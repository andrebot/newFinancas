import { skeleton } from '../../config/constants';

// The kit's loading placeholders (K28, OQ-132): grey shapes that pulse where
// content is about to appear. `Skeleton` is one shape, for callers that draw
// their own (a rail of cards); `SkeletonRows` is the ledger's loading row from
// the Transactions mockup — an avatar, two text lines and an amount — reused by
// every list while its first or next page loads. The pulse only runs when the
// user hasn't asked for reduced motion.

/** The placeholder's outline: a text line, an avatar or a card. */
export type SkeletonShape = 'line' | 'circle' | 'block';

/** The skeleton's props. */
export interface SkeletonProps {
  /** Defaults to a text line. */
  readonly shape?: SkeletonShape | undefined;
  /** The size (and any other look) of the shape, e.g. `w-2/5` or `size-9`. */
  readonly className?: string | undefined;
}

/** The skeleton rows' props. */
export interface SkeletonRowsProps {
  /** What is loading, already translated; screen readers announce it. */
  readonly label: string;
  /** How many rows to draw; defaults to `config/constants.ts → skeleton.rows`. */
  readonly count?: number | undefined;
}

const SHAPES: Record<SkeletonShape, string> = {
  line: 'h-3 rounded',
  circle: 'rounded-full',
  block: 'rounded-2xl',
};

// The mockup's two rows differ in their line widths, so a run of rows doesn't
// read as a grid; longer runs repeat the pair.
const ROW_WIDTHS = [
  { title: 'w-2/5', meta: 'w-3/5', amount: 'w-16' },
  { title: 'w-1/3', meta: 'w-1/2', amount: 'w-20' },
] as const;

/**
 * Builds the classes of one placeholder shape.
 *
 * @param shape - The outline to draw.
 * @param className - The caller's size and extra classes, if any.
 * @returns The shape's classes.
 */
export const skeletonClasses = (shape: SkeletonShape, className?: string) => [
  'bg-raised motion-safe:animate-pulse',
  SHAPES[shape],
  className,
].filter(Boolean).join(' ');

/**
 * Renders one pulsing placeholder shape. It is hidden from screen readers:
 * the region it sits in announces the loading.
 *
 * @param props - The shape and its size classes.
 * @returns The placeholder.
 */
export function Skeleton({ shape = 'line', className }: SkeletonProps) {
  return <div aria-hidden="true" className={skeletonClasses(shape, className)} />;
}

/**
 * Renders the ledger-style loading rows as one live status region named by
 * `label`, so assistive technology hears "loading" once rather than per row.
 *
 * @param props - The announcement and the number of rows.
 * @returns The rows of placeholders.
 */
export function SkeletonRows({ label, count = skeleton.rows }: SkeletonRowsProps) {
  const rows = Array.from(
    { length: count },
    (_, index) => ROW_WIDTHS[index % ROW_WIDTHS.length]!,
  );

  return (
    <div
      role="status"
      aria-busy="true"
      aria-label={label}
      className="flex flex-col gap-3 px-5 py-3"
    >
      {rows.map((widths, index) => (
        // The rows are identical placeholders that never reorder.
        // eslint-disable-next-line react/no-array-index-key
        <div key={index} className="flex items-center gap-3">
          <Skeleton shape="circle" className="size-9" />
          <div className="flex flex-1 flex-col gap-1.5">
            <Skeleton className={widths.title} />
            <Skeleton className={`h-2.5 opacity-70 ${widths.meta}`} />
          </div>
          <Skeleton className={widths.amount} />
        </div>
      ))}
    </div>
  );
}
