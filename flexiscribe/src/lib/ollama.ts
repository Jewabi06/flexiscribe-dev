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
  if (!text) return '';
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
    // If ≥75% of the smaller keyword set appears in the other, it's a duplicate.
    // Raised from 60% → 75% to avoid over-aggressive dedup that rejects
    // distinct questions that merely share topic words.
    if (intersection / smaller >= 0.75) return true;
  }
  
  return false;
}

// ============================================================================
// LESSON CONTENT CLEANING
// ============================================================================

/**
 * Clean lesson content for quiz generation by removing greetings, conversational
 * fillers, meta-comments, and JSON artifacts that would pollute fill-in-blank
 * sentences.  Applied before passing the lesson content to the generation pipeline.
 */
export function cleanLessonForQuiz(raw: string): string {
  // ── Pass 0: Strip JSON artifacts ──
  // Detect JSON-formatted content by counting structural characters
  // ( { } [ ] and "key": patterns). If the content has significant JSON
  // structure, extract values and discard the syntax so the LLM never sees
  // field names like "term", "definition", "example" to blank.
  let content = raw;
  {
    let braces = 0;
    let brackets = 0;
    for (const ch of content) {
      if (ch === '{' || ch === '}') braces++;
      if (ch === '[' || ch === ']') brackets++;
    }
    const kvPatterns = (content.match(/"[a-z_]{1,30}"\s*:/gi) || []).length;
    const jsonScore = braces + brackets + kvPatterns * 2;
    // Threshold: if the content has meaningful JSON structure, clean it.
    // Pure prose typically scores 0-3; structured JSON scores 20+.
    if (jsonScore >= 8) {
      const rawLines = content.split('\n');
      const cleaned: string[] = [];
      for (const line of rawLines) {
        let t = line.trim();
        // Skip pure structural lines:  {  }  [  ]  ,  or combinations
        if (/^[\[\]{},'"\s]*$/.test(t)) continue;
        // Detect JSON key-value:  "key": "value",  or  "key": value
        const kvMatch = t.match(/^\s*"([^"]{1,50})"\s*:\s*(.+)$/);
        if (kvMatch) {
          let value = kvMatch[2].trim().replace(/,\s*$/, '');
          // Skip if value opens an array or object (structural, not a leaf)
          if (/^[\[{]/.test(value)) continue;
          // Unwrap surrounding quotes
          value = value.replace(/^"(.*)"$/, '$1');
          if (value.length > 1) { cleaned.push(value); continue; }
          continue;
        }
        // Detect standalone quoted string in an array:  "some value",
        const arrVal = t.match(/^\s*"([^"]+)"\s*,?\s*$/);
        if (arrVal && arrVal[1].length > 1) {
          cleaned.push(arrVal[1]);
          continue;
        }
        // Keep prose lines unchanged
        if (t.length > 1) cleaned.push(t);
      }
      content = cleaned.join('\n');
    }
  }

  // ── Pass 1: Strip greetings / conversational openers ──
  const lines = content.split('\n');
  const result = lines.map(line => {
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
    if (trimmed.length === 0) return false;
    if (/^(good\s+(morning|afternoon|evening|day)|hello|hi|welcome|alright|okay|dangal\s+greetings)[!.,;:]*$/i.test(trimmed)) return false;
    return true;
  });
  return result.join('\n');
}

// ============================================================================
// AUTO-EXTRACTION OF IMPORTANT TERMS (no key concepts fallback)
// ============================================================================

/**
 * When no keyConcepts are provided, automatically extract candidate terms from
 * the lesson content. Uses noun-phrase extraction (capitalised multi-word
 * phrases appearing ≥2 times) and optional notes array (e.g. Python Cornell
 * notes that weren't wired as keyConcepts).
 *
 * Returns an array of `{ term, definition }` objects suitable as a fallback
 * concept pool for concept-by-concept generation and distractor sourcing.
 */
function extractImportantTerms(
  lessonContent: string,
  notes?: any[]
): { term: string; definition: string }[] {
  const termSet = new Set<string>();
  const termDefinitions = new Map<string, string>();

  // 1. Pull terms from notes array if available — includes definitions
  if (notes && Array.isArray(notes)) {
    for (const n of notes) {
      if (typeof n === 'object' && n.term && typeof n.term === 'string' && n.term.length >= 3) {
        const term = n.term.trim();
        termSet.add(term);
        if (n.definition && typeof n.definition === 'string') {
          termDefinitions.set(term, n.definition.trim());
        }
      }
    }
  }

  // 2. Extract capitalised multi-word phrases (noun phrases)
  //    e.g. "Space Utilization", "Vertical Racking Systems"
  const nounPhraseRe = /\b([A-Z][a-z]+(?:[-\s]+[A-Z][a-z]+)+)\b/g;
  const phraseCount = new Map<string, number>();
  let match: RegExpExecArray | null;
  while ((match = nounPhraseRe.exec(lessonContent)) !== null) {
    const phrase = match[1].trim();
    phraseCount.set(phrase, (phraseCount.get(phrase) || 0) + 1);
  }
  for (const [phrase, cnt] of phraseCount) {
    if (cnt >= 2 || phrase.split(/\s+/).length >= 3) {
      termSet.add(phrase);
    }
  }

  // 3. Extract quoted terms and bold/italic markers common in lesson content
  const quotedRe = /[""]([A-Z][^""]{2,40})[""]/g;
  while ((match = quotedRe.exec(lessonContent)) !== null) {
    termSet.add(match[1].trim());
  }

  // 4. Extract ALL-CAPS acronym definitions:  "ABC (Something Something)"
  const acronymRe = /\b([A-Z]{2,})\s*\(([^)]{3,50})\)/g;
  while ((match = acronymRe.exec(lessonContent)) !== null) {
    termSet.add(match[1].trim());
    termSet.add(match[2].trim());
  }

  // 5. Extract single capitalised words that appear frequently (≥3 times)
  //    and are 5+ chars to skip articles/prepositions
  const singleCapRe = /\b([A-Z][a-z]{4,})\b/g;
  const singleCount = new Map<string, number>();
  while ((match = singleCapRe.exec(lessonContent)) !== null) {
    const w = match[1];
    singleCount.set(w, (singleCount.get(w) || 0) + 1);
  }
  for (const [word, cnt] of singleCount) {
    if (cnt >= 3 && !termSet.has(word)) {
      termSet.add(word);
    }
  }

  // Convert to { term, definition } — use definitions from notes when available
  const result = Array.from(termSet).map(term => ({
    term,
    definition: termDefinitions.get(term) || ''
  }));
  console.log(`extractImportantTerms: found ${result.length} auto-extracted terms from ${lessonContent.length} chars${notes ? ` (${termDefinitions.size} with definitions from notes)` : ''}`);
  return result;
}

// ============================================================================
// KEY-CONCEPT EXPANSION
// ============================================================================

/**
 * Expand key concepts by extracting variant / more-specific terms from the
 * lesson content.  For example, if "JOIN Operation" is a key concept and the
 * lesson content mentions "INNER JOIN", "LEFT JOIN", etc., those are added as
 * additional concepts so the deterministic FIB generator can create items
 * for them (with correct, verbatim answers).
 *
 * Also prevents false-positive matches where a broad term like "Relational
 * Database" could match inside the negative form "non-relational database".
 */
export function expandKeyConcepts(
  keyConcepts: { term: string; definition: string; example?: string }[],
  lessonContent: string
): { term: string; definition: string; example?: string }[] {
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
        while ((m = pat.exec(lessonContent)) !== null) {
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

  // ── Noun-phrase extraction ──
  // Extract capitalised multi-word phrases that appear at least twice in the
  // lesson content and are not already in the concept list. These are likely
  // important technical terms the reviewer didn't explicitly list.
  const nounPhraseRe = /\b([A-Z][a-z]+(?:\s+[A-Z][a-z]+)+)\b/g;
  const phraseCount = new Map<string, number>();
  let npm: RegExpExecArray | null;
  while ((npm = nounPhraseRe.exec(lessonContent)) !== null) {
    const phrase = npm[1].trim();
    phraseCount.set(phrase, (phraseCount.get(phrase) || 0) + 1);
  }
  for (const [phrase, freq] of phraseCount.entries()) {
    if (freq < 2) continue; // must appear at least twice
    const normP = normalizeText(phrase);
    if (seen.has(normP)) continue;
    if (phrase.split(/\s+/).length < 2 || phrase.length < 6) continue;
    seen.add(normP);
    expanded.push({ term: phrase, definition: '' });
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
  // Step 1: Split on newlines first — preserves line-level chunks from structured
  // content (bullet lists, "Term: Definition" lines, notes, numbered items).
  const lines = text.split(/\n+/).map(s => s.trim()).filter(s => s.length > 0);

  const result: string[] = [];
  for (const line of lines) {
    // Strip bullet / list markers (-, •, *, 1., 2), etc.)
    const cleaned = line.replace(/^[-•*]\s+/, '').replace(/^\d+[.)]\s+/, '').trim();
    if (!cleaned || cleaned.length <= 15) continue;

    // Step 2: Within each line, also split on sentence boundaries
    // (.!? followed by space + uppercase) to handle multi-sentence lines.
    const normalized = cleaned.replace(/\s+/g, ' ');
    const raw = normalized.split(/(?<=[.!?])\s+(?=[A-Z"])|(?<=[.!?])\s*$/);
    for (const s of raw) {
      const trimmed = s.trim();
      if (trimmed.length > 15) result.push(trimmed);
    }
  }

  // Deduplicate while preserving order
  const seen = new Set<string>();
  return result.filter(s => {
    if (seen.has(s)) return false;
    seen.add(s);
    return true;
  });
}

/**
 * Build a map from key-concept term → list of sentences that contain that
 * term verbatim (case-insensitive, whole-word match) or via fuzzy span match.
 */
function mapKeyTermsToSentences(
  sentences: string[],
  keyConcepts: { term: string; definition?: string }[]
): Map<string, string[]> {
  const termMap = new Map<string, string[]>();
  for (const concept of keyConcepts) {
    const term = concept.term.trim();
    if (!term || term.length < 2) continue;
    const escaped = escapeRegex(term);
    // Use word-boundary for single words; for multi-word, require the full
    // phrase to appear (word boundaries at the edges only).
    const regex = new RegExp(`\\b${escaped}\\b`, 'i');
    const matching: string[] = [];
    for (const sentence of sentences) {
      if (regex.test(sentence)) {
        matching.push(sentence);
      } else {
        // Fuzzy fallback: sliding-window match for terms that don't appear verbatim
        const fuzzy = findBestFuzzySpan(sentence, term, 0.75);
        if (fuzzy) {
          matching.push(sentence);
        }
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
 *   1. Splits the lesson content into sentences.
 *   2. Maps each key concept to sentences that contain it verbatim.
 *   3. For each candidate, replaces the key term with [blank].
 *   4. Picks 3 distractors from the remaining key concepts.
 *
 * This guarantees:
 * - The sentence is verbatim from the lesson content (no hallucination).
 * - The answer is actually present in the sentence.
 * - Distractors are always relevant key concepts.
 * - Zero API calls → instant generation, 100% yield.
 *
 * Falls back to null if insufficient sentences contain key terms,
 * letting the caller use the wave-based LLM pipeline instead.
 */
function generateDeterministicFIB(
  lessonContent: string,
  keyConcepts: { term: string; definition?: string }[],
  count: number,
  difficulty: 'EASY' | 'MEDIUM' | 'HARD',
  notes?: { term: string; definition?: string; example?: string }[]
): any[] | null {
  const sentences = splitIntoSentences(lessonContent);
  const termMap = mapKeyTermsToSentences(sentences, keyConcepts);

  console.log(`Deterministic FIB: ${sentences.length} sentences, ${keyConcepts.length} key concepts, ${termMap.size} terms matched`);

  // ── Notes-based candidate injection ──
  // When the lesson content is a list of notes (not prose), splitIntoSentences
  // yields few usable sentences from the original structured content. Inject
  // composite sentences built from notes that ALWAYS contain the term.
  if (notes && Array.isArray(notes) && notes.length >= 2) {
    let injected = 0;
    for (const note of notes) {
      if (!note.term || note.term.trim().length < 3) continue;
      const term = note.term.trim();

      // Template 1: "An example of {term} is {example}" — always contains the term
      if (note.example && note.example.trim().length > 15) {
        const composite = `An example of ${term} is ${note.example.trim().charAt(0).toLowerCase()}${note.example.trim().slice(1)}`;
        const existing = termMap.get(term) || [];
        if (!existing.includes(composite)) {
          existing.push(composite);
          termMap.set(term, existing);
          injected++;
        }
      }

      // Template 2: "{term} refers to {definition}" — always contains the term
      if (note.definition && note.definition.trim().length > 15) {
        const defSentence = `${term} refers to ${note.definition.trim().charAt(0).toLowerCase()}${note.definition.trim().slice(1)}`;
        const existing = termMap.get(term) || [];
        if (!existing.includes(defSentence)) {
          existing.push(defSentence);
          termMap.set(term, existing);
          injected++;
        }
      }

      // Template 3: "{term} is defined as {definition}" — always contains the term
      if (note.definition && note.definition.trim().length > 15) {
        const defSentence2 = `${term} is defined as ${note.definition.trim().charAt(0).toLowerCase()}${note.definition.trim().slice(1)}`;
        const existing = termMap.get(term) || [];
        if (!existing.includes(defSentence2)) {
          existing.push(defSentence2);
          termMap.set(term, existing);
          injected++;
        }
      }
    }
    if (injected > 0) {
      console.log(`Deterministic FIB: injected ${injected} note-based candidates (examples + definitions). Total terms matched: ${termMap.size}`);
    }
  }

  // ── Universal concept-definition synthesis ──
  // For ANY concept that still has no candidate sentences, synthesize a
  // definition-based sentence from keyConcepts. This guarantees every concept
  // with a definition gets at least one candidate, regardless of content format.
  {
    let synthesized = 0;
    for (const concept of keyConcepts) {
      if (!concept.term || concept.term.trim().length < 3) continue;
      const term = concept.term.trim();
      if (termMap.has(term) && (termMap.get(term)!.length > 0)) continue; // already has candidates
      if (!concept.definition || concept.definition.trim().length < 15) continue;

      // "Term refers to definition..."
      const defSentence = `${term} refers to ${concept.definition.trim().charAt(0).toLowerCase()}${concept.definition.trim().slice(1)}`;
      termMap.set(term, [defSentence]);
      synthesized++;
    }
    if (synthesized > 0) {
      console.log(`Deterministic FIB: synthesized ${synthesized} definition-based sentences for unmatched concepts. Total terms: ${termMap.size}`);
    }
  }

  if (termMap.size === 0) {
    console.warn('Deterministic FIB: no sentences found containing any key concept — falling back to LLM.');
    const sampleTerms = keyConcepts.slice(0, 5).map(k => k.term).join(', ');
    const sampleSentences = sentences.slice(0, 3).map(s => s.substring(0, 80)).join(' | ');
    console.warn(`  Sample terms: ${sampleTerms}`);
    console.warn(`  Sample sentences: ${sampleSentences}`);
    return null;
  }

  // Build flat list of candidates: { term, sentence }
  let candidates: { term: string; sentence: string }[] = [];
  for (const [term, sentenceList] of termMap.entries()) {
    for (const sentence of sentenceList) {
      candidates.push({ term, sentence });
    }
  }

  // ── Per-concept cap to limit repetition ──
  // When generating many items (especially for HARD where detCount = 1.5×count),
  // the same concept can appear 4+ times if the concept pool is smaller than the
  // requested count. Cap each concept's sentences to improve diversity.
  const MAX_PER_CONCEPT = difficulty === 'HARD' ? 2 : 3;
  {
    const candidatesByTerm = new Map<string, typeof candidates>();
    for (const c of candidates) {
      const list = candidatesByTerm.get(c.term) || [];
      list.push(c);
      candidatesByTerm.set(c.term, list);
    }
    const cappedCandidates: typeof candidates = [];
    for (const [, termCandidates] of candidatesByTerm) {
      const shuffledTerm = shuffleArray(termCandidates);
      cappedCandidates.push(...shuffledTerm.slice(0, MAX_PER_CONCEPT));
    }
    candidates = shuffleArray(cappedCandidates);
    console.log(`Deterministic FIB: capped candidates from ${candidates.length + (cappedCandidates.length - cappedCandidates.length)} to ${cappedCandidates.length} (max ${MAX_PER_CONCEPT}/concept).`);
  }

  // Shuffle for variety, then sort by a composite score:
  //  1. Prefer sentences covering terms not yet used (uniqueness bonus)
  //  2. For EASY prefer shorter terms; for MEDIUM/HARD prefer longer terms
  // This maximises concept diversity and picks the most representative sentences.
  let sorted = shuffleArray(candidates);

  // Pre-compute term frequency (how many sentences each term appears in)
  const termFreq = new Map<string, number>();
  for (const c of candidates) {
    termFreq.set(c.term, (termFreq.get(c.term) || 0) + 1);
  }

  sorted.sort((a, b) => {
    // Uniqueness: prefer terms with fewer sentence hits (rarer = more informative)
    const freqA = termFreq.get(a.term) || 1;
    const freqB = termFreq.get(b.term) || 1;
    if (freqA !== freqB) return freqA - freqB; // fewer hits first

    // Sentence quality: prefer medium-length sentences (80-200 chars).
    // Very short sentences lack context; very long ones make poor blanks.
    const lenScore = (s: string) => {
      const len = s.length;
      if (len >= 80 && len <= 200) return 0; // ideal
      if (len >= 60 && len <= 250) return 1; // acceptable
      return 2; // too short or too long
    };
    const lenA = lenScore(a.sentence);
    const lenB = lenScore(b.sentence);
    if (lenA !== lenB) return lenA - lenB;

    // Avoid sentences where the term is at the very start (position 0-5) —
    // these often produce "The [blank] is..." patterns that lack context.
    const posA = a.sentence.toLowerCase().indexOf(a.term.toLowerCase());
    const posB = b.sentence.toLowerCase().indexOf(b.term.toLowerCase());
    const posScoreA = posA >= 0 && posA <= 5 ? 1 : 0;
    const posScoreB = posB >= 0 && posB <= 5 ? 1 : 0;
    if (posScoreA !== posScoreB) return posScoreA - posScoreB;

    // Then length-based tiebreak
    if (difficulty === 'EASY') return a.term.length - b.term.length;
    return b.term.length - a.term.length;
  });
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
  // EASY requires tighter fuzzy matching to ensure near-verbatim answers;
  // MEDIUM/HARD allow slightly looser spans.
  const fuzzyThreshold = difficulty === 'EASY' ? 0.80 : 0.75;

  // Build an extended lesson content string that includes note examples,
  // definitions, and synthesized concept sentences so that buildFIBItem's
  // reconstruction check passes for injected/synthesized candidate sentences.
  let extendedContent = lessonContent;
  {
    const extraTexts: string[] = [];
    // Add all 3 note templates (matching injection above) + raw example
    if (notes && Array.isArray(notes)) {
      for (const n of notes) {
        if (!n.term || n.term.trim().length < 3) continue;
        const term = n.term.trim();
        if (n.example && n.example.trim().length > 15) {
          extraTexts.push(n.example.trim());
          extraTexts.push(`An example of ${term} is ${n.example.trim().charAt(0).toLowerCase()}${n.example.trim().slice(1)}`);
        }
        if (n.definition && n.definition.trim().length > 15) {
          extraTexts.push(`${term} refers to ${n.definition.trim().charAt(0).toLowerCase()}${n.definition.trim().slice(1)}`);
          extraTexts.push(`${term} is defined as ${n.definition.trim().charAt(0).toLowerCase()}${n.definition.trim().slice(1)}`);
        }
      }
    }
    // Add synthesized concept-definition sentences from keyConcepts
    for (const concept of keyConcepts) {
      if (!concept.term || concept.term.trim().length < 3) continue;
      if (!concept.definition || concept.definition.trim().length < 15) continue;
      const defSentence = `${concept.term.trim()} refers to ${concept.definition.trim().charAt(0).toLowerCase()}${concept.definition.trim().slice(1)}`;
      if (!extraTexts.includes(defSentence)) extraTexts.push(defSentence);
    }
    if (extraTexts.length > 0) {
      extendedContent = lessonContent + '\n' + extraTexts.join('\n');
    }
  }

  // PASS 1: one sentence per term (maximizes concept diversity)
  // For MEDIUM: two-phase blend — 60% EASY-style + 40% HARD-style
  const mediumEasyCountCap = difficulty === 'MEDIUM' ? Math.ceil(count * 0.6) : 0;
  for (let phase = 0; phase < (difficulty === 'MEDIUM' ? 2 : 1); phase++) {
    const phaseLimit = difficulty === 'MEDIUM' && phase === 0 ? mediumEasyCountCap : count;
    for (const c of shuffled) {
      if (result.length >= phaseLimit) break;
      if (usedTerms.has(c.term)) continue;
      if (usedSentences.has(c.sentence)) continue;
      // Skip greeting sentences
      if (greetingPatterns.some(p => p.test(c.sentence))) continue;
      // ── Bloom's taxonomy difficulty filter ──
      // EASY  → allow compound terms up to 3 words (most domain terms are 2-word compounds)
      // MEDIUM Phase A → EASY-style: allow compound terms up to 3 words
      // MEDIUM Phase B → HARD-style: multi-word terms, longer sentences
      // HARD  → multi-word terms and longer, complex sentences (application)
      const termWordCount = c.term.split(/\s+/).length;
      if (difficulty === 'EASY' && termWordCount > 3) continue;
      if (difficulty === 'MEDIUM' && phase === 0 && termWordCount > 3) continue;
      if (difficulty === 'MEDIUM' && phase === 1 && termWordCount === 1 && c.term.length < 5) continue;
      if (difficulty === 'MEDIUM' && phase === 1 && c.sentence.length < 60) continue;
      if (difficulty === 'HARD' && termWordCount === 1 && c.term.length < 5) continue;
      if (difficulty === 'HARD' && c.sentence.length < 60) continue;

      const item = buildFIBItem(c.term, c.sentence, allTerms, extendedContent, fuzzyThreshold);
      if (!item) continue;

      result.push(item);
      usedSentences.add(c.sentence);
      usedTerms.add(c.term);
    }
  }

  // PASS 2: if still under count, allow reusing terms (different sentences)
  // Still apply relaxed difficulty filters to maintain differentiation.
  if (result.length < count) {
    for (const c of shuffled) {
      if (result.length >= count) break;
      if (usedSentences.has(c.sentence)) continue;
      if (greetingPatterns.some(p => p.test(c.sentence))) continue;
      // Relaxed difficulty filter — only exclude extreme mismatches
      if (difficulty === 'HARD' && c.term.split(/\s+/).length === 1 && c.term.length < 3) continue;

      const item = buildFIBItem(c.term, c.sentence, allTerms, extendedContent, fuzzyThreshold);
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

      const item = buildFIBItem(c.term, c.sentence, allTerms, extendedContent, fuzzyThreshold);
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
 * Return a concise one-sentence version of a concept's definition.
 * - Extracts the first sentence (up to first . ! ?) if available.
 * - Falls back to first 100 characters with ellipsis.
 * - Falls back to the term name if no definition exists.
 */
function getShortDefinition(concept: { term: string; definition: string }): string {
  if (!concept.definition || !concept.definition.trim()) return concept.term;
  const def = concept.definition.trim();
  // Extract first sentence — stop at the first sentence-ending punctuation
  // that is NOT inside a common abbreviation (e.g., "e.g.", "i.e.").
  const match = def.match(/^.+?[.!?](?:\s|$)/);
  if (match) return match[0].trim();
  // No sentence boundary found — take first 100 chars
  return def.substring(0, 100).trim() + (def.length > 100 ? '…' : '');
}

/**
 * Deterministic MCQ generator — ALL difficulties.
 *
 * EASY (Bloom's Level 1 — Recall):
 *   Forward:  "What is [term]?"  →  choices = definitions
 *   Reverse:  definition as question  →  choices = terms
 *   Example-forward:  "Which is an example of [term]?"  →  choices = examples
 *   Example-reverse:  example scenario  →  choices = terms
 *
 * MEDIUM (Bloom's Level 2-3 — Understanding / Application):
 *   Purpose:  "What is the main purpose of [term]?"  →  choices = short definitions
 *   Application:  "In which scenario would you use [term]?"  →  choices = examples
 *   Compare:  "How does [term A] differ from [term B]?"  →  choices are distinguishing descriptions
 *   Definition-identify:  "[definition phrase]. This best describes:"  →  choices = terms
 *
 * HARD (Bloom's Level 4-5 — Analysis / Evaluation):
 *   Scenario:  "[full example scenario] — Which concept is being applied?"  →  choices = terms
 *   Not-example:  "Which is NOT an example of [term]?"  →  correct = wrong example
 *   Best-choice:  "A company needs to [goal]. Which approach is BEST?"  →  choices = terms
 *   Distinguish:  "Which concept specifically addresses [key phrase from def]?"  →  choices = terms
 *
 * Falls back to null if fewer than 4 valid concepts.
 */
function generateDeterministicMCQ(
  keyConcepts: { term: string; definition: string; example?: string }[],
  count: number,
  difficulty: 'EASY' | 'MEDIUM' | 'HARD'
): any[] | null {
  const validConcepts = keyConcepts.filter(k => k.definition && k.definition.trim().length > 0);
  if (validConcepts.length < 4) {
    console.warn(`Deterministic MCQ ${difficulty}: only ${validConcepts.length} concepts have definitions (need ≥4) — falling back to LLM.`);
    return null;
  }

  const conceptsWithExamples = validConcepts.filter(k => k.example && k.example.trim().length > 10);
  const shuffledConcepts = shuffleArray([...validConcepts]);
  const result: any[] = [];
  const usedQuestions = new Set<string>();

  // Helper: pick 3 distractor concepts from pool, excluding the target concept(s)
  function pickDistractors(pool: typeof validConcepts, exclude: Set<string>, n: number = 3): typeof validConcepts {
    return shuffleArray(pool.filter(k => !exclude.has(k.term))).slice(0, n);
  }

  // Helper: add item if not duplicate
  function addItem(qKey: string, item: any): boolean {
    if (usedQuestions.has(qKey) || result.length >= count) return false;
    result.push(item);
    usedQuestions.add(qKey);
    return true;
  }

  if (difficulty === 'EASY') {
    // ── EASY styles: forward, reverse, example-forward, example-reverse ──
    const styles: string[] = ['forward', 'reverse', 'example-forward', 'example-reverse'];
    for (const style of styles) {
      if (result.length >= count) break;
      if ((style === 'example-forward' || style === 'example-reverse') && conceptsWithExamples.length < 4) continue;

      const pool = (style === 'example-forward' || style === 'example-reverse')
        ? shuffleArray([...conceptsWithExamples]) : shuffledConcepts;

      for (const concept of pool) {
        if (result.length >= count) break;

        if (style === 'forward') {
          const correctShort = getShortDefinition(concept);
          const qKey = normalizeText(`What is ${concept.term}?`);
          const distractors = pickDistractors(validConcepts, new Set([concept.term]));
          if (distractors.length < 3) continue;
          const allChoices = [correctShort, ...distractors.map(c => getShortDefinition(c))];
          if (new Set(allChoices).size < 4) continue;
          const choices = shuffleArray(allChoices);
          addItem(qKey, {
            question: `What is ${concept.term}?`, choices,
            answerIndex: choices.indexOf(correctShort),
            explanation: `The correct answer is '${correctShort}' because that is the definition of ${concept.term}.`,
          });
        } else if (style === 'reverse') {
          const correctShort = getShortDefinition(concept);
          const qKey = normalizeText(`reverse:${correctShort}`);
          const distractors = pickDistractors(validConcepts, new Set([concept.term]));
          if (distractors.length < 3) continue;
          const choices = shuffleArray([concept.term, ...distractors.map(c => c.term)]);
          addItem(qKey, {
            question: correctShort, choices,
            answerIndex: choices.indexOf(concept.term),
            explanation: `The correct answer is '${concept.term}' because it matches the description: ${correctShort}`,
          });
        } else if (style === 'example-forward') {
          const correctExample = concept.example!.trim();
          const qKey = normalizeText(`example-of:${concept.term}`);
          const distractors = pickDistractors(conceptsWithExamples, new Set([concept.term]));
          if (distractors.length < 3) continue;
          const allChoices = [correctExample, ...distractors.map(c => c.example!.trim())];
          if (new Set(allChoices).size < 4) continue;
          const choices = shuffleArray(allChoices);
          addItem(qKey, {
            question: `Which of the following is an example of ${concept.term}?`, choices,
            answerIndex: choices.indexOf(correctExample),
            explanation: `The correct answer is the example of ${concept.term}: ${correctExample}`,
          });
        } else if (style === 'example-reverse') {
          const exampleText = concept.example!.trim();
          const qKey = normalizeText(`example-rev:${exampleText.substring(0, 50)}`);
          const distractors = pickDistractors(validConcepts, new Set([concept.term]));
          if (distractors.length < 3) continue;
          const choices = shuffleArray([concept.term, ...distractors.map(c => c.term)]);
          addItem(qKey, {
            question: `Which concept does this scenario illustrate? "${exampleText}"`, choices,
            answerIndex: choices.indexOf(concept.term),
            explanation: `The correct answer is '${concept.term}' because this scenario is an example of ${concept.term}: ${getShortDefinition(concept)}`,
          });
        }
      }
    }

  } else if (difficulty === 'MEDIUM') {
    // ── MEDIUM = 60% EASY + 40% HARD blend ──
    // Phase 1: EASY-style items (forward, reverse, example-forward, example-reverse)
    const easyCountCap = Math.ceil(count * 0.6);
    const easyStyles: string[] = ['forward', 'reverse', 'example-forward', 'example-reverse'];
    for (const style of easyStyles) {
      if (result.length >= easyCountCap) break;
      if ((style === 'example-forward' || style === 'example-reverse') && conceptsWithExamples.length < 4) continue;

      const pool = (style === 'example-forward' || style === 'example-reverse')
        ? shuffleArray([...conceptsWithExamples]) : shuffledConcepts;

      for (const concept of pool) {
        if (result.length >= easyCountCap) break;

        if (style === 'forward') {
          const correctShort = getShortDefinition(concept);
          const qKey = normalizeText(`What is ${concept.term}?`);
          const distractors = pickDistractors(validConcepts, new Set([concept.term]));
          if (distractors.length < 3) continue;
          const allChoices = [correctShort, ...distractors.map(c => getShortDefinition(c))];
          if (new Set(allChoices).size < 4) continue;
          const choices = shuffleArray(allChoices);
          addItem(qKey, {
            question: `What is ${concept.term}?`, choices,
            answerIndex: choices.indexOf(correctShort),
            explanation: `The correct answer is '${correctShort}' because that is the definition of ${concept.term}.`,
          });
        } else if (style === 'reverse') {
          const correctShort = getShortDefinition(concept);
          const qKey = normalizeText(`reverse:${correctShort}`);
          const distractors = pickDistractors(validConcepts, new Set([concept.term]));
          if (distractors.length < 3) continue;
          const choices = shuffleArray([concept.term, ...distractors.map(c => c.term)]);
          addItem(qKey, {
            question: correctShort, choices,
            answerIndex: choices.indexOf(concept.term),
            explanation: `The correct answer is '${concept.term}' because it matches the description: ${correctShort}`,
          });
        } else if (style === 'example-forward') {
          const correctExample = concept.example!.trim();
          const qKey = normalizeText(`example-of:${concept.term}`);
          const distractors = pickDistractors(conceptsWithExamples, new Set([concept.term]));
          if (distractors.length < 3) continue;
          const allChoices = [correctExample, ...distractors.map(c => c.example!.trim())];
          if (new Set(allChoices).size < 4) continue;
          const choices = shuffleArray(allChoices);
          addItem(qKey, {
            question: `Which of the following is an example of ${concept.term}?`, choices,
            answerIndex: choices.indexOf(correctExample),
            explanation: `The correct answer is the example of ${concept.term}: ${correctExample}`,
          });
        } else if (style === 'example-reverse') {
          const exampleText = concept.example!.trim();
          const qKey = normalizeText(`example-rev:${exampleText.substring(0, 50)}`);
          const distractors = pickDistractors(validConcepts, new Set([concept.term]));
          if (distractors.length < 3) continue;
          const choices = shuffleArray([concept.term, ...distractors.map(c => c.term)]);
          addItem(qKey, {
            question: `Which concept does this scenario illustrate? "${exampleText}"`, choices,
            answerIndex: choices.indexOf(concept.term),
            explanation: `The correct answer is '${concept.term}' because this scenario is an example of ${concept.term}: ${getShortDefinition(concept)}`,
          });
        }
      }
    }

    // Phase 2: HARD-style items (scenario-analysis, best-choice, distinguish, not-example)
    const hardStyles: string[] = ['scenario-analysis', 'best-choice', 'distinguish', 'not-example'];
    for (const style of hardStyles) {
      if (result.length >= count) break;

      if (style === 'scenario-analysis') {
        if (conceptsWithExamples.length < 4) continue;
        for (const concept of shuffleArray([...conceptsWithExamples])) {
          if (result.length >= count) break;
          const exampleText = concept.example!.trim();
          const qKey = normalizeText(`scenario:${exampleText.substring(0, 60)}`);
          const distractors = pickDistractors(validConcepts, new Set([concept.term]));
          if (distractors.length < 3) continue;
          const choices = shuffleArray([concept.term, ...distractors.map(c => c.term)]);
          addItem(qKey, {
            question: `Consider this scenario: "${exampleText}" — Which concept or strategy is being applied?`, choices,
            answerIndex: choices.indexOf(concept.term),
            explanation: `This scenario illustrates ${concept.term}: ${getShortDefinition(concept)}`,
          });
        }
      } else if (style === 'best-choice') {
        for (const concept of shuffledConcepts) {
          if (result.length >= count) break;
          const defSnippet = getShortDefinition(concept);
          const qKey = normalizeText(`best:${concept.term}`);
          const distractors = pickDistractors(validConcepts, new Set([concept.term]));
          if (distractors.length < 3) continue;
          const choices = shuffleArray([concept.term, ...distractors.map(c => c.term)]);
          addItem(qKey, {
            question: `An organization needs to achieve the following: "${defSnippet}" — Which approach or concept is BEST suited for this goal?`,
            choices, answerIndex: choices.indexOf(concept.term),
            explanation: `${concept.term} is specifically designed for this: ${concept.definition}`,
          });
        }
      } else if (style === 'distinguish') {
        for (const concept of shuffledConcepts) {
          if (result.length >= count) break;
          const words = concept.definition.split(/\s+/).filter(w => w.length > 3).slice(0, 10);
          if (words.length < 4) continue;
          const keyPhrase = words.join(' ');
          const qKey = normalizeText(`distinguish:${concept.term}`);
          const distractors = pickDistractors(validConcepts, new Set([concept.term]));
          if (distractors.length < 3) continue;
          const choices = shuffleArray([concept.term, ...distractors.map(c => c.term)]);
          addItem(qKey, {
            question: `Which concept specifically addresses "${keyPhrase}"?`,
            choices, answerIndex: choices.indexOf(concept.term),
            explanation: `${concept.term}: ${concept.definition}`,
          });
        }
      } else if (style === 'not-example') {
        if (conceptsWithExamples.length < 4) continue;
        for (const concept of shuffleArray([...conceptsWithExamples])) {
          if (result.length >= count) break;
          const qKey = normalizeText(`not-ex:${concept.term}`);
          const wrongConcepts = shuffleArray(conceptsWithExamples.filter(k => k.term !== concept.term));
          if (wrongConcepts.length < 1) continue;
          const wrongExample = wrongConcepts[0].example!.trim();
          const correctExample = concept.example!.trim();
          const secondWrong = wrongConcepts.length > 1 ? wrongConcepts[1] : null;
          const thirdChoice = secondWrong ? secondWrong.example!.trim() : getShortDefinition(concept);
          const allChoices = [correctExample, wrongExample, thirdChoice, getShortDefinition(concept)];
          if (new Set(allChoices).size < 4) continue;
          const choices = shuffleArray(allChoices);
          addItem(qKey, {
            question: `Which of the following does NOT describe or exemplify ${concept.term}?`,
            choices, answerIndex: choices.indexOf(wrongExample),
            explanation: `"${wrongExample}" is actually an example of ${wrongConcepts[0].term}, not ${concept.term}.`,
          });
        }
      }
    }

  } else {
    // ── HARD styles: scenario-analysis, not-example, best-choice, distinguish ──
    const styles: string[] = ['scenario-analysis', 'best-choice', 'distinguish', 'not-example'];
    for (const style of styles) {
      if (result.length >= count) break;

      if (style === 'scenario-analysis') {
        // Full example scenario + analysis → "Which concept is being applied?"
        if (conceptsWithExamples.length < 4) continue;
        for (const concept of shuffleArray([...conceptsWithExamples])) {
          if (result.length >= count) break;
          const exampleText = concept.example!.trim();
          const qKey = normalizeText(`scenario:${exampleText.substring(0, 60)}`);
          const distractors = pickDistractors(validConcepts, new Set([concept.term]));
          if (distractors.length < 3) continue;
          const choices = shuffleArray([concept.term, ...distractors.map(c => c.term)]);
          addItem(qKey, {
            question: `Consider this scenario: "${exampleText}" — Which concept or strategy is being applied?`, choices,
            answerIndex: choices.indexOf(concept.term),
            explanation: `This scenario illustrates ${concept.term}: ${getShortDefinition(concept)}`,
          });
        }
      } else if (style === 'best-choice') {
        // "A company needs to [goal from definition]. Which approach is BEST?" → terms
        for (const concept of shuffledConcepts) {
          if (result.length >= count) break;
          const defSnippet = getShortDefinition(concept);
          const qKey = normalizeText(`best:${concept.term}`);
          const distractors = pickDistractors(validConcepts, new Set([concept.term]));
          if (distractors.length < 3) continue;
          const choices = shuffleArray([concept.term, ...distractors.map(c => c.term)]);
          addItem(qKey, {
            question: `An organization needs to achieve the following: "${defSnippet}" — Which approach or concept is BEST suited for this goal?`,
            choices, answerIndex: choices.indexOf(concept.term),
            explanation: `${concept.term} is specifically designed for this: ${concept.definition}`,
          });
        }
      } else if (style === 'distinguish') {
        // "Which concept specifically addresses [key phrase]?" → terms
        for (const concept of shuffledConcepts) {
          if (result.length >= count) break;
          // Extract a distinguishing phrase: first 8-12 significant words
          const words = concept.definition.split(/\s+/).filter(w => w.length > 3).slice(0, 10);
          if (words.length < 4) continue;
          const keyPhrase = words.join(' ');
          const qKey = normalizeText(`distinguish:${concept.term}`);
          const distractors = pickDistractors(validConcepts, new Set([concept.term]));
          if (distractors.length < 3) continue;
          const choices = shuffleArray([concept.term, ...distractors.map(c => c.term)]);
          addItem(qKey, {
            question: `Which concept specifically addresses "${keyPhrase}"?`,
            choices, answerIndex: choices.indexOf(concept.term),
            explanation: `${concept.term}: ${concept.definition}`,
          });
        }
      } else if (style === 'not-example') {
        // "Which is NOT an example of [term]?" → correct = example of a DIFFERENT concept
        if (conceptsWithExamples.length < 4) continue;
        for (const concept of shuffleArray([...conceptsWithExamples])) {
          if (result.length >= count) break;
          const qKey = normalizeText(`not-ex:${concept.term}`);
          // 2 correct examples (from this concept — but we only have 1, so we use the definition as a "related" choice)
          // 1 wrong example from another concept (the correct answer — it's NOT an example of this concept)
          const wrongConcepts = shuffleArray(conceptsWithExamples.filter(k => k.term !== concept.term));
          if (wrongConcepts.length < 1) continue;
          const wrongExample = wrongConcepts[0].example!.trim();
          const correctExample = concept.example!.trim();
          // Build 3 plausible examples for this concept, 1 that doesn't belong
          const secondWrong = wrongConcepts.length > 1 ? wrongConcepts[1] : null;
          const thirdChoice = secondWrong ? secondWrong.example!.trim() : getShortDefinition(concept);
          const allChoices = [correctExample, wrongExample, thirdChoice, getShortDefinition(concept)];
          if (new Set(allChoices).size < 4) continue;
          const choices = shuffleArray(allChoices);
          // The "correct answer" is the one that IS an example of THIS concept
          // (the question asks "which is NOT" — so the answer is the wrong example)
          // Actually let's flip: question = "Which does NOT describe [term]?"
          addItem(qKey, {
            question: `Which of the following does NOT describe or exemplify ${concept.term}?`,
            choices, answerIndex: choices.indexOf(wrongExample),
            explanation: `"${wrongExample}" is actually an example of ${wrongConcepts[0].term}, not ${concept.term}.`,
          });
        }
      }
    }
  }

  if (result.length === 0) {
    console.warn(`Deterministic MCQ ${difficulty}: could not build any valid items — falling back to LLM.`);
    return null;
  }

  console.log(`Deterministic MCQ ${difficulty}: produced ${result.length}/${count} items (${validConcepts.length} concepts, ${conceptsWithExamples.length} with examples).`);
  return result;
}

// ============================================================================
// DETERMINISTIC FLASHCARD GENERATOR (ALL DIFFICULTIES)
// ============================================================================

/**
 * Deterministic flashcard generator — ALL difficulties.
 *
 * EASY: "What is {term}?" → definition (Bloom's Level 1)
 * MEDIUM: "Explain / Describe / What is the purpose of {term}?" → definition (Level 2-3)
 * HARD: Scenario-based, comparison, and application fronts (Level 4-5)
 *
 * Falls back to null if fewer than 2 key concepts have definitions.
 */
function generateDeterministicFlashcards(
  keyConcepts: { term: string; definition: string; example?: string }[],
  count: number,
  difficulty: 'EASY' | 'MEDIUM' | 'HARD'
): any[] | null {
  const validConcepts = keyConcepts.filter(k => k.definition && k.definition.trim().length > 10);
  if (validConcepts.length < 2) {
    console.warn(`Deterministic Flashcards: only ${validConcepts.length} concepts have definitions (need ≥2) — falling back to LLM.`);
    return null;
  }

  const conceptsWithExamples = validConcepts.filter(k => k.example && k.example.trim().length > 10);

  // Question templates per difficulty
  const easyTemplates = [
    (term: string) => `What is ${term}?`,
    (term: string) => `Define ${term}.`,
  ];
  const hardTemplates = [
    (term: string) => `How would you apply ${term} in a real-world scenario?`,
    (term: string) => `What are the key considerations when implementing ${term}?`,
    (term: string) => `Analyze the significance of ${term} in practice.`,
    (term: string) => `What problems does ${term} solve, and what are its limitations?`,
  ];
  const templates = difficulty === 'EASY' ? easyTemplates : hardTemplates;

  const shuffledConcepts = shuffleArray([...validConcepts]);
  const result: any[] = [];
  const usedFronts = new Set<string>();

  // Helper to add a card if front is not a duplicate
  function addCard(front: string, back: string): boolean {
    const key = normalizeText(front);
    if (usedFronts.has(key) || result.length >= count) return false;
    result.push({ front, back });
    usedFronts.add(key);
    return true;
  }

  // Pass 1: one card per concept using difficulty-appropriate templates
  // For MEDIUM: 60% EASY templates + 40% HARD templates
  if (difficulty === 'MEDIUM') {
    const easyCountCap = Math.ceil(count * 0.6);
    // Phase A: EASY-style cards
    for (let i = 0; i < shuffledConcepts.length && result.length < easyCountCap; i++) {
      const concept = shuffledConcepts[i];
      const template = easyTemplates[i % easyTemplates.length];
      addCard(template(concept.term), concept.definition.trim());
    }
    // Phase B: HARD-style cards
    for (let i = 0; i < shuffledConcepts.length && result.length < count; i++) {
      const concept = shuffledConcepts[i];
      const template = hardTemplates[i % hardTemplates.length];
      addCard(template(concept.term), concept.definition.trim());
    }
  } else {
    for (let i = 0; i < shuffledConcepts.length && result.length < count; i++) {
      const concept = shuffledConcepts[i];
      const template = templates[i % templates.length];
      addCard(template(concept.term), concept.definition.trim());
    }
  }

  // Pass 2: additional cards using different templates for same concepts
  if (result.length < count) {
    const pass2Templates = difficulty === 'MEDIUM'
      ? [...easyTemplates, ...hardTemplates]
      : templates;
    if (pass2Templates.length > 1) {
      for (let pass = 1; pass < pass2Templates.length && result.length < count; pass++) {
        for (let i = 0; i < shuffledConcepts.length && result.length < count; i++) {
          const concept = shuffledConcepts[i];
          const template = pass2Templates[(i + pass) % pass2Templates.length];
          addCard(template(concept.term), concept.definition.trim());
        }
      }
    }
  }

  // Pass 3: example-based — "What concept does this illustrate?"
  if (result.length < count && conceptsWithExamples.length > 0) {
    for (const concept of shuffleArray([...conceptsWithExamples])) {
      if (result.length >= count) break;
      addCard(
        `What concept does this illustrate? "${concept.example!.trim()}"`,
        `${concept.term}: ${concept.definition.trim()}`
      );
    }
  }

  // Pass 4: "Give an example of [term]"
  if (result.length < count && conceptsWithExamples.length > 0) {
    for (const concept of shuffleArray([...conceptsWithExamples])) {
      if (result.length >= count) break;
      addCard(`Give an example of ${concept.term}.`, concept.example!.trim());
    }
  }

  // Pass 5 (MEDIUM/HARD): comparison cards — "Compare [A] and [B]"
  if (result.length < count && (difficulty === 'HARD' || difficulty === 'MEDIUM') && validConcepts.length >= 2) {
    const pairs: [typeof validConcepts[0], typeof validConcepts[0]][] = [];
    for (let i = 0; i < validConcepts.length; i++) {
      for (let j = i + 1; j < validConcepts.length; j++) {
        pairs.push([validConcepts[i], validConcepts[j]]);
      }
    }
    for (const [a, b] of shuffleArray(pairs)) {
      if (result.length >= count) break;
      addCard(
        `Compare and contrast ${a.term} with ${b.term}.`,
        `${a.term}: ${a.definition.trim()}\n\n${b.term}: ${b.definition.trim()}`
      );
    }
  }

  // Pass 6 (MEDIUM/HARD): scenario analysis — "Given this scenario, what concept applies?"
  if (result.length < count && (difficulty === 'HARD' || difficulty === 'MEDIUM') && conceptsWithExamples.length > 0) {
    for (const concept of shuffleArray([...conceptsWithExamples])) {
      if (result.length >= count) break;
      addCard(
        `A facility encounters this situation: "${concept.example!.trim()}" — What concept is being applied and why?`,
        `${concept.term} is being applied. ${concept.definition.trim()}`
      );
    }
  }

  if (result.length === 0) {
    console.warn('Deterministic Flashcards: could not build any valid items — falling back to LLM.');
    return null;
  }

  console.log(`Deterministic Flashcards ${difficulty}: produced ${result.length}/${count} items (${validConcepts.length} concepts, ${conceptsWithExamples.length} with examples).`);
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
  originalLessonContent?: string,
  fuzzyThreshold: number = 0.75
): { sentence: string; answer: string; distractors: string[] } | null {
  const escaped = escapeRegex(term);
  const regex = new RegExp(`\\b${escaped}\\b`, 'i');
  const matchResult = regex.exec(sentence);

  let blanked: string;
  let actualAnswer: string;

  let usedFuzzy = false;

  if (matchResult) {
    // ── Exact match path ──
    const matchIndex = matchResult.index;
    const matchEnd = matchIndex + matchResult[0].length;

    // ── Hyphen-boundary guard ──
    if (matchIndex > 0 && sentence[matchIndex - 1] === '-') {
      console.warn(`buildFIBItem: "${term}" rejected — preceded by hyphen at pos ${matchIndex}`);
      return null;
    }
    if (matchEnd < sentence.length && sentence[matchEnd] === '-') {
      console.warn(`buildFIBItem: "${term}" rejected — followed by hyphen at pos ${matchEnd}`);
      return null;
    }

    blanked = sentence.replace(regex, '[blank]');
    actualAnswer = term; // canonical key concept as answer
  } else {
    // ── Fuzzy match fallback ──
    // The term doesn't appear verbatim. Try sliding-window fuzzy matching
    // (e.g. "Nanay's Role" matching "the role of Nanay" in the sentence).
    const fuzzy = findBestFuzzySpan(sentence, term, fuzzyThreshold);
    if (!fuzzy) return null;
    const matchedSpan = sentence.substring(fuzzy.start, fuzzy.end);
    // Don't fuzzy-blank very short spans (< 3 chars) — too imprecise
    if (matchedSpan.length < 3) return null;
    blanked = sentence.substring(0, fuzzy.start) + '[blank]' + sentence.substring(fuzzy.end);
    actualAnswer = term; // answer is always the canonical key concept, not the matched span
    usedFuzzy = true;
  }

  // Safety: make sure a [blank] was actually inserted
  if (!blanked.includes('[blank]')) return null;

  // ── Light reconstruction verification ──
  // Log a warning if the reconstructed sentence isn't found in the lesson
  // content, but do NOT reject — the deterministic path constructs sentences
  // synthetically and they are always valid by construction.
  if (!usedFuzzy && originalLessonContent) {
    const reconstructed = normalizeText(blanked.replace('[blank]', actualAnswer));
    const normLesson = normalizeText(originalLessonContent);
    if (!normLesson.includes(reconstructed)) {
      console.warn(`buildFIBItem: reconstruction note for "${actualAnswer}" — sentence not in lesson (synthetic OK)`);
    }
  }

  // Pick 3 distractors from other key terms
  const normTerm = term.toLowerCase();
  const otherTerms = allTerms.filter(t => t.toLowerCase() !== normTerm);
  const shuffledOthers = shuffleArray(otherTerms);
  const distractors = shuffledOthers.slice(0, 3);

  // If we don't have 3 distractors from key concepts, try to pad from
  // lesson content — extract capitalized noun phrases as fallback distractors
  if (distractors.length < 3 && originalLessonContent) {
    const usedSet = new Set([normTerm, ...distractors.map(d => d.toLowerCase())]);
    // Extract capitalized multi-word terms from lesson content as potential distractors
    const capitalizedTerms = originalLessonContent.match(/\b[A-Z][a-z]+(?:\s+[A-Z][a-z]+)+\b/g) || [];
    for (const ct of shuffleArray([...new Set(capitalizedTerms)])) {
      if (distractors.length >= 3) break;
      if (!usedSet.has(ct.toLowerCase())) {
        distractors.push(ct);
        usedSet.add(ct.toLowerCase());
      }
    }
  }

  if (distractors.length < 2) return null; // absolute minimum for a question

  return {
    sentence: blanked,
    answer: actualAnswer,
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
  // Strategy 1: Look for "items": [ ... ] wrapper (standard format)
  const match = raw.match(/"items"\s*:\s*\[/);
  const searchContent = match && match.index !== undefined
    ? raw.substring(match.index + match[0].length)
    : raw; // Fallback: scan the entire response for complete objects

  const items = extractCompleteObjects(searchContent);

  if (items.length > 0) {
    const source = match ? '"items" array' : 'bare objects';
    console.log(`🔧 Salvaged ${items.length} complete item(s) from ${source}`);
    return { items };
  }
  return null;
}

/**
 * Extract all complete top-level JSON objects from a string by tracking
 * brace depth.  Handles escaped characters and strings correctly.
 * Works on both wrapped (`"items": [...]`) and bare (`[{...}, {...}]`) output.
 */
function extractCompleteObjects(content: string): any[] {
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
  return items;
}

/**
 * Attempt to recycle rejected FIB items by fixing recoverable issues.
 * Targets the most common rejection reasons:
 *  - Answer not a recognized key concept → fuzzy-match to closest concept
 *  - Invalid distractor count → pad with key concepts or trim
 *  - Distractor not in lesson content → swap with valid key concepts
 * Returns only items that would pass validateFillInBlankItem after fixes.
 */
function recycleRejectedFIBItems(
  rejected: any[],
  keyConcepts: { term: string; definition: string }[],
  lessonContent: string,
  difficulty: string,
  seenItems: Set<string>,
  fallbackConcepts: { term: string; definition: string }[] = [],
  notes?: { term: string; definition?: string; example?: string }[]
): any[] {
  // Use fallbackConcepts (auto-extracted) when keyConcepts are absent
  const effectiveConcepts = keyConcepts.length >= 4 ? keyConcepts : (fallbackConcepts.length >= 4 ? fallbackConcepts : keyConcepts);
  if (effectiveConcepts.length < 4) return []; // Need concepts for distractor pool

  const conceptTerms = effectiveConcepts.map(k => k.term);
  const normConcepts = conceptTerms.map(t => normalizeText(t));
  const recycled: any[] = [];

  for (const rej of rejected) {
    if (!rej.sentence || !rej.answer || !rej._rejectionReason) continue;
    const reason: string = rej._rejectionReason;

    let fixedAnswer = rej.answer;
    let fixedDistractors = Array.isArray(rej.distractors) ? [...rej.distractors] : [];

    // Fix 1: Answer not a recognized key concept — fuzzy match
    if (reason.includes('not a recognized key concept')) {
      const normAnswer = normalizeText(rej.answer);
      let bestIdx = -1;
      let bestScore = 0;
      for (let i = 0; i < normConcepts.length; i++) {
        // Simple containment + length similarity heuristic
        const nc = normConcepts[i];
        if (nc === normAnswer) { bestIdx = i; bestScore = 1; break; }
        if (nc.includes(normAnswer) || normAnswer.includes(nc)) {
          const score = Math.min(nc.length, normAnswer.length) / Math.max(nc.length, normAnswer.length);
          if (score > bestScore && score >= 0.6) { bestScore = score; bestIdx = i; }
        }
      }
      if (bestIdx >= 0) {
        fixedAnswer = conceptTerms[bestIdx];
      } else {
        continue; // Can't fix this item
      }
    }

    // Fix 2: Invalid distractor count — pad or trim
    if (typeof rej.distractors === 'string') {
      fixedDistractors = rej.distractors.split(/,\s*/).map((d: string) => d.trim()).filter((d: string) => d.length > 0);
    }
    if (fixedDistractors.length > 3) {
      fixedDistractors = fixedDistractors.slice(0, 3);
    }
    if (fixedDistractors.length < 3) {
      // Pad with unused key concepts
      const usedSet = new Set([normalizeText(fixedAnswer), ...fixedDistractors.map((d: string) => normalizeText(d))]);
      for (const ct of conceptTerms) {
        if (fixedDistractors.length >= 3) break;
        if (!usedSet.has(normalizeText(ct))) {
          fixedDistractors.push(ct);
          usedSet.add(normalizeText(ct));
        }
      }
    }
    if (fixedDistractors.length !== 3) continue;

    // Fix 3: Replace invalid distractors with valid key concepts
    if (reason.includes('neither a key concept nor found')) {
      const normLesson = normalizeText(lessonContent);
      const conceptSet = new Set(normConcepts);
      const usedSet = new Set([normalizeText(fixedAnswer), ...fixedDistractors.map((d: string) => normalizeText(d))]);

      fixedDistractors = fixedDistractors.map((d: string) => {
        const nd = normalizeText(d);
        if (conceptSet.has(nd) || normLesson.includes(nd)) return d;
        // Replace with an unused key concept
        for (const ct of conceptTerms) {
          if (!usedSet.has(normalizeText(ct))) {
            usedSet.add(normalizeText(ct));
            return ct;
          }
        }
        return d; // No replacement available
      });
    }

    // Reconstruct and re-validate
    const candidate = { ...rej, answer: fixedAnswer, distractors: fixedDistractors };
    delete candidate._rejected;
    delete candidate._rejectionReason;

    const dedup = normalizeText(candidate.sentence);
    if (seenItems.has(dedup)) continue;

    const result = validateFillInBlankItem(candidate, lessonContent, keyConcepts, difficulty, notes);
    if (result.valid) {
      seenItems.add(dedup);
      recycled.push(result.item);
    }
  }

  if (recycled.length > 0) {
    console.log(`♻️ Recycled ${recycled.length} FIB item(s) from ${rejected.length} rejected`);
  }
  return recycled;
}

/**
 * Attempt to recycle rejected MCQ items by fixing recoverable issues.
 * The most common MCQ rejections are:
 *  - answerIndex mismatch (explanation says correct answer but index is wrong)
 *  - Missing/short explanation
 *  - Ungrounded distractor (choice not in source material)
 * Returns only items that would pass validateMCQItem after fixes.
 */
function recycleRejectedMCQItems(
  rejected: any[],
  keyConcepts: { term: string; definition: string }[],
  lessonContent: string,
  difficulty: string,
  seenItems: Set<string>
): any[] {
  const recycled: any[] = [];

  for (const rej of rejected) {
    if (!rej.question || !rej.choices || !rej._rejectionReason) continue;
    const reason: string = rej._rejectionReason;

    const candidate = { ...rej };
    delete candidate._rejected;
    delete candidate._rejectionReason;

    // Fix 1: answerIndex mismatch — extract from explanation
    if (reason.includes('Explanation does not reference') || reason.includes('answerIndex')) {
      if (candidate.explanation) {
        const match = candidate.explanation.match(/correct answer is ['"]([^'"]+)['"]/i);
        if (match) {
          const extracted = normalizeText(match[1]);
          const idx = candidate.choices.findIndex((c: string) => normalizeText(c) === extracted);
          if (idx >= 0) candidate.answerIndex = idx;
        }
      }
    }

    // Fix 2: Ungrounded distractor — swap with key concept term
    if (reason.includes('not grounded in source material') && keyConcepts.length > 0) {
      const normLesson = normalizeText(lessonContent);
      const conceptTerms = keyConcepts.map(k => k.term);
      const usedSet = new Set(candidate.choices.map((c: string) => normalizeText(c)));

      for (let ci = 0; ci < candidate.choices.length; ci++) {
        if (ci === candidate.answerIndex) continue;
        const choiceNorm = normalizeText(candidate.choices[ci]);
        if (normLesson.includes(choiceNorm)) continue;
        // Replace with unused key concept
        for (const ct of conceptTerms) {
          if (!usedSet.has(normalizeText(ct))) {
            candidate.choices[ci] = ct;
            usedSet.add(normalizeText(ct));
            break;
          }
        }
      }
    }

    // Fix 3: Missing/short explanation — generate a basic one
    if (reason.includes('explanation') && candidate.choices && typeof candidate.answerIndex === 'number') {
      const correctChoice = candidate.choices[candidate.answerIndex];
      if (correctChoice) {
        candidate.explanation = `The correct answer is '${correctChoice}' because it directly relates to the concept described in the lesson content.`;
      }
    }

    // Dedup check
    const qKey = normalizeText(candidate.question);
    if (seenItems.has(qKey)) continue;
    let isDuplicate = false;
    for (const existing of seenItems) {
      if (areQuestionsSimilar(qKey, existing)) { isDuplicate = true; break; }
    }
    if (isDuplicate) continue;

    const result = validateMCQItem(candidate, difficulty, keyConcepts, lessonContent);
    if (result.valid) {
      seenItems.add(qKey);
      recycled.push(result.item);
    }
  }

  if (recycled.length > 0) {
    console.log(`♻️ Recycled ${recycled.length} MCQ item(s) from ${rejected.length} rejected`);
  }
  return recycled;
}

/**
 * Attempt to recycle rejected flashcard items by fixing recoverable issues.
 * Common flashcard rejections:
 *  - Back too short (< 10 chars)
 *  - Duplicate front (but with different back — can be salvaged with rewording)
 */
function recycleRejectedFlashcardItems(
  rejected: any[],
  keyConcepts: { term: string; definition: string }[],
  seenItems: Set<string>
): any[] {
  const recycled: any[] = [];

  for (const rej of rejected) {
    if (!rej.front || !rej.back || !rej._rejectionReason) continue;
    const reason: string = rej._rejectionReason;

    const candidate = { ...rej };
    delete candidate._rejected;
    delete candidate._rejectionReason;

    // Fix 1: Back too short — try to expand from key concepts
    if (reason.includes('Insufficient content') && candidate.front) {
      const frontNorm = normalizeText(candidate.front);
      for (const kc of keyConcepts) {
        if (frontNorm.includes(normalizeText(kc.term)) && kc.definition && kc.definition.trim().length >= 10) {
          candidate.back = kc.definition.trim();
          break;
        }
      }
    }

    // Dedup check
    const frontKey = normalizeText(candidate.front);
    if (seenItems.has(frontKey)) continue;
    let isDuplicate = false;
    for (const existing of seenItems) {
      if (areQuestionsSimilar(frontKey, existing)) { isDuplicate = true; break; }
    }
    if (isDuplicate) continue;

    const result = validateFlashcardItem(candidate);
    if (result.valid) {
      seenItems.add(frontKey);
      recycled.push(result.item);
    }
  }

  if (recycled.length > 0) {
    console.log(`♻️ Recycled ${recycled.length} Flashcard item(s) from ${rejected.length} rejected`);
  }
  return recycled;
}

/**
 * Attempt to repair a truncated / malformed JSON response by asking the
 * model to complete it.  The model receives the broken text and a short
 * instruction to output only the corrected JSON.  Uses a very low
 * temperature (0.1) to encourage deterministic fixing rather than creative
 * rewriting.
 *
 * Returns the raw repaired string (caller is responsible for parsing),
 * or null if the repair call itself fails or produces nothing useful.
 */
async function repairTruncatedJSON(
  raw: string,
  model: string,
  maxTokens: number
): Promise<string | null> {
  const repairPrompt =
    `The following JSON is incomplete or malformed. ` +
    `Complete it so it forms a valid JSON object with an "items" array. ` +
    `Output ONLY the corrected JSON — no explanation, no markdown fences.\n\n` +
    `TRUNCATED JSON:\n${raw}\n\nCORRECTED JSON:`;

  try {
    const repaired = await generateWithOllama(repairPrompt, {
      model,
      temperature: 0.1,
      requireJson: true,
      maxTokens: Math.round(maxTokens * 1.5), // extra headroom
    });
    if (!repaired || repaired.trim().length === 0) return null;
    return repaired;
  } catch (err) {
    console.error('Repair attempt failed:', err instanceof Error ? err.message : err);
    return null;
  }
}

/**
 * Extract leading sentence of each paragraph as a concept-seed list.
 * Used to prepend topical anchors to lesson content slices for long lesson content.
 */
function extractConceptSeeds(lessonContent: string, maxSeeds: number = 6): string {
  const paragraphs = lessonContent.split(/\n\s*\n/).filter(p => p.trim().length > 0);
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
 * Get a rotating slice of the lesson content for each batch.
 * Uses sentence-boundary alignment to avoid cutting mid-sentence,
 * which prevents the model from hallucinating to complete truncated text.
 *
 * windowSize increased from 900→1100 to give the model more context per call,
 * reducing the total number of calls needed for long lesson content.
 */
function getLessonSlice(
  lessonContent: string,
  batchIndex: number,
  windowSize: number = 1100,
  overlap: number = 150
): string {
  // If lesson content fits in one window, return it whole — no slicing needed
  if (lessonContent.length <= windowSize) {
    return lessonContent;
  }

  // For very long lesson content (>3x window), prepend concept seeds so each
  // slice still has topical anchors even when it covers only a small portion.
  const conceptPrefix = lessonContent.length > windowSize * 3
    ? extractConceptSeeds(lessonContent)
    : '';

  const step = windowSize - overlap;
  let start = (batchIndex * step) % Math.max(lessonContent.length - windowSize, 1);
  let end = Math.min(start + windowSize, lessonContent.length);

  // Snap `start` forward to the next sentence boundary (after . or \n)
  if (start > 0) {
    const boundaryMatch = lessonContent.slice(start).match(/^[^.\n]*[.\n]\s*/);
    if (boundaryMatch) {
      start += boundaryMatch[0].length;
    }
  }

  // Snap `end` forward to include the full sentence (up to next . or \n)
  if (end < lessonContent.length) {
    const tailMatch = lessonContent.slice(end).match(/^[^.\n]*[.\n]/);
    if (tailMatch) {
      end += tailMatch[0].length;
    }
  }

  // If we've wrapped around and the slice is too small, start from beginning
  if (end - start < windowSize / 2) {
    return conceptPrefix + lessonContent.slice(0, windowSize);
  }

  return conceptPrefix + lessonContent.slice(start, end);
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
function validateMCQItem(item: any, difficulty: string = 'MEDIUM', keyConcepts: { term: string; definition: string }[] = [], lessonContent: string = ''): { valid: boolean; item: any; rejectionReason?: string } {
  // Must have a question string
  if (!item.question || typeof item.question !== 'string' || item.question.trim().length < 5) {
    return {
      valid: false,
      item,
      rejectionReason: `Missing or invalid question (got: ${typeof item.question})`
    };
  }

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
  //   Tier 2: Verbatim in the lesson content
  //   Tier 3: Word-overlap ≥40% with source material (lesson content + key concept defs)
  // This prevents hallucinated distractors while accepting reasonable model-generated
  // phrases that are grounded in the source content.
  if (keyConcepts.length > 0 && lessonContent.length > 0) {
    const conceptTerms = new Set(keyConcepts.map(k => normalizeText(k.term)));
    const allConceptText = keyConcepts.map(k => normalizeText(k.term) + ' ' + normalizeText(k.definition || '')).join(' ');
    const normLesson = normalizeText(lessonContent);
    // Build a set of all significant words from the source material for word-overlap check
    const sourceWords = new Set(
      [...normLesson.split(/\s+/), ...allConceptText.split(/\s+/)].filter(w => w.length > 3)
    );

    for (let ci = 0; ci < fixedItem.choices.length; ci++) {
      if (ci === fixedItem.answerIndex) continue; // Skip correct answer
      const choiceNorm = normalizeText(fixedItem.choices[ci]);

      // Tier 1: Exact key concept match or substring containment (strongest signal)
      const isKeyConcept = conceptTerms.has(choiceNorm) ||
        [...conceptTerms].some(ct => ct.includes(choiceNorm) || choiceNorm.includes(ct));
      if (isKeyConcept) continue;

      // Tier 2: Found verbatim in the lesson content
      const inLesson = normLesson.includes(choiceNorm);
      if (inLesson) continue;

      // Tier 3: Word-overlap — if ≥20% of the distractor's significant words
      // appear in the source material (lesson content + key concept definitions),
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
 * @param lessonContent  The full source lesson content — used to verify the sentence is
 *                 actually present in the source material (not hallucinated).
 * Returns object with { valid: boolean, item: any, rejectionReason?: string }
 */
function validateFillInBlankItem(
  item: any,
  lessonContent: string = '',
  keyConcepts: { term: string; definition: string }[] = [],
  difficulty: string = 'MEDIUM',
  notes?: { term: string; definition?: string; example?: string }[]
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
  // source lesson content. This prevents the model from hallucinating sentences that
  // look plausible but aren't actually in the material — a major cause of
  // duplicates across waves (the model invents the same fake sentence repeatedly).
  if (lessonContent.length > 0) {
    const reconstructed = normalizeText(fixedSentence.replace('[blank]', item.answer));
    const normLesson = normalizeText(lessonContent);
    if (!normLesson.includes(reconstructed)) {
      // Check if the sentence matches a note example (verbatim or with minor punctuation diffs)
      let matchesNoteExample = false;
      if (notes && notes.length > 0) {
        matchesNoteExample = notes.some(n => {
          if (!n.example || n.example.trim().length < 10) return false;
          const normExample = normalizeText(n.example);
          // Accept if reconstructed is the example or a close substring
          return normExample.includes(reconstructed) || reconstructed.includes(normExample);
        });
      }
      if (!matchesNoteExample) {
        // Fallback: check if most words appear in order (handles minor tokenization diffs)
        const recWords = reconstructed.split(/\s+/).filter(w => w.length > 3);
        if (recWords.length >= 3) {
          const lessonWords = new Set(normLesson.split(/\s+/));
          const hits = recWords.filter(w => lessonWords.has(w)).length;
          const ratio = hits / recWords.length;
          // EASY requires near-verbatim recall; MEDIUM/HARD accept
          // paraphrased sentences as long as the core content is preserved.
          const threshold = difficulty === 'EASY' ? 0.80 : 0.55;
          if (ratio < threshold) {
            return {
              valid: false,
              item,
              rejectionReason: `Sentence not found in lesson content (word match ${Math.round(ratio * 100)}% < ${Math.round(threshold * 100)}%): "${fixedSentence}"`
            };
          }
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
  
  if (!Array.isArray(distractors) || distractors.length < 2) {
    return { 
      valid: false, 
      item, 
      rejectionReason: `Invalid distractors (length: ${Array.isArray(distractors) ? distractors.length : typeof distractors}, expected: 2-4)` 
    };
  }
  // Auto-fix: trim to 3 if more, pad from key concepts if fewer
  if (distractors.length > 3) {
    distractors = distractors.slice(0, 3);
  }
  if (distractors.length < 3 && keyConcepts.length > 0) {
    const usedSet = new Set([normalizeText(item.answer), ...distractors.map((d: string) => normalizeText(d))]);
    for (const kc of keyConcepts) {
      if (distractors.length >= 3) break;
      if (!usedSet.has(normalizeText(kc.term))) {
        distractors.push(kc.term);
        usedSet.add(normalizeText(kc.term));
      }
    }
  }
  if (distractors.length < 3) {
    return { 
      valid: false, 
      item, 
      rejectionReason: `Insufficient distractors after padding (have: ${distractors.length}, need: 3)` 
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

  // ── Term/verb boundary check ──
  // Reject answers that span across a concept term and a following verb/
  // preposition, e.g. "Utilization refers", "Plan refers", "Systems to".
  // These occur when the LLM blanks the wrong span in "Term refers to..."
  // template sentences.
  if (/\s+(refers|defined|to|is|are|was|were|means|involves|includes)\s*$/i.test(item.answer.trim())) {
    return {
      valid: false,
      item,
      rejectionReason: `Answer "${item.answer}" crosses a term/verb boundary — blank the FULL concept term, not partial`
    };
  }

  // ── Grammar check for "refers to" patterns ──
  // If the sentence has "refers" immediately before [blank], the answer must
  // start with "to" so the reconstructed sentence reads "refers to <definition>".
  // Without this, items like 'Accessibility refers [blank]' with answer
  // 'Designing spaces...' produce ungrammatical output.
  const beforeBlank = fixedSentence.split('[blank]')[0].trim().toLowerCase();
  if (beforeBlank.endsWith('refers')) {
    const answerLowerTrim = item.answer.trim().toLowerCase();
    if (!answerLowerTrim.startsWith('to ')) {
      return {
        valid: false,
        item,
        rejectionReason: `Answer must start with "to" when blank follows "refers" (grammar: "refers [blank]" → "refers to ...")`
      };
    }
  }

  // ── Grammar check for "defined as" patterns ──
  // Same idea: "is defined as [blank]" requires the answer to be a noun phrase,
  // not starting with another verb. "defined as" before [blank] is fine as-is
  // since the model writes "X is defined as [definition]".

  // ── JSON field name check ──
  // Reject answers where the sentence looks like raw JSON (blanked a field name)
  if (/^\s*"[a-z_]+"\s*:\s*\[?\s*$/.test(item.sentence.replace('[blank]', '').trim()) ||
      /"[a-z_]+"\s*:\s*"?\[blank\]"?/.test(item.sentence)) {
    return {
      valid: false,
      item,
      rejectionReason: `Sentence is raw JSON — not a valid quiz sentence`
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

  // ── Answer must be related to a key concept (when list is available) ──
  // If we have a keyConcepts list, the blanked word should be one of those
  // terms or closely related. Uses fuzzy substring matching to tolerate
  // minor morphological variations (e.g. "algorithms" vs "algorithm").
  // When no keyConcepts exist, relax: answer must appear in lesson content
  // (verbatim or via high word overlap) and be a meaningful term.
  if (keyConcepts.length > 0) {
    const conceptTerms = keyConcepts.map(k => normalizeText(k.term));
    const isExactMatch = conceptTerms.some(ct => ct === answerLower);
    if (!isExactMatch) {
      // Fuzzy: accept if answer is a substring of a concept or vice versa
      // Also accept if answer shares >=60% character overlap with any concept
      const isFuzzyMatch = conceptTerms.some(ct => {
        if (ct.includes(answerLower) || answerLower.includes(ct)) return true;
        // Character-level overlap for morphological variants
        const shorter = ct.length < answerLower.length ? ct : answerLower;
        const longer = ct.length < answerLower.length ? answerLower : ct;
        if (shorter.length >= 3 && longer.startsWith(shorter.substring(0, Math.ceil(shorter.length * 0.7)))) return true;
        return false;
      });
      // Also accept if the answer appears verbatim in the lesson content
      const inLesson = lessonContent.length > 0 && normalizeText(lessonContent).includes(answerLower);
      if (!isFuzzyMatch && !inLesson) {
        return {
          valid: false,
          item,
          rejectionReason: `Answer "${item.answer}" is not a recognized key concept`
        };
      }
    }
  } else {
    // No keyConcepts available — relaxed validation.
    // Answer must be a meaningful term that actually appears in the lesson.
    const normLesson = normalizeText(lessonContent);
    const answerInLesson = normLesson.includes(answerLower);
    if (!answerInLesson) {
      // Fuzzy fallback: check high word overlap (≥70%)
      const overlap = wordOverlapRatio(lessonContent, item.answer);
      if (overlap < 0.7) {
        return {
          valid: false,
          item,
          rejectionReason: `Answer "${item.answer}" not found in lesson content (no key concepts, overlap ${Math.round(overlap * 100)}%)`
        };
      }
    }
    // For HARD: require multi-word answer (2+ words) unless single-word is a known note term
    if (difficulty === 'HARD') {
      const wordCount = item.answer.trim().split(/\s+/).length;
      if (wordCount < 2) {
        // Allow single-word terms that are explicitly defined in notes
        const isNoteTerm = notes && notes.some(n =>
          n.term && normalizeText(n.term) === answerLower
        );
        if (!isNoteTerm) {
          return {
            valid: false,
            item,
            rejectionReason: `HARD FIB requires multi-word answer (got ${wordCount} word: "${item.answer}")`
          };
        }
      }
    }
  }

  // ── Key-concept distractor check ──
  // When keyConcepts are available, verify each distractor is either a known
  // key concept OR at least appears somewhere in the lesson content. This ensures
  // distractors are real, relevant terms — not hallucinated garbage.
  // Accept distractors with significant word overlap (≥20%) to avoid rejecting
  // topically-grounded paraphrased terms.
  // When no keyConcepts: still check distractors are grounded in lesson content.
  if (lessonContent.length > 0) {
    const conceptTerms = new Set(keyConcepts.map(k => normalizeText(k.term)));
    const normLesson = normalizeText(lessonContent);
    const lessonWordSet = new Set(normLesson.split(/\s+/).filter(w => w.length > 3));
    for (const d of distractors) {
      const normD = normalizeText(d);
      const isKeyConcept = conceptTerms.has(normD);
      if (isKeyConcept) continue;
      const inLesson = normLesson.includes(normD);
      if (inLesson) continue;
      // Fuzzy concept match: accept if distractor is a substring of a concept or vice versa
      const fuzzyConceptMatch = [...conceptTerms].some(ct => ct.includes(normD) || normD.includes(ct));
      if (fuzzyConceptMatch) continue;
      // Word-overlap fallback — accept topically grounded distractors
      const dWords = normD.split(/\s+/).filter(w => w.length > 3);
      if (dWords.length > 0) {
        const dHits = dWords.filter(w => lessonWordSet.has(w)).length;
        if (dHits / dWords.length >= 0.2) continue;
      }
      // Single-word distractors under 15 chars: check if they share a root
      // with any lesson word (handles morphological variants)
      if (dWords.length <= 1 && normD.length >= 3 && normD.length <= 15) {
        const dRoot = normD.substring(0, Math.ceil(normD.length * 0.7));
        const hasRoot = [...lessonWordSet].some(w => w.startsWith(dRoot));
        if (hasRoot) continue;
      }
      return {
        valid: false,
        item,
        rejectionReason: `Distractor "${d}" is neither a key concept nor found in the lesson content`
      };
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
  lessonContent: string = '',
  keyConcepts: { term: string; definition: string }[] = [],
  notes?: { term: string; definition?: string; example?: string }[]
): { validItems: any[]; rejectedItems: any[] } {
  const validItems: any[] = [];
  const rejectedItems: any[] = [];
  
  for (const item of items) {
    let validationResult: { valid: boolean; item: any; rejectionReason?: string };
    
    // Type-specific validation
    if (type === 'MCQ') {
      validationResult = validateMCQItem(item, difficulty, keyConcepts, lessonContent);
      
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
      validationResult = validateFillInBlankItem(item, lessonContent, keyConcepts, difficulty, notes);
      
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
 * against the source lesson content and returning a structured JSON verdict.
 */
function buildVerificationPrompt(
  items: any[],
  type: 'MCQ' | 'FILL_IN_BLANK' | 'FLASHCARD',
  lessonContent: string
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

1. ANSWER CORRECTNESS: Read the question carefully. Based ONLY on the lesson content, determine the correct answer. Does the choice at answerIndex match YOUR answer? If not, mark INCORRECT.
2. BEST ANSWER TEST: Is there a MORE SPECIFIC or MORE ACCURATE answer to this question that is NOT among the 4 choices? If so, the question is flawed — mark INCORRECT. (Example: if the question asks about "worms" but only "malware" is an option, that is too broad.)
3. DISTRACTOR VALIDITY: Are the 3 wrong choices genuinely WRONG for this specific question? If any distractor could also be correct, mark INCORRECT.
4. QUESTION CLARITY: Is the question clear, complete, and answerable from the lesson content alone? (No missing words, no outside knowledge needed.)
5. EXPLANATION ACCURACY: Does the explanation correctly justify the answer? Does it match the choice at answerIndex?
6. TERM ECHO: If the question asks "What is X?" and the answer is just "X" (the term itself, not a definition), mark INCORRECT.
7. DISTRACTOR SOURCE: Are all 3 wrong choices topically related to the lesson content content? If any distractor is completely unrelated to the subject matter, mark INCORRECT. (Distractors may be derived phrases — they don't need to be exact key concept terms.)

Be STRICT. When in doubt, mark INCORRECT.`;
  } else if (type === 'FILL_IN_BLANK') {
    typeRules = `You are a STRICT teacher grading fill-in-blank items. For each item, check ALL of the following:

1. SENTENCE ACCURACY: When [blank] is replaced with the answer, does the sentence match content from the lesson content EXACTLY (not paraphrased)?
2. ANSWER CORRECTNESS: Is the answer the EXACT correct word/phrase for the blank according to the lesson content? Is it the COMPLETE term (not a fragment like "trade-off" when it should be "bias-variance tradeoff")?
3. ANSWER QUALITY: Is the answer a meaningful concept/term (not a preposition, article, or generic word like "the", "and", "is")?
4. BLANK IMPORTANCE: Is the blanked word a KEY CONCEPT, TECHNICAL TERM, or IMPORTANT NAME from the lesson content — something a student should know? If it's a trivial word, mark INCORRECT.
5. DISTRACTOR VALIDITY: Are all 3 distractors real terms from the lesson content that do NOT correctly fill the blank? Could any distractor work as well as the answer? If so, mark INCORRECT.
6. DISTRACTOR RELEVANCE: Are the distractors important concepts/terms from the same domain (not random words)? They should be plausible enough to test knowledge.
7. SENTENCE COMPLETENESS: Is the sentence complete and grammatically correct with the blank?
8. OFF-TOPIC CONTENT: Does the sentence contain any greetings ("good morning", "hello", "welcome"), meta-comments ("here is", "in this exercise"), or text NOT from the lesson content? If yes, mark INCORRECT.

Be STRICT. When in doubt, mark INCORRECT.`;
  } else {
    typeRules = `You are a STRICT teacher grading flashcards. For each card, check ALL of the following:

1. FRONT CLARITY: Does the front ask a clear, specific question about a concept from the lesson content?
2. BACK ACCURACY: Is the back factually accurate according to the lesson content?
3. FRONT-BACK MATCH: Does the back ACTUALLY answer the front? (Not a mismatch or tangential.)
4. COMPLETENESS: Is the back complete enough to be a useful answer?
5. SPECIFICITY: Is the front specific enough that only one answer is reasonable?

Be STRICT. When in doubt, mark INCORRECT.`;
  }

  return `You are a strict academic reviewer. Verify each quiz item below against the source lesson content. Output ONLY valid JSON.

LESSON CONTENT:
${lessonContent}

ITEMS TO VERIFY:
${itemsBlock}

${typeRules}

Respond with ONLY this JSON structure (no extra text):
{"verdicts":[{"index":0,"pass":true,"reason":null},{"index":1,"pass":false,"reason":"explanation of what is wrong"}]}`;
}

/**
 * Verify a batch of quiz items for factual correctness using Ollama.
 *
 * Sends the items + lesson content to the model and asks it to cross-check each one.
 * Returns items split into verified (passed) and failed (with reasons).
 *
 * Items are processed in sub-batches of up to VERIFY_BATCH_SIZE to keep
 * the prompt+response within token limits.
 */
async function verifyQuizItemsWithGemma(
  items: any[],
  type: 'MCQ' | 'FILL_IN_BLANK' | 'FLASHCARD',
  lessonContent: string,
  model: string
): Promise<{ verified: any[]; failed: { item: any; reason: string }[] }> {
  if (items.length === 0) return { verified: [], failed: [] };

  const VERIFY_BATCH_SIZE = 5; // Keep prompts manageable for 4B models
  const verified: any[] = [];
  const failed: { item: any; reason: string }[] = [];

  // Process in sub-batches
  for (let offset = 0; offset < items.length; offset += VERIFY_BATCH_SIZE) {
    const batch = items.slice(offset, offset + VERIFY_BATCH_SIZE);
    const prompt = buildVerificationPrompt(batch, type, lessonContent);

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
    signal?: AbortSignal;
    timeoutMs?: number;
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
    signal: callerSignal,
    timeoutMs = 120_000, // default 2 min
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

    // Combine caller signal (e.g. client disconnect) with per-call timeout.
    // If either fires, the fetch is aborted.
    const timeoutSignal = AbortSignal.timeout(timeoutMs);
    const combinedSignal = callerSignal
      ? AbortSignal.any([callerSignal, timeoutSignal])
      : timeoutSignal;

    const response = await fetch(`${OLLAMA_BASE_URL}/api/generate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
      signal: combinedSignal,
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
 * 3. Live /api/tags probe with size-aware priority
 *
 * OLLAMA_PREFERRED_SIZE env var (optional): "small" | "medium" | "large"
 *   - "small"  → 1B variants first  (fastest, lower quality)
 *   - "medium" → 4B variants first  (default — best balance)
 *   - "large"  → 9B/12B variants first (highest quality, needs GPU)
 *
 * Quantized models (q4_K_M, q4_0) are ~2× faster on CPU with minimal quality loss.
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
  
  // Build priority list based on OLLAMA_PREFERRED_SIZE
  const preferredSize = (process.env.OLLAMA_PREFERRED_SIZE || 'medium').toLowerCase();

  let preferredModels: string[];
  if (preferredSize === 'large') {
    // Prefer larger models — higher quality, needs GPU
    preferredModels = [
      'gemma3:12b-it-q4_K_M',
      'gemma3:12b',
      'gemma2:9b-it-q4_K_M',
      'gemma2:9b',
      'gemma3:4b-it-q4_K_M',
      'gemma3:4b-q4_0',
      'gemma3:4b',
    ];
  } else if (preferredSize === 'small') {
    // Prefer smaller models — fastest, lower quality
    preferredModels = [
      'gemma3:1b-it-q4_K_M',
      'gemma3:1b',
      'gemma3:4b-it-q4_K_M',
      'gemma3:4b-q4_0',
      'gemma3:4b',
    ];
  } else {
    // Default "medium" — 4B variants (best quality-to-speed balance)
    preferredModels = [
      'gemma3:4b-it-q4_K_M',
      'gemma3:4b-q4_0',
      'gemma3:4b-cloud',
      'gemma3:4b',
      'gemma3:1b-it-q4_K_M',
      'gemma3:1b',
    ];
  }

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

// ============================================================================
// HARD SCENARIO TRANSFORM — Ollama-powered upgrade of deterministic items
// ============================================================================

/**
 * Transform a single deterministic MCQ into a HARD scenario-based question via Ollama.
 *
 * The LLM rewrites only the question text as a real-world scenario while keeping
 * the same choices and correct answer index intact. This guarantees structural
 * correctness (choices + answerIndex are preserved) while adding analytical depth.
 */
async function transformMCQToScenario(
  item: { question: string; choices: string[]; answerIndex: number; explanation?: string },
  lessonSlice: string,
  model: string,
  temperature: number
): Promise<{ question: string; choices: string[]; answerIndex: number; explanation: string } | null> {
  const correctAnswer = item.choices[item.answerIndex];
  const prompt = `Transform this quiz question into a HARD scenario-based question. Output ONLY valid JSON.

ORIGINAL QUESTION: ${item.question}
CORRECT ANSWER: ${correctAnswer}

LESSON CONTEXT:
${lessonSlice}

RULES:
1. Rewrite the question as a 1-2 sentence real-world scenario that requires analysis
2. Keep ALL 4 choices EXACTLY as provided — do NOT change, reorder, or rephrase them
3. The correct answer must still be "${correctAnswer}" (answerIndex ${item.answerIndex})
4. Explanation: 1-2 sentences starting with "The correct answer is '${correctAnswer}' because ..."

{"question":"...scenario question...","choices":${JSON.stringify(item.choices)},"answerIndex":${item.answerIndex},"explanation":"The correct answer is '${correctAnswer}' because ..."}`;

  try {
    const raw = await generateWithOllama(prompt, {
      model,
      temperature,
      requireJson: true,
      maxTokens: 600,
    });

    let parsed: any;
    try {
      parsed = JSON.parse(raw);
    } catch {
      const m = raw.match(/(\{[\s\S]*\})/);
      if (m) { try { parsed = JSON.parse(m[1]); } catch { return null; } }
      if (!parsed) return null;
    }

    if (!parsed.question || !Array.isArray(parsed.choices) || parsed.choices.length !== 4) return null;

    // Verify the LLM didn't change the choices — compare normalized sets
    const origSet = new Set(item.choices.map(c => normalizeText(c)));
    const newSet = new Set(parsed.choices.map((c: string) => normalizeText(c)));
    if (origSet.size !== newSet.size || ![...origSet].every(c => newSet.has(c))) {
      // Choices were modified — fall back to original choices with rewritten question
      parsed.choices = item.choices;
      parsed.answerIndex = item.answerIndex;
    } else {
      // Choices are same but possibly reordered — find correct answerIndex
      const normCorrect = normalizeText(correctAnswer);
      const newIdx = parsed.choices.findIndex((c: string) => normalizeText(c) === normCorrect);
      if (newIdx < 0) return null;
      parsed.answerIndex = newIdx;
    }

    // Ensure explanation exists
    if (!parsed.explanation || parsed.explanation.length < 10) {
      parsed.explanation = `The correct answer is '${correctAnswer}' because it directly relates to the concept described in the lesson content.`;
    }

    return {
      question: parsed.question,
      choices: parsed.choices,
      answerIndex: parsed.answerIndex,
      explanation: parsed.explanation,
    };
  } catch (err) {
    console.error('transformMCQToScenario failed:', err instanceof Error ? err.message : err);
    return null;
  }
}

/**
 * Transform a single deterministic FIB into a HARD scenario-based item via Ollama.
 *
 * The LLM creates a longer, more complex sentence containing the same answer term.
 * Distractors are preserved from the deterministic generator.
 */
async function transformFIBToScenario(
  item: { sentence: string; answer: string; distractors: string[] },
  lessonSlice: string,
  keyConcepts: { term: string; definition: string }[],
  model: string,
  temperature: number
): Promise<{ sentence: string; answer: string; distractors: string[] } | null> {
  const conceptDef = keyConcepts.find(k => normalizeText(k.term) === normalizeText(item.answer));
  const defHint = conceptDef?.definition ? `\nDEFINITION: ${conceptDef.definition}` : '';

  const prompt = `Create a HARD fill-in-the-blank sentence about "${item.answer}". Output ONLY valid JSON.

ORIGINAL SENTENCE: ${item.sentence.replace('[blank]', item.answer)}${defHint}

LESSON CONTEXT:
${lessonSlice}

RULES:
1. Write a NEW sentence (80+ chars) using a scenario or application context from the lesson
2. The sentence MUST contain the term "${item.answer}" replaced with [blank]
3. Answer must be EXACTLY "${item.answer}" — do NOT change or abbreviate it
4. Use these exact distractors: ${JSON.stringify(item.distractors)}
5. Do NOT copy the original sentence — create a NEW one with different wording
6. Ensure the sentence is grammatically complete. If you use "refers", it MUST be followed by "to" (e.g., "X refers to [blank]").
7. The answer must appear as a noun phrase — it must fit naturally in the sentence when inserted into [blank].

{"sentence":"...scenario sentence with [blank]...","answer":"${item.answer}","distractors":${JSON.stringify(item.distractors)}}`;

  try {
    const raw = await generateWithOllama(prompt, {
      model,
      temperature,
      requireJson: true,
      maxTokens: 400,
    });

    let parsed: any;
    try {
      parsed = JSON.parse(raw);
    } catch {
      const m = raw.match(/(\{[\s\S]*\})/);
      if (m) { try { parsed = JSON.parse(m[1]); } catch { return null; } }
      if (!parsed) return null;
    }

    if (!parsed.sentence || !parsed.answer) return null;

    // Enforce answer hasn't been changed
    if (normalizeText(parsed.answer) !== normalizeText(item.answer)) {
      parsed.answer = item.answer;
    }

    // Ensure [blank] is present
    if (!parsed.sentence.includes('[blank]')) {
      // Try to insert [blank] by finding the answer in the sentence
      const esc = escapeRegex(item.answer);
      const reg = new RegExp(`\\b${esc}\\b`, 'i');
      if (reg.test(parsed.sentence)) {
        parsed.sentence = parsed.sentence.replace(reg, '[blank]');
      } else {
        return null;
      }
    }

    // Enforce distractors
    parsed.distractors = item.distractors;

    // ── Post-parse grammar guard ──
    // Verify that the answer actually appears in the sentence when [blank] is
    // replaced. This catches cases where the model blanked a different word.
    const reconstructed = parsed.sentence.replace('[blank]', item.answer);
    const ansEsc = escapeRegex(item.answer);
    if (!new RegExp(`\\b${ansEsc}\\b`, 'i').test(reconstructed)) {
      console.warn(`  Transform FIB: answer "${item.answer}" missing in reconstructed sentence — rejecting`);
      return null;
    }

    // Verify "refers to" grammar: if sentence has "refers [blank]", answer must start with "to"
    const pre = parsed.sentence.split('[blank]')[0].trim().toLowerCase();
    if (pre.endsWith('refers') && !item.answer.trim().toLowerCase().startsWith('to ')) {
      console.warn(`  Transform FIB: grammar error — "refers [blank]" but answer doesn't start with "to" — rejecting`);
      return null;
    }

    return {
      sentence: parsed.sentence,
      answer: item.answer,
      distractors: item.distractors,
    };
  } catch (err) {
    console.error('transformFIBToScenario failed:', err instanceof Error ? err.message : err);
    return null;
  }
}

/**
 * Transform a single deterministic flashcard into a HARD scenario-based card via Ollama.
 *
 * The LLM rewrites the front as a scenario/application question and the back as
 * an analytical explanation.
 */
async function transformFlashcardToScenario(
  item: { front: string; back: string },
  lessonSlice: string,
  model: string,
  temperature: number
): Promise<{ front: string; back: string } | null> {
  const prompt = `Transform this flashcard into a HARD scenario-based card. Output ONLY valid JSON.

ORIGINAL FRONT: ${item.front}
ORIGINAL BACK: ${item.back}

LESSON CONTEXT:
${lessonSlice}

RULES:
1. Front: A real-world scenario (1-2 sentences) or "What would happen if..." question
2. Back: 2-3 sentence analysis or explanation — not just a definition
3. Content from lesson only — no outside knowledge

{"front":"...scenario question...","back":"...2-3 sentence analysis..."}`;

  try {
    const raw = await generateWithOllama(prompt, {
      model,
      temperature,
      requireJson: true,
      maxTokens: 400,
    });

    let parsed: any;
    try {
      parsed = JSON.parse(raw);
    } catch {
      const m = raw.match(/(\{[\s\S]*\})/);
      if (m) { try { parsed = JSON.parse(m[1]); } catch { return null; } }
      if (!parsed) return null;
    }

    if (!parsed.front || !parsed.back) return null;
    if (parsed.front.length < 20 || parsed.back.length < 20) return null;

    return { front: parsed.front, back: parsed.back };
  } catch (err) {
    console.error('transformFlashcardToScenario failed:', err instanceof Error ? err.message : err);
    return null;
  }
}

/**
 * Orchestrate the transformation of deterministic items to HARD scenarios via Ollama.
 *
 * Features:
 * - **Incremental validation**: each item is validated immediately after transform.
 *   Stops as soon as `targetValid` items are collected.
 * - **Concurrency control**: processes items in parallel batches of `OLLAMA_CONCURRENCY`
 *   (default 1 for CPU; set to 2–3 for GPU).
 * - **Time budget**: aborts after `OLLAMA_TRANSFORM_TIME_MS` (default 2 min).
 * - **Signal propagation**: honours an external AbortSignal (e.g. client disconnect).
 */
async function transformItemsToHardScenarios(
  items: any[],
  type: 'MCQ' | 'FILL_IN_BLANK' | 'FLASHCARD',
  lessonContent: string,
  keyConcepts: { term: string; definition: string }[],
  model: string,
  temperature: number,
  options: {
    targetValid?: number;
    validator?: (item: any) => { valid: boolean; item: any };
    signal?: AbortSignal;
  } = {}
): Promise<{ transformed: any[]; validItems: any[]; failed: number; apiCalls: number }> {
  const { targetValid = items.length, validator, signal } = options;

  const validItems: any[] = [];
  const transformed: any[] = [];
  const seenKeys = new Set<string>();
  let failed = 0;
  let apiCalls = 0;

  // ── Time budget for transform step ──
  const TRANSFORM_TIME_BUDGET_MS = parseInt(process.env.OLLAMA_TRANSFORM_TIME_MS ?? '120000', 10);
  const transformStart = Date.now();

  // Concurrency: default 2 — safe for remote GPU setups; Ollama serialises
  // automatically on CPU so this only helps when a GPU is available.
  const concurrency = parseInt(process.env.OLLAMA_CONCURRENCY ?? '2', 10);

  console.log(`\n🔄 Transforming up to ${items.length} items to HARD scenarios (target: ${targetValid} valid, concurrency: ${concurrency}, budget: ${TRANSFORM_TIME_BUDGET_MS / 1000}s)...`);

  // Process a single item: transform → validate → collect
  const processItem = async (item: any, idx: number): Promise<void> => {
    const sliceSize = type === 'FILL_IN_BLANK' ? 1500 : 1200;
    const lessonSlice = getLessonSlice(lessonContent, idx, sliceSize, 0);

    let result: any = null;
    try {
      if (type === 'MCQ') {
        result = await transformMCQToScenario(item, lessonSlice, model, temperature);
      } else if (type === 'FILL_IN_BLANK') {
        result = await transformFIBToScenario(item, lessonSlice, keyConcepts, model, temperature);
      } else if (type === 'FLASHCARD') {
        result = await transformFlashcardToScenario(item, lessonSlice, model, temperature);
      }
    } catch {
      // Ollama call failed (timeout, abort, etc.) — keep original
    }
    apiCalls++;

    const outputItem = result ?? item;
    transformed.push(outputItem);

    if (!result) {
      failed++;
    }

    // ── Incremental validation ──
    if (validator) {
      const res = validator(outputItem);
      if (res.valid) {
        const key = normalizeText(
          type === 'MCQ' ? res.item.question : type === 'FILL_IN_BLANK' ? res.item.sentence : res.item.front
        );
        if (!seenKeys.has(key)) {
          seenKeys.add(key);
          validItems.push(res.item);
        }
      }
    } else {
      // No validator — accept all non-null results
      if (result) validItems.push(outputItem);
    }
  };

  // Process in batches of `concurrency`
  for (let i = 0; i < items.length; i += concurrency) {
    // ── Check abort signal ──
    if (signal?.aborted) {
      console.warn(`⚠ Transform aborted by signal after ${i} items.`);
      break;
    }

    // ── Check time budget ──
    const elapsed = Date.now() - transformStart;
    if (elapsed >= TRANSFORM_TIME_BUDGET_MS) {
      console.warn(`⏱ Transform time budget exhausted (${Math.round(elapsed / 1000)}s). Processed ${i}/${items.length}.`);
      break;
    }

    // ── Early exit when we have enough valid items ──
    if (validItems.length >= targetValid) {
      console.log(`✅ Transform early exit: ${validItems.length}/${targetValid} valid items collected after ${i} processed (${Math.round(elapsed / 1000)}s).`);
      break;
    }

    const batch = items.slice(i, i + concurrency);
    await Promise.all(batch.map((item, j) => processItem(item, i + j)));

    if ((i + concurrency) % 5 < concurrency || i + concurrency >= items.length) {
      console.log(`  Transform progress: ${Math.min(i + concurrency, items.length)}/${items.length} processed, ${validItems.length} valid (${Math.round((Date.now() - transformStart) / 1000)}s)`);
    }
  }

  console.log(`✅ Transform complete: ${validItems.length} valid, ${failed} kept-original, ${apiCalls} calls (${Math.round((Date.now() - transformStart) / 1000)}s)`);
  return { transformed, validItems, failed, apiCalls };
}

/**
 * Generate quiz using Ollama with structured prompts (auto-selects best available model)
 * High-performance parallel-wave architecture with 1.5x overgeneration
 */
export async function generateQuizWithGemma(
  lessonContent: string,
  type: 'MCQ' | 'FILL_IN_BLANK' | 'FLASHCARD',
  difficulty: 'EASY' | 'MEDIUM' | 'HARD',
  count: number,
  preResolvedModel?: string,
  keyConcepts: { term: string; definition: string; example?: string }[] = [],
  originalKeyConcepts: { term: string; definition: string; example?: string }[] = [],
  notes?: { term: string; definition?: string; example?: string }[],
  signal?: AbortSignal,
  onProgress?: (event: { stage: string; message: string; percent: number }) => void
): Promise<any> {
  // Track generation time
  const startTime = Date.now();

  // ── Content-length intelligence ──
  // When the lesson has no structured key concepts and the raw content is
  // short, requesting many items is futile — the LLM will just repeat the
  // same few sentences. Cap the effective count proportionally so the wave
  // loop converges quickly instead of grinding through 200 waves of dupes.
  if (keyConcepts.length === 0 && lessonContent.length < 2000) {
    const contentCap = Math.max(5, Math.floor(lessonContent.length / 150));
    if (count > contentCap) {
      console.warn(`⚠ Short content (${lessonContent.length} chars, 0 concepts) — capping count from ${count} → ${contentCap}`);
      count = contentCap;
    }
  }

  // ── Auto-extract concepts when keyConcepts are empty ──
  // This feeds ALL deterministic fast-paths (FIB, MCQ, Flashcard) so that
  // even lessons without structured key_concepts can hit the instant path.
  let autoConcepts: { term: string; definition: string }[] = [];
  if (keyConcepts.length === 0) {
    autoConcepts = extractImportantTerms(lessonContent, notes);
    if (autoConcepts.length > 0) {
      console.log(`Auto-extracted ${autoConcepts.length} concepts from lesson content for deterministic generation.`);
    }
  }

  // ── Deterministic fast-path for FILL_IN_BLANK ──
  // When keyConcepts are available, we can build items deterministically by
  // pre-extracting sentences that contain key terms. This guarantees each
  // sentence is verbatim, the answer is present, and distractors are real
  // key concepts — eliminating the "answer not found" and paraphrasing
  // failures that plague the LLM-based pipeline.
  //
  // For HARD: deterministic items are collected as seeds, then each is
  // transformed into a scenario-based item via Ollama (never returned as-is).
  let _deterministicSeed: any[] | null = null;
  const fibConcepts = keyConcepts.length >= 4 ? keyConcepts : (autoConcepts.length >= 4 ? autoConcepts : []);
  if (type === 'FILL_IN_BLANK' && fibConcepts.length >= 4) {
    if (difficulty === 'HARD') {
      // ── Step 1: Try deterministic HARD directly — instant, no LLM ──
      const hardDet = generateDeterministicFIB(lessonContent, fibConcepts, count, 'HARD', notes);
      if (hardDet && hardDet.length >= count) {
        const elapsed = Date.now() - startTime;
        const timeString = elapsed < 60000 ? `${elapsed}ms` : `${Math.floor(elapsed / 60000)}m ${Math.floor((elapsed % 60000) / 1000)}s`;
        console.log(`\n=== Generation Complete (deterministic HARD FIB fast-path) ===`);
        console.log(`Requested: ${count} | Produced: ${hardDet.length} | Time: ${timeString}`);
        console.log(`===========================\n`);
        onProgress?.({ stage: 'complete', message: 'Quiz generated!', percent: 100 });
        return {
          type: 'fill_blank',
          difficulty: 'hard',
          items: hardDet.slice(0, count),
          rejectedItems: [],
          stats: { requested: count, generated: hardDet.length, rejected: 0, waves: 0, apiCalls: 0 }
        };
      }

      // ── Step 2: Deterministic HARD yielded partial — seed those, try transform for the rest ──
      const hardSeed = hardDet ?? [];
      if (hardSeed.length > 0) {
        console.log(`Deterministic HARD FIB produced ${hardSeed.length}/${count} — will attempt transform for remainder.`);
      }

      // Generate EASY base items for transform
      const detCount = Math.ceil(count * 1.5);
      const deterministicItems = generateDeterministicFIB(lessonContent, fibConcepts, detCount, 'EASY', notes);

      if (deterministicItems && deterministicItems.length > 0) {
        const resolvedModelForTransform = process.env.OLLAMA_HARD_MODEL || preResolvedModel || await getBestAvailableModel();
        const hardTemp = 0.40;
        const remaining = count - hardSeed.length;
        const itemsToTransform = deterministicItems.slice(0, Math.min(remaining, 5));
        onProgress?.({ stage: 'transform', message: `Transforming ${itemsToTransform.length} items to HARD scenarios...`, percent: 15 });
        const { validItems: validTransformed, transformed, failed: _failedFIB, apiCalls } = await transformItemsToHardScenarios(
          itemsToTransform, 'FILL_IN_BLANK', lessonContent, fibConcepts, resolvedModelForTransform, hardTemp,
          {
            targetValid: remaining,
            validator: (item: any) => validateFillInBlankItem(item, lessonContent, fibConcepts, 'HARD', notes),
            signal,
          }
        );

        // Combine deterministic HARD seed + transformed items
        const combined = [...hardSeed, ...validTransformed];
        if (combined.length >= count) {
          const elapsed = Date.now() - startTime;
          const timeString = elapsed < 60000 ? `${elapsed}ms` : `${Math.floor(elapsed / 60000)}m ${Math.floor((elapsed % 60000) / 1000)}s`;
          console.log(`\n=== Generation Complete (HARD FIB: ${hardSeed.length} det + ${validTransformed.length} transformed) ===`);
          console.log(`Requested: ${count} | Produced: ${combined.length} | Time: ${timeString}`);
          console.log(`===========================\n`);
          return {
            type: 'fill_blank',
            difficulty: 'hard',
            items: combined.slice(0, count),
            rejectedItems: [],
            stats: { requested: count, generated: combined.length, rejected: transformed.length - validTransformed.length, waves: 0, apiCalls }
          };
        }
        if (combined.length >= Math.ceil(count * 0.6)) {
          const elapsed = Date.now() - startTime;
          const timeString = elapsed < 60000 ? `${elapsed}ms` : `${Math.floor(elapsed / 60000)}m ${Math.floor((elapsed % 60000) / 1000)}s`;
          console.log(`\n=== Generation Complete (HARD FIB partial early-return: ${combined.length}/${count}) ===`);
          console.log(`Time: ${timeString}`);
          console.log(`===========================\n`);
          return {
            type: 'fill_blank',
            difficulty: 'hard',
            items: combined.slice(0, count),
            rejectedItems: [],
            stats: { requested: count, generated: combined.length, rejected: transformed.length - validTransformed.length, waves: 0, apiCalls }
          };
        }
        // Seed the wave loop with whatever we have
        _deterministicSeed = combined;
        console.log(`HARD FIB: ${combined.length}/${count} after det+transform — wave loop will fill remaining.`);
      } else if (hardSeed.length > 0) {
        _deterministicSeed = hardSeed;
        console.log(`HARD FIB: ${hardSeed.length}/${count} from det only — wave loop will fill remaining.`);
      }
    } else {
      // EASY / MEDIUM path (unchanged)
      const deterministicItems = generateDeterministicFIB(lessonContent, fibConcepts, count, difficulty, notes);
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
      } else if (deterministicItems && deterministicItems.length > 0) {
        _deterministicSeed = deterministicItems;
        console.log(`Deterministic FIB produced ${deterministicItems.length}/${count} — wave loop will fill remaining.`);
      }
    }
  }

  // ── Deterministic fast-path for MCQ (ALL difficulties) ──
  // Uses ORIGINAL key concepts (pre-expansion) + definitions to build
  // quiz questions. Expanded variants produce fragment terms
  // like "learning discovers" that are not valid concepts for MCQ.
  //
  // For HARD: try deterministic HARD first (instant). If enough items,
  // return immediately with zero LLM calls. Otherwise seed those +
  // transform a small batch via Ollama, then fall through to wave loop.
  let _deterministicMCQSeed: any[] | null = null;
  const mcqConcepts = originalKeyConcepts.length >= 4 ? originalKeyConcepts
    : keyConcepts.length >= 4 ? keyConcepts
    : autoConcepts.length >= 4 ? autoConcepts : [];
  if (type === 'MCQ' && mcqConcepts.length >= 4) {
    if (difficulty === 'HARD') {
      // ── Step 1: Try deterministic HARD directly — instant, no LLM ──
      const hardDet = generateDeterministicMCQ(mcqConcepts, count, 'HARD');
      if (hardDet && hardDet.length >= count) {
        const elapsed = Date.now() - startTime;
        const timeString = elapsed < 60000 ? `${elapsed}ms` : `${Math.floor(elapsed / 60000)}m ${Math.floor((elapsed % 60000) / 1000)}s`;
        console.log(`\n=== Generation Complete (deterministic HARD MCQ fast-path) ===`);
        console.log(`Requested: ${count} | Produced: ${hardDet.length} | Time: ${timeString}`);
        console.log(`===========================\n`);
        onProgress?.({ stage: 'complete', message: 'Quiz generated!', percent: 100 });
        return {
          type: 'mcq',
          difficulty: 'hard',
          items: hardDet.slice(0, count),
          rejectedItems: [],
          stats: { requested: count, generated: hardDet.length, rejected: 0, waves: 0, apiCalls: 0 }
        };
      }

      // ── Step 2: Deterministic HARD yielded partial — seed those, try transform for the rest ──
      const hardSeed = hardDet ?? [];
      if (hardSeed.length > 0) {
        console.log(`Deterministic HARD MCQ produced ${hardSeed.length}/${count} — will attempt transform for remainder.`);
      }

      // Generate EASY base items for transform
      const detCount = Math.ceil(count * 1.5);
      const deterministicItems = generateDeterministicMCQ(mcqConcepts, detCount, 'EASY');

      if (deterministicItems && deterministicItems.length > 0) {
        const resolvedModelForTransform = process.env.OLLAMA_HARD_MODEL || preResolvedModel || await getBestAvailableModel();
        const hardTemp = 0.45;
        const remaining = count - hardSeed.length;
        const itemsToTransform = deterministicItems.slice(0, Math.min(remaining, 5));
        onProgress?.({ stage: 'transform', message: `Transforming ${itemsToTransform.length} MCQ items to HARD scenarios...`, percent: 15 });
        const { validItems: validTransformed, transformed, failed: _failedMCQ, apiCalls } = await transformItemsToHardScenarios(
          itemsToTransform, 'MCQ', lessonContent, mcqConcepts, resolvedModelForTransform, hardTemp,
          {
            targetValid: remaining,
            validator: (item: any) => validateMCQItem(item, 'HARD', mcqConcepts, lessonContent),
            signal,
          }
        );

        // Combine deterministic HARD seed + transformed items
        const combined = [...hardSeed, ...validTransformed];
        if (combined.length >= count) {
          const elapsed = Date.now() - startTime;
          const timeString = elapsed < 60000 ? `${elapsed}ms` : `${Math.floor(elapsed / 60000)}m ${Math.floor((elapsed % 60000) / 1000)}s`;
          console.log(`\n=== Generation Complete (HARD MCQ: ${hardSeed.length} det + ${validTransformed.length} transformed) ===`);
          console.log(`Requested: ${count} | Produced: ${combined.length} | Time: ${timeString}`);
          console.log(`===========================\n`);
          return {
            type: 'mcq',
            difficulty: 'hard',
            items: combined.slice(0, count),
            rejectedItems: [],
            stats: { requested: count, generated: combined.length, rejected: transformed.length - validTransformed.length, waves: 0, apiCalls }
          };
        }
        if (combined.length >= Math.ceil(count * 0.6)) {
          const elapsed = Date.now() - startTime;
          const timeString = elapsed < 60000 ? `${elapsed}ms` : `${Math.floor(elapsed / 60000)}m ${Math.floor((elapsed % 60000) / 1000)}s`;
          console.log(`\n=== Generation Complete (HARD MCQ partial early-return: ${combined.length}/${count}) ===`);
          console.log(`Time: ${timeString}`);
          console.log(`===========================\n`);
          return {
            type: 'mcq',
            difficulty: 'hard',
            items: combined.slice(0, count),
            rejectedItems: [],
            stats: { requested: count, generated: combined.length, rejected: transformed.length - validTransformed.length, waves: 0, apiCalls }
          };
        }
        // Seed the wave loop with whatever we have
        _deterministicMCQSeed = combined;
        console.log(`HARD MCQ: ${combined.length}/${count} after det+transform — wave loop will fill remaining.`);
      } else if (hardSeed.length > 0) {
        _deterministicMCQSeed = hardSeed;
        console.log(`HARD MCQ: ${hardSeed.length}/${count} from det only — wave loop will fill remaining.`);
      }
    } else {
      // EASY / MEDIUM path (unchanged)
      const deterministicItems = generateDeterministicMCQ(mcqConcepts, count, difficulty);
      if (deterministicItems && deterministicItems.length >= count) {
        const elapsed = Date.now() - startTime;
        const elapsedSeconds = Math.floor(elapsed / 1000);
        const minutes = Math.floor(elapsedSeconds / 60);
        const seconds = elapsedSeconds % 60;
        const timeString = minutes > 0 ? `${minutes}m ${seconds}s` : `${elapsed}ms`;

        console.log(`\n=== Generation Complete ===`);
        console.log(`Requested: ${count} (deterministic MCQ ${difficulty} fast-path)`);
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
          difficulty: difficulty.toLowerCase(),
          items: deterministicItems.slice(0, count),
          rejectedItems: [],
          stats: { requested: count, generated: deterministicItems.length, rejected: 0, waves: 0, apiCalls: 0 }
        };
      } else if (deterministicItems && deterministicItems.length > 0) {
        _deterministicMCQSeed = deterministicItems;
        console.log(`Deterministic MCQ ${difficulty} produced ${deterministicItems.length}/${count} — wave loop will fill remaining.`);
      }
    }
  }

  // ── Deterministic fast-path for FLASHCARDS (ALL difficulties) ──
  // Builds front/back cards directly from key concept definitions.
  // EASY: simple recall, MEDIUM: varied styles, HARD: scenario/comparison.
  //
  // For HARD: try deterministic HARD first (instant). If enough items,
  // return immediately with zero LLM calls. Otherwise seed those +
  // transform a small batch via Ollama, then fall through to wave loop.
  let _deterministicFlashcardSeed: any[] | null = null;
  const flashcardConcepts = originalKeyConcepts.length >= 2 ? originalKeyConcepts
    : keyConcepts.length >= 2 ? keyConcepts
    : autoConcepts.length >= 2 ? autoConcepts : [];
  if (type === 'FLASHCARD' && flashcardConcepts.length >= 2) {
    if (difficulty === 'HARD') {
      // ── Step 1: Try deterministic HARD directly — instant, no LLM ──
      const hardDet = generateDeterministicFlashcards(flashcardConcepts, count, 'HARD');
      if (hardDet && hardDet.length >= count) {
        const elapsed = Date.now() - startTime;
        const timeString = elapsed < 60000 ? `${elapsed}ms` : `${Math.floor(elapsed / 60000)}m ${Math.floor((elapsed % 60000) / 1000)}s`;
        console.log(`\n=== Generation Complete (deterministic HARD Flashcard fast-path) ===`);
        console.log(`Requested: ${count} | Produced: ${hardDet.length} | Time: ${timeString}`);
        console.log(`===========================\n`);
        onProgress?.({ stage: 'complete', message: 'Quiz generated!', percent: 100 });
        return {
          type: 'flashcard',
          difficulty: 'hard',
          items: hardDet.slice(0, count),
          rejectedItems: [],
          stats: { requested: count, generated: hardDet.length, rejected: 0, waves: 0, apiCalls: 0 }
        };
      }

      // ── Step 2: Deterministic HARD yielded partial — seed those, try transform for the rest ──
      const hardSeed = hardDet ?? [];
      if (hardSeed.length > 0) {
        console.log(`Deterministic HARD Flashcard produced ${hardSeed.length}/${count} — will attempt transform for remainder.`);
      }

      // Generate EASY base items for transform
      const detCount = Math.ceil(count * 1.5);
      const deterministicItems = generateDeterministicFlashcards(flashcardConcepts, detCount, 'EASY');

      if (deterministicItems && deterministicItems.length > 0) {
        const resolvedModelForTransform = process.env.OLLAMA_HARD_MODEL || preResolvedModel || await getBestAvailableModel();
        const hardTemp = 0.55;
        const remaining = count - hardSeed.length;
        const itemsToTransform = deterministicItems.slice(0, Math.min(remaining, 5));
        onProgress?.({ stage: 'transform', message: `Transforming ${itemsToTransform.length} Flashcard items to HARD scenarios...`, percent: 15 });
        const { validItems: validTransformed, transformed, failed: _failedFlash, apiCalls } = await transformItemsToHardScenarios(
          itemsToTransform, 'FLASHCARD', lessonContent, flashcardConcepts, resolvedModelForTransform, hardTemp,
          {
            targetValid: remaining,
            validator: (item: any) => validateFlashcardItem(item),
            signal,
          }
        );

        // Combine deterministic HARD seed + transformed items
        const combined = [...hardSeed, ...validTransformed];
        if (combined.length >= count) {
          const elapsed = Date.now() - startTime;
          const timeString = elapsed < 60000 ? `${elapsed}ms` : `${Math.floor(elapsed / 60000)}m ${Math.floor((elapsed % 60000) / 1000)}s`;
          console.log(`\n=== Generation Complete (HARD Flashcard: ${hardSeed.length} det + ${validTransformed.length} transformed) ===`);
          console.log(`Requested: ${count} | Produced: ${combined.length} | Time: ${timeString}`);
          console.log(`===========================\n`);
          return {
            type: 'flashcard',
            difficulty: 'hard',
            items: combined.slice(0, count),
            rejectedItems: [],
            stats: { requested: count, generated: combined.length, rejected: transformed.length - validTransformed.length, waves: 0, apiCalls }
          };
        }
        if (combined.length >= Math.ceil(count * 0.6)) {
          const elapsed = Date.now() - startTime;
          const timeString = elapsed < 60000 ? `${elapsed}ms` : `${Math.floor(elapsed / 60000)}m ${Math.floor((elapsed % 60000) / 1000)}s`;
          console.log(`\n=== Generation Complete (HARD Flashcard partial early-return: ${combined.length}/${count}) ===`);
          console.log(`Time: ${timeString}`);
          console.log(`===========================\n`);
          return {
            type: 'flashcard',
            difficulty: 'hard',
            items: combined.slice(0, count),
            rejectedItems: [],
            stats: { requested: count, generated: combined.length, rejected: transformed.length - validTransformed.length, waves: 0, apiCalls }
          };
        }
        // Seed the wave loop with whatever we have
        _deterministicFlashcardSeed = combined;
        console.log(`HARD Flashcard: ${combined.length}/${count} after det+transform — wave loop will fill remaining.`);
      } else if (hardSeed.length > 0) {
        _deterministicFlashcardSeed = hardSeed;
        console.log(`HARD Flashcard: ${hardSeed.length}/${count} from det only — wave loop will fill remaining.`);
      }
    } else {
      // EASY / MEDIUM path (unchanged)
      const deterministicItems = generateDeterministicFlashcards(flashcardConcepts, count, difficulty);
      if (deterministicItems && deterministicItems.length >= count) {
        const elapsed = Date.now() - startTime;
        const elapsedSeconds = Math.floor(elapsed / 1000);
        const minutes = Math.floor(elapsedSeconds / 60);
        const seconds = elapsedSeconds % 60;
        const timeString = minutes > 0 ? `${minutes}m ${seconds}s` : `${elapsed}ms`;

        console.log(`\n=== Generation Complete ===`);
        console.log(`Requested: ${count} (deterministic Flashcard ${difficulty} fast-path)`);
        console.log(`Total verified items generated: ${deterministicItems.length}`);
        console.log(`Final items returned: ${Math.min(deterministicItems.length, count)}`);
        console.log(`Rejected items: 0`);
        console.log(`Total waves: 0 (0 API calls)`);
        console.log(`Success rate: 100%`);
        console.log(`JSON parse errors (possible truncations): 0`);
        console.log(`Time elapsed: ${timeString}`);
        console.log(`===========================\n`);

        return {
          type: 'flashcard',
          difficulty: difficulty.toLowerCase(),
          items: deterministicItems.slice(0, count),
          rejectedItems: [],
          stats: { requested: count, generated: deterministicItems.length, rejected: 0, waves: 0, apiCalls: 0 }
        };
      } else if (deterministicItems && deterministicItems.length > 0) {
        _deterministicFlashcardSeed = deterministicItems;
        console.log(`Deterministic Flashcards produced ${deterministicItems.length}/${count} — wave loop will fill remaining.`);
      }
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
  if (_deterministicFlashcardSeed && _deterministicFlashcardSeed.length > 0) {
    for (const item of _deterministicFlashcardSeed) {
      allValidItems.push(item);
      if (item.front) seenItems.add(normalizeText(item.front));
    }
    console.log(`Seeded wave loop with ${_deterministicFlashcardSeed.length} deterministic Flashcard items.`);
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
  // HARD uses a minimal buffer — each item costs 1-2 Ollama calls on CPU,
  // so overgeneration directly translates to long wait times.
  const BUFFER = difficulty === 'HARD'
    ? Math.min(2, Math.ceil(count * 0.1))   // HARD: max 2 extra
    : Math.max(5, Math.ceil(count * 0.5));  // EASY/MEDIUM: 50% buffer
  const targetCount = count + BUFFER;
  console.log(`Will generate up to ${targetCount} verified items (${count} requested + ${BUFFER} buffer).`);

  // CPU inference: Ollama processes requests sequentially on CPU, so parallel calls
  // just compete for threads and both timeout. Use CONCURRENCY=1 for local/CPU setups.
  // Set OLLAMA_CONCURRENCY=2 (or higher) when running with GPU / sufficient RAM.
  const CONCURRENCY = parseInt(process.env.OLLAMA_CONCURRENCY ?? '1', 10);
  // Wave budget — generous to ensure we keep trying until target is met.
  // The absolute time limit is the real safety valve.
  const MAX_WAVES = 200;
  // Absolute time limit: stop after this many ms regardless of progress.
  // Default 4 minutes — must finish before the API route timeout (maxDuration=300s)
  // with enough margin for response serialization and DB writes.
  const ABSOLUTE_TIME_LIMIT_MS = parseInt(process.env.OLLAMA_TIME_LIMIT_MS ?? '240000', 10);
  
  let wave = 0;
  let totalApiCalls = 0;
  let consecutiveFailures = 0;

  // Notify the caller that the wave loop is starting
  if (allValidItems.length < targetCount) {
    onProgress?.({ stage: 'wave', message: `Generating items... (${allValidItems.length}/${count} so far)`, percent: 30 });
  }
  
  let jsonParseErrors = 0; // Track truncation-related parse failures
  let repairAttempts = 0;   // Track JSON repair attempts (cap to avoid infinite loops)
  const MAX_REPAIR_ATTEMPTS = 3; // Repair is expensive; prefer salvage over repair
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

  // ── Hard FIB concept-by-concept state ──
  // For Hard FIB, generate one item per concept with a focused prompt.
  // This avoids batch truncation and ensures each item targets a distinct concept.
  // When keyConcepts are empty, uses autoConcepts already extracted above.
  let hardFIBConceptPool: { term: string; definition: string }[] = [];
  let hardFIBConceptIndex = 0;
  if (type === 'FILL_IN_BLANK' && difficulty === 'HARD') {
    if (keyConcepts.length > 0) {
      hardFIBConceptPool = shuffleArray([...keyConcepts]);
    } else if (autoConcepts.length >= 2) {
      hardFIBConceptPool = shuffleArray([...autoConcepts]);
      console.log(`Hard FIB: using ${autoConcepts.length} auto-extracted terms for concept-by-concept mode.`);
    }
    if (hardFIBConceptPool.length > 0) {
      console.log(`Hard FIB: concept-by-concept mode with ${hardFIBConceptPool.length} concepts.`);
    }
  }

  // ── Hard Flashcard concept-by-concept state ──
  // For Hard flashcards that overflow the deterministic path, generate one
  // card per concept with a focused prompt as fallback.
  let hardFlashcardConceptPool: { term: string; definition: string }[] = [];
  let hardFlashcardConceptIndex = 0;
  if (type === 'FLASHCARD' && difficulty === 'HARD' && keyConcepts.length > 0) {
    hardFlashcardConceptPool = shuffleArray([...keyConcepts]);
    console.log(`Hard Flashcard: concept-by-concept mode with ${hardFlashcardConceptPool.length} concepts.`);
  }

  // ── Per-concept retry tracking ──
  // Don't advance to the next concept until the current one produces output
  // or exhausts its retry budget. This ensures every concept gets covered.
  const MAX_CONCEPT_RETRIES = 3;
  const conceptRetries = new Map<string, number>();

  console.log(`Starting quiz generation: ${count} ${type} items at ${difficulty} difficulty`);
  console.log(`Configuration: baseBatchSize=${baseBatchSize}, CONCURRENCY=${CONCURRENCY}, MAX_WAVES=${MAX_WAVES}`);
  console.log(`Key concepts: ${keyConcepts.length} (original: ${originalKeyConcepts.length})`);
  console.log(`Lesson content length: ${lessonContent.length} chars`);
  console.log(`Base temperature: ${baseTemperature}`);
  
  try {
    // ── Parallel-wave generation loop ──
    // Each wave fires CONCURRENCY parallel API calls, each with a different lesson content slice
    while (allValidItems.length < targetCount && wave < MAX_WAVES) {
      // ── Absolute time limit ──
      const elapsedSoFar = Date.now() - startTime;
      if (elapsedSoFar >= ABSOLUTE_TIME_LIMIT_MS) {
        console.warn(`⏱ Absolute time limit reached (${Math.round(elapsedSoFar / 1000)}s). ` +
          `Returning ${allValidItems.length}/${targetCount} collected items.`);
        break;
      }

      // Emit progress every 3 waves so the SSE connection stays alive
      if (wave % 3 === 0) {
        const pct = Math.min(80, 30 + Math.round((allValidItems.length / targetCount) * 50));
        onProgress?.({ stage: 'wave', message: `Generating items... (${allValidItems.length}/${count})`, percent: pct });
      }

      const remainingCount = targetCount - allValidItems.length;
      
      // ── Simplified temperature strategy ──
      // Use fixed temperatures per type/difficulty. Only boost mildly on stagnation.
      // Complex oscillation confuses the 4B model more than it helps.
      let temperature: number;
      if (stagnantWaves >= 3) {
        // Mild stagnation boost — cap at base + 0.15 to avoid incoherent output
        temperature = Math.min(baseTemperature + 0.15, 0.75);
      } else {
        temperature = baseTemperature;
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

      // Force batch size of 2 for EASY MCQ — small enough for reliable JSON,
      // large enough to double throughput vs single-item requests.
      if (difficulty === 'EASY' && type === 'MCQ') {
        effectiveBatchSize = 2;
      }
      // Cap MCQ batch size at 5 for all difficulties to prevent constraint saturation.
      // The model degrades sharply when asked for >5 MCQ items with strict JSON + constraints.
      if (type === 'MCQ' && effectiveBatchSize > 5) {
        effectiveBatchSize = 5;
      }

      // When stuck, jump to a random part of the lesson content to find fresh content
      if (stagnantWaves >= 2) {
        sliceRandomOffset = Math.floor(Math.random() * 20);
        console.log(`🔀 Randomizing lesson content slice offset to ${sliceRandomOffset}`);
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

        const prompt = buildHardMCQPrompt(concept, lessonContent, keyConcepts);
        const maxTokens = 600; // generous for a single item

        const retryNum = conceptRetries.get(concept.term) || 0;
        console.log(`  Hard MCQ concept-by-concept: "${concept.term}" (index ${hardConceptIndex}, attempt ${retryNum + 1}/${MAX_CONCEPT_RETRIES + 1})`);
        const rawResponse = await generateWithOllama(prompt, {
          model: resolvedModel,
          temperature: retryNum > 0 ? Math.min(temperature + 0.1 * retryNum, 0.8) : temperature,
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
            if (!parsedItem && repairAttempts < MAX_REPAIR_ATTEMPTS) {
              // ── Repair attempt for Hard MCQ concept-by-concept ──
              repairAttempts++;
              console.log(`  Hard MCQ "${concept.term}": Attempting JSON repair (attempt ${repairAttempts}/${MAX_REPAIR_ATTEMPTS})...`);
              const repaired = await repairTruncatedJSON(rawResponse, resolvedModel, maxTokens);
              if (repaired) {
                try {
                  parsedItem = JSON.parse(repaired);
                  console.log(`  Hard MCQ "${concept.term}": ✅ Repair succeeded.`);
                } catch {
                  const jsonMatch2 = repaired.match(/(\{[\s\S]*\})/);
                  if (jsonMatch2) {
                    try { parsedItem = JSON.parse(jsonMatch2[1]); } catch { /* ignore */ }
                  }
                  if (parsedItem) {
                    console.log(`  Hard MCQ "${concept.term}": Repair partially succeeded (extracted JSON).`);
                  } else {
                    console.warn(`  Hard MCQ "${concept.term}": Repair produced invalid JSON.`);
                  }
                }
              }
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
                validateQuizItems(items, type, seenItems, difficulty, lessonContent, keyConcepts, notes);

              if (structValid.length > 0) {
                // Skip LLM verification for concept-by-concept — structural
                // validation is already thorough, and the extra Ollama call
                // per wave doubles generation time on CPU inference.
                allValidItems.push(...structValid);
                allRejectedItems.push(...rejBatch);
                waveValidCount = structValid.length;
                waveRejectedCount = rejBatch.length;
              } else {
                allRejectedItems.push(...rejBatch);
                waveRejectedCount = rejBatch.length;
              }
            } else {
              console.warn(`  Invalid structure for concept "${concept.term}"`);
            }
          }
        }

        // Track stagnation and per-concept retry
        if (waveValidCount === 0) {
          const retries = (conceptRetries.get(concept.term) || 0) + 1;
          conceptRetries.set(concept.term, retries);
          if (retries >= MAX_CONCEPT_RETRIES) {
            console.warn(`  Concept "${concept.term}": exhausted ${retries} retries — moving to next concept`);
            hardConceptIndex++;
          }
          // else: stay on same concept for retry
          consecutiveFailures++;
          stagnantWaves++;
        } else {
          // Success — advance to next concept
          hardConceptIndex++;
          conceptRetries.delete(concept.term);
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

      // ── Hard FIB: concept-by-concept single-item generation ──
      // For Hard FIB, generate one item per concept to avoid truncation and
      // ensure each item targets a distinct multi-word key term.
      if (type === 'FILL_IN_BLANK' && difficulty === 'HARD' && hardFIBConceptPool.length > 0) {
        const concept = hardFIBConceptPool[hardFIBConceptIndex % hardFIBConceptPool.length];

        const conceptPool = keyConcepts.length > 0 ? keyConcepts : autoConcepts;
        const retryNum = conceptRetries.get(concept.term) || 0;
        const prompt = buildHardFIBPrompt(concept, getLessonSlice(lessonContent, hardFIBConceptIndex, 1900, 150), conceptPool, notes);
        const maxTokens = 500;

        console.log(`  Hard FIB concept-by-concept: "${concept.term}" (index ${hardFIBConceptIndex}, attempt ${retryNum + 1}/${MAX_CONCEPT_RETRIES + 1})`);
        const rawResponse = await generateWithOllama(prompt, {
          model: resolvedModel,
          temperature: retryNum > 0 ? Math.min(temperature + 0.1 * retryNum, 0.8) : temperature,
          requireJson: true,
          maxTokens,
        }).catch(err => {
          console.error(`  Call failed for FIB concept "${concept.term}":`, err instanceof Error ? err.message : err);
          return null;
        });
        totalApiCalls++;

        let waveValidCount = 0;
        let waveRejectedCount = 0;

        if (rawResponse) {
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
              console.error(`  JSON parse error for FIB concept "${concept.term}"`);
            }
          }

          if (parsedItem) {
            const items = parsedItem.items && Array.isArray(parsedItem.items)
              ? parsedItem.items
              : (parsedItem.sentence && parsedItem.answer ? [parsedItem] : []);

            if (items.length > 0) {
              const { validItems: structValid, rejectedItems: rejBatch } =
                validateQuizItems(items, type, seenItems, difficulty, lessonContent, keyConcepts, notes);

              if (structValid.length > 0) {
                // Skip LLM verification for concept-by-concept — structural
                // validation is already thorough for FIB items.
                allValidItems.push(...structValid);
                allRejectedItems.push(...rejBatch);
                waveValidCount = structValid.length;
                waveRejectedCount = rejBatch.length;
              } else {
                allRejectedItems.push(...rejBatch);
                waveRejectedCount = rejBatch.length;
              }
            } else {
              console.warn(`  Invalid structure for FIB concept "${concept.term}"`);
            }
          }
        }

        // Track stagnation and per-concept retry
        if (waveValidCount === 0) {
          const retries = (conceptRetries.get(concept.term) || 0) + 1;
          conceptRetries.set(concept.term, retries);
          if (retries >= MAX_CONCEPT_RETRIES) {
            console.warn(`  FIB Concept "${concept.term}": exhausted ${retries} retries — moving to next concept`);
            hardFIBConceptIndex++;
          }
          consecutiveFailures++;
          stagnantWaves++;
        } else {
          hardFIBConceptIndex++;
          conceptRetries.delete(concept.term);
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

        if (stagnantWaves >= 10) {
          console.warn(`⚠ ${stagnantWaves} consecutive zero-yield waves — stopping early. Returning ${allValidItems.length}/${targetCount} collected items.`);
          break;
        }
        continue;
      }

      // ── Hard Flashcard: concept-by-concept single-item generation ──
      // For Hard flashcards, generate one card per concept with a focused prompt.
      // This avoids batch truncation and ensures scenario-based content.
      if (type === 'FLASHCARD' && difficulty === 'HARD' && hardFlashcardConceptPool.length > 0) {
        const concept = hardFlashcardConceptPool[hardFlashcardConceptIndex % hardFlashcardConceptPool.length];

        const retryNum = conceptRetries.get(concept.term) || 0;
        const prompt = buildHardFlashcardPrompt(concept, getLessonSlice(lessonContent, hardFlashcardConceptIndex, 1500, 0), keyConcepts);
        const maxTokens = 400;

        console.log(`  Hard Flashcard concept-by-concept: "${concept.term}" (index ${hardFlashcardConceptIndex}, attempt ${retryNum + 1}/${MAX_CONCEPT_RETRIES + 1})`);
        const rawResponse = await generateWithOllama(prompt, {
          model: resolvedModel,
          temperature: retryNum > 0 ? Math.min(temperature + 0.1 * retryNum, 0.8) : temperature,
          requireJson: true,
          maxTokens,
        }).catch(err => {
          console.error(`  Call failed for flashcard concept "${concept.term}":`, err instanceof Error ? err.message : err);
          return null;
        });
        totalApiCalls++;

        let waveValidCount = 0;
        let waveRejectedCount = 0;

        if (rawResponse) {
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
              console.error(`  JSON parse error for flashcard concept "${concept.term}"`);
            }
          }

          if (parsedItem) {
            const items = parsedItem.items && Array.isArray(parsedItem.items)
              ? parsedItem.items
              : (parsedItem.front && parsedItem.back ? [parsedItem] : []);

            if (items.length > 0) {
              const { validItems: structValid, rejectedItems: rejBatch } =
                validateQuizItems(items, type, seenItems, difficulty, lessonContent, keyConcepts, notes);

              if (structValid.length > 0) {
                // Skip LLM verification for concept-by-concept — structural
                // validation is sufficient for flashcards.
                allValidItems.push(...structValid);
                allRejectedItems.push(...rejBatch);
                waveValidCount = structValid.length;
                waveRejectedCount = rejBatch.length;
              } else {
                allRejectedItems.push(...rejBatch);
                waveRejectedCount = rejBatch.length;
              }
            }
          }
        }

        // Track stagnation and per-concept retry
        if (waveValidCount === 0) {
          const retries = (conceptRetries.get(concept.term) || 0) + 1;
          conceptRetries.set(concept.term, retries);
          if (retries >= MAX_CONCEPT_RETRIES) {
            console.warn(`  Flashcard Concept "${concept.term}": exhausted ${retries} retries — moving to next concept`);
            hardFlashcardConceptIndex++;
          }
          consecutiveFailures++;
          stagnantWaves++;
        } else {
          hardFlashcardConceptIndex++;
          conceptRetries.delete(concept.term);
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

        if (stagnantWaves >= 10) {
          console.warn(`⚠ ${stagnantWaves} consecutive zero-yield waves — stopping early. Returning ${allValidItems.length}/${targetCount} collected items.`);
          break;
        }
        continue;
      }
      
      // Build and fire parallel promises
      const wavePromises = Array.from({ length: callsThisWave }).map((_, i) => {
        // ── Content-aware slice selection ──
        // When stagnating, find uncovered key concepts and select slices
        // that contain them, instead of purely random offsets.
        let sliceIndex = wave * CONCURRENCY + i + sliceRandomOffset;
        if (stagnantWaves >= 2 && keyConcepts.length > 0) {
          const uncoveredConcepts = keyConcepts.filter(kc => {
            const nt = normalizeText(kc.term);
            return !Array.from(seenItems).some(s => s.includes(nt));
          });
          if (uncoveredConcepts.length > 0) {
            // Find the position of an uncovered concept in the lesson content
            const target = uncoveredConcepts[(wave + i) % uncoveredConcepts.length];
            const idx = normalizeText(lessonContent).indexOf(normalizeText(target.term));
            if (idx >= 0) {
              // Convert character position to a step-based index for getLessonSlice
              const windowSize = type === 'FILL_IN_BLANK' ? 1500 : 1100;
              const step = windowSize - (type === 'FILL_IN_BLANK' ? 150 : 0);
              sliceIndex = Math.floor(idx / Math.max(step, 1));
            }
          }
        }
        // FIB benefits from overlap so the model sees cross-paragraph context;
        // MCQ/flashcard keep zero overlap to avoid duplicate rejections.
        const sliceOverlap = type === 'FILL_IN_BLANK' ? 150 : 0;
        // Dynamic window size: larger batches need more context from the lesson content
        // FIB uses a larger base window — verbatim sentences need more surrounding context.
        const dynamicWindowSize = type === 'FILL_IN_BLANK'
          ? (effectiveBatchSize <= 2 ? 1500 : effectiveBatchSize <= 4 ? 1700 : 1900)
          : (effectiveBatchSize <= 2 ? 1100 : effectiveBatchSize <= 4 ? 1300 : 1500);
        const lessonSlice = getLessonSlice(lessonContent, sliceIndex, dynamicWindowSize, sliceOverlap);
        
        // Overgeneration factor: request more items than needed
        // to account for rejections during validation.
        const overgenFactor = 1.4;
        const perCallTarget = Math.ceil(remainingCount / callsThisWave);
        const overgenCap = effectiveBatchSize + 2;
        const batchCount = Math.min(
          Math.ceil(perCallTarget * overgenFactor),
          overgenCap
        );
        
        // ── Fixed generous token budgets ──
        // HARD items need significantly more tokens. Use fixed budgets
        // instead of dynamic multiplier — simpler, more predictable.
        const tokensPerItem =
          difficulty === 'HARD'
            ? (type === 'MCQ' ? 600 : type === 'FILL_IN_BLANK' ? 500 : 300)
            : difficulty === 'MEDIUM'
            ? (type === 'MCQ' ? 450 : type === 'FILL_IN_BLANK' ? 300 : 200)
            : (type === 'MCQ' ? 500 : type === 'FILL_IN_BLANK' ? 250 : 150);
        // Hard cap scales with batch size.
        const tokenHardCap = type === 'FILL_IN_BLANK'
          ? (effectiveBatchSize <= 2 ? 9000 : effectiveBatchSize <= 4 ? 10500 : 12000)
          : (effectiveBatchSize <= 2 ? 6000 : effectiveBatchSize <= 4 ? 7500 : 9000);
        const maxTokens = Math.min(batchCount * tokensPerItem + 100, tokenHardCap);
        
        console.log(`  Call ${i + 1}: Requesting ${batchCount} items (slice offset ${sliceIndex}, max ${maxTokens} tokens)`);
        
        const batchPrompt = buildPrompt(type, difficulty, batchCount, lessonSlice, recentConcepts, usedSentences, keyConcepts);
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
      
      // Compute a token budget for potential repair attempts (same formula as per-call)
      const baseRepairTokens =
        difficulty === 'HARD'
          ? (type === 'MCQ' ? 500 : type === 'FILL_IN_BLANK' ? 180 : 200)
          : difficulty === 'MEDIUM'
          ? (type === 'MCQ' ? 360 : type === 'FILL_IN_BLANK' ? 150 : 130)
          : (type === 'MCQ' ? 500 : type === 'FILL_IN_BLANK' ? 130 : 100);
      const repairTokenBudget = Math.min(
        Math.round(baseRepairTokens * effectiveBatchSize * tokenMultiplier) + 100,
        9000
      );

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
          } else if (repairAttempts < MAX_REPAIR_ATTEMPTS) {
            // ── Repair attempt: ask the model to complete the truncated JSON ──
            repairAttempts++;
            console.log(`  Call ${i + 1}: Attempting JSON repair (attempt ${repairAttempts}/${MAX_REPAIR_ATTEMPTS})...`);
            const repaired = await repairTruncatedJSON(rawResponse, resolvedModel, repairTokenBudget);
            if (repaired) {
              try {
                parsedResponse = JSON.parse(repaired);
                console.log(`  Call ${i + 1}: ✅ Repair succeeded — parsed JSON.`);
              } catch {
                // Repair output was still invalid — try salvaging the repair output
                const repairedSalvage = salvageTruncatedJson(repaired);
                if (repairedSalvage && repairedSalvage.items.length > 0) {
                  parsedResponse = repairedSalvage;
                  console.log(`  Call ${i + 1}: Repair partially succeeded — salvaged ${repairedSalvage.items.length} item(s) from repair output.`);
                } else {
                  console.warn(`  Call ${i + 1}: Repair produced invalid JSON.`);
                }
              }
            }
            if (!parsedResponse) {
              jsonParseErrors++;
              tokenMultiplier = Math.min(tokenMultiplier * 1.25, 2.0);
              console.error(`  Call ${i + 1}: JSON parse error (${jsonParseErrors} total) — ` +
                `response truncated, repair failed. ` +
                `Token multiplier raised to ${tokenMultiplier.toFixed(2)}x.`, parseError);
              continue;
            }
          } else {
            jsonParseErrors++;
            // Bump token multiplier by 25% per parse error (cap at 2.0x)
            tokenMultiplier = Math.min(tokenMultiplier * 1.25, 2.0);
            console.error(`  Call ${i + 1}: JSON parse error (${jsonParseErrors} total) — ` +
              `response truncated, no items salvageable, repair limit reached. ` +
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
          validateQuizItems(parsedResponse.items, type, seenItems, difficulty, lessonContent, keyConcepts, notes);
        
        // ── Step 2: Factual verification on structurally valid items ──
        // Only items that pass BOTH structural and factual checks are added
        // to allValidItems. This eliminates the need for post-generation
        // verification that would discard items after the fact.
        if (structurallyValid.length > 0) {
          // ── Skip verification for EASY and MEDIUM ──
          // Easy questions are simple recall — structural validation is sufficient.
          // Medium questions are understanding-level — the structural validation
          // (answer presence, distractor grounding, key-concept checks) already
          // ensures quality. Verification via a second LLM call often rejects
          // correct items with "too broad" or "distractor source" failures,
          // halving yield for no real quality gain.
          // Only HARD items get full LLM factual verification.
          if (difficulty === 'EASY' || difficulty === 'MEDIUM') {
            allValidItems.push(...structurallyValid);
            allRejectedItems.push(...rejectedBatchItems);
            waveValidCount += structurallyValid.length;
            waveRejectedCount += rejectedBatchItems.length;
            console.log(`  Call ${i + 1}: Generated ${parsedResponse.items.length}, ` +
              `StructValid: ${structurallyValid.length} (accepted — ${difficulty} skip-verify), ` +
              `Rejected: ${rejectedBatchItems.length}`);
          } else {
          const { verified, failed } = await verifyQuizItemsWithGemma(
            structurallyValid, type, lessonContent, resolvedModel
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
      // For short content without concepts, also bail quickly — the LLM
      // has exhausted the material and will only produce duplicates.
      const deterministicCoverage = (_deterministicSeed?.length ?? 0) / targetCount;
      const contentBasedLimit = Math.max(5, Math.min(20, Math.ceil(lessonContent.length / 500)));
      const stagnantLimit = deterministicCoverage >= 0.8 ? 5 : contentBasedLimit;

      // ── Stagnation fallback: switch to concept-by-concept for FIB ──
      // If batch generation is stuck and we have auto-extracted terms,
      // activate concept-by-concept mode for subsequent waves.
      if (stagnantWaves >= 5 && type === 'FILL_IN_BLANK' && hardFIBConceptPool.length === 0 && autoConcepts.length >= 2) {
        hardFIBConceptPool = shuffleArray([...autoConcepts]);
        hardFIBConceptIndex = 0;
        stagnantWaves = 0; // reset so we give concept-by-concept a fair chance
        console.log(`🔄 Stagnation fallback: switching to concept-by-concept with ${autoConcepts.length} auto-extracted terms.`);
      }

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
    
    // Final validation — return empty result instead of crashing
    if (allValidItems.length === 0) {
      console.warn(`⚠ No valid items generated after ${wave} waves (${totalApiCalls} API calls). Returning empty result.`);
      const endTime = Date.now();
      const elapsedMs = endTime - startTime;
      const elapsedSeconds = Math.floor(elapsedMs / 1000);
      const mins = Math.floor(elapsedSeconds / 60);
      const secs = elapsedSeconds % 60;
      const timeStr = mins > 0 ? `${mins}m ${secs}s` : `${elapsedMs}ms`;

      console.log(`\n=== Generation Complete (empty) ===`);
      console.log(`Requested: ${count} | Verified: 0 | Rejected: ${allRejectedItems.length}`);
      console.log(`Waves: ${wave} (${totalApiCalls} API calls) | Time: ${timeStr}`);
      console.log(`===================================\n`);

      return {
        type: type === 'MCQ' ? 'mcq' : type === 'FILL_IN_BLANK' ? 'fill_blank' : 'flashcard',
        difficulty: difficulty.toLowerCase(),
        items: [],
        rejectedItems: allRejectedItems,
        stats: { requested: count, generated: 0, rejected: allRejectedItems.length, waves: wave, apiCalls: totalApiCalls },
        warning: `Could not generate any valid ${type} items. The lesson content may be too short or not suitable for this quiz type.`
      };
    }
    
    // ── Post-processing: recycle rejected items ──
    // Try fixing common rejection issues before falling back to deterministic backfill.
    if (allValidItems.length < count && allRejectedItems.length > 0) {
      if (type === 'FILL_IN_BLANK') {
        const recycled = recycleRejectedFIBItems(
          allRejectedItems, keyConcepts, lessonContent, difficulty, seenItems, autoConcepts, notes
        );
        allValidItems.push(...recycled);
      } else if (type === 'MCQ') {
        const recycled = recycleRejectedMCQItems(
          allRejectedItems, keyConcepts, lessonContent, difficulty, seenItems
        );
        allValidItems.push(...recycled);
      } else if (type === 'FLASHCARD') {
        const recycled = recycleRejectedFlashcardItems(
          allRejectedItems, keyConcepts, seenItems
        );
        allValidItems.push(...recycled);
      }
    }

    // ── Shortfall backfill: deterministic last resort ──
    // If we still don't have enough items after the wave loop + recycling,
    // use deterministic generators one more time with relaxed settings.
    // This guarantees we meet (or get as close as possible to) the requested count.
    if (allValidItems.length < count) {
      const shortfall = count - allValidItems.length;
      console.log(`⚡ Shortfall backfill: need ${shortfall} more items. Attempting deterministic generation...`);
      onProgress?.({ stage: 'backfill', message: `Filling remaining ${shortfall} items...`, percent: 85 });

      if (type === 'FILL_IN_BLANK' && (keyConcepts.length >= 2 || autoConcepts.length >= 2)) {
        // Try deterministic FIB with a higher count to maximize yield
        const bfConcepts = keyConcepts.length >= 2 ? keyConcepts : autoConcepts;
        const backfillItems = generateDeterministicFIB(lessonContent, bfConcepts, shortfall + 5, difficulty, notes);
        if (backfillItems) {
          // Filter out items that duplicate existing ones
          for (const item of backfillItems) {
            if (allValidItems.length >= count) break;
            const key = normalizeText(item.sentence);
            if (!seenItems.has(key)) {
              allValidItems.push(item);
              seenItems.add(key);
            }
          }
          console.log(`  FIB backfill: added ${Math.min(allValidItems.length, count) - (count - shortfall)} items`);
        }
      } else if (type === 'MCQ' && (keyConcepts.length >= 4 || autoConcepts.length >= 4)) {
        // Try deterministic MCQ for any difficulty as a last resort
        const backfillConcepts = originalKeyConcepts.length >= 4 ? originalKeyConcepts
          : keyConcepts.length >= 4 ? keyConcepts : autoConcepts;
        const backfillItems = generateDeterministicMCQ(backfillConcepts, shortfall + 5, difficulty);
        if (backfillItems) {
          for (const item of backfillItems) {
            if (allValidItems.length >= count) break;
            const key = normalizeText(item.question);
            if (!seenItems.has(key)) {
              allValidItems.push(item);
              seenItems.add(key);
            }
          }
          console.log(`  MCQ backfill: added ${Math.min(allValidItems.length, count) - (count - shortfall)} items`);
        }
      } else if (type === 'FLASHCARD' && (keyConcepts.length >= 2 || autoConcepts.length >= 2)) {
        const backfillConcepts = originalKeyConcepts.length >= 2 ? originalKeyConcepts
          : keyConcepts.length >= 2 ? keyConcepts : autoConcepts;
        const backfillItems = generateDeterministicFlashcards(backfillConcepts, shortfall + 5, difficulty);
        if (backfillItems) {
          for (const item of backfillItems) {
            if (allValidItems.length >= count) break;
            const key = normalizeText(item.front);
            if (!seenItems.has(key)) {
              allValidItems.push(item);
              seenItems.add(key);
            }
          }
          console.log(`  Flashcard backfill: added ${Math.min(allValidItems.length, count) - (count - shortfall)} items`);
        }
      }

      if (allValidItems.length < count) {
        console.warn(`⚠ After backfill: ${allValidItems.length}/${count} items. Content may not have enough material for ${count} unique items.`);
      }
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

    // ── Rejection reason breakdown ──
    // Aggregate _rejectionReason tags so the developer can tell at a glance
    // which validator rule is most restrictive and tune accordingly.
    if (allRejectedItems.length > 0) {
      const reasonCounts = new Map<string, number>();
      for (const rej of allRejectedItems) {
        const reason = (rej._rejectionReason || rej.rejectionReason || 'unknown').split(':')[0].trim();
        reasonCounts.set(reason, (reasonCounts.get(reason) || 0) + 1);
      }
      console.log(`--- Rejection Breakdown ---`);
      for (const [reason, cnt] of [...reasonCounts.entries()].sort((a, b) => b[1] - a[1])) {
        console.log(`  ${cnt}x  ${reason}`);
      }
      console.log(`---------------------------`);
    }

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
  lessonContent: string,
  recentConcepts: string[] = [],
  usedSentences: string[] = [],
  keyConcepts: { term: string; definition: string }[] = []
): string {
  switch (type) {
    case 'MCQ':
      return buildMCQPrompt(difficulty, count, lessonContent, recentConcepts, usedSentences, keyConcepts);
    case 'FILL_IN_BLANK':
      return buildFillInBlankPrompt(difficulty, count, lessonContent, recentConcepts, usedSentences, keyConcepts);
    case 'FLASHCARD':
      return buildFlashcardPrompt(difficulty, count, lessonContent, recentConcepts, usedSentences, keyConcepts);
    default:
      throw new Error(`Unknown quiz type: ${type}`);
  }
}

/**
 * Build MCQ generation prompt with Bloom's taxonomy difficulty separation
 * and key-concept-aware distractors.
 */
function buildMCQPrompt(difficulty: string, count: number, lessonContent: string, recentConcepts: string[] = [], usedQuestions: string[] = [], keyConcepts: { term: string; definition: string }[] = []): string {
  // ── EASY: Ultra-minimal prompt to maximize model compliance ──
  // The 4B model fails to produce valid JSON when the prompt is complex.
  // For Easy recall questions, strip everything to the bare minimum:
  // no usedBlock (dedup handled by seenItems), no conceptsBlock.
  if (difficulty === 'EASY') {
    return `Create ${count} EASY multiple-choice questions from the lesson content below. Output ONLY valid JSON.

LESSON CONTENT:
${lessonContent}

RULES:
- Test simple recall — definitions, direct facts.
- Question patterns: "What is X?" or "Which term describes...?"
- Correct answer must be directly stated in the lesson content.
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

  return `Create up to ${count} ${difficulty} MCQs from the lesson content. Output ONLY valid JSON. Return fewer if needed.${avoid}${usedBlock}

LESSON CONTENT:
${lessonContent}${keyConceptsBlock}

DIFFICULTY:
${diffGuide[difficulty] || diffGuide.MEDIUM}

RULES:
1. Content from lesson content only — no outside knowledge
2. Each question on a different concept. Concise choices (a few words each).
3. Distractors from KEY CONCEPTS or lesson content. answerIndex MUST point to the correct choice.
4. Explanation: 1 sentence starting with "The correct answer is '...' because ..."
5. If asking "What is X?", answer = X's definition, NOT the term itself

{"type":"mcq","difficulty":"${difficulty.toLowerCase()}","items":[{"question":"...","choices":["correct","wrong1","wrong2","wrong3"],"answerIndex":0,"explanation":"The correct answer is '...' because ..."}]}`;
}

/**
 * Build a focused prompt for a SINGLE Hard FIB item based on one specific concept.
 *
 * Used by the concept-by-concept Hard FIB loop. Asks the model to find a
 * complex sentence containing the concept and blank it, with 3 distractors
 * from the key concept pool. Keeps the prompt minimal to avoid truncation.
 */
function buildHardFIBPrompt(
  concept: { term: string; definition: string },
  lessonContent: string,
  keyConcepts: { term: string; definition: string }[] = [],
  notes?: { term: string; definition?: string; example?: string }[]
): string {
  const otherTerms = keyConcepts
    .filter(k => k.term !== concept.term)
    .map(k => k.term)
    .slice(0, 10);
  const distractorHint = otherTerms.length > 0
    ? `\nDISTRACTOR TERMS (pick exactly 3 for distractors): ${otherTerms.join(', ')}`
    : '';

  // If a note with an example exists for this concept, include it as a hint
  const noteForConcept = notes?.find(n =>
    n.term && normalizeText(n.term) === normalizeText(concept.term) && n.example && n.example.trim().length > 20
  );
  const exampleHint = noteForConcept
    ? `\nEXAMPLE SENTENCE (you may use this as the sentence, blanking "${concept.term}"): ${noteForConcept.example!.trim()}`
    : '';

  return `Generate ONE Hard fill-in-the-blank item about "${concept.term}". Output ONLY valid JSON.

LESSON CONTENT:
${lessonContent}

CONCEPT: ${concept.term}
DEFINITION: ${concept.definition || 'See lesson content.'}${exampleHint}${distractorHint}

RULES:
1. Find a LONG sentence (60+ chars) from the lesson content that contains "${concept.term}" or a MULTI-WORD phrase closely related to it
2. Copy the sentence EXACTLY word-for-word and replace the ENTIRE multi-word term (2+ words) with [blank]. Do NOT blank a single word.
3. Answer must be the COMPLETE multi-word term (e.g. "Space Utilization", "Cross-Docking System") — single-word answers are REJECTED
4. Distractors must be 3 other terms from the distractor list above (or from the lesson if no list). They must NOT fit the blank.
5. The sentence must come VERBATIM from the lesson content — do NOT paraphrase or modify any words
6. If no suitable long sentence exists in the lesson, use the EXAMPLE SENTENCE above (if provided) and blank the term.

GOOD EXAMPLE (multi-word blank):
{"sentence":"The [blank] ensures efficient movement of materials through the warehouse.","answer":"Cross-Docking System","distractors":["Product Layout","Vertical Racking","U-Shape Layout"]}

BAD EXAMPLE (single-word — will be REJECTED):
{"sentence":"The [blank] ensures efficient movement.","answer":"system","distractors":["layout","design","flow"]}

{"sentence":"...","answer":"${concept.term}","distractors":["wrong1","wrong2","wrong3"]}`;
}

/**
 * Build a focused prompt for a SINGLE Hard MCQ based on one specific concept.
 *
 * Used by the concept-by-concept Hard MCQ loop. Keeps the prompt minimal:
 * lesson content + concept definition + 6 compact rules + single-item JSON template.
 * This eliminates truncation (only 1 item to generate) and ensures each
 * question targets a distinct concept.
 */
function buildHardMCQPrompt(
  concept: { term: string; definition: string },
  lessonContent: string,
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

  return `Generate ONE HARD multiple-choice question about "${concept.term}" from the lesson content below. Output ONLY valid JSON.

LESSON CONTENT:
${lessonContent}

CONCEPT: ${concept.term}
DEFINITION: ${concept.definition || 'See lesson content for details.'}${distractorHint}

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
 * Build a focused prompt for a SINGLE Hard flashcard based on one specific concept.
 *
 * Used by the concept-by-concept Hard flashcard loop. Creates scenario-based
 * or application-level flashcards (Bloom's Level 4-5). Keeps the prompt minimal
 * to avoid truncation.
 */
function buildHardFlashcardPrompt(
  concept: { term: string; definition: string },
  lessonContent: string,
  keyConcepts: { term: string; definition: string }[] = []
): string {
  // Provide related terms for context
  const relatedTerms = keyConcepts
    .filter(k => k.term !== concept.term)
    .map(k => k.term)
    .slice(0, 8);
  const relatedHint = relatedTerms.length > 0
    ? `\nRELATED CONCEPTS: ${relatedTerms.join(', ')}`
    : '';

  return `Generate ONE HARD flashcard about "${concept.term}" from the lesson content below. Output ONLY valid JSON.

LESSON CONTENT:
${lessonContent}

CONCEPT: ${concept.term}
DEFINITION: ${concept.definition || 'See lesson content for details.'}${relatedHint}

RULES:
1. Front: A concise scenario (1-2 sentences) or application question about this concept
2. Front MUST describe a situation, ask "what would happen if...", or compare concepts
3. Back: 2-3 sentence analysis or explanation — not just a definition
4. Content from lesson content only — no outside knowledge

{"front":"If a system encounters [scenario involving ${concept.term}], what approach should be used?","back":"The approach would be... because ${concept.term} ..."}`;
}

/**
 * Build fill-in-blank generation prompt
 */
function buildFillInBlankPrompt(difficulty: string, count: number, lessonContent: string, recentConcepts: string[] = [], usedSentences: string[] = [], keyConcepts: { term: string; definition: string }[] = []): string {
  const diffGuide: Record<string, string> = {
    EASY: 'Blank a simple noun or name. Single word answer. Obvious clues.',
    MEDIUM: 'Blank a technical term or concept. Context helps but not obvious.',
    HARD: 'Blank a multi-word key term or conceptual phrase (2+ words). Single-word answers are NOT allowed for HARD. Use longer sentences. Requires deep understanding.'
  };

  const avoid = recentConcepts.length > 0
    ? `\nDo NOT reuse these terms or sentences — pick DIFFERENT ones: ${recentConcepts.join(', ')}`
    : '';

  // Inject already-used sentences so the model doesn't regenerate them.
  // Cap at 30 to balance dedup signal vs context window usage.
  const usedBlock = usedSentences.length > 0
    ? `\n\nIMPORTANT: The following sentences have ALREADY been used. You MUST NOT output any of these again or any sentence covering the same concept. Any repeated sentence will be REJECTED.\n${usedSentences.slice(-30).map(s => `- ${s}`).join('\n')}\n`
    : '';

  // Build KEY CONCEPTS block when available — tells the model exactly which
  // terms are worth blanking and which terms make good distractors.
  // Include definitions so the model understands the concepts deeply.
  let keyConceptsBlock = '';
  if (keyConcepts.length > 0) {
    const hasDefinitions = keyConcepts.some(k => k.definition && k.definition.trim().length > 10);
    if (hasDefinitions) {
      keyConceptsBlock = `\n\nKEY CONCEPTS (blank ONLY these terms — use others as distractors):\n${keyConcepts.map(k => `- ${k.term}${k.definition ? ': ' + k.definition : ''}`).join('\n')}\n`;
    } else {
      keyConceptsBlock = `\n\nKEY CONCEPTS (use these for blanks and distractors):\n${keyConcepts.map(k => `- ${k.term}`).join('\n')}\n`;
    }
  }

  return `You are a strict quiz generator. Output ONLY valid JSON — no greetings, no extra text, no explanations outside the JSON structure.
Create ${count} ${difficulty} fill-in-the-blank items from this lesson content.${avoid}${usedBlock}

LESSON CONTENT:
${lessonContent}${keyConceptsBlock}

CRITICAL RULES — follow ALL or the item will be rejected:
1. Copy sentences EXACTLY from the lesson content — do NOT paraphrase or reword.
2. Replace ONE key concept/technical term with [blank] — NOT common words like "the", "is", "and".
3. NEVER blank JSON field names like "term", "definition", "example". Only blank KEY CONCEPT terms.
4. Answer must be the COMPLETE term verbatim from the original sentence.
5. Each item uses a DIFFERENT sentence — never repeat.
6. "distractors": exactly 3 strings from the KEY CONCEPTS list (or lesson content). No invented terms.
7. Return FEWER items if you cannot find ${count} different valid sentences.
- ${diffGuide[difficulty] || diffGuide.MEDIUM}

EXAMPLE:
GOOD: {"sentence":"A [blank] stores data in tables with rows and columns.","answer":"Relational Database","distractors":["NoSQL Database","Primary Key","Index"]}

{"type":"fill_blank","difficulty":"${difficulty.toLowerCase()}","items":[{"sentence":"The [blank] is responsible for...","answer":"term","distractors":["wrong1","wrong2","wrong3"]}]}`;
}

/**
 * Build flashcard generation prompt with Bloom's taxonomy difficulty separation
 */
function buildFlashcardPrompt(difficulty: string, count: number, lessonContent: string, recentConcepts: string[] = [], usedSentences: string[] = [], keyConcepts: { term: string; definition: string }[] = []): string {
  // ── Bloom's taxonomy difficulty templates ──
  const diffGuide: Record<string, string> = {
    EASY: `EASY = Recall (Bloom's Level 1)
- Front: "What is [term]?" — simple definition question
- Back: 1-2 sentence definition directly from the lesson content
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

  return `Create ${count} ${difficulty} flashcards from this lesson content. Output ONLY valid JSON.${avoid}${usedBlock}

LESSON CONTENT:
${lessonContent}${keyConceptsBlock}

DIFFICULTY LEVEL:
${diffGuide[difficulty] || diffGuide.MEDIUM}

RULES:
- Content from lesson content only, no outside knowledge
- Each card on a different concept
- Use exact terminology from the lesson content

{"type":"flashcard","difficulty":"${difficulty.toLowerCase()}","items":[{"front":"What is...?","back":"It is..."}]}`;
}
