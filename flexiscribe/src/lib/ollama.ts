/**
 * Ollama API integration for Gemma 3 4B
 */

const OLLAMA_BASE_URL = process.env.OLLAMA_BASE_URL || 'http://localhost:11434';

// ── Global model cache ──
// Memoize the resolved model for 60 s so concurrent / back-to-back
// generations don't each fire a /api/tags request.
let _cachedModel: string | null = null;
let _cachedModelTs = 0;
const MODEL_CACHE_TTL_MS = 60_000; // 1 minute

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Fisher-Yates shuffle algorithm for randomizing array order
 * Used to randomize MCQ answer positions
 */
function shuffleArray<T>(array: T[]): T[] {
  const shuffled = [...array]; // Create a copy to avoid mutating original
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

/**
 * Normalize text for comparison (lowercase, trim, remove extra spaces)
 */
function normalizeText(text: string): string {
  return text.toLowerCase().trim().replace(/\s+/g, ' ');
}

/**
 * Check if two questions are semantically similar (for deduplication).
 * Uses a 3-tier strategy: exact match → substring → keyword-set overlap.
 * The keyword tier catches paraphrased duplicates like
 * "What is AI?" ≈ "What does AI aim to achieve?"
 */
function areQuestionsSimilar(q1: string, q2: string): boolean {
  const norm1 = normalizeText(q1);
  const norm2 = normalizeText(q2);
  
  // Tier 1: Exact match after normalization
  if (norm1 === norm2) return true;
  
  // Tier 2: Substring containment (for substantial questions)
  const minLength = Math.min(norm1.length, norm2.length);
  if (minLength > 20) {
    if (norm1.includes(norm2) || norm2.includes(norm1)) return true;
  }
  
  // Tier 3: Keyword-set overlap — catches semantic duplicates.
  // Extract significant words (>3 chars), ignoring common question words.
  const stopWords = new Set(['what', 'which', 'does', 'that', 'this', 'with', 'from',
    'most', 'following', 'primarily', 'describe', 'describes', 'between',
    'about', 'into', 'their', 'these', 'those', 'have', 'been', 'being',
    'would', 'could', 'should', 'will', 'your', 'they', 'them', 'than',
    'other', 'each', 'also', 'more', 'some', 'when', 'where', 'used']);
  const extractKeywords = (text: string): Set<string> => {
    return new Set(
      text.split(/\s+/)
        .filter(w => w.length > 3 && !stopWords.has(w))
    );
  };
  const kw1 = extractKeywords(norm1);
  const kw2 = extractKeywords(norm2);
  if (kw1.size >= 2 && kw2.size >= 2) {
    const intersection = [...kw1].filter(w => kw2.has(w)).length;
    const smaller = Math.min(kw1.size, kw2.size);
    // If ≥60% of the smaller keyword set appears in the other, it's a duplicate
    if (intersection / smaller >= 0.6) return true;
  }
  
  return false;
}

// ============================================================================
// SUMMARY CLEANING
// ============================================================================

/**
 * Clean a summary for quiz generation by removing greetings, conversational
 * fillers, and meta-comments that would pollute fill-in-blank sentences.
 * Applied before passing the summary to the generation pipeline.
 */
export function cleanSummaryForQuiz(raw: string): string {
  const lines = raw.split('\n');
  const cleaned = lines.map(line => {
    // Strip leading greetings / conversational openers from every line
    return line
      .replace(/^\s*(good\s+(morning|afternoon|evening|day)[!.,;:]*\s*)/i, '')
      .replace(/^\s*(hello[!.,;:]*\s*)/i, '')
      .replace(/^\s*(hi[!.,;:]*\s+)/i, '')
      .replace(/^\s*(welcome[!.,;:]*\s*)/i, '')
      .replace(/^\s*(dangal\s+greetings[!.,;:]*\s*)/i, '')
      .replace(/^\s*(alright[!.,;:]*\s*)/i, '')
      .replace(/^\s*(okay[!.,;:]*\s*)/i, '')
      .replace(/^\s*(so[!.,;:]+\s*)/i, '')
      .replace(/^\s*(now[!.,;:]+\s*)/i, '')
      .replace(/^\s*(let'?s\s+(start|begin|look|move|go|continue)[^.]*\.\s*)/i, '')
      .replace(/^\s*(students?[!.,;:]*\s*)/i, '');
  }).filter(line => {
    const trimmed = line.trim();
    // Remove entirely empty lines that result from stripping
    if (trimmed.length === 0) return false;
    // Remove lines that are ONLY greetings / filler with no technical content
    if (/^(good\s+(morning|afternoon|evening|day)|hello|hi|welcome|alright|okay|dangal\s+greetings)[!.,;:]*$/i.test(trimmed)) return false;
    return true;
  });
  return cleaned.join('\n');
}

// ============================================================================
// KEY-CONCEPT EXPANSION
// ============================================================================

/**
 * Expand key concepts by extracting variant / more-specific terms from the
 * summary text.  For example, if "JOIN Operation" is a key concept and the
 * summary mentions "INNER JOIN", "LEFT JOIN", etc., those are added as
 * additional concepts so the deterministic FIB generator can create items
 * for them (with correct, verbatim answers).
 *
 * Also prevents false-positive matches where a broad term like "Relational
 * Database" could match inside the negative form "non-relational database".
 */
export function expandKeyConcepts(
  keyConcepts: { term: string; definition: string }[],
  summary: string
): { term: string; definition: string }[] {
  const expanded = [...keyConcepts];
  const seen = new Set(keyConcepts.map(k => normalizeText(k.term)));

  // ── Extract full phrases from parenthesized acronym terms ──
  // Terms like "UDP (User Datagram Protocol)" contain the full expansion
  // inside parentheses. Add that expansion as an explicit variant so the
  // deterministic generator can blank the *complete* phrase, not a fragment
  // like "User Datagram".
  for (const concept of keyConcepts) {
    const parenMatch = concept.term.match(/\(([^)]+)\)/);
    if (parenMatch) {
      const fullPhrase = parenMatch[1].trim();
      const normFull = normalizeText(fullPhrase);
      // Only add if it's a multi-word phrase (single words inside parens
      // are usually abbreviations like "(ACLs)", not useful as answers).
      if (!seen.has(normFull) && fullPhrase.split(/\s+/).length >= 2) {
        seen.add(normFull);
        expanded.push({ term: fullPhrase, definition: concept.definition });
      }
    }
    // Also add the part *before* the parentheses if it differs from the
    // original term.  e.g. "TCP (Transmission Control Protocol)" → "TCP".
    const beforeParen = concept.term.replace(/\s*\([^)]*\)\s*/g, '').trim();
    if (beforeParen.length >= 2) {
      const normBefore = normalizeText(beforeParen);
      if (!seen.has(normBefore)) {
        seen.add(normBefore);
        expanded.push({ term: beforeParen, definition: concept.definition });
      }
    }
  }

  // Words that must NOT appear at the first or last position of a variant.
  // Covers articles, conjunctions, prepositions, pronouns, auxiliaries,
  // be-verbs, question words, and common verbs whose 3rd-person form
  // appears at sentence boundaries ("Triad provides", "encryption uses").
  const edgeJunk = new Set([
    // articles / conjunctions / prepositions
    'a', 'an', 'the', 'and', 'or', 'but', 'nor', 'yet', 'so', 'for',
    'to', 'of', 'in', 'on', 'at', 'by', 'with', 'from', 'into', 'onto',
    'upon', 'as', 'if', 'than', 'then', 'not', 'also', 'just', 'only',
    // pronouns / determiners
    'it', 'its', 'this', 'that', 'there', 'here',
    'he', 'she', 'we', 'they', 'me', 'him', 'her', 'us', 'them',
    'my', 'your', 'his', 'our', 'their', 'these', 'those',
    // be-verbs & auxiliaries
    'is', 'are', 'was', 'were', 'be', 'been', 'being',
    'has', 'have', 'had', 'having',
    'do', 'does', 'did',
    'will', 'would', 'could', 'should', 'can', 'may', 'might', 'shall', 'must',
    // question / relative words
    'where', 'when', 'which', 'who', 'what', 'how', 'why',
    // common verbs (base + 3rd-person) that create sentence fragments
    'use', 'uses', 'provide', 'provides', 'combine', 'combines',
    'include', 'includes', 'involve', 'involves', 'require', 'requires',
    'offer', 'offers', 'allow', 'allows', 'ensure', 'ensures',
    'enable', 'enables', 'create', 'creates', 'prevent', 'prevents',
    'protect', 'protects', 'detect', 'detects', 'handle', 'handles',
    'manage', 'manages', 'define', 'defines', 'contain', 'contains',
    'represent', 'represents', 'describe', 'describes',
    // numbers & ordinals — produce fragments like "TCP three" from
    // "TCP three-way handshake"; the full compound is captured separately.
    'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight',
    'nine', 'ten', 'first', 'second', 'third', 'fourth', 'fifth',
    'single', 'double', 'triple', 'multiple', 'many', 'several',
  ]);

  // Collect the set of words that appear inside original key concept terms
  // so we can whitelist -ing / -ly words that are part of known concepts
  // (e.g. "Processing" in "Natural Language Processing").
  const keyConceptWordSet = new Set<string>();
  for (const k of keyConcepts) {
    for (const w of k.term.split(/\s+/)) {
      keyConceptWordSet.add(w.toLowerCase().replace(/[^a-z]/g, ''));
    }
  }

  for (const concept of keyConcepts) {
    const coreWords = concept.term
      .split(/\s+/)
      .filter(w => w.length >= 3);

    if (coreWords.length === 0) continue;

    for (const core of coreWords) {
      const esc = escapeRegex(core);
      // 2-word and 3-word phrases that include the core word
      const patterns = [
        new RegExp(`\\b(\\w+\\s+${esc})\\b`, 'gi'),         // X core
        new RegExp(`\\b(${esc}\\s+\\w+)\\b`, 'gi'),         // core X
        new RegExp(`\\b(\\w+\\s+${esc}\\s+\\w+)\\b`, 'gi'), // X core Y
      ];

      // ── Hyphenated-compound patterns ──
      // \w in the basic patterns doesn't cross hyphens, so "TCP three-way
      // handshake" is never captured as one phrase. These extra patterns
      // look for phrases where the core word is followed (or preceded) by
      // a hyphenated compound, e.g. "three-way handshake", "man-in-the-
      // middle attack".
      const hyphPatterns = [
        // core + hyphenated-word + word:  "TCP three-way handshake"
        new RegExp(`\\b(${esc}\\s+\\w+-\\w+\\s+\\w+)\\b`, 'gi'),
        // word + hyphenated-word + core:  "man-in-the-middle attack"
        new RegExp(`\\b(\\w+-\\w+(?:-\\w+)*\\s+${esc})\\b`, 'gi'),
        // core + hyphenated-word:  "three-way"
        new RegExp(`\\b(${esc}\\s+\\w+-\\w+(?:-\\w+)*)\\b`, 'gi'),
        // hyphenated-word + core:  "cross-site scripting"
        new RegExp(`\\b(\\w+-\\w+(?:-\\w+)*\\s+${esc})\\b`, 'gi'),
      ];

      const allPatterns = [...patterns, ...hyphPatterns];

      for (const pat of allPatterns) {
        let m: RegExpExecArray | null;
        while ((m = pat.exec(summary)) !== null) {
          const variant = m[1].trim();
          const normV = normalizeText(variant);
          if (seen.has(normV)) continue;
          if (variant.length < 4) continue;

          // Reject variants with unbalanced parentheses (e.g. "NAT (Network")
          const openParen = (variant.match(/\(/g) || []).length;
          const closeParen = (variant.match(/\)/g) || []).length;
          if (openParen !== closeParen) continue;

          // Reject variants starting/ending with non-word punctuation
          if (/^[^\w]/.test(variant)) continue;
          if (/[^\w.)!?]$/.test(variant)) continue;

          // Skip negated forms (e.g. "non-relational" when term is "Relational")
          if (/\bnon[-\s]?\w/i.test(variant) && !/\bnon[-\s]?\w/i.test(concept.term)) continue;

          // ── Edge-word filter ──
          // Split on whitespace (keep hyphenated parts together as one word)
          const words = variant.split(/\s+/);
          const firstWord = words[0].toLowerCase().replace(/[^a-z-]/g, '');
          const lastWord = words[words.length - 1].toLowerCase().replace(/[^a-z-]/g, '');
          // For edge-junk check, strip hyphens so "three-way" checks "threeway"
          // but also check each sub-part of hyphenated words.
          const firstBase = firstWord.replace(/-/g, '');
          const lastBase = lastWord.replace(/-/g, '');
          const firstParts = firstWord.split('-');
          const lastParts = lastWord.split('-');
          if (edgeJunk.has(firstBase) || edgeJunk.has(lastBase)) continue;
          // Check individual parts of hyphenated words at edges
          if (firstParts.length === 1 && edgeJunk.has(firstParts[0])) continue;
          if (lastParts.length === 1 && edgeJunk.has(lastParts[0])) continue;

          // Reject trailing adverbs (-ly, length > 3)
          if (lastBase.length > 3 && lastBase.endsWith('ly')) continue;

          // Reject leading gerunds/verbs (-ing) unless the word is part of
          // an original key concept (e.g. "Processing" in "Data Processing").
          if (firstBase.endsWith('ing') && firstBase.length > 4 && !keyConceptWordSet.has(firstBase)) continue;

          // Reject trailing -ing words that are not known concept words
          if (lastBase.endsWith('ing') && lastBase.length > 4 && !keyConceptWordSet.has(lastBase)) continue;

          seen.add(normV);
          expanded.push({ term: variant, definition: concept.definition });
        }
      }
    }
  }

  console.log(`expandKeyConcepts: ${keyConcepts.length} → ${expanded.length} concepts (${expanded.length - keyConcepts.length} variants added).`);
  return expanded;
}

// ============================================================================
// SENTENCE EXTRACTION & DETERMINISTIC FILL-IN-BLANK
// ============================================================================

/**
 * Split text into individual sentences.
 * Uses a regex that splits on sentence-ending punctuation (. ! ?) followed
 * by whitespace or end-of-string. Handles common abbreviations and decimals
 * by requiring the period to follow a lowercase/uppercase letter or closing
 * quote, not a single uppercase initial like "Dr." etc.
 */
