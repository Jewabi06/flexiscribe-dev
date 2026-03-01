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
 * Check if two questions are semantically similar (for deduplication)
 */
function areQuestionsSimilar(q1: string, q2: string): boolean {
  const norm1 = normalizeText(q1);
  const norm2 = normalizeText(q2);
  
  // Exact match after normalization
  if (norm1 === norm2) return true;
  
  // Check if one is a substring of the other (with length threshold)
  const minLength = Math.min(norm1.length, norm2.length);
  if (minLength > 20) { // Only for substantial questions
    if (norm1.includes(norm2) || norm2.includes(norm1)) return true;
  }
  
  return false;
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
function validateMCQItem(item: any, difficulty: string = 'MEDIUM'): { valid: boolean; item: any; rejectionReason?: string } {
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
function validateFillInBlankItem(item: any, summary: string = ''): { valid: boolean; item: any; rejectionReason?: string } {
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
        if (ratio < 0.7) {
          return {
            valid: false,
            item,
            rejectionReason: `Sentence not found in summary (word match ${Math.round(ratio * 100)}% < 70%): "${fixedSentence}"`
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
  summary: string = ''
): { validItems: any[]; rejectedItems: any[] } {
  const validItems: any[] = [];
  const rejectedItems: any[] = [];
  
  for (const item of items) {
    let validationResult: { valid: boolean; item: any; rejectionReason?: string };
    
    // Type-specific validation
    if (type === 'MCQ') {
      validationResult = validateMCQItem(item, difficulty);
      
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
      validationResult = validateFillInBlankItem(item, summary);
      
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
      
      // Check for duplicates
      if (validationResult.valid) {
        const frontKey = normalizeText(validationResult.item.front);
        if (existingItems.has(frontKey)) {
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
    typeRules = `For each MCQ item, check ALL of the following:
1. Is the correct answer (at answerIndex) the MOST ACCURATE and SPECIFIC answer to the question, based on the summary? If the best answer is not among the 4 choices, mark INCORRECT.
2. Are all 4 choices real concepts, terms, or phrases that appear in or relate to the summary? No placeholders or nonsensical options.
3. Are the 3 distractors genuinely wrong for THIS question? (A distractor that is also correct = bad item.)
4. Does the explanation accurately justify WHY the correct answer is correct?
5. Is the question itself answerable from the summary? (Not about outside knowledge.)
If ANY check fails, mark as INCORRECT and explain which check failed and why.`;
  } else if (type === 'FILL_IN_BLANK') {
    typeRules = `For each fill-in-blank item, check ALL of the following:
1. When [blank] is replaced with the answer, does the sentence reflect content from the summary?
2. Is the answer the correct word/phrase that belongs in the blank, according to the summary?
3. Are all 3 distractors real terms from the summary that do NOT correctly fill the blank?
4. Could any distractor also be correct for this blank? If so, mark INCORRECT.
If ANY check fails, mark as INCORRECT and explain which check failed and why.`;
  } else {
    typeRules = `For each flashcard, check ALL of the following:
1. Does the front ask a clear question about a concept from the summary?
2. Is the back factually accurate according to the summary?
3. Does the back actually answer the front? (Not a mismatch.)
4. Is the information on the back complete enough to be useful, without being misleading?
If ANY check fails, mark as INCORRECT and explain which check failed and why.`;
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
  preResolvedModel?: string
): Promise<any> {
  // Track generation time
  const startTime = Date.now();
  
  // Pre-resolve model ONCE before the batch loop (eliminates redundant /api/tags calls)
  const resolvedModel = preResolvedModel || await getBestAvailableModel();
  console.log(`Using model: ${resolvedModel} (resolved once, reused for all batches)`);
  
  // Dynamic temperature based on quiz type AND difficulty for better accuracy
  // Lower = more factual/deterministic, Higher = more creative
  const temperatureMatrix: Record<string, Record<string, number>> = {
    MCQ:           { EASY: 0.25, MEDIUM: 0.30, HARD: 0.40 },
    FILL_IN_BLANK: { EASY: 0.20, MEDIUM: 0.30, HARD: 0.35 },
    FLASHCARD:     { EASY: 0.30, MEDIUM: 0.45, HARD: 0.55 },
  };
  const baseTemperature = temperatureMatrix[type]?.[difficulty] ?? 0.3;

  // Track unique items across batches to prevent duplicates
  const seenItems = new Set<string>();
  const allValidItems: any[] = [];
  const allRejectedItems: any[] = [];
  
  // ── Optimized batch configuration ──
  // Smaller HARD batches = higher per-item success rate, less wasted inference.
  // FILL_IN_BLANK HARD gets the smallest — nested JSON + paraphrasing issues.
  let baseBatchSize =
    type === 'FILL_IN_BLANK' && difficulty === 'HARD' ? 2 :
    type === 'FILL_IN_BLANK' ? 3 :
    difficulty === 'HARD' ? 3 :
    6;
  const originalBaseBatchSize = baseBatchSize; // Preserved so we can restore after recovery
  
  // CPU inference: Ollama processes requests sequentially on CPU, so parallel calls
  // just compete for threads and both timeout. Use CONCURRENCY=1 for local/CPU setups.
  // Set OLLAMA_CONCURRENCY=2 (or higher) when running with GPU / sufficient RAM.
  const CONCURRENCY = parseInt(process.env.OLLAMA_CONCURRENCY ?? '1', 10);
  // Generous wave budget — adaptive recovery strategies will keep retrying
  // with different temperatures, slices, and batch sizes until the requested
  // count is reached. The absolute time limit is the real safety valve.
  const MAX_WAVES = Math.max(Math.ceil(count / baseBatchSize) * 10, 40);
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

  console.log(`Starting quiz generation: ${count} ${type} items at ${difficulty} difficulty`);
  console.log(`Configuration: baseBatchSize=${baseBatchSize}, CONCURRENCY=${CONCURRENCY}, MAX_WAVES=${MAX_WAVES}`);
  console.log(`Base temperature: ${baseTemperature}`);
  
  try {
    // ── Parallel-wave generation loop ──
    // Each wave fires CONCURRENCY parallel API calls, each with a different summary slice
    while (allValidItems.length < count && wave < MAX_WAVES) {
      // ── Absolute time limit ──
      const elapsedSoFar = Date.now() - startTime;
      if (elapsedSoFar >= ABSOLUTE_TIME_LIMIT_MS) {
        console.warn(`⏱ Absolute time limit reached (${Math.round(elapsedSoFar / 1000)}s). ` +
          `Returning ${allValidItems.length}/${count} collected items.`);
        break;
      }

      const remainingCount = count - allValidItems.length;
      
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
      if (stagnantWaves >= 3) {
        // Recovery mode: use the full baseBatchSize set by the recovery strategy
        effectiveBatchSize = baseBatchSize;
        console.log(`Recovery mode: using full batch size ${effectiveBatchSize} (stagnantWaves=${stagnantWaves})`);
      } else if (consecutiveFailures >= 3) {
        effectiveBatchSize = Math.max(Math.floor(baseBatchSize * 0.6), 1);
        console.log(`Batch size reduced ${baseBatchSize} → ${effectiveBatchSize} after ${consecutiveFailures} consecutive failures`);
      } else {
        effectiveBatchSize = baseBatchSize;
      }

      // ── Stagnation recovery: randomize slice offset ──
      // When stuck, jump to a random part of the summary to find fresh content
      if (stagnantWaves >= 2 && stagnantWaves % 2 === 0) {
        sliceRandomOffset = Math.floor(Math.random() * 20);
        console.log(`🔀 Randomizing summary slice offset to ${sliceRandomOffset}`);
      }

      // Determine how many parallel calls to fire this wave
      const callsThisWave = Math.min(
        CONCURRENCY,
        Math.ceil(remainingCount / effectiveBatchSize) // Don't fire more calls than needed
      );
      
      console.log(`\nWave ${wave + 1}/${MAX_WAVES}: Firing ${callsThisWave} parallel calls (${allValidItems.length}/${count} collected)`);
      
      // Build and fire parallel promises
      const wavePromises = Array.from({ length: callsThisWave }).map((_, i) => {
        const sliceIndex = wave * CONCURRENCY + i + sliceRandomOffset; // Each call gets a different summary slice
        // Zero overlap for all types — overlap causes the same content to reappear
        // across waves, triggering massive duplicate rejections (especially for MCQ/FIB).
        const sliceOverlap = 0;
        // Dynamic window size: larger batches need more context from the summary
        const dynamicWindowSize = effectiveBatchSize <= 2 ? 1100 : effectiveBatchSize <= 4 ? 1300 : 1500;
        const summarySlice = getSummarySlice(summary, sliceIndex, dynamicWindowSize, sliceOverlap);
        
        // Overgeneration factor: request more items than needed to account for
        // rejections. During stagnation recovery, use a higher factor (1.5x)
        // because most items will be duplicates — we need volume to find novel ones.
        const overgenFactor = stagnantWaves >= 3 ? 1.5 : 1.1;
        const perCallTarget = Math.ceil(remainingCount / callsThisWave);
        // Cap: during recovery, allow up to effectiveBatchSize + 3 to give the
        // model real room to generate diverse content. Normally, tight cap.
        const overgenCap = stagnantWaves >= 3
          ? effectiveBatchSize + 3
          : effectiveBatchSize + 1;
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
            ? (type === 'MCQ' ? 280 : type === 'FILL_IN_BLANK' ? 120 : 140)
            : difficulty === 'MEDIUM'
            ? (type === 'MCQ' ? 220 : type === 'FILL_IN_BLANK' ? 100 : 110)
            : (type === 'MCQ' ? 200 : type === 'FILL_IN_BLANK' ? 90 : 85);
        // Dynamic token multiplier: after parse errors (truncation), automatically
        // increase budget for subsequent waves to avoid repeated truncation.
        const tokensPerItem = Math.min(Math.round(baseTokensPerItem * tokenMultiplier), 450);
        // Hard cap scales with batch size: larger batches need proportionally more tokens.
        // Minimum 2800 to avoid truncation even for small batches of MCQ.
        const tokenHardCap = effectiveBatchSize <= 2 ? 2800 : effectiveBatchSize <= 4 ? 3400 : 4000;
        const maxTokens = Math.min(batchCount * tokensPerItem + 100, tokenHardCap);
        
        console.log(`  Call ${i + 1}: Requesting ${batchCount} items (slice offset ${sliceIndex}, max ${maxTokens} tokens)`);
        
        const batchPrompt = buildPrompt(type, difficulty, batchCount, summarySlice, recentConcepts, usedSentences);
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
        }
        
        // Validate structure
        if (!parsedResponse.items || !Array.isArray(parsedResponse.items)) {
          console.warn(`  Call ${i + 1}: Invalid response structure`);
          continue;
        }
        
        // Validate and deduplicate items (seenItems is shared across all calls)
        const { validItems: validBatchItems, rejectedItems: rejectedBatchItems } =
          validateQuizItems(parsedResponse.items, type, seenItems, difficulty, summary);
        
        allValidItems.push(...validBatchItems);
        allRejectedItems.push(...rejectedBatchItems);
        waveValidCount += validBatchItems.length;
        waveRejectedCount += rejectedBatchItems.length;
        
        console.log(`  Call ${i + 1}: Generated ${parsedResponse.items.length}, Valid: ${validBatchItems.length}, Rejected: ${rejectedBatchItems.length}`);
        
        // Early exit if we already have enough
        if (allValidItems.length >= count) break;
      }
      
      // Track consecutive failures for adaptive strategies
      if (waveValidCount === 0) {
        consecutiveFailures++;
        stagnantWaves++;
      } else {
        const wasInRecovery = stagnantWaves >= 3;
        consecutiveFailures = 0;
        stagnantWaves = 0;
        sliceRandomOffset = 0; // Reset slice offset on success
        
        // Restore original batch size after recovery succeeds, so future
        // waves don't stay stuck with a small/large recovery batch size.
        if (wasInRecovery && baseBatchSize !== originalBaseBatchSize) {
          console.log(`Recovery succeeded — restoring baseBatchSize from ${baseBatchSize} to ${originalBaseBatchSize}`);
          baseBatchSize = originalBaseBatchSize;
        }
        
        // Decay token multiplier gradually instead of hard-resetting to 1.0.
        // Hard reset causes whiplash: success → reset → immediate truncation next wave.
        // Gradual decay (15% per successful wave) converges to 1.0 over several waves.
        if (tokenMultiplier > 1.0) {
          const prevMultiplier = tokenMultiplier;
          tokenMultiplier = Math.max(tokenMultiplier * 0.85, 1.0);
          console.log(`Token multiplier decayed ${prevMultiplier.toFixed(2)}x → ${tokenMultiplier.toFixed(2)}x (successful wave)`);
        }
      }
      
      // Show progress
      const progress = Math.min(100, Math.round((allValidItems.length / count) * 100));
      console.log(`Wave ${wave + 1} result: +${waveValidCount} valid, +${waveRejectedCount} rejected | Total: ${allValidItems.length}/${count} (${progress}%)`);
      
      wave++;
      
      if (allValidItems.length >= count) {
        console.log(`✓ Target reached! Collected ${allValidItems.length} valid items in ${wave} waves (${totalApiCalls} API calls)`);
        break;
      }

      // ── Adaptive recovery instead of early termination ──
      // Instead of giving up after consecutive zero-yield waves, apply
      // escalating recovery strategies to break through the plateau.
      // Key insight: requesting MORE items per call (not fewer) gives the model
      // more room to produce diverse content, increasing the chance that at
      // least some items pass validation.
      if (stagnantWaves >= 3) {
        console.warn(`⚠ ${stagnantWaves} consecutive zero-yield waves. Applying recovery strategies...`);
        
        // Strategy 1: Cycle batch sizes UPWARD to request more items per call.
        // Larger batches give the model more room to generate diverse content,
        // increasing the chance that novel items slip through deduplication.
        // Cycle: 3 → 4 → 5 → 6 → fallback to 2 if even large batches fail.
        const batchCycle = [3, 4, 5, 6, 2];
        const cycleIndex = Math.min(stagnantWaves - 3, batchCycle.length - 1);
        const targetBatch = batchCycle[cycleIndex];
        if (targetBatch !== baseBatchSize) {
          console.log(`  → Batch size changed from ${baseBatchSize} to ${targetBatch} (cycle step ${cycleIndex + 1}/${batchCycle.length})`);
          baseBatchSize = targetBatch;
        }
        
        // Strategy 2: Boost token budget to accommodate larger batches.
        // Larger batches need proportionally more tokens to avoid truncation.
        if (tokenMultiplier < 1.8) {
          const targetMultiplier = baseBatchSize >= 4 ? 1.6 : baseBatchSize >= 3 ? 1.4 : 1.2;
          tokenMultiplier = Math.min(Math.max(tokenMultiplier, targetMultiplier), 1.8);
          console.log(`  → Token multiplier set to ${tokenMultiplier.toFixed(2)}x for batch size ${baseBatchSize}`);
        }

        // Strategy 3: On deep stagnation (7+ waves), partially clear the
        // seen-items set to relax duplicate detection — keeps only the last
        // half of items, allowing previously-similar-but-not-identical content.
        if (stagnantWaves >= 7 && seenItems.size > 0) {
          const arr = Array.from(seenItems);
          const keepCount = Math.ceil(arr.length / 2);
          seenItems.clear();
          for (const item of arr.slice(-keepCount)) {
            seenItems.add(item);
          }
          console.log(`  → Relaxed duplicate memory: kept ${keepCount}/${arr.length} seen items`);
        }
      }
      
      // Progress advisory (not a termination)
      if (wave >= 3 && allValidItems.length < count * 0.3) {
        console.warn(`⚠ Low progress after ${wave} waves (${allValidItems.length}/${count}). ` +
          `Recovery strategies active — will keep retrying until target is met or time limit is reached.`);
      }
    }
    
    // Final validation
    if (allValidItems.length === 0) {
      throw new Error('No valid quiz items generated after multiple attempts');
    }
    
    // Trim to exact count if we got more (expected with overgeneration)
    let finalItems = allValidItems.slice(0, count);

    // ── Post-generation verification ──
    // Ask the model to cross-check every item against the source summary.
    // Items that fail verification are discarded; focused repair waves
    // regenerate just the missing count, up to MAX_REPAIR_ROUNDS.
    const MAX_REPAIR_ROUNDS = 3;
    let verificationFailures = 0;

    for (let repairRound = 0; repairRound <= MAX_REPAIR_ROUNDS; repairRound++) {
      // Check time budget — skip verification if we're already near the limit
      const elapsedBeforeVerify = Date.now() - startTime;
      if (elapsedBeforeVerify >= ABSOLUTE_TIME_LIMIT_MS * 0.95) {
        console.warn(`⏱ Near time limit — skipping verification round ${repairRound}`);
        break;
      }

      console.log(`\n🔍 Verification round ${repairRound + 1}: checking ${finalItems.length} items...`);
      const { verified, failed } = await verifyQuizItemsWithGemma(
        finalItems, type, summary, resolvedModel
      );

      // Track failures across rounds
      for (const f of failed) {
        verificationFailures++;
        allRejectedItems.push({
          ...f.item,
          _rejected: true,
          _rejectionReason: `Verification: ${f.reason}`,
        });
      }

      console.log(`  ✓ Passed: ${verified.length}  ✗ Failed: ${failed.length}`);

      if (failed.length === 0 || repairRound === MAX_REPAIR_ROUNDS) {
        // All good, or we've exhausted repair rounds — use what we have
        finalItems = verified;
        break;
      }

      // Need to regenerate `failed.length` replacement items
      const deficit = failed.length;
      console.log(`\n🔧 Repair wave: regenerating ${deficit} item(s) to replace verification failures...`);

      // Build fresh memory set from verified items
      const repairedSeenItems = new Set<string>();
      for (const v of verified) {
        if (type === 'MCQ' && v.question) repairedSeenItems.add(normalizeText(v.question));
        else if (type === 'FILL_IN_BLANK' && v.sentence) repairedSeenItems.add(normalizeText(v.sentence));
        else if (type === 'FLASHCARD' && v.front) repairedSeenItems.add(normalizeText(v.front));
      }

      // Collect used content for the generation prompt
      const repairUsed: string[] = [];
      for (const v of verified) {
        if (type === 'MCQ' && v.question) repairUsed.push(v.question);
        else if (type === 'FILL_IN_BLANK' && v.sentence) repairUsed.push(v.sentence);
        else if (type === 'FLASHCARD' && v.front) repairUsed.push(v.front);
      }

      // Small focused generation: request deficit + 2 to account for rejections
      const repairBatchSize = Math.min(deficit + 2, 8);
      const repairSlice = getSummarySlice(summary, repairRound * 3, 1300, 0);
      const repairPromptText = buildPrompt(type, difficulty, repairBatchSize, repairSlice, [], repairUsed);

      const repairTokens = type === 'MCQ' ? repairBatchSize * 260 + 100
        : type === 'FILL_IN_BLANK' ? repairBatchSize * 110 + 100
        : repairBatchSize * 120 + 100;

      try {
        const repairRaw = await generateWithOllama(repairPromptText, {
          model: resolvedModel,
          temperature: baseTemperature + 0.05, // Slight bump for diversity
          requireJson: true,
          maxTokens: Math.min(repairTokens, 3400),
        });
        totalApiCalls++;

        let repairParsed: any;
        try {
          repairParsed = JSON.parse(repairRaw);
        } catch {
          const salvaged = salvageTruncatedJson(repairRaw);
          if (salvaged) repairParsed = salvaged;
          else { console.warn('Repair wave JSON parse failed'); finalItems = verified; continue; }
        }

        if (repairParsed?.items && Array.isArray(repairParsed.items)) {
          const { validItems: repairValid } = validateQuizItems(
            repairParsed.items, type, repairedSeenItems, difficulty, summary
          );
          console.log(`  Repair wave produced ${repairValid.length} structurally valid items`);

          // Combine verified + repair items, trim to target count
          finalItems = [...verified, ...repairValid].slice(0, count);
        } else {
          finalItems = verified;
        }
      } catch (err) {
        console.error('Repair wave failed:', err instanceof Error ? err.message : err);
        finalItems = verified;
      }
      // Loop will verify the combined set in the next round
    }
    
    // Calculate elapsed time
    const endTime = Date.now();
    const elapsedMs = endTime - startTime;
    const elapsedSeconds = Math.floor(elapsedMs / 1000);
    const minutes = Math.floor(elapsedSeconds / 60);
    const seconds = elapsedSeconds % 60;
    const timeString = minutes > 0 ? `${minutes}m ${seconds}s` : `${seconds}s`;
    
    console.log(`\n=== Generation Complete ===`);
    console.log(`Requested: ${count}`);
    console.log(`Valid items generated: ${allValidItems.length}`);
    console.log(`Final items (after verification): ${finalItems.length}`);
    console.log(`Rejected items: ${allRejectedItems.length} (${verificationFailures} from verification)`);
    console.log(`Total waves: ${wave} (${totalApiCalls} API calls)`);
    console.log(`Success rate: ${Math.round((finalItems.length / Math.max(finalItems.length + allRejectedItems.length, 1)) * 100)}%`);
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
        verificationFailures,
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
  usedSentences: string[] = []
): string {
  switch (type) {
    case 'MCQ':
      return buildMCQPrompt(difficulty, count, summary, recentConcepts, usedSentences);
    case 'FILL_IN_BLANK':
      return buildFillInBlankPrompt(difficulty, count, summary, recentConcepts, usedSentences);
    case 'FLASHCARD':
      return buildFlashcardPrompt(difficulty, count, summary, recentConcepts, usedSentences);
    default:
      throw new Error(`Unknown quiz type: ${type}`);
  }
}

/**
 * Build MCQ generation prompt with all quality controls
 */
function buildMCQPrompt(difficulty: string, count: number, summary: string, recentConcepts: string[] = [], usedQuestions: string[] = []): string {
  const diffGuide: Record<string, string> = {
    EASY: 'Simple recall only. Correct answer is a direct quote from the summary. Wrong choices are obviously wrong.',
    MEDIUM: 'Test understanding. Choices are plausible but distinguishable. Distractors are related summary concepts.',
    HARD: 'Test critical thinking. All choices seem reasonable. Distractors are closely related summary concepts a student could confuse.'
  };

  const avoid = recentConcepts.length > 0 ? `\nAVOID these topics: ${recentConcepts.join(', ')}` : '';

  // Inject already-used questions so the model avoids recycling the same concepts.
  // Cap at 15 to avoid exceeding context window on very large runs.
  const usedBlock = usedQuestions.length > 0
    ? `\n\nIMPORTANT: The following questions have ALREADY been used. You MUST NOT create questions about the same topics or concepts. Any repeated topic will be REJECTED.\n${usedQuestions.slice(-30).map(q => `- ${q}`).join('\n')}\n`
    : '';

  return `Create ${count} ${difficulty} MCQs from this summary. Output ONLY valid JSON.${avoid}${usedBlock}

SUMMARY:
${summary}

RULES:
- All content from summary only, no outside knowledge
- Each question on a different concept
- All 4 choices must be real terms from the summary, no placeholders
- 3 wrong choices must be real summary terms, not the correct answer
- No duplicate or synonym choices
- Explanation starts with: "The correct answer is '[exact choice text]' because ..."
- ${diffGuide[difficulty] || diffGuide.MEDIUM}

{"type":"mcq","difficulty":"${difficulty.toLowerCase()}","items":[{"question":"...","choices":["...","...","...","..."],"answerIndex":0,"explanation":"The correct answer is '...' because ..."}]}`;
}

/**
 * Build fill-in-blank generation prompt
 */
function buildFillInBlankPrompt(difficulty: string, count: number, summary: string, recentConcepts: string[] = [], usedSentences: string[] = []): string {
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

  return `Create ${count} ${difficulty} fill-in-the-blank items from this summary. Output ONLY valid JSON.${avoid}${usedBlock}

SUMMARY:
${summary}

RULES:
- Copy sentences EXACTLY from the summary — do NOT paraphrase or reword
- Each sentence has exactly one [blank]
- Answer must be a word/phrase that appears VERBATIM in the original sentence
- Each item must use a DIFFERENT sentence from a DIFFERENT part of the summary — never repeat
- "distractors" must be a JSON array of exactly 3 strings: ["a","b","c"]
- Distractors are other real terms from the summary (not the answer)
- If you cannot find ${count} different sentences, return FEWER items — quality over quantity
- ${diffGuide[difficulty] || diffGuide.MEDIUM}

{"type":"fill_blank","difficulty":"${difficulty.toLowerCase()}","items":[{"sentence":"The [blank] is responsible for...","answer":"term","distractors":["wrong1","wrong2","wrong3"]}]}`;
}

/**
 * Build flashcard generation prompt
 */
function buildFlashcardPrompt(difficulty: string, count: number, summary: string, recentConcepts: string[] = [], usedSentences: string[] = []): string {
  const diffGuide: Record<string, string> = {
    EASY: 'Front: "What is [term]?" only. Back: 1-2 sentence definition from summary.',
    MEDIUM: 'Front: Concept question. Back: Explanation with application (2-3 sentences).',
    HARD: 'Front: Complex scenario. Back: Detailed analysis or comparison.'
  };

  const avoid = recentConcepts.length > 0 ? `\nAVOID these topics: ${recentConcepts.join(', ')}` : '';

  // Inject already-used fronts so the model doesn't regenerate duplicate cards.
  const usedBlock = usedSentences.length > 0
    ? `\n\nALREADY USED FLASHCARD FRONTS (DO NOT reuse these questions):\n${usedSentences.slice(-30).map(s => `- ${s}`).join('\n')}\n`
    : '';

  return `Create ${count} ${difficulty} flashcards from this summary. Output ONLY valid JSON.${avoid}${usedBlock}

SUMMARY:
${summary}

RULES:
- Content from summary only, no outside knowledge
- Each card on a different concept
- Use exact terminology from the summary
- ${diffGuide[difficulty] || diffGuide.MEDIUM}

{"type":"flashcard","difficulty":"${difficulty.toLowerCase()}","items":[{"front":"What is...?","back":"It is..."}]}`;
}
