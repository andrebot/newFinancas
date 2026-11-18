import { expect, test as base, type BrowserContext } from '@playwright/test';

// Every journey's `test` (N10 S1, OQ-250): Playwright's, plus an automatic
// check that no page broke the Content Security Policy. The CSP is sent only
// when the API serves the built app (`E2E_TARGET=production`); under the Vite
// dev server there is none, so nothing is ever reported there. Chrome reports
// each blocked script, style, font or image as a console error.

const CSP_VIOLATION = /violates the following Content Security Policy directive/;

/**
 * Collects the CSP violations a browser context's pages report.
 *
 * @param context - The browser context to watch.
 * @returns The list the violations are added to, as they happen.
 */
export const watchCspViolations = (context: BrowserContext): string[] => {
  const violations: string[] = [];
  context.on('console', (message) => {
    if (message.type() === 'error' && CSP_VIOLATION.test(message.text())) {
      violations.push(`${message.location().url}: ${message.text()}`);
    }
  });
  return violations;
};

export const test = base.extend<{ cspViolations: string[] }>({
  cspViolations: [async ({ context }, use) => {
    const violations = watchCspViolations(context);
    await use(violations);
    expect(violations, 'Content Security Policy violations').toEqual([]);
  }, { auto: true }],
});

export { expect };
