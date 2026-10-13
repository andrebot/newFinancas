// A grid of colour swatches for the foundations stories (N14): each swatch
// paints `var(--c-<token>)`, so it follows the toolbar's theme live.

/** The grid's props. */
export interface SwatchGridProps {
  /** Token names without the `--c-` prefix (`ink`, `cat-teal`, …). */
  readonly tokens: readonly string[];
}

/**
 * Renders one swatch per token, labelled with its name.
 *
 * @param props - The tokens to show.
 * @returns The grid.
 */
export function SwatchGrid({ tokens }: SwatchGridProps) {
  return (
    <ul className="grid grid-cols-[repeat(auto-fill,minmax(9rem,1fr))] gap-3">
      {tokens.map((token) => (
        <li key={token} className="overflow-hidden rounded-xl border border-line bg-card">
          <div className="h-14" style={{ background: `var(--c-${token})` }} />
          <code className="block px-3 py-2 font-mono type-caption text-muted">{token}</code>
        </li>
      ))}
    </ul>
  );
}