function splitIntoSentences(text: string): string[] {
  // Replace newlines with spaces for uniform splitting, then split.
  const normalized = text.replace(/\n+/g, ' ').replace(/\s+/g, ' ').trim();
  // Split on . ! ? followed by a space and an uppercase letter, or end-of-string.
  // This avoids splitting on abbreviations like "e.g." or "Dr." in most cases.
  const raw = normalized.split(/(?<=[.!?])\s+(?=[A-Z"])|(?<=[.!?])\s*$/);
  return raw
    .map(s => s.trim())
    .filter(s => s.length > 15); // Drop fragments shorter than 15 chars
}

/**
 * Build a map from key-concept term → list of sentences that contain that
 * term verbatim (case-insensitive, whole-word match).
 */
function mapKeyTermsToSentences(
  sentences: string[],
  keyConcepts: { term: string; definition?: string }[]
): Map<string, string[]> {
  const termMap = new Map<string, string[]>();
  for (const concept of keyConcepts) {
    const term = concept.term.trim();
    if (!term || term.length < 2) continue;
    const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    // Use word-boundary for single words; for multi-word, require the full
    // phrase to appear (word boundaries at the edges only).
    const regex = new RegExp(`\\b${escaped}\\b`, 'i');
    const matching: string[] = [];
    for (const sentence of sentences) {
      if (regex.test(sentence)) {
        matching.push(sentence);
      }
    }
    if (matching.length > 0) {
      termMap.set(term, matching);
    }
  }
  return termMap;
}

/**
 * Deterministic fill-in-blank generator.
 *
 * Instead of asking the LLM to both select a sentence and blank a term
 * (which causes rampant paraphrasing and "answer not found" failures),
 * this function:
 *   1. Splits the summary into sentences.
 *   2. Maps each key concept to sentences that contain it verbatim.
 *   3. For each candidate, replaces the key term with [blank].
 *   4. Picks 3 distractors from the remaining key concepts.
 *
 * This guarantees:
 * - The sentence is verbatim from the summary (no hallucination).
 * - The answer is actually present in the sentence.
 * - Distractors are always relevant key concepts.
 * - Zero API calls → instant generation, 100% yield.
 *
 * Falls back to null if insufficient sentences contain key terms,
 * letting the caller use the wave-based LLM pipeline instead.
 */
function generateDeterministicFIB(
  summary: string,
  keyConcepts: { term: string; definition?: string }[],
  count: number,
  difficulty: 'EASY' | 'MEDIUM' | 'HARD'
): any[] | null {
  const sentences = splitIntoSentences(summary);
  const termMap = mapKeyTermsToSentences(sentences, keyConcepts);

  if (termMap.size === 0) {
    console.warn('Deterministic FIB: no sentences found containing any key concept — falling back to LLM.');
    return null;
  }

  // Build flat list of candidates: { term, sentence }
  const candidates: { term: string; sentence: string }[] = [];
  for (const [term, sentenceList] of termMap.entries()) {
    for (const sentence of sentenceList) {
      candidates.push({ term, sentence });
    }
  }

  // Shuffle for variety, then sort by term length descending so that
  // longer (more complete) phrases are tried first.  For EASY difficulty,
  // sort *ascending* so shorter / single-word terms are preferred.
  let sorted = shuffleArray(candidates);
  if (difficulty === 'EASY') {
    sorted.sort((a, b) => a.term.length - b.term.length);
  } else {
    sorted.sort((a, b) => b.term.length - a.term.length);
  }
  const shuffled = sorted;

  // Greeting / off-topic patterns to skip
  const greetingPatterns = [
    /^good\s+(morning|afternoon|evening|day)\b/i,
    /^hello\b/i, /^hi\b/i, /^welcome\b/i,
    /\bthank\s+you\b/i, /\bas\s+an\s+ai\b/i,
  ];

  const allTerms = keyConcepts.map(k => k.term);
  const usedSentences = new Set<string>();
  const usedTerms = new Set<string>(); // prefer one sentence per term
  const result: any[] = [];

  // PASS 1: one sentence per term (maximizes concept diversity)
  for (const c of shuffled) {
    if (result.length >= count) break;
    if (usedTerms.has(c.term)) continue;
    if (usedSentences.has(c.sentence)) continue;
    // Skip greeting sentences
    if (greetingPatterns.some(p => p.test(c.sentence))) continue;
    // ── Bloom's taxonomy difficulty filter ──
    // EASY  → single-word or short terms (recall)
    // MEDIUM → any term length (understanding)
    // HARD  → multi-word terms and longer, complex sentences (application)
    const termWordCount = c.term.split(/\s+/).length;
    if (difficulty === 'EASY' && termWordCount > 1) continue;
    if (difficulty === 'HARD' && termWordCount === 1 && c.term.length < 5) continue;
    if (difficulty === 'HARD' && c.sentence.length < 60) continue;

    const item = buildFIBItem(c.term, c.sentence, allTerms, summary);
    if (!item) continue;

    result.push(item);
    usedSentences.add(c.sentence);
    usedTerms.add(c.term);
  }

  // PASS 2: if still under count, allow reusing terms (different sentences)
  // Still apply relaxed difficulty filters to maintain differentiation.
  if (result.length < count) {
    for (const c of shuffled) {
      if (result.length >= count) break;
      if (usedSentences.has(c.sentence)) continue;
      if (greetingPatterns.some(p => p.test(c.sentence))) continue;
      // Relaxed difficulty filter — only exclude the worst mismatches
      const termWordCount2 = c.term.split(/\s+/).length;
      if (difficulty === 'EASY' && termWordCount2 > 2) continue;
      if (difficulty === 'HARD' && termWordCount2 === 1 && c.term.length < 4) continue;

      const item = buildFIBItem(c.term, c.sentence, allTerms, summary);
      if (!item) continue;

      result.push(item);
      usedSentences.add(c.sentence);
    }
  }

  // PASS 3: relax difficulty filters if still under count — any valid
  // term/sentence pair is better than falling back to the slower LLM loop.
  if (result.length < count) {
    for (const c of shuffled) {
      if (result.length >= count) break;
      if (usedSentences.has(c.sentence)) continue;
      if (greetingPatterns.some(p => p.test(c.sentence))) continue;
      // No difficulty filter — accept any term/sentence pair

      const item = buildFIBItem(c.term, c.sentence, allTerms, summary);
      if (!item) continue;

      result.push(item);
      usedSentences.add(c.sentence);
    }
  }

  if (result.length === 0) {
    console.warn('Deterministic FIB: could not build any valid items — falling back to LLM.');
    return null;
  }

  console.log(`Deterministic FIB: produced ${result.length}/${count} items (${termMap.size} key terms matched across ${sentences.length} sentences).`);
  return result;
}

// ============================================================================
// DETERMINISTIC EASY MCQ GENERATOR
// ============================================================================

/**
 * Deterministic Easy MCQ generator.
 *
 * For each key concept, creates a definition-recall question:
 *   "What is [term]?"
 * Correct answer = the definition of the term.
 * Distractors = definitions of 3 other key concepts.
 * Choices are full definitions — this tests whether the student can
 * identify the correct definition among plausible alternatives.
 *
 * Why this works:
 * - No LLM involved → 100% yield, instant, zero JSON parse errors.
 * - Each question is a valid Bloom's Level 1 (recall) item.
 * - Distractors are real definitions from the same domain → plausible.
 * - Scales with content: N key concepts with definitions → up to N items.
 *
 * Falls back to null if fewer than 4 key concepts have definitions.
 */
function generateDeterministicMCQ_Easy(
  keyConcepts: { term: string; definition: string }[],
  count: number
): any[] | null {
  // Filter to concepts that actually have non-empty definitions
  const validConcepts = keyConcepts.filter(k => k.definition && k.definition.trim().length > 0);
  if (validConcepts.length < 4) {
    console.warn(`Deterministic MCQ Easy: only ${validConcepts.length} concepts have definitions (need ≥4) — falling back to LLM.`);
    return null;
  }

  const shuffledConcepts = shuffleArray([...validConcepts]);
  const result: any[] = [];

  for (const concept of shuffledConcepts) {
    if (result.length >= count) break;

    const correctTerm = concept.term;
    const correctDef = concept.definition.trim();

    // Pick 3 distractor definitions from other concepts
    const otherConcepts = validConcepts.filter(k => k.term !== correctTerm);
    if (otherConcepts.length < 3) continue; // safety

    const distractorConcepts = shuffleArray(otherConcepts).slice(0, 3);
    const distractorDefs = distractorConcepts.map(k => k.definition.trim());

    // Choices: correct definition + 3 distractor definitions, shuffled
    const allChoices = [correctDef, ...distractorDefs];
    // Safety: ensure all 4 choices are unique (expanded variants can share
    // the same definition, causing duplicate options)
    const uniqueChoices = [...new Set(allChoices)];
    if (uniqueChoices.length < 4) {
      // Not enough unique definitions — skip this concept
      continue;
    }
    const choices = shuffleArray(uniqueChoices);
    const answerIndex = choices.indexOf(correctDef);

    const explanation = `The correct answer is '${correctDef}' because that is the definition of ${correctTerm}.`;

    result.push({
      question: `What is ${correctTerm}?`,
      choices,
      answerIndex,
      explanation,
    });
  }

  if (result.length === 0) {
    console.warn('Deterministic MCQ Easy: could not build any valid items — falling back to LLM.');
    return null;
  }

  console.log(`Deterministic MCQ Easy: produced ${result.length}/${count} items (${validConcepts.length} concepts with definitions).`);
  return result;
}

/**
 * Build a single fill-in-blank item by replacing `term` with [blank] in
 * `sentence` and picking 3 distractors from `allTerms`.
 *
 * Guards against false-positive matches:
 *  - Rejects matches inside hyphenated compound words (e.g. "non-relational"
 *    matching "Relational").
 *  - Reconstruction verification: replacing [blank] back with the term must
 *    reproduce the original sentence (catches partial / wrong-context matches).
 *
 * Returns null if replacement fails, not enough distractors, or guards trip.
 */
function buildFIBItem(
  term: string,
  sentence: string,
  allTerms: string[],
  originalSummary?: string
): { sentence: string; answer: string; distractors: string[] } | null {
  const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const regex = new RegExp(`\\b${escaped}\\b`, 'i');
  const matchResult = regex.exec(sentence);
  if (!matchResult) return null;

  // ── Hyphen-boundary guard ──
  // \b treats hyphens as non-word characters, so `\bRelational\b` matches
  // inside "non-relational". Reject if the character immediately before or
  // after the match is a hyphen — the term is part of a compound word.
  const matchIndex = matchResult.index;
  const matchEnd = matchIndex + matchResult[0].length;
  if (matchIndex > 0 && sentence[matchIndex - 1] === '-') {
    console.warn(`buildFIBItem: "${term}" rejected — preceded by hyphen at pos ${matchIndex}`);
    return null;
  }
  if (matchEnd < sentence.length && sentence[matchEnd] === '-') {
    console.warn(`buildFIBItem: "${term}" rejected — followed by hyphen at pos ${matchEnd}`);
    return null;
  }

  const blanked = sentence.replace(regex, '[blank]');
  // Safety: make sure a [blank] was actually inserted
  if (!blanked.includes('[blank]')) return null;

  // ── Reconstruction verification ──
  // Replacing [blank] with the answer must reproduce a sentence that exists
  // in the original summary. Catches edge cases where the regex matched a
  // substring that doesn't correspond to the intended term in context.
  if (originalSummary) {
    const reconstructed = normalizeText(blanked.replace('[blank]', term));
    const normSummary = normalizeText(originalSummary);
    if (!normSummary.includes(reconstructed)) {
      console.warn(`buildFIBItem: reconstruction failed for "${term}" — sentence not found in summary`);
      return null;
    }
  }

  // Pick 3 distractors from other key terms
  const normTerm = term.toLowerCase();
  const otherTerms = allTerms.filter(t => t.toLowerCase() !== normTerm);
  if (otherTerms.length < 3) return null; // not enough distractors

  const shuffledOthers = shuffleArray(otherTerms);
  const distractors = shuffledOthers.slice(0, 3);

  return {
    sentence: blanked,
    answer: term,
    distractors,
  };
}

/**
 * Escape special regex characters in a string
 */
function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Attempt to salvage complete JSON items from a truncated API response.
 * When num_predict cuts the output mid-JSON, the last item is incomplete
 * but earlier items may be perfectly valid. This function extracts them
 * using brace-counting with string awareness.
 */
function salvageTruncatedJson(raw: string): { items: any[] } | null {
  const match = raw.match(/"items"\s*:\s*\[/);
  if (!match || match.index === undefined) return null;

  const arrayContentStart = match.index + match[0].length;
  const content = raw.substring(arrayContentStart);

  const items: any[] = [];
  let depth = 0;
  let objStart = -1;
  let inString = false;
  let escaped = false;

  for (let i = 0; i < content.length; i++) {
    const ch = content[i];

    if (escaped) { escaped = false; continue; }
    if (ch === '\\' && inString) { escaped = true; continue; }
    if (ch === '"') { inString = !inString; continue; }
    if (inString) continue;

    if (ch === '{') {
      if (depth === 0) objStart = i;
      depth++;
    } else if (ch === '}') {
      depth--;
      if (depth === 0 && objStart >= 0) {
        const objStr = content.substring(objStart, i + 1);
        try {
          items.push(JSON.parse(objStr));
        } catch {
          // Skip malformed objects
        }
        objStart = -1;
      }
    }
  }

  if (items.length > 0) {
    console.log(`🔧 Salvaged ${items.length} complete item(s) from truncated JSON`);
    return { items };
  }
  return null;
}

/**
 * Extract leading sentence of each paragraph as a concept-seed list.
 * Used to prepend topical anchors to summary slices for long summaries.
 */
function extractConceptSeeds(summary: string, maxSeeds: number = 6): string {
  const paragraphs = summary.split(/\n\s*\n/).filter(p => p.trim().length > 0);
  const seeds: string[] = [];
  for (const para of paragraphs) {
    const firstSentence = para.trim().match(/^[^.!?]*[.!?]/);
    if (firstSentence && firstSentence[0].length > 15) {
      seeds.push(firstSentence[0].trim());
    }
    if (seeds.length >= maxSeeds) break;
  }
  return seeds.length > 0 ? `Key concepts: ${seeds.join(' ')}\n\n` : '';
}

/**
 * Get a rotating slice of the summary for each batch.
 * Uses sentence-boundary alignment to avoid cutting mid-sentence,
 * which prevents the model from hallucinating to complete truncated text.
 *
 * windowSize increased from 900→1100 to give the model more context per call,
 * reducing the total number of calls needed for long summaries.
 */
function getSummarySlice(
  summary: string,
  batchIndex: number,
  windowSize: number = 1100,
  overlap: number = 150
): string {
  // If summary fits in one window, return it whole — no slicing needed
  if (summary.length <= windowSize) {
    return summary;
  }

  // For very long summaries (>3x window), prepend concept seeds so each
  // slice still has topical anchors even when it covers only a small portion.
  const conceptPrefix = summary.length > windowSize * 3
    ? extractConceptSeeds(summary)
    : '';

  const step = windowSize - overlap;
  let start = (batchIndex * step) % Math.max(summary.length - windowSize, 1);
  let end = Math.min(start + windowSize, summary.length);

  // Snap `start` forward to the next sentence boundary (after . or \n)
  if (start > 0) {
    const boundaryMatch = summary.slice(start).match(/^[^.\n]*[.\n]\s*/);
    if (boundaryMatch) {
      start += boundaryMatch[0].length;
    }
  }

  // Snap `end` forward to include the full sentence (up to next . or \n)
  if (end < summary.length) {
    const tailMatch = summary.slice(end).match(/^[^.\n]*[.\n]/);
    if (tailMatch) {
      end += tailMatch[0].length;
    }
  }

  // If we've wrapped around and the slice is too small, start from beginning
  if (end - start < windowSize / 2) {
    return conceptPrefix + summary.slice(0, windowSize);
  }

  return conceptPrefix + summary.slice(start, end);
}

// ============================================================================
// VALIDATION FUNCTIONS
// ============================================================================

/**
 * Check for placeholder patterns in MCQ choices
 */
function hasPlaceholderText(choice: string): boolean {
  const placeholderPatterns = [
    /option [a-d]/i,
    /wrong answer/i,
    /correct answer/i,
    /plausible/i,
    /choice [1-4]/i,
    /^[a-d]$/i
  ];
  return placeholderPatterns.some(pattern => pattern.test(choice));
}

/**
 * Validate and fix a single MCQ item
 * Returns object with { valid: boolean, item: any, rejectionReason?: string }
 */
function validateMCQItem(item: any, difficulty: string = 'MEDIUM', keyConcepts: { term: string; definition: string }[] = [], summary: string = ''): { valid: boolean; item: any; rejectionReason?: string } {
  // Check choices array
  if (!item.choices || item.choices.length !== 4) {
    return { 
      valid: false, 
      item, 
      rejectionReason: `Invalid choices array (length: ${item.choices?.length}, expected: 4)` 
    };
  }
  
  // Check for placeholder text
  for (const choice of item.choices) {
    if (hasPlaceholderText(choice)) {
      return { 
        valid: false, 
        item, 
        rejectionReason: `Placeholder text detected in choice: "${choice}"` 
      };
    }
  }

  // Minimum choice length — reject garbage like "a", "B", "–"
  for (const choice of item.choices) {
    if (typeof choice !== 'string' || choice.trim().length < 3) {
      return {
        valid: false,
        item,
        rejectionReason: `Choice too short (${choice?.length ?? 0} chars): "${choice}"`
      };
    }
  }

  // Duplicate-choices guard — all 4 must be unique after normalization.
  // If duplicates exist, indexOf after shuffle will point to the wrong answer.
  const normalizedChoices = item.choices.map((c: string) => normalizeText(c));
  const uniqueChoices = new Set(normalizedChoices);
  if (uniqueChoices.size < 4) {
    return {
      valid: false,
      item,
      rejectionReason: `Duplicate choices detected (${uniqueChoices.size} unique out of 4)`
    };
  }

  // Check that no two choices are near-duplicates using word-set overlap.
  // Previous substring check was too aggressive (e.g. "encapsulation" ⊂ "encapsulation in OOP").
  // Now we use significant-word overlap: reject only when ≥80% of the shorter
  // choice's words (length > 3) appear in the longer one.
  for (let i = 0; i < normalizedChoices.length; i++) {
    for (let j = i + 1; j < normalizedChoices.length; j++) {
      const wordsA = new Set(normalizedChoices[i].split(/\s+/).filter((w: string) => w.length > 3));
      const wordsB = new Set(normalizedChoices[j].split(/\s+/).filter((w: string) => w.length > 3));
      if (wordsA.size > 0 && wordsB.size > 0) {
        const intersection = [...wordsA].filter(w => wordsB.has(w)).length;
        const overlapRatio = intersection / Math.min(wordsA.size, wordsB.size);
        if (overlapRatio > 0.8) {
          return {
            valid: false,
            item,
            rejectionReason: `Near-duplicate choices (${Math.round(overlapRatio * 100)}% word overlap): "${item.choices[i]}" vs "${item.choices[j]}"`
          };
        }
      }
    }
  }
  
  // Validate answerIndex
  if (typeof item.answerIndex !== 'number' || item.answerIndex < 0 || item.answerIndex > 3) {
    return { 
      valid: false, 
      item, 
      rejectionReason: `Invalid answerIndex: ${item.answerIndex} (must be 0-3)` 
    };
  }
  
  // Validate explanation exists
  if (!item.explanation || item.explanation.trim().length < 10) {
    return { 
      valid: false, 
      item, 
      rejectionReason: 'Missing or insufficient explanation (min 10 characters)' 
    };
  }

  // ── answerIndex auto-correction from explanation ──
  // The model frequently mis-keys answerIndex. Extract the quoted answer from
  // the explanation ("The correct answer is '[text]' because ...") and if it
  // matches a DIFFERENT choice, override answerIndex to point to that choice.
  // This eliminates the largest category of mis-graded items.
  if (item.explanation) {
    const explanationAnswerMatch = item.explanation.match(
      /correct answer is ['"]([^'"]+)['"]/i
    );
    if (explanationAnswerMatch) {
      const extractedAnswer = normalizeText(explanationAnswerMatch[1]);
      const matchIdx = item.choices.findIndex(
        (c: string) => normalizeText(c) === extractedAnswer
      );
      if (matchIdx >= 0 && matchIdx !== item.answerIndex) {
        console.log(
          `🔧 Auto-fixed answerIndex: ${item.answerIndex} → ${matchIdx} ` +
          `(extracted "${explanationAnswerMatch[1]}" from explanation)`
        );
        item.answerIndex = matchIdx;
      }
    }
  }

  // ── Reject "term echo" items ──
  // If the question asks "What is X?" and the answer is just "X" (the same
  // term restated), the item teaches nothing. Reject it.
  // Uses FULL PHRASE match to avoid false positives where individual answer
  // words each appear in the question but the answer itself is different.
  if (item.question) {
    const qNorm = normalizeText(item.question);
    const aNorm = normalizeText(item.choices[item.answerIndex]);
    // Only reject when the COMPLETE answer phrase appears in the question.
    // Individual word checks caused too many false positives (e.g. "training"
    // matching "trained", or common domain words appearing in both).
    if (aNorm.split(/\s+/).length <= 3 && aNorm.length >= 4) {
      if (qNorm.includes(aNorm)) {
        return {
          valid: false,
          item,
          rejectionReason: `Answer "${item.choices[item.answerIndex]}" is just the question topic restated — not a real answer`
        };
      }
    }
  }
  
  // CRITICAL FIX: Randomize the position of the correct answer
  // This prevents "B is always correct" problem
  const correctChoice = item.choices[item.answerIndex];
  const shuffledChoices = shuffleArray(item.choices);
  const newAnswerIndex = shuffledChoices.indexOf(correctChoice);
  
  const fixedItem = {
    ...item,
    choices: shuffledChoices,
    answerIndex: newAnswerIndex
  };

  // Explanation-answer alignment check — difficulty-aware.
  // EASY: accept if the answer appears as a substring in the explanation (the model
  //       is instructed to quote the answer, so substring is a reliable signal).
  //       Fall back to 30% word overlap for single-word answers.
  // MEDIUM/HARD: require ≥50% word overlap (paraphrasing is expected at higher levels).
  if (fixedItem.explanation && fixedItem.choices[fixedItem.answerIndex]) {
    const correctText = normalizeText(fixedItem.choices[fixedItem.answerIndex]);
    const explanationText = normalizeText(fixedItem.explanation);

    // Substring fallback — if the exact answer phrase appears, it's clearly aligned
    const substringMatch = explanationText.includes(correctText);

    if (!substringMatch) {
      // For EASY: skip strict alignment check. EASY questions are simple recall —
      // if choices and answerIndex are valid, a slightly off explanation is acceptable.
      // This prevents rejecting otherwise-correct items when the model paraphrases.
      if (difficulty !== 'EASY') {
        // Word-overlap check for MEDIUM/HARD
        const correctWords = correctText.split(/\s+/).filter(w => w.length > 3);
        if (correctWords.length >= 2) {
          const explanationWordSet = new Set(explanationText.split(/\s+/));
          const hits = correctWords.filter(w => explanationWordSet.has(w)).length;
          const overlapRatio = hits / correctWords.length;
          const threshold = 0.5;
          if (overlapRatio < threshold) {
            return {
              valid: false,
              item: fixedItem,
              rejectionReason: `Explanation does not reference correct answer (word overlap ${Math.round(overlapRatio * 100)}% < ${Math.round(threshold * 100)}%)`
            };
          }
        }
      }
    }
  }

  // ── MCQ choice relevance check ──
  // When keyConcepts are available, verify that distractors are topically related
  // to the source material. Uses a 3-tier approach:
  //   Tier 1: Exact key concept match or substring containment
  //   Tier 2: Verbatim in the summary
  //   Tier 3: Word-overlap ≥40% with source material (summary + key concept defs)
  // This prevents hallucinated distractors while accepting reasonable model-generated
  // phrases that are grounded in the source content.
  if (keyConcepts.length > 0 && summary.length > 0) {
    const conceptTerms = new Set(keyConcepts.map(k => normalizeText(k.term)));
    const allConceptText = keyConcepts.map(k => normalizeText(k.term) + ' ' + normalizeText(k.definition || '')).join(' ');
    const normSummary = normalizeText(summary);
    // Build a set of all significant words from the source material for word-overlap check
    const sourceWords = new Set(
      [...normSummary.split(/\s+/), ...allConceptText.split(/\s+/)].filter(w => w.length > 3)
    );

    for (let ci = 0; ci < fixedItem.choices.length; ci++) {
      if (ci === fixedItem.answerIndex) continue; // Skip correct answer
      const choiceNorm = normalizeText(fixedItem.choices[ci]);

      // Tier 1: Exact key concept match or substring containment (strongest signal)
      const isKeyConcept = conceptTerms.has(choiceNorm) ||
        [...conceptTerms].some(ct => ct.includes(choiceNorm) || choiceNorm.includes(ct));
      if (isKeyConcept) continue;

      // Tier 2: Found verbatim in the summary
      const inSummary = normSummary.includes(choiceNorm);
      if (inSummary) continue;

      // Tier 3: Word-overlap — if ≥20% of the distractor's significant words
      // appear in the source material (summary + key concept definitions),
      // the distractor is topically grounded and acceptable.
      // Lowered from 40% after observing that even legitimate distractors like
      // "Optimizing model parameters" fail at 40% when only one word matches.
      const choiceWords = choiceNorm.split(/\s+/).filter(w => w.length > 3);
      if (choiceWords.length === 0) continue; // Very short choice — let it pass
      const hits = choiceWords.filter(w => sourceWords.has(w)).length;
      const overlapRatio = hits / choiceWords.length;
      if (overlapRatio >= 0.1) continue;

      // None of the tiers passed — reject this distractor
      return {
        valid: false,
        item: fixedItem,
        rejectionReason: `Distractor "${fixedItem.choices[ci]}" is not grounded in source material (word overlap: ${Math.round(overlapRatio * 100)}%)`
      };
    }
  }
  
  return { valid: true, item: fixedItem };
}

/**
 * Compute word-overlap ratio between two strings.
 * Returns a value between 0 and 1 representing the fraction
 * of answer words found in the sentence.
 */
function wordOverlapRatio(sentence: string, answer: string): number {
  const sentenceWords = new Set(normalizeText(sentence).split(/\s+/));
  const answerWords = normalizeText(answer).split(/\s+/);
  if (answerWords.length === 0) return 0;
  let hits = 0;
  for (const w of answerWords) {
    if (sentenceWords.has(w)) hits++;
  }
  return hits / answerWords.length;
}

/**
 * Find the best contiguous span in the sentence that matches the answer words.
 * Returns [startIndex, endIndex] in the original string, or null if no good match.
 * Uses a sliding window over sentence words and picks the window with the
 * highest overlap to the answer words.
 */
function findBestFuzzySpan(
  sentence: string,
  answer: string,
  threshold: number = 0.7
): { start: number; end: number } | null {
  const answerWords = normalizeText(answer).split(/\s+/);
  const windowSize = answerWords.length;
  if (windowSize === 0) return null;

  // Tokenize sentence, keeping track of character offsets
  const tokenRegex = /\S+/g;
  const tokens: { word: string; start: number; end: number }[] = [];
  let match;
  while ((match = tokenRegex.exec(sentence)) !== null) {
    tokens.push({
      word: match[0].toLowerCase().replace(/[^a-z0-9]/g, ''),
      start: match.index,
      end: match.index + match[0].length,
    });
  }

  const answerSet = new Set(answerWords.map(w => w.toLowerCase().replace(/[^a-z0-9]/g, '')));

  let bestOverlap = 0;
  let bestStart = -1;
  let bestEnd = -1;

  // Slide a window of size windowSize (±1) over the tokens
  for (let extra = 0; extra <= 1; extra++) {
    const ws = windowSize + extra;
    for (let i = 0; i <= tokens.length - ws; i++) {
      let hits = 0;
      for (let j = i; j < i + ws; j++) {
        if (answerSet.has(tokens[j].word)) hits++;
      }
      const overlap = hits / answerWords.length;
      if (overlap > bestOverlap) {
        bestOverlap = overlap;
        bestStart = tokens[i].start;
        bestEnd = tokens[i + ws - 1].end;
      }
    }
  }

  if (bestOverlap >= threshold && bestStart >= 0) {
    return { start: bestStart, end: bestEnd };
  }
  return null;
}

/**
 * Auto-fix fill-in-blank sentence to include [blank] marker.
 * Uses a 3-tier strategy: exact match → multi-word match → fuzzy match.
 * The fuzzy tier (Strategy 3) handles paraphrased sentences where the answer
 * words appear in a different order or with minor rewording.
 * Returns fixed sentence or null if unable to fix.
 */
function autoFixFillInBlank(sentence: string, answer: string): string | null {
  if (sentence.includes('[blank]')) {
    return sentence; // Already has blank marker
  }
  
  const trimmedAnswer = answer.trim();
  
  // Strategy 1: Exact case-insensitive match with word boundaries
  const exactRegex = new RegExp(`\\b${escapeRegex(trimmedAnswer)}\\b`, 'i');
  if (exactRegex.test(sentence)) {
    const fixed = sentence.replace(exactRegex, '[blank]');
    console.log(`Auto-fixed (exact): "${trimmedAnswer}" → [blank]`);
    return fixed;
  }
  
  // Strategy 2: Multi-word answer matching (strict word-by-word)
  const answerWords = trimmedAnswer.split(/\s+/);
  if (answerWords.length > 1) {
    const words = sentence.split(/\b/);
    
    for (let i = 0; i < words.length; i++) {
      if (normalizeText(words[i]) === normalizeText(answerWords[0])) {
        let matches = true;
        for (let j = 1; j < answerWords.length; j++) {
          const wordIndex = i + j * 2;
          if (wordIndex >= words.length || normalizeText(words[wordIndex]) !== normalizeText(answerWords[j])) {
            matches = false;
            break;
          }
        }
        
        if (matches) {
          const endIndex = i + (answerWords.length - 1) * 2 + 1;
          words.splice(i, endIndex - i, '[blank]');
          const fixed = words.join('');
          console.log(`Auto-fixed (multi-word): "${trimmedAnswer}" → [blank]`);
          return fixed;
        }
      }
    }
  }

  // Strategy 3: Fuzzy span matching — handles paraphrased sentences.
  // Find the contiguous window that has ≥70% word overlap with the answer,
  // then replace that span with [blank].
  const fuzzySpan = findBestFuzzySpan(sentence, trimmedAnswer, 0.7);
  if (fuzzySpan) {
    const fixed = sentence.slice(0, fuzzySpan.start) + '[blank]' + sentence.slice(fuzzySpan.end);
    console.log(`Auto-fixed (fuzzy, overlap≥70%): "${trimmedAnswer}" → [blank]`);
    return fixed;
  }
  
  console.warn(`Could not auto-fix: answer "${trimmedAnswer}" not found in: "${sentence}"`);
  return null;
}

/**
 * Validate and fix a single fill-in-blank item.
 * @param item  The raw item from the model.
 * @param summary  The full source summary — used to verify the sentence is
 *                 actually present in the source material (not hallucinated).
 * Returns object with { valid: boolean, item: any, rejectionReason?: string }
 */
function validateFillInBlankItem(
  item: any,
  summary: string = '',
  keyConcepts: { term: string; definition: string }[] = []
): { valid: boolean; item: any; rejectionReason?: string } {
  if (!item.sentence || !item.answer) {
    return { 
      valid: false, 
      item, 
      rejectionReason: 'Missing sentence or answer' 
    };
  }
  
  // Auto-fix: add [blank] marker if missing
  const fixedSentence = autoFixFillInBlank(item.sentence, item.answer);
  if (!fixedSentence) {
    return { 
      valid: false, 
      item, 
      rejectionReason: `Could not auto-fix: answer "${item.answer}" not found in sentence` 
    };
  }

  // ── Greeting / off-topic phrase check ──
  // Common patterns that indicate the model added conversational fluff.
  const unwantedPatterns = [
    /^good\s+(morning|afternoon|evening|day)\b/i,
    /^hello\b/i,
    /^hi\b/i,
    /^welcome\b/i,
    /\bthank\s+you\b/i,
    /\bas\s+an\s+ai\b/i,
    /\bi\s+think\b/i,
    /\bin\s+this\s+(exercise|task|question)\b/i,
    /^(first|second|next|finally),?\s+/i,
    /\bnow,?\s+(let'?s|we)\b/i,
    /^here\s+(is|are)\b/i,
  ];
  const lowerSentenceCheck = fixedSentence.toLowerCase();
  for (const pattern of unwantedPatterns) {
    if (pattern.test(lowerSentenceCheck)) {
      return {
        valid: false,
        item,
        rejectionReason: `Sentence contains unwanted conversational text matching: "${pattern.source}"`
      };
    }
  }

  // ── Source-presence check ──
  // Verify the sentence (with [blank] replaced by the answer) exists in the
  // source summary. This prevents the model from hallucinating sentences that
  // look plausible but aren't actually in the material — a major cause of
  // duplicates across waves (the model invents the same fake sentence repeatedly).
  if (summary.length > 0) {
    const reconstructed = normalizeText(fixedSentence.replace('[blank]', item.answer));
    const normSummary = normalizeText(summary);
    if (!normSummary.includes(reconstructed)) {
      // Fallback: check if most words appear in order (handles minor tokenization diffs)
      const recWords = reconstructed.split(/\s+/).filter(w => w.length > 3);
      if (recWords.length >= 3) {
        const summaryWords = new Set(normSummary.split(/\s+/));
        const hits = recWords.filter(w => summaryWords.has(w)).length;
        const ratio = hits / recWords.length;
        if (ratio < 0.85) {
          return {
            valid: false,
            item,
            rejectionReason: `Sentence not found in summary (word match ${Math.round(ratio * 100)}% < 85%): "${fixedSentence}"`
          };
        }
      }
    }
  }
  
  // ── Distractor auto-fix ──
  // Gemma 4B sometimes returns distractors as a comma-separated string
  // instead of a JSON array. Attempt to salvage before rejecting.
  let distractors = item.distractors;
  if (typeof distractors === 'string') {
    // "encapsulation, abstraction, inheritance" → ["encapsulation", "abstraction", "inheritance"]
    distractors = distractors.split(/,\s*/).map((d: string) => d.trim()).filter((d: string) => d.length > 0);
    console.log(`Auto-fixed distractors from string → array (${distractors.length} items)`);
  }
  
  if (!Array.isArray(distractors) || distractors.length !== 3) {
    return { 
      valid: false, 
      item, 
      rejectionReason: `Invalid distractors (length: ${Array.isArray(distractors) ? distractors.length : typeof distractors}, expected: 3)` 
    };
  }

  // ── Answer quality check ──
  // Reject items where the blanked word is a generic/stop word rather than a
  // meaningful concept. The model sometimes blanks prepositions or articles.
  const genericWords = new Set([
    'the', 'a', 'an', 'is', 'are', 'was', 'were', 'be', 'been', 'being',
    'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could',
    'should', 'may', 'might', 'can', 'shall', 'must', 'need', 'dare',
    'and', 'or', 'but', 'not', 'nor', 'yet', 'so', 'for', 'to', 'of',
    'in', 'on', 'at', 'by', 'with', 'from', 'into', 'onto', 'upon',
    'about', 'between', 'through', 'during', 'before', 'after', 'above',
    'below', 'up', 'down', 'out', 'off', 'over', 'under', 'again', 'then',
    'once', 'here', 'there', 'when', 'where', 'why', 'how', 'all', 'each',
    'every', 'both', 'few', 'more', 'most', 'other', 'some', 'such', 'no',
    'only', 'own', 'same', 'than', 'too', 'very', 'just', 'also', 'its',
    'it', 'this', 'that', 'these', 'those', 'they', 'them', 'their', 'we',
    'us', 'our', 'you', 'your', 'he', 'she', 'him', 'her', 'his', 'my'
  ]);
  const answerLower = item.answer.trim().toLowerCase();
  if (genericWords.has(answerLower)) {
    return {
      valid: false,
      item,
      rejectionReason: `Answer "${item.answer}" is a generic/stop word — must blank a KEY CONCEPT, not a common word`
    };
  }
  
  // Reject extremely short answers (single character) — likely a bad blank
  if (item.answer.trim().length < 2) {
    return {
      valid: false,
      item,
      rejectionReason: `Answer "${item.answer}" is too short (${item.answer.trim().length} char) — likely not a meaningful concept`
    };
  }

  // ── Answer must be a key concept (when list is available) ──
  // If we have a keyConcepts list, the blanked word should be one of those
  // terms. This prevents the model from blanking trivial or tangential words.
  if (keyConcepts.length > 0) {
    const conceptTerms = new Set(keyConcepts.map(k => normalizeText(k.term)));
    if (!conceptTerms.has(answerLower)) {
      return {
        valid: false,
        item,
        rejectionReason: `Answer "${item.answer}" is not a recognized key concept`
      };
    }
  }

  // ── Key-concept distractor check ──
  // When keyConcepts are available, verify each distractor is either a known
  // key concept OR at least appears somewhere in the summary. This ensures
  // distractors are real, relevant terms — not hallucinated garbage.
  if (keyConcepts.length > 0 && summary.length > 0) {
    const conceptTerms = new Set(keyConcepts.map(k => normalizeText(k.term)));
    const normSummary = normalizeText(summary);
    for (const d of distractors) {
      const normD = normalizeText(d);
      const isKeyConcept = conceptTerms.has(normD);
      const inSummary = normSummary.includes(normD);
      if (!isKeyConcept && !inSummary) {
        return {
          valid: false,
          item,
          rejectionReason: `Distractor "${d}" is neither a key concept nor found in the summary`
        };
      }
    }
  }

  return {
    valid: true,
    item: {
      ...item,
      sentence: fixedSentence,
      distractors
    }
  };
}

/**
 * Validate a single flashcard item
 * Returns object with { valid: boolean, item: any, rejectionReason?: string }
 */
function validateFlashcardItem(item: any): { valid: boolean; item: any; rejectionReason?: string } {
  if (!item.front || !item.back) {
    return { 
      valid: false, 
      item, 
      rejectionReason: 'Missing front or back content' 
    };
  }
  
  // Ensure both have meaningful content (not just whitespace)
  if (normalizeText(item.front).length < 3 || normalizeText(item.back).length < 10) {
    return { 
      valid: false, 
      item, 
      rejectionReason: `Insufficient content (front: ${normalizeText(item.front).length} chars, back: ${normalizeText(item.back).length} chars)` 
    };
  }
  
  return { valid: true, item };
}

/**
 * Validate quiz items structure and content
 * Returns object with { validItems: any[], rejectedItems: any[] }
 * Also randomizes MCQ answer positions to prevent "B is always correct" issue
 */
function validateQuizItems(
  items: any[], 
  type: string, 
  existingItems: Set<string> = new Set(),
  difficulty: string = 'MEDIUM',
  summary: string = '',
  keyConcepts: { term: string; definition: string }[] = []
): { validItems: any[]; rejectedItems: any[] } {
  const validItems: any[] = [];
  const rejectedItems: any[] = [];
  
  for (const item of items) {
    let validationResult: { valid: boolean; item: any; rejectionReason?: string };
    
    // Type-specific validation
    if (type === 'MCQ') {
      validationResult = validateMCQItem(item, difficulty, keyConcepts, summary);
      
      // Check for duplicates — use semantic similarity (keyword overlap)
      // instead of exact normalized match. This catches paraphrased duplicates
      // that the model generates when slices overlap.
      if (validationResult.valid) {
        const questionKey = normalizeText(validationResult.item.question);
        let isDuplicate = existingItems.has(questionKey);
        if (!isDuplicate) {
          // Check keyword overlap with all existing questions
          for (const existing of existingItems) {
            if (areQuestionsSimilar(questionKey, existing)) {
              isDuplicate = true;
              break;
            }
          }
        }
        if (isDuplicate) {
          validationResult = {
            valid: false,
            item: validationResult.item,
            rejectionReason: 'Duplicate question detected'
          };
        } else {
          existingItems.add(questionKey);
        }
      }
    } else if (type === 'FILL_IN_BLANK') {
      validationResult = validateFillInBlankItem(item, summary, keyConcepts);
      
      // Check for duplicates — use semantic similarity (keyword overlap)
      // to catch paraphrased duplicates the model generates across waves.
      if (validationResult.valid) {
        const sentenceKey = normalizeText(validationResult.item.sentence);
        let isDuplicate = existingItems.has(sentenceKey);
        if (!isDuplicate) {
          for (const existing of existingItems) {
            if (areQuestionsSimilar(sentenceKey, existing)) {
              isDuplicate = true;
              break;
            }
          }
        }
        if (isDuplicate) {
          validationResult = {
            valid: false,
            item: validationResult.item,
            rejectionReason: 'Duplicate sentence detected'
          };
        } else {
          existingItems.add(sentenceKey);
        }
      }
    } else if (type === 'FLASHCARD') {
      validationResult = validateFlashcardItem(item);
      
      // Check for duplicates — use semantic similarity (keyword overlap)
      // to catch paraphrased duplicates the model generates across waves.
      if (validationResult.valid) {
        const frontKey = normalizeText(validationResult.item.front);
        let isDuplicate = existingItems.has(frontKey);
        if (!isDuplicate) {
          for (const existing of existingItems) {
            if (areQuestionsSimilar(frontKey, existing)) {
              isDuplicate = true;
              break;
            }
          }
        }
        if (isDuplicate) {
          validationResult = {
            valid: false,
            item: validationResult.item,
            rejectionReason: 'Duplicate flashcard front detected'
          };
        } else {
          existingItems.add(frontKey);
        }
      }
    } else {
      continue; // Unknown type
    }
    
    if (validationResult.valid) {
      validItems.push(validationResult.item);
    } else {
      rejectedItems.push({
        ...validationResult.item,
        _rejected: true,
        _rejectionReason: validationResult.rejectionReason
      });
      console.warn(`Rejected item: ${validationResult.rejectionReason}`);
    }
  }
  
  return { validItems, rejectedItems };
}

// ============================================================================
// POST-GENERATION VERIFICATION
// ============================================================================

/**
 * Build a verification prompt for a batch of quiz items.
 * The model is asked to act as a strict teacher, cross-checking each item
 * against the source summary and returning a structured JSON verdict.
 */
function buildVerificationPrompt(
  items: any[],
  type: 'MCQ' | 'FILL_IN_BLANK' | 'FLASHCARD',
  summary: string
): string {
  // Serialize items compactly for the prompt
  const itemsBlock = items.map((item, idx) => {
    if (type === 'MCQ') {
      return `Item ${idx}:\n  Question: ${item.question}\n  Choices: ${JSON.stringify(item.choices)}\n  Correct answer index: ${item.answerIndex} ("${item.choices[item.answerIndex]}")\n  Explanation: ${item.explanation}`;
    } else if (type === 'FILL_IN_BLANK') {
      return `Item ${idx}:\n  Sentence: ${item.sentence}\n  Answer: ${item.answer}\n  Distractors: ${JSON.stringify(item.distractors)}`;
    } else {
      return `Item ${idx}:\n  Front: ${item.front}\n  Back: ${item.back}`;
    }
  }).join('\n\n');

  let typeRules: string;
  if (type === 'MCQ') {
    typeRules = `You are a STRICT teacher grading quiz questions. For each MCQ, check ALL of the following and mark INCORRECT if ANY fails:

1. ANSWER CORRECTNESS: Read the question carefully. Based ONLY on the summary, determine the correct answer. Does the choice at answerIndex match YOUR answer? If not, mark INCORRECT.
2. BEST ANSWER TEST: Is there a MORE SPECIFIC or MORE ACCURATE answer to this question that is NOT among the 4 choices? If so, the question is flawed — mark INCORRECT. (Example: if the question asks about "worms" but only "malware" is an option, that is too broad.)
3. DISTRACTOR VALIDITY: Are the 3 wrong choices genuinely WRONG for this specific question? If any distractor could also be correct, mark INCORRECT.
4. QUESTION CLARITY: Is the question clear, complete, and answerable from the summary alone? (No missing words, no outside knowledge needed.)
5. EXPLANATION ACCURACY: Does the explanation correctly justify the answer? Does it match the choice at answerIndex?
6. TERM ECHO: If the question asks "What is X?" and the answer is just "X" (the term itself, not a definition), mark INCORRECT.
7. DISTRACTOR SOURCE: Are all 3 wrong choices topically related to the summary content? If any distractor is completely unrelated to the subject matter, mark INCORRECT. (Distractors may be derived phrases — they don't need to be exact key concept terms.)

Be STRICT. When in doubt, mark INCORRECT.`;
  } else if (type === 'FILL_IN_BLANK') {
    typeRules = `You are a STRICT teacher grading fill-in-blank items. For each item, check ALL of the following:

1. SENTENCE ACCURACY: When [blank] is replaced with the answer, does the sentence match content from the summary EXACTLY (not paraphrased)?
2. ANSWER CORRECTNESS: Is the answer the EXACT correct word/phrase for the blank according to the summary? Is it the COMPLETE term (not a fragment like "trade-off" when it should be "bias-variance tradeoff")?
3. ANSWER QUALITY: Is the answer a meaningful concept/term (not a preposition, article, or generic word like "the", "and", "is")?
4. BLANK IMPORTANCE: Is the blanked word a KEY CONCEPT, TECHNICAL TERM, or IMPORTANT NAME from the summary — something a student should know? If it's a trivial word, mark INCORRECT.
5. DISTRACTOR VALIDITY: Are all 3 distractors real terms from the summary that do NOT correctly fill the blank? Could any distractor work as well as the answer? If so, mark INCORRECT.
6. DISTRACTOR RELEVANCE: Are the distractors important concepts/terms from the same domain (not random words)? They should be plausible enough to test knowledge.
7. SENTENCE COMPLETENESS: Is the sentence complete and grammatically correct with the blank?
8. OFF-TOPIC CONTENT: Does the sentence contain any greetings ("good morning", "hello", "welcome"), meta-comments ("here is", "in this exercise"), or text NOT from the summary? If yes, mark INCORRECT.

Be STRICT. When in doubt, mark INCORRECT.`;
  } else {
    typeRules = `You are a STRICT teacher grading flashcards. For each card, check ALL of the following:

1. FRONT CLARITY: Does the front ask a clear, specific question about a concept from the summary?
2. BACK ACCURACY: Is the back factually accurate according to the summary?
3. FRONT-BACK MATCH: Does the back ACTUALLY answer the front? (Not a mismatch or tangential.)
4. COMPLETENESS: Is the back complete enough to be a useful answer?
5. SPECIFICITY: Is the front specific enough that only one answer is reasonable?

Be STRICT. When in doubt, mark INCORRECT.`;
  }

  return `You are a strict academic reviewer. Verify each quiz item below against the source summary. Output ONLY valid JSON.

SUMMARY:
${summary}

ITEMS TO VERIFY:
${itemsBlock}

${typeRules}

Respond with ONLY this JSON structure (no extra text):
{"verdicts":[{"index":0,"pass":true,"reason":null},{"index":1,"pass":false,"reason":"explanation of what is wrong"}]}`;
}

/**
 * Verify a batch of quiz items for factual correctness using Ollama.
 *
 * Sends the items + summary to the model and asks it to cross-check each one.
 * Returns items split into verified (passed) and failed (with reasons).
 *
 * Items are processed in sub-batches of up to VERIFY_BATCH_SIZE to keep
 * the prompt+response within token limits.
 */
async function verifyQuizItemsWithGemma(
  items: any[],
  type: 'MCQ' | 'FILL_IN_BLANK' | 'FLASHCARD',
  summary: string,
  model: string
): Promise<{ verified: any[]; failed: { item: any; reason: string }[] }> {
  if (items.length === 0) return { verified: [], failed: [] };

  const VERIFY_BATCH_SIZE = 5; // Keep prompts manageable for 4B models
  const verified: any[] = [];
  const failed: { item: any; reason: string }[] = [];

  // Process in sub-batches
  for (let offset = 0; offset < items.length; offset += VERIFY_BATCH_SIZE) {
    const batch = items.slice(offset, offset + VERIFY_BATCH_SIZE);
    const prompt = buildVerificationPrompt(batch, type, summary);

    // Token budget: ~80 tokens per verdict (index + pass/fail + reason sentence)
    const maxTokens = Math.min(batch.length * 100 + 80, 1200);

    try {
      const raw = await generateWithOllama(prompt, {
        model,
        temperature: 0.1, // Near-deterministic for factual checking
        requireJson: true,
        maxTokens,
      });

      let parsed: any;
      try {
        parsed = JSON.parse(raw);
      } catch {
        // Try to salvage
        const salvaged = salvageTruncatedJson(raw);
        if (salvaged) {
          // salvageTruncatedJson returns { items: [...] }, but we expect { verdicts: [...] }
          // Re-parse: look for "verdicts" key or fall back to items
          parsed = { verdicts: salvaged.items };
        } else {
          console.warn(`⚠ Verification JSON parse failed for batch at offset ${offset} — accepting items as-is`);
          verified.push(...batch);
          continue;
        }
      }

      const verdicts: any[] = parsed?.verdicts || parsed?.items || [];
      if (!Array.isArray(verdicts) || verdicts.length === 0) {
        // Model returned garbage — accept items rather than rejecting blindly
        console.warn(`⚠ Verification returned no verdicts for batch at offset ${offset} — accepting items as-is`);
        verified.push(...batch);
        continue;
      }

      // Map verdicts back to items
      const verdictMap = new Map<number, { pass: boolean; reason: string | null }>();
      for (const v of verdicts) {
        if (typeof v.index === 'number') {
          verdictMap.set(v.index, { pass: !!v.pass, reason: v.reason || null });
        }
      }

      for (let i = 0; i < batch.length; i++) {
        const verdict = verdictMap.get(i);
        if (!verdict) {
          // No verdict for this item — accept it (benefit of the doubt)
          verified.push(batch[i]);
        } else if (verdict.pass) {
          verified.push(batch[i]);
        } else {
          failed.push({ item: batch[i], reason: verdict.reason || 'Failed verification' });
          console.warn(`❌ Verification rejected item ${offset + i}: ${verdict.reason}`);
        }
      }
    } catch (err) {
      // Verification call itself failed — accept the batch to avoid blocking generation
      console.error(`⚠ Verification call failed for batch at offset ${offset}:`, err instanceof Error ? err.message : err);
      verified.push(...batch);
    }
  }

  return { verified, failed };
}

export interface OllamaGenerateRequest {
  model: string;
  prompt: string;
  stream?: boolean;
  format?: 'json';
  options?: {
    temperature?: number;
    top_p?: number;
    top_k?: number;
    num_predict?: number;
  };
}

export interface OllamaGenerateResponse {
  model: string;
  created_at: string;
  response: string;
  done: boolean;
}

/**
 * Generate text using Ollama
 */
export async function generateWithOllama(
  prompt: string,
  options: {
    model?: string;
    temperature?: number;
    requireJson?: boolean;
    maxTokens?: number;
  } = {}
): Promise<string> {
  // Auto-select best available model if not specified
  let modelToUse = options.model;
  if (!modelToUse) {
    modelToUse = await getBestAvailableModel();
    console.log(`Auto-selected model: ${modelToUse}`);
  }
  
  const {
    temperature = 0.7,
    requireJson = false,
    maxTokens,
  } = options;

  try {
    const requestBody: OllamaGenerateRequest = {
      model: modelToUse,
      prompt,
      stream: false,
      options: {
        temperature,
        ...(maxTokens ? { num_predict: maxTokens } : {}),
      },
    };

    if (requireJson) {
      requestBody.format = 'json';
    }

    const response = await fetch(`${OLLAMA_BASE_URL}/api/generate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
      signal: AbortSignal.timeout(300_000), // 5 min timeout — CPU inference is slow
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Ollama API error: ${response.status} ${response.statusText}. Model: ${modelToUse}. Response: ${errorText}`);
    }

    const data: OllamaGenerateResponse = await response.json();
    return data.response;
  } catch (error) {
    console.error('Error calling Ollama:', error);
    throw new Error(`Failed to generate with Ollama: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Check if Ollama is available
 */
export async function checkOllamaAvailability(): Promise<boolean> {
  try {
    const response = await fetch(`${OLLAMA_BASE_URL}/api/tags`, {
      method: 'GET',
    });
    return response.ok;
  } catch (error) {
    console.error('Ollama is not available:', error);
    return false;
  }
}

/**
 * Get list of available Ollama models
 */
export async function getAvailableModels(): Promise<string[]> {
  try {
    const response = await fetch(`${OLLAMA_BASE_URL}/api/tags`, {
      method: 'GET',
    });
    
    if (!response.ok) {
      return [];
    }
    
    const data = await response.json();
    return data.models?.map((m: any) => m.name) || [];
  } catch (error) {
    console.error('Error fetching models:', error);
    return [];
  }
}

/**
 * Find the best available small model for quiz generation.
 *
 * Resolution order:
 * 1. OLLAMA_MODEL env var — lets the deployer pin a specific model (e.g. gemma3:1b)
 * 2. Cached result from a previous call (TTL = 60 s)
 * 3. Live /api/tags probe with quantized → 4b → 1b priority
 *
 * Quantized models (q4_K_M, q4_0) are ~2× faster on CPU with minimal quality loss.
 * 1B models are another 2–3× faster but produce lower-quality items.
 */
export async function getBestAvailableModel(): Promise<string> {
  // 1. Respect explicit env-var override — skip everything else
  const envModel = process.env.OLLAMA_MODEL;
  if (envModel) {
    console.log(`Using model from OLLAMA_MODEL env var: ${envModel}`);
    return envModel;
  }

  // 2. Return cached result if still fresh
  if (_cachedModel && Date.now() - _cachedModelTs < MODEL_CACHE_TTL_MS) {
    return _cachedModel;
  }

  // 3. Probe available models
  const models = await getAvailableModels();
  
  // Priority order: quantized 4B → full 4B → quantized 1B → full 1B
  // Quantized 4B variants give ~2× CPU speedup with negligible quality loss.
  // 1B variants are another 2–3× faster but with some quality trade-off.
  const preferredModels = [
    'gemma3:4b-it-q4_K_M',  // Best quality-to-speed quantized 4B
    'gemma3:4b-q4_0',       // Aggressive quantization, fastest 4B
    'gemma3:4b-cloud',
    'gemma3:4b',
    'gemma3:1b-it-q4_K_M',  // Quantized 1B — very fast, lower quality
    'gemma3:1b',             // Full 1B — fast, lower quality
  ];

  const QUANTIZED_TAGS = ['q4_K_M', 'q4_0', 'q8_0', 'q5_K_M', 'q4_1', 'q2_K'];
  
  let selected: string | null = null;

  // First, try exact match
  for (const preferred of preferredModels) {
    if (models.includes(preferred)) {
      selected = preferred;
      break;
    }
  }
  
  // Then try prefix match
  if (!selected) {
    for (const preferred of preferredModels) {
      const prefix = preferred.split(':')[0];
      const found = models.find(m => m.startsWith(prefix));
      if (found) {
        selected = found;
        break;
      }
    }
  }
  
  // Last resort: any model
  if (!selected) {
    selected = models[0] || 'gemma3:4b';
  }

  // Warn if the selected model is NOT quantized — user could pull one for speed
  const isQuantized = QUANTIZED_TAGS.some(tag => selected!.includes(tag));
  if (!isQuantized) {
    console.warn(
      `⚠ Selected model "${selected}" is not quantized. ` +
      `For ~2× faster CPU inference, pull a quantized variant: ollama pull gemma3:4b-it-q4_K_M`
    );
  }

  // Cache the result
  _cachedModel = selected;
  _cachedModelTs = Date.now();

  return selected;
}

/**
 * Generate quiz using Ollama with structured prompts (auto-selects best available model)
 * High-performance parallel-wave architecture with 1.5x overgeneration
 */
export async function generateQuizWithGemma(
  summary: string,
  type: 'MCQ' | 'FILL_IN_BLANK' | 'FLASHCARD',
  difficulty: 'EASY' | 'MEDIUM' | 'HARD',
  count: number,
  preResolvedModel?: string,
  keyConcepts: { term: string; definition: string }[] = [],
  originalKeyConcepts: { term: string; definition: string }[] = []
): Promise<any> {
  // Track generation time
  const startTime = Date.now();

  // ── Deterministic fast-path for FILL_IN_BLANK ──
  // When keyConcepts are available, we can build items deterministically by
  // pre-extracting sentences that contain key terms. This guarantees each
  // sentence is verbatim, the answer is present, and distractors are real
  // key concepts — eliminating the "answer not found" and paraphrasing
  // failures that plague the LLM-based pipeline.
  let _deterministicSeed: any[] | null = null;
  if (type === 'FILL_IN_BLANK' && keyConcepts.length >= 4) {
    const deterministicItems = generateDeterministicFIB(summary, keyConcepts, count, difficulty);
    if (deterministicItems && deterministicItems.length >= count) {
      const elapsed = Date.now() - startTime;
      const elapsedSeconds = Math.floor(elapsed / 1000);
      const minutes = Math.floor(elapsedSeconds / 60);
      const seconds = elapsedSeconds % 60;
      const timeString = minutes > 0 ? `${minutes}m ${seconds}s` : `${elapsed}ms`;

      console.log(`\n=== Generation Complete ===`);
      console.log(`Requested: ${count} (deterministic fast-path)`);
      console.log(`Total verified items generated: ${deterministicItems.length}`);
      console.log(`Final items returned: ${Math.min(deterministicItems.length, count)}`);
      console.log(`Rejected items: 0`);
      console.log(`Total waves: 0 (0 API calls)`);
      console.log(`Success rate: 100%`);
      console.log(`JSON parse errors (possible truncations): 0`);
      console.log(`Time elapsed: ${timeString}`);
      console.log(`===========================\n`);

      return {
        type: 'fill_blank',
        difficulty: difficulty.toLowerCase(),
        items: deterministicItems.slice(0, count),
        rejectedItems: [],
        stats: { requested: count, generated: deterministicItems.length, rejected: 0, waves: 0, apiCalls: 0 }
      };
    }
    // Save partial results to seed the wave loop
    if (deterministicItems && deterministicItems.length > 0) {
      _deterministicSeed = deterministicItems;
      console.log(`Deterministic FIB produced ${deterministicItems.length}/${count} — wave loop will fill remaining.`);
    }
  }

  // ── Deterministic fast-path for EASY MCQ ──
  // Uses ORIGINAL key concepts (pre-expansion) + definitions to build
  // definition-recall questions. Expanded variants produce fragment terms
  // like "learning discovers" that are not valid concepts for MCQ.
  let _deterministicMCQSeed: any[] | null = null;
  const easyMCQConcepts = originalKeyConcepts.length >= 4 ? originalKeyConcepts : keyConcepts;
  if (type === 'MCQ' && difficulty === 'EASY' && easyMCQConcepts.length >= 4) {
    const deterministicItems = generateDeterministicMCQ_Easy(easyMCQConcepts, count);
    if (deterministicItems && deterministicItems.length >= count) {
      const elapsed = Date.now() - startTime;
      const elapsedSeconds = Math.floor(elapsed / 1000);
      const minutes = Math.floor(elapsedSeconds / 60);
      const seconds = elapsedSeconds % 60;
      const timeString = minutes > 0 ? `${minutes}m ${seconds}s` : `${elapsed}ms`;

      console.log(`\n=== Generation Complete ===`);
      console.log(`Requested: ${count} (deterministic MCQ Easy fast-path)`);
      console.log(`Total verified items generated: ${deterministicItems.length}`);
      console.log(`Final items returned: ${Math.min(deterministicItems.length, count)}`);
      console.log(`Rejected items: 0`);
      console.log(`Total waves: 0 (0 API calls)`);
      console.log(`Success rate: 100%`);
      console.log(`JSON parse errors (possible truncations): 0`);
      console.log(`Time elapsed: ${timeString}`);
      console.log(`===========================\n`);

      return {
        type: 'mcq',
        difficulty: 'easy',
        items: deterministicItems.slice(0, count),
        rejectedItems: [],
        stats: { requested: count, generated: deterministicItems.length, rejected: 0, waves: 0, apiCalls: 0 }
      };
    }
    // Save partial results to seed the wave loop
    if (deterministicItems && deterministicItems.length > 0) {
      _deterministicMCQSeed = deterministicItems;
      console.log(`Deterministic MCQ Easy produced ${deterministicItems.length}/${count} — wave loop will fill remaining.`);
    }
  }
  
  // Pre-resolve model ONCE before the batch loop (eliminates redundant /api/tags calls)
  const resolvedModel = preResolvedModel || await getBestAvailableModel();
  console.log(`Using model: ${resolvedModel} (resolved once, reused for all batches)`);

  
  // Dynamic temperature based on quiz type AND difficulty for better accuracy
  // Lower = more factual/deterministic, Higher = more creative
  const temperatureMatrix: Record<string, Record<string, number>> = {
    MCQ:           { EASY: 0.25, MEDIUM: 0.30, HARD: 0.45 },
    FILL_IN_BLANK: { EASY: 0.30, MEDIUM: 0.35, HARD: 0.40 },
    FLASHCARD:     { EASY: 0.30, MEDIUM: 0.45, HARD: 0.55 },
  };
  const baseTemperature = temperatureMatrix[type]?.[difficulty] ?? 0.3;

  // Track unique items across batches to prevent duplicates
  const seenItems = new Set<string>();
  const allValidItems: any[] = [];
  const allRejectedItems: any[] = [];

  // ── Seed with partial deterministic results (FIB or MCQ Easy) ──
  // If the deterministic path produced some items but not enough,
  // inject them into the pool so the wave loop only needs to fill the gap.
  if (_deterministicSeed && _deterministicSeed.length > 0) {
    for (const item of _deterministicSeed) {
      allValidItems.push(item);
      if (item.sentence) seenItems.add(normalizeText(item.sentence));
    }
    console.log(`Seeded wave loop with ${_deterministicSeed.length} deterministic FIB items.`);
  }
  if (_deterministicMCQSeed && _deterministicMCQSeed.length > 0) {
    for (const item of _deterministicMCQSeed) {
      allValidItems.push(item);
      if (item.question) seenItems.add(normalizeText(item.question));
    }
    console.log(`Seeded wave loop with ${_deterministicMCQSeed.length} deterministic MCQ Easy items.`);
  }
  
  // ── Optimized batch configuration ──
  // Smaller HARD batches = higher per-item success rate, less wasted inference.
  // FILL_IN_BLANK HARD gets the smallest — nested JSON + paraphrasing issues.
  let baseBatchSize =
    type === 'FILL_IN_BLANK' && difficulty === 'HARD' ? 2 :
    type === 'FILL_IN_BLANK' ? 3 :
    type === 'MCQ' ? 5 :  // MCQ capped at 5 — models degrade sharply above 6 items with strict JSON
    difficulty === 'HARD' ? 3 :
    6;
  
  // Generate a buffer of extra verified items so that even if some items are
  // borderline or the model struggles in later waves, we still meet the
  // requested count. Only `count` items are returned; extras are discarded.
  const BUFFER = Math.max(5, Math.ceil(count * 0.2)); // at least 5 extra, or 20%
  const targetCount = count + BUFFER;
  console.log(`Will generate up to ${targetCount} verified items (${count} requested + ${BUFFER} buffer).`);

  // CPU inference: Ollama processes requests sequentially on CPU, so parallel calls
  // just compete for threads and both timeout. Use CONCURRENCY=1 for local/CPU setups.
  // Set OLLAMA_CONCURRENCY=2 (or higher) when running with GPU / sufficient RAM.
  const CONCURRENCY = parseInt(process.env.OLLAMA_CONCURRENCY ?? '1', 10);
  // Wave budget — with improved prompts, fewer waves should be needed.
  // The absolute time limit is the real safety valve.
  const MAX_WAVES = 150;
  // Absolute time limit: stop after this many ms regardless of progress.
  // Default 10 minutes — enough for large counts on CPU inference.
  const ABSOLUTE_TIME_LIMIT_MS = parseInt(process.env.OLLAMA_TIME_LIMIT_MS ?? '600000', 10);
  
  let wave = 0;
  let totalApiCalls = 0;
  let consecutiveFailures = 0;
  
  let jsonParseErrors = 0; // Track truncation-related parse failures
  let tokenMultiplier = 1.0; // Dynamic: increases by 20% per parse error, resets on success
  let stagnantWaves = 0; // Track consecutive waves with zero new valid items
  let sliceRandomOffset = 0; // Random offset added to slice index on stagnation recovery

  // ── Hard MCQ concept-by-concept state ──
  // For Hard MCQs, we generate one question per concept to eliminate truncation.
  // Shuffle the concept list once and walk through it sequentially.
  let hardConceptPool: { term: string; definition: string }[] = [];
  let hardConceptIndex = 0;
  if (type === 'MCQ' && difficulty === 'HARD' && keyConcepts.length > 0) {
    hardConceptPool = shuffleArray([...keyConcepts]);
    console.log(`Hard MCQ: concept-by-concept mode with ${hardConceptPool.length} concepts.`);
  }

  console.log(`Starting quiz generation: ${count} ${type} items at ${difficulty} difficulty`);
  console.log(`Configuration: baseBatchSize=${baseBatchSize}, CONCURRENCY=${CONCURRENCY}, MAX_WAVES=${MAX_WAVES}`);
  console.log(`Base temperature: ${baseTemperature}`);
  
  try {
    // ── Parallel-wave generation loop ──
    // Each wave fires CONCURRENCY parallel API calls, each with a different summary slice
    while (allValidItems.length < targetCount && wave < MAX_WAVES) {
      // ── Absolute time limit ──
      const elapsedSoFar = Date.now() - startTime;
      if (elapsedSoFar >= ABSOLUTE_TIME_LIMIT_MS) {
        console.warn(`⏱ Absolute time limit reached (${Math.round(elapsedSoFar / 1000)}s). ` +
          `Returning ${allValidItems.length}/${targetCount} collected items.`);
        break;
      }

      const remainingCount = targetCount - allValidItems.length;
      
      // ── Adaptive temperature strategy ──
      // Instead of only decaying (which makes the model MORE deterministic when stuck),
      // oscillate: boost temperature on stagnation to encourage diversity, then
      // reset on success. This breaks out of repetitive generation loops.
      let temperature: number;
      if (stagnantWaves >= 2) {
        // Stagnation recovery: INCREASE temperature for diversity
        const boost = Math.min(stagnantWaves * 0.08, 0.35);
        // Higher ceiling during deep stagnation to maximize diversity
        const tempCeiling = stagnantWaves >= 5
          ? (type === 'FLASHCARD' ? 0.95 : 0.85)
          : (type === 'FLASHCARD' ? 0.85 : 0.75);
        temperature = Math.min(baseTemperature + boost, tempCeiling);
        console.log(`🔄 Stagnation recovery (wave ${stagnantWaves}): temperature boosted to ${temperature.toFixed(2)}`);
      } else if (consecutiveFailures > 0 && stagnantWaves === 0) {
        // Minor failures but still producing SOME items — gentle decay
        const tempFloor = type === 'FLASHCARD' ? 0.35 : 0.25;
        temperature = Math.max(baseTemperature - (consecutiveFailures * 0.02), tempFloor);
      } else {
        temperature = baseTemperature;
      }
      
      if (temperature !== baseTemperature) {
        console.log(`Temperature adjusted to ${temperature.toFixed(2)} (base: ${baseTemperature.toFixed(2)})`);
      }
      
      // Extract used concepts for memory injection — cap at 8 to avoid bloating prompt
      const recentConcepts = Array.from(seenItems).slice(-Math.min(count, 8));

      // Collect already-used content for explicit prompt injection so the model
      // avoids regenerating identical content across all quiz types.
      const usedSentences: string[] = [];
      if (type === 'FILL_IN_BLANK') {
        for (const item of allValidItems) {
          // Store the sentence exactly as validated (with [blank]) so the model
          // sees the exact format it should NOT reproduce.
          if (item.sentence) usedSentences.push(item.sentence);
        }
      } else if (type === 'FLASHCARD') {
        for (const item of allValidItems) {
          if (item.front) usedSentences.push(item.front);
        }
      } else if (type === 'MCQ') {
        // For MCQ: collect used question text so later waves avoid recycling topics
        for (const item of allValidItems) {
          if (item.question) usedSentences.push(item.question);
        }
      }
      
      // ── Dynamic batch-size adjustment ──
      // When in stagnation recovery (stagnantWaves >= 3), the recovery block has
      // already set baseBatchSize to a deliberate value via cycling. Do NOT reduce
      // it here — that was the bug causing recovery to be immediately undone.
      // Only apply the generic reduction for early consecutive failures (before
      // recovery kicks in at stagnantWaves >= 3).
      let effectiveBatchSize: number;
      if (consecutiveFailures >= 3) {
        effectiveBatchSize = Math.max(Math.floor(baseBatchSize * 0.6), 1);
        console.log(`Batch size reduced ${baseBatchSize} → ${effectiveBatchSize} after ${consecutiveFailures} consecutive failures`);
      } else {
        effectiveBatchSize = baseBatchSize;
      }

      // Force single-item requests for EASY MCQ to guarantee small, well-formed
      // JSON responses. The 4B model struggles to produce valid multi-item arrays
      // for MCQ (each item has question + 4 choices + explanation). Single-item
      // requests are slower but dramatically more reliable.
      if (difficulty === 'EASY' && type === 'MCQ') {
        effectiveBatchSize = 1;
      }
      // Cap MCQ batch size at 5 for all difficulties to prevent constraint saturation.
      // The model degrades sharply when asked for >5 MCQ items with strict JSON + constraints.
      if (type === 'MCQ' && effectiveBatchSize > 5) {
        effectiveBatchSize = 5;
      }

      // When stuck, jump to a random part of the summary to find fresh content
      if (stagnantWaves >= 2) {
        sliceRandomOffset = Math.floor(Math.random() * 20);
        console.log(`🔀 Randomizing summary slice offset to ${sliceRandomOffset}`);
      }

      // Determine how many parallel calls to fire this wave
      const callsThisWave = Math.min(
        CONCURRENCY,
        Math.ceil(remainingCount / effectiveBatchSize) // Don't fire more calls than needed
      );
      
      console.log(`\nWave ${wave + 1}/${MAX_WAVES}: Firing ${callsThisWave} parallel calls (${allValidItems.length}/${count} collected)`);

      // ── Hard MCQ: concept-by-concept single-item generation ──
      // Instead of batch generation (which truncates), generate ONE question
      // per concept. Each call is small, fast, and almost always produces
      // valid JSON. Walk through the shuffled concept pool sequentially;
      // wrap around if we exhaust all concepts.
      if (type === 'MCQ' && difficulty === 'HARD' && hardConceptPool.length > 0) {
        const concept = hardConceptPool[hardConceptIndex % hardConceptPool.length];
        hardConceptIndex++;

        const prompt = buildHardMCQPrompt(concept, summary, keyConcepts);
        const maxTokens = 600; // generous for a single item

        console.log(`  Hard MCQ concept-by-concept: "${concept.term}" (index ${hardConceptIndex})`);
        const rawResponse = await generateWithOllama(prompt, {
          model: resolvedModel,
          temperature,
          requireJson: true,
          maxTokens,
        }).catch(err => {
          console.error(`  Call failed for concept "${concept.term}":`, err instanceof Error ? err.message : err);
          return null;
        });
        totalApiCalls++;

        let waveValidCount = 0;
        let waveRejectedCount = 0;

        if (rawResponse) {
          // Parse the single-item JSON
          let parsedItem: any = null;
          try {
            parsedItem = JSON.parse(rawResponse);
          } catch {
            const jsonMatch = rawResponse.match(/(\{[\s\S]*\})/);
            if (jsonMatch) {
              try { parsedItem = JSON.parse(jsonMatch[1]); } catch { /* ignore */ }
            }
            if (!parsedItem) {
              jsonParseErrors++;
              tokenMultiplier = Math.min(tokenMultiplier * 1.25, 2.0);
              console.error(`  JSON parse error for concept "${concept.term}"`);
            }
          }

          if (parsedItem) {
            // The model may return a bare item or wrapped in {items:[...]}.
            // Normalize to an array.
            const items = parsedItem.items && Array.isArray(parsedItem.items)
              ? parsedItem.items
              : (parsedItem.question && parsedItem.choices ? [parsedItem] : []);

            if (items.length > 0) {
              const { validItems: structValid, rejectedItems: rejBatch } =
                validateQuizItems(items, type, seenItems, difficulty, summary, keyConcepts);

              if (structValid.length > 0) {
                // Verify Hard items (skip only Easy)
                const { verified, failed } = await verifyQuizItemsWithGemma(
                  structValid, type, summary, resolvedModel
                );
                totalApiCalls += Math.ceil(structValid.length / 5);

                // Remove failed items from seenItems
                for (const f of failed) {
                  const key = f.item.question ? normalizeText(f.item.question) : '';
                  if (key) seenItems.delete(key);
                }

                allValidItems.push(...verified);
                allRejectedItems.push(...rejBatch);
                for (const f of failed) {
                  allRejectedItems.push({ ...f.item, _rejected: true, _rejectionReason: `Verification: ${f.reason}` });
                }
                waveValidCount = verified.length;
                waveRejectedCount = rejBatch.length + failed.length;
              } else {
                allRejectedItems.push(...rejBatch);
                waveRejectedCount = rejBatch.length;
              }
            } else {
              console.warn(`  Invalid structure for concept "${concept.term}"`);
            }
          }
        }

        // Track stagnation
        if (waveValidCount === 0) {
          consecutiveFailures++;
          stagnantWaves++;
        } else {
          consecutiveFailures = 0;
          stagnantWaves = 0;
          if (tokenMultiplier > 1.0) {
            tokenMultiplier = Math.max(tokenMultiplier * 0.85, 1.0);
          }
        }

        const progress = Math.min(100, Math.round((allValidItems.length / targetCount) * 100));
        console.log(`Wave ${wave + 1} result: +${waveValidCount} verified, +${waveRejectedCount} rejected | Total: ${allValidItems.length}/${targetCount} (${progress}%)`);

        wave++;
        if (allValidItems.length >= targetCount) {
          console.log(`✓ Target reached! Collected ${allValidItems.length} verified items in ${wave} waves (${totalApiCalls} API calls)`);
          break;
        }

        // Stagnant limit for Hard concept-by-concept
        if (stagnantWaves >= 10) {
          console.warn(`⚠ ${stagnantWaves} consecutive zero-yield waves — stopping early. Returning ${allValidItems.length}/${targetCount} collected items.`);
          break;
        }
        continue; // skip the generic batch logic below
      }
      
      // Build and fire parallel promises
      const wavePromises = Array.from({ length: callsThisWave }).map((_, i) => {
        const sliceIndex = wave * CONCURRENCY + i + sliceRandomOffset; // Each call gets a different summary slice
        // Zero overlap for all types — overlap causes the same content to reappear
        // across waves, triggering massive duplicate rejections (especially for MCQ/FIB).
        const sliceOverlap = 0;
        // Dynamic window size: larger batches need more context from the summary
        const dynamicWindowSize = effectiveBatchSize <= 2 ? 1100 : effectiveBatchSize <= 4 ? 1300 : 1500;
        const summarySlice = getSummarySlice(summary, sliceIndex, dynamicWindowSize, sliceOverlap);
        
        // Overgeneration factor: request slightly more items than needed
        // to account for rejections during validation.
        const overgenFactor = 1.1;
        const perCallTarget = Math.ceil(remainingCount / callsThisWave);
        const overgenCap = effectiveBatchSize + 1;
        const batchCount = Math.min(
          Math.ceil(perCallTarget * overgenFactor),
          overgenCap
        );
        
        // ── Difficulty-aware token budgets ──
        // HARD items need significantly more tokens: longer explanations (MCQ),
        // longer sentences (FIB), and detailed backs (flashcards).
        // Budgets raised after observing truncation even at 180 tokens/item.
        const baseTokensPerItem =
          difficulty === 'HARD'
            ? (type === 'MCQ' ? 500 : type === 'FILL_IN_BLANK' ? 180 : 200)
            : difficulty === 'MEDIUM'
            ? (type === 'MCQ' ? 360 : type === 'FILL_IN_BLANK' ? 150 : 130)
            : (type === 'MCQ' ? 500 : type === 'FILL_IN_BLANK' ? 130 : 100);
        // Dynamic token multiplier: after parse errors (truncation), automatically
        // increase budget for subsequent waves to avoid repeated truncation.
        const tokensPerItem = Math.min(Math.round(baseTokensPerItem * tokenMultiplier), 800);
        // Hard cap scales with batch size: larger batches need proportionally more tokens.
        // MCQ items with explanations need significantly more tokens than FIB/flashcards.
        const tokenHardCap = effectiveBatchSize <= 2 ? 6000 : effectiveBatchSize <= 4 ? 7500 : 9000;
        const maxTokens = Math.min(batchCount * tokensPerItem + 100, tokenHardCap);
        
        console.log(`  Call ${i + 1}: Requesting ${batchCount} items (slice offset ${sliceIndex}, max ${maxTokens} tokens)`);
        
        const batchPrompt = buildPrompt(type, difficulty, batchCount, summarySlice, recentConcepts, usedSentences, keyConcepts);
        return generateWithOllama(batchPrompt, {
          model: resolvedModel,
          temperature,
          requireJson: true,
          maxTokens,
        }).catch((err) => {
          // Don't let one failed call kill the whole wave
          console.error(`  Call ${i + 1} failed:`, err instanceof Error ? err.message : err);
          return null;
        });
      });
      
      // Await all parallel calls
      const rawResponses = await Promise.all(wavePromises);
      totalApiCalls += callsThisWave;
      
      // Process each response
      let waveValidCount = 0;
      let waveRejectedCount = 0;
      
      for (let i = 0; i < rawResponses.length; i++) {
        const rawResponse = rawResponses[i];
        if (!rawResponse) continue; // Skip failed calls
        
        // Parse response
        let parsedResponse;
        try {
          parsedResponse = JSON.parse(rawResponse);
        } catch (parseError) {
          // Try to extract JSON from surrounding text (model sometimes adds intro/outro)
          const jsonMatch = rawResponse.match(/(\{[\s\S]*\})/);  
          if (jsonMatch) {
            try {
              parsedResponse = JSON.parse(jsonMatch[1]);
              console.log(`  Call ${i + 1}: Extracted JSON from surrounding text`);
            } catch {
              // Fall through to salvage
            }
          }
          if (!parsedResponse) {
          // Try to salvage complete items from truncated JSON before giving up
          const salvaged = salvageTruncatedJson(rawResponse);
          if (salvaged && salvaged.items.length > 0) {
            console.log(`  Call ${i + 1}: JSON parse failed — salvaged ${salvaged.items.length} complete item(s)`);
            parsedResponse = salvaged;
          } else {
            jsonParseErrors++;
            // Bump token multiplier by 25% per parse error (cap at 2.0x)
            tokenMultiplier = Math.min(tokenMultiplier * 1.25, 2.0);
            console.error(`  Call ${i + 1}: JSON parse error (${jsonParseErrors} total) — ` +
              `response truncated, no items salvageable. ` +
              `Token multiplier raised to ${tokenMultiplier.toFixed(2)}x.`, parseError);
            continue;
          }
          } // end if (!parsedResponse)
        }
        
        // Validate structure
        if (!parsedResponse.items || !Array.isArray(parsedResponse.items)) {
          console.warn(`  Call ${i + 1}: Invalid response structure`);
          continue;
        }
        
        // ── Step 1: Structural validation + duplicate check ──
        const { validItems: structurallyValid, rejectedItems: rejectedBatchItems } =
          validateQuizItems(parsedResponse.items, type, seenItems, difficulty, summary, keyConcepts);
        
        // ── Step 2: Factual verification on structurally valid items ──
        // Only items that pass BOTH structural and factual checks are added
        // to allValidItems. This eliminates the need for post-generation
        // verification that would discard items after the fact.
        if (structurallyValid.length > 0) {
          // ── Skip verification for EASY ──
          // Easy questions are simple recall — the structural validation is
          // sufficient. Verification often rejects correct recall items with
          // "too broad" or "distractor source" failures, killing yield.
          // For MEDIUM/HARD, full verification is still applied.
          if (difficulty === 'EASY') {
            allValidItems.push(...structurallyValid);
            allRejectedItems.push(...rejectedBatchItems);
            waveValidCount += structurallyValid.length;
            waveRejectedCount += rejectedBatchItems.length;
            console.log(`  Call ${i + 1}: Generated ${parsedResponse.items.length}, ` +
              `StructValid: ${structurallyValid.length} (accepted — Easy skip-verify), ` +
              `Rejected: ${rejectedBatchItems.length}`);
          } else {
          const { verified, failed } = await verifyQuizItemsWithGemma(
            structurallyValid, type, summary, resolvedModel
          );
          totalApiCalls += Math.ceil(structurallyValid.length / 5);

          // Remove failed items from seenItems — they were tentatively added
          // by validateQuizItems but didn't pass verification, so future waves
          // should be free to generate similar (but correct) items.
          for (const f of failed) {
            let key = '';
            if (type === 'MCQ' && f.item.question) key = normalizeText(f.item.question);
            else if (type === 'FILL_IN_BLANK' && f.item.sentence) key = normalizeText(f.item.sentence);
            else if (type === 'FLASHCARD' && f.item.front) key = normalizeText(f.item.front);
            if (key) seenItems.delete(key);
          }

          // Only verified items enter the final pool
          allValidItems.push(...verified);

          // Track all rejections
          allRejectedItems.push(...rejectedBatchItems);
          for (const f of failed) {
            allRejectedItems.push({
              ...f.item,
              _rejected: true,
              _rejectionReason: `Verification: ${f.reason}`,
            });
          }

          waveValidCount += verified.length;
          waveRejectedCount += rejectedBatchItems.length + failed.length;

          console.log(`  Call ${i + 1}: Generated ${parsedResponse.items.length}, ` +
            `StructValid: ${structurallyValid.length}, ` +
            `Verified: ${verified.length}, Rejected: ${rejectedBatchItems.length + failed.length}`);
          }
        } else {
          // No structurally valid items
          allRejectedItems.push(...rejectedBatchItems);
          waveRejectedCount += rejectedBatchItems.length;
          console.log(`  Call ${i + 1}: Generated ${parsedResponse.items.length}, ` +
            `StructValid: 0, Rejected: ${rejectedBatchItems.length}`);
        }
        
        // Early exit if we already have enough
        if (allValidItems.length >= targetCount) break;
      }
      
      // Track consecutive failures for adaptive strategies
      if (waveValidCount === 0) {
        consecutiveFailures++;
        stagnantWaves++;
      } else {
        consecutiveFailures = 0;
        stagnantWaves = 0;
        sliceRandomOffset = 0;
        
        // Decay token multiplier gradually on success
        if (tokenMultiplier > 1.0) {
          const prevMultiplier = tokenMultiplier;
          tokenMultiplier = Math.max(tokenMultiplier * 0.85, 1.0);
          console.log(`Token multiplier decayed ${prevMultiplier.toFixed(2)}x → ${tokenMultiplier.toFixed(2)}x (successful wave)`);
        }
      }
      
      // Show progress
      const progress = Math.min(100, Math.round((allValidItems.length / targetCount) * 100));
      console.log(`Wave ${wave + 1} result: +${waveValidCount} verified, +${waveRejectedCount} rejected | Total: ${allValidItems.length}/${targetCount} (${progress}%)`);
      
      // 🛑 Stop early on consecutive zero-yield waves.
      // When the deterministic seed already covers ≥80% of the target,
      // further LLM waves are unlikely to produce anything useful (most
      // sentences are already consumed), so bail after just 3 failures.
      const deterministicCoverage = (_deterministicSeed?.length ?? 0) / targetCount;
      const stagnantLimit = deterministicCoverage >= 0.8 ? 3 : 10;
      if (stagnantWaves >= stagnantLimit) {
        console.warn(`⚠ ${stagnantWaves} consecutive zero-yield waves (limit=${stagnantLimit}, detCoverage=${Math.round(deterministicCoverage * 100)}%) — stopping early. Returning ${allValidItems.length}/${targetCount} collected items.`);
        break; // exits the while loop
      }

      wave++;
      
      if (allValidItems.length >= targetCount) {
        console.log(`✓ Target reached! Collected ${allValidItems.length} verified items in ${wave} waves (${totalApiCalls} API calls)`);
        break;
      }

      if (wave >= 3 && allValidItems.length < targetCount * 0.3) {
        console.warn(`⚠ Low progress after ${wave} waves (${allValidItems.length}/${targetCount}).`);
      }
    }
    
    // Final validation
    if (allValidItems.length === 0) {
      throw new Error('No valid quiz items generated after multiple attempts');
    }
    
    // Trim to exact count if we got more (expected with overgeneration)
    // All items in allValidItems have already passed both structural
    // validation AND factual verification during the wave loop.
    const finalItems = allValidItems.slice(0, count);

    if (finalItems.length < count) {
      console.warn(`⚠ Could only produce ${finalItems.length}/${count} verified items after ${wave} waves.`);
    }
    
    // Calculate elapsed time
    const endTime = Date.now();
    const elapsedMs = endTime - startTime;
    const elapsedSeconds = Math.floor(elapsedMs / 1000);
    const minutes = Math.floor(elapsedSeconds / 60);
    const seconds = elapsedSeconds % 60;
    const timeString = minutes > 0 ? `${minutes}m ${seconds}s` : `${seconds}s`;
    
    console.log(`\n=== Generation Complete ===`);
    console.log(`Requested: ${count} (target with buffer: ${targetCount})`);
    console.log(`Total verified items generated: ${allValidItems.length}`);
    console.log(`Final items returned: ${finalItems.length}`);
    console.log(`Rejected items: ${allRejectedItems.length}`);
    console.log(`Total waves: ${wave} (${totalApiCalls} API calls)`);
    console.log(`Success rate: ${Math.round((allValidItems.length / Math.max(allValidItems.length + allRejectedItems.length, 1)) * 100)}%`);
    console.log(`JSON parse errors (possible truncations): ${jsonParseErrors}`);
    console.log(`Time elapsed: ${timeString}`);
    console.log(`===========================\n`);

    // Actionable warning if many parse errors — token budget is likely too tight
    if (jsonParseErrors >= 2) {
      console.warn(
        `⚠ ${jsonParseErrors} JSON parse errors detected — responses may be truncated by the num_predict cap. ` +
        `Consider increasing per-item token budgets (tokensPerItem) if this affects output quality.`
      );
    }
    
    if (finalItems.length < count) {
      console.warn(`Generated ${finalItems.length} verified items out of ${count} requested (${wave} waves)`);
    } else {
      console.log(`Successfully generated ${finalItems.length} verified items in ${wave} waves (${totalApiCalls} API calls)`);
    }
    
    return {
      type: type === 'MCQ' ? 'mcq' : type === 'FILL_IN_BLANK' ? 'fill_blank' : 'flashcard',
      difficulty: difficulty.toLowerCase(),
      items: finalItems,
      rejectedItems: allRejectedItems,
      stats: {
        requested: count,
        generated: finalItems.length,
        rejected: allRejectedItems.length,
        waves: wave,
        apiCalls: totalApiCalls
      }
    };
    
  } catch (error) {
    console.error('Error generating quiz with Gemma:', error);
    throw new Error(`Failed to generate quiz: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

// ============================================================================
// PROMPT BUILDING FUNCTIONS
// ============================================================================

/**
 * Build the appropriate prompt based on quiz type
 */
function buildPrompt(
  type: 'MCQ' | 'FILL_IN_BLANK' | 'FLASHCARD',
  difficulty: 'EASY' | 'MEDIUM' | 'HARD',
  count: number,
  summary: string,
  recentConcepts: string[] = [],
  usedSentences: string[] = [],
  keyConcepts: { term: string; definition: string }[] = []
): string {
  switch (type) {
    case 'MCQ':
      return buildMCQPrompt(difficulty, count, summary, recentConcepts, usedSentences, keyConcepts);
    case 'FILL_IN_BLANK':
      return buildFillInBlankPrompt(difficulty, count, summary, recentConcepts, usedSentences, keyConcepts);
    case 'FLASHCARD':
      return buildFlashcardPrompt(difficulty, count, summary, recentConcepts, usedSentences, keyConcepts);
    default:
      throw new Error(`Unknown quiz type: ${type}`);
  }
}

/**
 * Build MCQ generation prompt with Bloom's taxonomy difficulty separation
 * and key-concept-aware distractors.
 */
function buildMCQPrompt(difficulty: string, count: number, summary: string, recentConcepts: string[] = [], usedQuestions: string[] = [], keyConcepts: { term: string; definition: string }[] = []): string {
  // ── EASY: Ultra-minimal prompt to maximize model compliance ──
  // The 4B model fails to produce valid JSON when the prompt is complex.
  // For Easy recall questions, strip everything to the bare minimum:
  // no usedBlock (dedup handled by seenItems), no conceptsBlock.
  if (difficulty === 'EASY') {
    return `Create ${count} EASY multiple-choice questions from the summary below. Output ONLY valid JSON.

SUMMARY:
${summary}

RULES:
- Test simple recall — definitions, direct facts.
- Question patterns: "What is X?" or "Which term describes...?"
- Correct answer must be directly stated in the summary.
- 3 wrong choices must be clearly wrong (different category).
- Each question on a DIFFERENT concept.
- Explanation: 1 sentence starting with "The correct answer is '...' because ...".
- Do NOT include any text outside the JSON.

{"type":"mcq","difficulty":"easy","items":[{"question":"What is...?","choices":["correct","wrong1","wrong2","wrong3"],"answerIndex":0,"explanation":"The correct answer is 'correct' because ..."}]}`;
  }

  // ── MEDIUM / HARD: Lean prompt — difficulty guide + key concepts + slim rules ──
  // Removed: BAD examples (model doesn't need them), "FIRST decide answer" rule
  // (adds reasoning load), full used-question dump (replaced with concept terms).
  // This reduces constraint saturation on the 4B model.
  const diffGuide: Record<string, string> = {
    MEDIUM: `MEDIUM = Understanding / Comparison (Bloom's Level 2-3)
- Test PURPOSE, DIFFERENCE, or INTERPRETATION
- Patterns: "What is the purpose of X?", "Why is X used for...?", "What is the difference between X and Y?"
- Wrong choices should be plausible (same domain) but distinguishable`,
    HARD: `HARD = Application / Analysis (Bloom's Level 4-5)
- Present a concise SCENARIO (1-2 sentences) or multi-concept question
- Patterns: "Given [situation], what happens?", "A system has [problem]... Which [concept] applies?"
- All choices must seem reasonable — only deep understanding reveals the correct one
- Explanation: 1-2 sentences.`
  };

  const avoid = recentConcepts.length > 0 ? `\nAVOID these topics: ${recentConcepts.join(', ')}` : '';

  // ── Lightweight used-concepts injection ──
  // Instead of dumping 30 full question strings (which bloats context and
  // confuses the model), inject only the concept TERMS that have been covered.
  // This is lighter, cleaner, and more effective at preventing topic repetition.
  const usedConceptTerms: string[] = [];
  if (usedQuestions.length > 0 && keyConcepts.length > 0) {
    for (const kc of keyConcepts) {
      const normTerm = normalizeText(kc.term);
      if (usedQuestions.some(q => normalizeText(q).includes(normTerm))) {
        usedConceptTerms.push(kc.term);
      }
    }
  }
  const usedBlock = usedConceptTerms.length > 0
    ? `\nUSED CONCEPTS (avoid repeating as primary topic): ${usedConceptTerms.join(', ')}\n`
    : '';

  // Compute which key concepts haven't been covered by existing questions.
  const unusedConcepts = keyConcepts.filter(k => {
    const normTerm = normalizeText(k.term);
    return !usedQuestions.some(q => normalizeText(q).includes(normTerm));
  });

  // Build KEY CONCEPTS block — show unused concepts with definitions to guide
  // the model toward fresh topics. Keep it compact.
  let keyConceptsBlock: string;
  if (unusedConcepts.length > 0) {
    keyConceptsBlock = `\nFOCUS ON THESE CONCEPTS:\n${unusedConcepts.map(k => `- ${k.term}${k.definition ? ': ' + k.definition : ''}`).join('\n')}\n`;
  } else if (keyConcepts.length > 0) {
    keyConceptsBlock = `\nKEY CONCEPTS:\n${keyConcepts.map(k => `- ${k.term}`).join('\n')}\n`;
  } else {
    keyConceptsBlock = '';
  }

  return `Create up to ${count} ${difficulty} MCQs from the summary. Output ONLY valid JSON. Return fewer if needed.${avoid}${usedBlock}

SUMMARY:
${summary}${keyConceptsBlock}

DIFFICULTY:
${diffGuide[difficulty] || diffGuide.MEDIUM}

RULES:
1. Content from summary only — no outside knowledge
2. Avoid repeating the same primary concept. Different angles on a concept are OK.
3. Correct answer must DIRECTLY answer the question
4. Keep ALL choices concise (a few words each) — do NOT use full definitions or long sentences as choices
5. Distractors should be plausible within the same domain (from KEY CONCEPTS or summary)
6. answerIndex MUST point to the correct choice
7. Explanation: 1 sentence starting with "The correct answer is '...' because ..."
8. If asking "What is X?", answer must be X's definition — NOT the term X itself

{"type":"mcq","difficulty":"${difficulty.toLowerCase()}","items":[{"question":"...","choices":["correct","wrong1","wrong2","wrong3"],"answerIndex":0,"explanation":"The correct answer is '...' because ..."}]}`;
}

/**
 * Build a focused prompt for a SINGLE Hard MCQ based on one specific concept.
 *
 * Used by the concept-by-concept Hard MCQ loop. Keeps the prompt minimal:
 * summary + concept definition + 6 compact rules + single-item JSON template.
 * This eliminates truncation (only 1 item to generate) and ensures each
 * question targets a distinct concept.
 */
function buildHardMCQPrompt(
  concept: { term: string; definition: string },
  summary: string,
  keyConcepts: { term: string; definition: string }[] = []
): string {
  // Provide other key terms as potential distractor sources
  const otherTerms = keyConcepts
    .filter(k => k.term !== concept.term)
    .map(k => k.term)
    .slice(0, 10);
  const distractorHint = otherTerms.length > 0
    ? `\nDISTRACTOR TERMS (pick 3 for wrong choices): ${otherTerms.join(', ')}`
    : '';

  return `Generate ONE HARD multiple-choice question about "${concept.term}" from the summary below. Output ONLY valid JSON.

SUMMARY:
${summary}

CONCEPT: ${concept.term}
DEFINITION: ${concept.definition || 'See summary for details.'}${distractorHint}

RULES:
1. Create a concise scenario (1-2 sentences) requiring application or analysis of this concept
2. Keep ALL choices concise (a few words each) — no full definitions
3. Correct answer must directly relate to the concept
4. 3 wrong choices must be plausible terms from the same domain
5. answerIndex MUST point to the correct choice
6. Explanation: 1-2 sentences starting with "The correct answer is '...' because ..."

{"question":"...","choices":["correct","wrong1","wrong2","wrong3"],"answerIndex":0,"explanation":"The correct answer is '...' because ..."}`;
}

/**
 * Build fill-in-blank generation prompt
 */
function buildFillInBlankPrompt(difficulty: string, count: number, summary: string, recentConcepts: string[] = [], usedSentences: string[] = [], keyConcepts: { term: string; definition: string }[] = []): string {
  const diffGuide: Record<string, string> = {
    EASY: 'Blank a simple noun or name. Single word answer. Obvious clues.',
    MEDIUM: 'Blank a technical term or concept. Context helps but not obvious.',
    HARD: 'Blank a multi-word key term or conceptual phrase. Use longer sentences. Requires deep understanding.'
  };

  const avoid = recentConcepts.length > 0
    ? `\nDo NOT reuse these terms or sentences — pick DIFFERENT ones: ${recentConcepts.join(', ')}`
    : '';

  // Inject already-used sentences so the model doesn't regenerate them.
  // Cap at 15 to avoid exceeding context window on very large runs.
  const usedBlock = usedSentences.length > 0
    ? `\n\nIMPORTANT: The following sentences have ALREADY been used. You MUST NOT output any of these again or any sentence covering the same concept. Any repeated sentence will be REJECTED.\n${usedSentences.slice(-30).map(s => `- ${s}`).join('\n')}\n`
    : '';

  // Build KEY CONCEPTS block when available — tells the model exactly which
  // terms are worth blanking and which terms make good distractors.
  const keyConceptsBlock = keyConcepts.length > 0
    ? `\n\nKEY CONCEPTS (use these for blanks and distractors):\n${keyConcepts.map(k => `- ${k.term}`).join('\n')}\n`
    : '';

  return `You are a strict quiz generator. Output ONLY valid JSON — no greetings, no extra text, no explanations outside the JSON structure.
Create ${count} ${difficulty} fill-in-the-blank items from this summary.${avoid}${usedBlock}

SUMMARY:
${summary}${keyConceptsBlock}

CRITICAL RULES — follow ALL or the item will be rejected:
1. Copy sentences EXACTLY from the summary — do NOT paraphrase, reword, or add any words.
2. Each sentence has exactly one [blank] replacing a KEY CONCEPT, TECHNICAL TERM, or IMPORTANT NAME — NOT a common word (not "the", "is", "and", "a", etc.).
3. Answer must be a word/phrase that appears VERBATIM in the original sentence.
4. The answer must be the COMPLETE term (e.g., "bias-variance tradeoff" not just "tradeoff").
5. Each item must use a DIFFERENT sentence from a DIFFERENT part of the summary — never repeat.
6. "distractors" must be a JSON array of exactly 3 strings: ["a","b","c"].
7. Distractors MUST be chosen from the KEY CONCEPTS list above (if provided). Pick exactly 3 terms from that list that are WRONG for this blank but plausible. Do NOT invent your own terms — every distractor must appear in the KEY CONCEPTS list or verbatim in the summary.
8. If you cannot find ${count} different sentences, return FEWER items — quality over quantity.
9. The answer must NOT be an example value when the blank should be a CATEGORY (e.g., blank should be "algorithms" not "linear regression").
10. ⚠️ NEVER include greetings like "good morning", "hello", "welcome", or any conversational text. Output ONLY the JSON object described below.
- ${diffGuide[difficulty] || diffGuide.MEDIUM}

EXAMPLE — GOOD vs BAD:
GOOD: {"sentence":"A [blank] stores data in tables with rows and columns.","answer":"Relational Database","distractors":["NoSQL Database","Primary Key","Index"]}
  ✓ Sentence is exact from summary, blank is a key concept, distractors are other key concepts that don't fit.
BAD:  {"sentence":"The [blank] is very important in databases.","answer":"thing","distractors":["stuff","item","object"]}
  ✗ Sentence is paraphrased, answer is generic, distractors are not real terms.

{"type":"fill_blank","difficulty":"${difficulty.toLowerCase()}","items":[{"sentence":"The [blank] is responsible for...","answer":"term","distractors":["wrong1","wrong2","wrong3"]}]}`;
}

/**
 * Build flashcard generation prompt with Bloom's taxonomy difficulty separation
 */
function buildFlashcardPrompt(difficulty: string, count: number, summary: string, recentConcepts: string[] = [], usedSentences: string[] = [], keyConcepts: { term: string; definition: string }[] = []): string {
  // ── Bloom's taxonomy difficulty templates ──
  const diffGuide: Record<string, string> = {
    EASY: `EASY = Recall (Bloom's Level 1)
- Front: "What is [term]?" — simple definition question
- Back: 1-2 sentence definition directly from the summary
- One concept per card`,
    MEDIUM: `MEDIUM = Understanding (Bloom's Level 2-3)
- Front: "What is the purpose of X?", "How does X work?", "What is the difference between X and Y?"
- Back: 2-3 sentence explanation with purpose or comparison
- Front MUST include "purpose", "how", "why", "difference", or "explain"`,
    HARD: `HARD = Application / Analysis (Bloom's Level 4-5)
- Front: Concise scenario (1-2 sentences) or multi-concept comparison
- Back: 2-3 sentence analysis, explanation, or troubleshooting reasoning
- Front MUST describe a situation or ask "what would happen if..."
- Keep both front and back concise — focus on the core concept`
  };

  const avoid = recentConcepts.length > 0 ? `\nAVOID these topics: ${recentConcepts.join(', ')}` : '';

  // ── Lightweight used-concepts injection for flashcards ──
  // Instead of dumping 30 full front strings, inject only concept TERMS covered.
  const usedConceptTerms: string[] = [];
  if (usedSentences.length > 0 && keyConcepts.length > 0) {
    for (const kc of keyConcepts) {
      const normTerm = normalizeText(kc.term);
      if (usedSentences.some(s => normalizeText(s).includes(normTerm))) {
        usedConceptTerms.push(kc.term);
      }
    }
  }
  const usedBlock = usedConceptTerms.length > 0
    ? `\nCOVERED CONCEPTS (use different angles or skip): ${usedConceptTerms.join(', ')}\n`
    : '';

  // Compute which key concepts haven't been covered by existing flashcards.
  // This is the key to preventing duplicate exhaustion: instead of just saying
  // "don't repeat these", we tell the model exactly which topics remain.
  const unusedConcepts = keyConcepts.filter(k => {
    const normTerm = normalizeText(k.term);
    // A concept is "used" if any existing front mentions the term
    return !usedSentences.some(s => normalizeText(s).includes(normTerm));
  });

  // Build KEY CONCEPTS block — prioritize unused concepts when available
  let keyConceptsBlock: string;
  if (unusedConcepts.length > 0) {
    // Show unused concepts with definitions to guide the model toward fresh topics
    keyConceptsBlock = `\n\nREMAINING UNUSED CONCEPTS (PRIORITIZE these — create cards about these FIRST):\n${unusedConcepts.map(k => `- ${k.term}${k.definition ? ': ' + k.definition : ''}`).join('\n')}\n`;
  } else if (keyConcepts.length > 0) {
    // All concepts used — show full list and encourage different angles/phrasings
    keyConceptsBlock = `\n\nKEY CONCEPTS (all topics covered — create cards with DIFFERENT question angles, comparisons, or applications):\n${keyConcepts.map(k => `- ${k.term}`).join('\n')}\n`;
  } else {
    keyConceptsBlock = '';
  }

  return `Create ${count} ${difficulty} flashcards from this summary. Output ONLY valid JSON.${avoid}${usedBlock}

SUMMARY:
${summary}${keyConceptsBlock}

DIFFICULTY LEVEL:
${diffGuide[difficulty] || diffGuide.MEDIUM}

RULES:
- Content from summary only, no outside knowledge
- Each card on a different concept
- Use exact terminology from the summary

{"type":"flashcard","difficulty":"${difficulty.toLowerCase()}","items":[{"front":"What is...?","back":"It is..."}]}`;
}
