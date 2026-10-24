// What both `captureLogs` take (OQ-199): the test runner's own clean-up hook,
// e.g. Vitest's `onTestFinished`. The capture registers its own stop on it, so
// it ends with its test even when the test throws — and this package still
// imports no test framework.

/** Registers a clean-up to run once the current test finishes. */
export type OnTestFinished = (cleanUp: () => void) => void;
