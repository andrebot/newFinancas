import type { PasswordStrengthHint, PasswordStrengthLevel } from '@financas/i18n';
import type { FeedbackType, Score } from '@zxcvbn-ts/core';
import { passwordStrength, validation } from '../config/constants';

// PasswordStrengthUtility (FU2, EBD): the advisory strength meter on register,
// reset and change password. The 12-character minimum is the only hard rule
// (NFR-SEC-4, ValidationUtility); this never blocks a submit. The estimate is
// zxcvbn-ts's (common passwords, keyboard runs, dates, repeats, l33t, the
// user's own name — OQ-120). The library and its dictionaries (~1 MB) are
// loaded on demand, only on the screens that show the meter, and nothing
// outside this module sees them: callers get our own levels and hint codes,
// which the catalog's `passwordStrength` section translates.

/** The meter's reading (`too_short` is below the hard minimum); labelled by the catalog. */
export type StrengthLevel = PasswordStrengthLevel;

/** What to change to make the password stronger; phrased by the catalog. */
export type StrengthHint = PasswordStrengthHint;

/** How many of the meter's four bars are filled. */
export type StrengthSegments = 0 | 1 | 2 | 3 | 4;

/** One reading of the meter. */
export interface PasswordStrength {
  readonly level: StrengthLevel;
  readonly segments: StrengthSegments;
  /** Absent when the password is already strong. */
  readonly hint?: StrengthHint;
}

/** What the estimator library answers for one password. */
export interface StrengthCheck {
  readonly score: Score;
  readonly feedback: FeedbackType;
}

/** Runs the estimator library on a password and words that should score low. */
export type CheckPassword = (password: string, userInputs: string[]) => StrengthCheck;

/**
 * Rates a password.
 *
 * @param password - The typed password.
 * @param personalInputs - The user's own details (name, email), which make a weak password.
 * @returns The meter's reading.
 */
export type PasswordStrengthEstimator = (
  password: string,
  personalInputs?: readonly string[],
) => PasswordStrength;

// zxcvbn-ts warning keys (its translations are left out, so it answers in keys).
const HINT_BY_WARNING: Readonly<Record<string, StrengthHint>> = {
  userInputs: 'avoid_personal',
  topTen: 'avoid_common',
  topHundred: 'avoid_common',
  common: 'avoid_common',
  similarToCommon: 'avoid_common',
  pwned: 'avoid_common',
  straightRow: 'avoid_patterns',
  keyPattern: 'avoid_patterns',
  simpleRepeat: 'avoid_patterns',
  extendedRepeat: 'avoid_patterns',
  sequences: 'avoid_patterns',
  recentYears: 'avoid_dates',
  dates: 'avoid_dates',
  wordByItself: 'avoid_lone_words',
  namesByThemselves: 'avoid_lone_words',
  commonNames: 'avoid_lone_words',
};

// zxcvbn's score 0–4 on the four-bar meter: 0 and 1 are both "weak".
const LEVEL_BY_SCORE: Readonly<Record<Score, StrengthLevel>> = {
  0: 'weak', 1: 'weak', 2: 'fair', 3: 'good', 4: 'strong',
};

const SEGMENTS_BY_LEVEL: Readonly<Record<StrengthLevel, StrengthSegments>> = {
  too_short: 0, weak: 1, fair: 2, good: 3, strong: 4,
};

const TOO_SHORT: PasswordStrength = { level: 'too_short', segments: 0, hint: 'add_length' };

/**
 * Picks the hint for a password that isn't strong yet.
 *
 * @param feedback - The library's feedback.
 * @returns The hint for its warning, or `add_length` when it has none we know.
 */
const hintFor = (feedback: FeedbackType): StrengthHint => (
  HINT_BY_WARNING[feedback.warning ?? ''] ?? 'add_length'
);

/**
 * Turns the library's answer into the meter's reading.
 *
 * @param check - The library's score and feedback.
 * @returns Level and bars; a hint unless the password is strong.
 */
export const toPasswordStrength = (check: StrengthCheck): PasswordStrength => {
  const level = LEVEL_BY_SCORE[check.score];
  const reading = { level, segments: SEGMENTS_BY_LEVEL[level] };

  return level === 'strong' ? reading : { ...reading, hint: hintFor(check.feedback) };
};

/**
 * Expands one personal detail into the words a password may borrow from it.
 * An email gives its local part too, with and without separators
 * (`ana.silva@x.com` → `ana.silva`, `anasilva`); the library matches whole
 * words only, and lowercases them itself.
 *
 * @param input - A name or email address.
 * @returns The detail and, for an email, the words taken from it.
 */
export const personalWords = (input: string): string[] => {
  const at = input.indexOf('@');
  if (at < 0) return [input];

  const localPart = input.slice(0, at);

  return [input, localPart, localPart.replace(/[^\p{L}\p{N}]/gu, '')];
};

/**
 * Builds the estimator around a library check. Below the hard minimum the
 * reading is always `too_short`, without asking the library.
 *
 * @param check - Runs the library (injected, so the mapping is testable on its own).
 * @returns The estimator.
 */
export const createPasswordStrengthEstimator = (
  check: CheckPassword,
): PasswordStrengthEstimator => (password, personalInputs = []) => {
  if (password.length < validation.password.minLength) return TOO_SHORT;

  const userInputs = [...passwordStrength.appWords, ...personalInputs.flatMap(personalWords)];

  return toPasswordStrength(check(password, userInputs));
};

/**
 * Loads zxcvbn-ts with the common, English and pt-BR dictionaries (both
 * languages for every user: a password mixes them freely) and builds the
 * estimator. Call it when a password screen opens; the bundle splits here.
 *
 * @returns The ready estimator.
 */
export const loadPasswordStrengthEstimator = async (): Promise<PasswordStrengthEstimator> => {
  const [{ ZxcvbnFactory }, common, english, portuguese] = await Promise.all([
    import('@zxcvbn-ts/core'),
    import('@zxcvbn-ts/language-common'),
    import('@zxcvbn-ts/language-en'),
    import('@zxcvbn-ts/language-pt-br'),
  ]);
  const zxcvbn = new ZxcvbnFactory({
    dictionary: { ...common.dictionary, ...english.dictionary, ...portuguese.dictionary },
    graphs: common.adjacencyGraphs,
    useLevenshteinDistance: passwordStrength.useLevenshteinDistance,
  });

  return createPasswordStrengthEstimator(
    (password, userInputs) => zxcvbn.check(password, userInputs),
  );
};
