import type { ReactNode } from 'react';
import { BrandMark } from '../brand/BrandMark';

// The kit's wizard layout (K34, OQ-135): the guided setup's page (mockups
// 10–14). A bar with only the brand mark — the main nav stays hidden until
// setup is done — over either a centred column (naming the household, the
// final summary) or the stepper beside the step's card (adding an account,
// categories, a budget). Below `lg` the stepper stacks above the card.

/** The centred column's width: a single question (560px) or the final summary (760px). */
export type WizardWidth = 'narrow' | 'wide';

/** The wizard layout's props. */
export interface WizardLayoutProps {
  /** The step's content: a centred column, or the step's card beside `aside`. */
  readonly children: ReactNode;
  /** The stepper and its tip; without it the content is a centred column. */
  readonly aside?: ReactNode;
  /** The centred column's width; defaults to `narrow`. Ignored beside `aside`. */
  readonly width?: WizardWidth | undefined;
}

const WIDTHS: Record<WizardWidth, string> = {
  narrow: 'max-w-[560px]',
  wide: 'max-w-[760px]',
};

const STEPPED = [
  'mx-auto grid max-w-[1080px] gap-12 px-4 pt-12 pb-16 sm:px-12',
  'lg:grid-cols-[260px_minmax(0,1fr)]',
].join(' ');

const CENTRED = 'mx-auto flex flex-col items-center gap-8 px-6 pt-20 pb-16 text-center';

/**
 * Renders the wizard's page.
 *
 * @param props - The step's content, the optional stepper and the centred column's width.
 * @returns The bar and the step.
 */
export function WizardLayout({ children, aside, width = 'narrow' }: WizardLayoutProps) {
  return (
    <div className="min-h-screen bg-bg text-ink type-body">
      <header className="flex h-16 items-center border-b border-line bg-card/80 px-6">
        <BrandMark />
      </header>
      {aside ? (
        <main className={STEPPED}>
          <aside className="flex flex-col pt-2">{aside}</aside>
          <div className="min-w-0">{children}</div>
        </main>
      ) : (
        <main className={`${CENTRED} ${WIDTHS[width]}`}>
          {children}
        </main>
      )}
    </div>
  );
}
