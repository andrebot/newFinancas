import {
  beforeAll, describe, expect, it,
} from 'vitest';
import {
  createPasswordStrengthEstimator,
  loadPasswordStrengthEstimator,
  personalWords,
  toPasswordStrength,
  type CheckPassword,
  type PasswordStrengthEstimator,
} from '../../../src/utilities/passwordStrength';

describe('toPasswordStrength', () => {
  it.each([
    [0, 'weak', 1],
    [1, 'weak', 1],
    [2, 'fair', 2],
    [3, 'good', 3],
  ] as const)('reads score %d as %s with %d bars and a hint', (score, level, segments) => {
    expect(toPasswordStrength({ score, feedback: { warning: null, suggestions: [] } }))
      .toEqual({ level, segments, hint: 'add_length' });
  });

  it('reads score 4 as strong, all bars, no hint', () => {
    expect(toPasswordStrength({ score: 4, feedback: { warning: 'common', suggestions: [] } }))
      .toEqual({ level: 'strong', segments: 4 });
  });

  it.each([
    ['userInputs', 'avoid_personal'],
    ['topTen', 'avoid_common'],
    ['topHundred', 'avoid_common'],
    ['common', 'avoid_common'],
    ['similarToCommon', 'avoid_common'],
    ['pwned', 'avoid_common'],
    ['straightRow', 'avoid_patterns'],
    ['keyPattern', 'avoid_patterns'],
    ['simpleRepeat', 'avoid_patterns'],
    ['extendedRepeat', 'avoid_patterns'],
    ['sequences', 'avoid_patterns'],
    ['recentYears', 'avoid_dates'],
    ['dates', 'avoid_dates'],
    ['wordByItself', 'avoid_lone_words'],
    ['namesByThemselves', 'avoid_lone_words'],
    ['commonNames', 'avoid_lone_words'],
    ['somethingNew', 'add_length'],
  ])('maps the warning %s to the hint %s', (warning, hint) => {
    expect(toPasswordStrength({ score: 1, feedback: { warning, suggestions: [] } }).hint)
      .toBe(hint);
  });
});

describe('personalWords', () => {
  it('keeps a name as it is', () => {
    expect(personalWords('Ana Silva')).toEqual(['Ana Silva']);
  });

  it('adds an email\'s local part, with and without separators', () => {
    expect(personalWords('ana.silva-2@example.com'))
      .toEqual(['ana.silva-2@example.com', 'ana.silva-2', 'anasilva2']);
  });

  it('keeps accented letters', () => {
    expect(personalWords('joão.gonçalves@example.com')[2]).toBe('joãogonçalves');
  });
});

describe('createPasswordStrengthEstimator', () => {
  /**
   * A library check that records its calls and always answers "good".
   *
   * @returns The check and the calls it received.
   */
  const recordingCheck = () => {
    const calls: [string, string[]][] = [];
    const check: CheckPassword = (password, userInputs) => {
      calls.push([password, userInputs]);
      return { score: 3, feedback: { warning: null, suggestions: [] } };
    };
    return { check, calls };
  };

  it('reads under 12 characters as too short without asking the library', () => {
    const { check, calls } = recordingCheck();

    expect(createPasswordStrengthEstimator(check)('a'.repeat(11)))
      .toEqual({ level: 'too_short', segments: 0, hint: 'add_length' });
    expect(calls).toEqual([]);
  });

  it('asks the library from 12 characters, with the app words and the personal inputs', () => {
    const { check, calls } = recordingCheck();

    expect(createPasswordStrengthEstimator(check)('a'.repeat(12), ['Ana', 'ana@example.com']))
      .toEqual({ level: 'good', segments: 3, hint: 'add_length' });
    expect(calls).toEqual([[
      'a'.repeat(12),
      [
        'financas', 'finanças', 'finance', 'household', 'casa',
        'Ana', 'ana@example.com', 'ana', 'ana',
      ],
    ]]);
  });

  it('defaults to no personal inputs', () => {
    const { check, calls } = recordingCheck();

    createPasswordStrengthEstimator(check)('a'.repeat(12));

    expect(calls[0]?.[1]).toEqual(['financas', 'finanças', 'finance', 'household', 'casa']);
  });
});

describe('loadPasswordStrengthEstimator (the real zxcvbn-ts)', () => {
  let estimate: PasswordStrengthEstimator;

  beforeAll(async () => {
    estimate = await loadPasswordStrengthEstimator();
  });

  it('reads a short password as too short', () => {
    expect(estimate('short').level).toBe('too_short');
  });

  it('flags a very common password', () => {
    expect(estimate('password1234')).toMatchObject({ level: 'weak', hint: 'avoid_common' });
  });

  it('flags a sequence', () => {
    expect(estimate('abcdefghijkl')).toMatchObject({ level: 'weak', hint: 'avoid_patterns' });
  });

  it('flags a date', () => {
    expect(estimate('15/03/1990abc')).toMatchObject({ hint: 'avoid_dates' });
  });

  it('flags the app\'s own name', () => {
    expect(estimate('financas2026!')).toMatchObject({ hint: 'avoid_personal' });
  });

  it('flags a password built from the user\'s email', () => {
    expect(estimate('anasilva1990', ['ana.silva@example.com']))
      .toMatchObject({ hint: 'avoid_personal' });
  });

  it('knows Portuguese words', () => {
    expect(estimate('cachorroquente').level).toBe('weak');
  });

  it('reads a long, unpredictable passphrase as strong', () => {
    expect(estimate('vela-marfim-trovão-57-cobalto')).toEqual({ level: 'strong', segments: 4 });
  });
});
