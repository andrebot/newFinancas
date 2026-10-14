import { useId, useState } from 'react';
import { Icon, type IconName } from '../../src/kit/icons/Icon';

// A searchable grid of icons for the Icon stories (N14): type part of a name
// to narrow it. Dev-only, so its few words are not in the i18n catalog.

/** The gallery's props. */
export interface IconGalleryProps {
  readonly names: readonly IconName[];
}

/**
 * Keeps the names that contain the query, ignoring case and surrounding spaces.
 *
 * @param names - Every name in the gallery.
 * @param query - What the reader typed.
 * @returns The matching names, in their original order.
 */
export const filterIconNames = (
  names: readonly IconName[],
  query: string,
): readonly IconName[] => {
  const needle = query.trim().toLowerCase();
  return names.filter((name) => name.includes(needle));
};

/**
 * Renders a search box over a grid of named icons.
 *
 * @param props - The icons to show.
 * @returns The gallery.
 */
export function IconGallery({ names }: IconGalleryProps) {
  const [query, setQuery] = useState('');
  const searchId = useId();
  const shown = filterIconNames(names, query);

  return (
    <div className="grid gap-4">
      <label htmlFor={searchId} className="grid max-w-80 gap-1 type-label text-muted">
        {`Search ${names.length} icons`}
        <input
          id={searchId}
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          className="h-9 rounded-lg border border-line bg-card px-3 type-body text-ink"
        />
      </label>
      <ul className="grid grid-cols-[repeat(auto-fill,minmax(8rem,1fr))] gap-2">
        {shown.map((name) => (
          <li
            key={name}
            className="flex flex-col items-center gap-2 rounded-xl border border-line bg-card p-3"
          >
            <Icon name={name} className="size-6" />
            <code className="text-center font-mono type-caption text-muted">{name}</code>
          </li>
        ))}
      </ul>
    </div>
  );
}
