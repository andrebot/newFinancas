import { Icon } from '../icons/Icon';

// The kit's stepper (K49, OQ-183): where the guided setup is (mockups 11–13).
// From `lg` it is the mockups' vertical list — a numbered dot, the step's
// label and hint, a connector down to the next step. Below `lg`, where the
// wizard stacks it above the step's card, it shrinks to a row of dots and
// the labels are kept for screen readers only. It only displays: Wizard
// Navigation owns Next / Back / Skip, and the caller translates every text.

/** One step of the stepper. */
export interface StepperStep {
  /** The step's name, already translated, e.g. "Add an account". */
  readonly label: string;
  /** A line under the label, already translated, e.g. "Where your money lives". */
  readonly hint?: string | undefined;
}

/** Where a step stands against the current one. */
export type StepState = 'done' | 'current' | 'next';

/** The stepper's props. */
export interface StepperProps {
  /** The steps, in order. */
  readonly steps: readonly StepperStep[];
  /** The current step's index, from 0; the steps before it are done. */
  readonly current: number;
  /** The line above the steps, already formatted, e.g. "Getting started · step 1 of 3". */
  readonly caption?: string | undefined;
  /** The list's accessible name, already translated. */
  readonly ariaLabel: string;
  /** What a screen reader adds after a done step, already translated, e.g. "completed". */
  readonly completedLabel: string;
}

const DOTS: Record<StepState, string> = {
  done: 'bg-mint text-onmint',
  current: 'bg-mintdeep text-mint ring-2 ring-mint',
  next: 'border border-line text-muted',
};

const LABELS: Record<StepState, string> = {
  done: 'text-muted',
  current: 'text-ink',
  next: 'text-muted',
};

/** The step's label and hint: shown from `lg`, for screen readers only below it. */
const STEP_TEXT = 'sr-only lg:not-sr-only';

/** The list: a row of dots below `lg`, the vertical list from it. */
const LIST = 'flex items-center gap-2 lg:flex-col lg:items-stretch lg:gap-0';

/**
 * Tells where a step stands against the current one.
 *
 * @param index - The step's index.
 * @param current - The current step's index.
 * @returns `done` before it, `current` on it, `next` after it.
 */
export const stepState = (index: number, current: number): StepState => {
  if (index < current) {
    return 'done';
  }
  return index === current ? 'current' : 'next';
};

/**
 * Builds the classes of a step's 32px dot.
 *
 * @param state - Where the step stands.
 * @returns The dot's classes.
 */
export const dotClasses = (state: StepState) => (
  `grid size-8 shrink-0 place-items-center rounded-full text-[13px] font-bold ${DOTS[state]}`
);

/**
 * Builds the classes of a step's label.
 *
 * @param state - Where the step stands.
 * @returns The label's classes.
 */
export const labelClasses = (state: StepState) => `text-sm font-semibold ${LABELS[state]}`;

/**
 * Builds the classes of the connector after a step: across between the dots
 * below `lg`, down under the dot from `lg`; mint once the step is done.
 *
 * @param state - Where the step it leaves stands.
 * @returns The connector's classes.
 */
export const connectorClasses = (state: StepState) => [
  'h-px w-6 lg:ml-[15px] lg:h-8 lg:w-px',
  state === 'done' ? 'bg-mint' : 'bg-line',
].join(' ');

/** A step's props: the step, where it stands, its number and whether a connector follows. */
interface StepItemProps {
  readonly step: StepperStep;
  readonly state: StepState;
  readonly number: number;
  readonly last: boolean;
  readonly completedLabel: string;
}

/**
 * Renders one step: its dot (a check once done), its text and the connector
 * to the next step.
 *
 * @param props - The step, where it stands, its number, whether it is last and the done word.
 * @returns The step's list item.
 */
function StepItem({
  step, state, number, last, completedLabel,
}: StepItemProps) {
  return (
    <li
      aria-current={state === 'current' ? 'step' : undefined}
      className="flex items-center gap-2 lg:flex-col lg:items-start lg:gap-0"
    >
      <div className="flex items-center gap-3">
        <span aria-hidden="true" className={dotClasses(state)}>
          {state === 'done' ? <Icon name="check" className="size-4.5" /> : number}
        </span>
        <div className={STEP_TEXT}>
          <div className={labelClasses(state)}>
            {step.label}
            {state === 'done' && <span className="sr-only">{` (${completedLabel})`}</span>}
          </div>
          {step.hint && <div className="text-xs text-muted">{step.hint}</div>}
        </div>
      </div>
      {!last && <div aria-hidden="true" className={connectorClasses(state)} />}
    </li>
  );
}

/**
 * Renders the stepper: its caption over the ordered steps, the current one
 * marked `aria-current="step"`.
 *
 * @param props - The steps, the current index, the caption and the accessible texts.
 * @returns The stepper.
 */
export function Stepper({
  steps, current, caption, ariaLabel, completedLabel,
}: StepperProps) {
  return (
    <div className="flex flex-col">
      {caption && <p className="mb-4 type-label text-muted">{caption}</p>}
      <ol aria-label={ariaLabel} className={LIST}>
        {steps.map((step, index) => (
          <StepItem
            key={step.label}
            step={step}
            state={stepState(index, current)}
            number={index + 1}
            last={index === steps.length - 1}
            completedLabel={completedLabel}
          />
        ))}
      </ol>
    </div>
  );
}
