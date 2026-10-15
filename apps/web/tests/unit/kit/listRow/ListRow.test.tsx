import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import {
  ListRow, ListRows, listRowClasses, listRowsClasses,
} from '../../../../src/kit/listRow/ListRow';

// Kit component (BDT: Interaction tier → unit): pure rendering, nothing mocked.

describe('listRowsClasses', () => {
  it('draws hairlines between divided rows, never under the last', () => {
    expect(listRowsClasses('divided')).toBe(
      'flex flex-col *:px-1 *:py-3 *:not-last:border-b *:not-last:border-line/70',
    );
  });

  it('draws each raised row as its own card, with a gap between', () => {
    expect(listRowsClasses('raised')).toBe(
      'flex flex-col gap-2 *:rounded-xl *:bg-raised *:px-3 *:py-2.5',
    );
  });

  it('appends the caller’s classes', () => {
    expect(listRowsClasses('divided', 'mt-2').endsWith(' mt-2')).toBe(true);
  });
});

describe('listRowClasses', () => {
  it('centres a row without a footer', () => {
    expect(listRowClasses(false, false)).toBe('flex gap-3 items-center');
  });

  it('aligns a row with a footer to the top', () => {
    expect(listRowClasses(true, false)).toBe('flex gap-3 items-start');
  });

  it('fades a dimmed row', () => {
    expect(listRowClasses(false, true)).toBe('flex gap-3 items-center opacity-60');
  });
});

describe('ListRows', () => {
  it('renders a divided list by default, without a name', () => {
    render(<ListRows><ListRow title="Jane Doe" /></ListRows>);

    const list = screen.getByRole('list');
    expect(list.className).toBe(listRowsClasses('divided'));
    expect(list.hasAttribute('aria-label')).toBe(false);
  });

  it('takes its surface, name and extra classes', () => {
    render(
      <ListRows surface="raised" label="Pending invitations" className="mt-2">
        <ListRow title="morgan@example.com" />
      </ListRows>,
    );

    const list = screen.getByRole('list', { name: 'Pending invitations' });
    expect(list.className).toBe(listRowsClasses('raised', 'mt-2'));
  });
});

describe('ListRow', () => {
  it('renders only the title when no other slot is given', () => {
    render(<ListRows><ListRow title="Jane Doe" /></ListRows>);

    const row = screen.getByRole('listitem');
    expect(row.className).toBe(listRowClasses(false, false));
    expect(row.children).toHaveLength(1);
    expect(screen.getByText('Jane Doe').className)
      .toBe('type-body truncate font-semibold text-ink');
  });

  it('renders every slot in order: leading, title, meta, footer, trailing', () => {
    render(
      <ListRows>
        <ListRow
          leading={<span>JD</span>}
          title="Jane Doe"
          meta="jane@example.com"
          footer={<button type="button">Accept</button>}
          trailing={<button type="button">Remove</button>}
        />
      </ListRows>,
    );

    const row = screen.getByRole('listitem');
    expect(row.className).toBe(listRowClasses(true, false));
    expect(row.textContent).toBe('JDJane Doejane@example.comAcceptRemove');
    expect(screen.getByText('jane@example.com').className)
      .toBe('mt-0.5 truncate type-caption text-muted');
    expect(within(row).getAllByRole('button').map((button) => button.textContent))
      .toEqual(['Accept', 'Remove']);
  });

  it('lets a sentence title wrap at regular weight', () => {
    render(
      <ListRows>
        <ListRow
          title={(
            <>
              <b>Alex</b>
              {' invited you'}
            </>
          )}
          titleWeight="regular"
        />
      </ListRows>,
    );

    expect(screen.getByText('invited you', { exact: false }).className).toBe('type-body text-ink');
  });

  it('fades a dimmed row', () => {
    render(<ListRows><ListRow title="Seen" dimmed /></ListRows>);

    expect(screen.getByRole('listitem').className).toBe(listRowClasses(false, true));
  });
});
