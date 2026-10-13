// Fixed application settings (OQ-101): the same in every environment, changed
// only in code, grouped by area. Facts that belong to an algorithm (a regular
// expression, a date format) stay next to the code that implements it.

/** Form field rules (FU1 ValidationUtility). */
// eslint-disable-next-line import-x/prefer-default-export -- grouped by area; more follow
export const validation = {
  /** FR-1.1: the shortest password accepted (mirrors the API's `authentication.password`). */
  password: {
    minLength: 12,
  },
  /** A whole percent (Goal allocations, OQ-87) — the contract's `percentage` bounds. */
  wholePercent: {
    min: 1,
    max: 100,
  },
};
