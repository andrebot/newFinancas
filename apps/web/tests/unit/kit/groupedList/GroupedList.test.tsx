import { act, fireEvent, screen } from '@testing-library/react';
import {
  afterEach, beforeEach, describe, expect, it, vi,
} from 'vitest';
import { GroupedList } from '../../../../src/kit/groupedList/GroupedList';
import { renderInLocale } from '../../../support/renderInLocale';

// Kit component (BDT: Interaction tier → unit): display and events only; the
// translator and the formatter run for real. jsdom has no layout, so the
// IntersectionObserver is stood in for and its callback driven by hand.

/** An item with an id, a date and a name. */
interface Row {
  readonly id: string;
  readonly date: string;
  readonly name: string;
}

const ROWS: readonly Row[] = [
  { id: 'netflix', date: '2026-09-12', name: 'Netflix' },
  { id: 'coffee', date: '2026-09-12', name: 'Coffee Shop' },
  { id: 'paycheck', date: '2026-09-01', name: 'Paycheck' },
  { id: 'rent', date: '2026-08-31', name: 'Rent' },
];

const MORE: Row = { id: 'groceries', date: '2026-08-20', name: 'Groceries' };

/**
 * Builds the list with the given items, status and handler, more to load.
 *
 * @param props - The items, the status and the page handler.
 * @returns The list element, for a rerender.
 */
const listWith = ({ items, status, onReachedEnd }: Pick<
  Parameters<typeof GroupedList<Row>>[0], 'items' | 'status' | 'onReachedEnd'
>) => (
  <GroupedList<Row>
    items={items}
    dateOf={(row) => row.date}
    keyOf={(row) => row.id}
    renderItem={(row) => <span>{row.name}</span>}
    hasMore
    status={status}
    onReachedEnd={onReachedEnd}
  />
);

/** A stand-in observer: what it was built with and what it was asked. */
interface ObserverStub {
  readonly callback: IntersectionObserverCallback;
  readonly options: IntersectionObserverInit | undefined;
  readonly observe: ReturnType<typeof vi.fn>;
  readonly disconnect: ReturnType<typeof vi.fn>;
}

let observers: ObserverStub[] = [];

/**
 * Builds a stand-in observer and keeps it for the test to drive.
 *
 * @param callback - What the list does when the sentinel comes into view.
 * @param options - Its root margin.
 * @returns The stand-in.
 */
function StubIntersectionObserver(
  callback: IntersectionObserverCallback,
  options?: IntersectionObserverInit,
) {
  const stub = {
    callback, options, observe: vi.fn(), disconnect: vi.fn(),
  };
  observers.push(stub);
  return stub;
}

/**
 * Tells the last observer whether the sentinel is in view.
 *
 * @param isIntersecting - Whether it is.
 */
const sentinelSeen = (isIntersecting: boolean) => {
  const observer = observers.at(-1)!;
  act(() => {
    observer.callback(
      [{ isIntersecting } as IntersectionObserverEntry],
      observer as unknown as IntersectionObserver,
    );
  });
};

/**
 * Renders the list with the four rows, more to load, unless told otherwise.
 *
 * @param overrides - Props to replace.
 * @param locale - The interface language.
 * @returns The page handler and the render result.
 */
const renderList = (
  overrides: Partial<Parameters<typeof GroupedList<Row>>[0]> = {},
  locale: 'en-US' | 'pt-BR' = 'en-US',
) => {
  const onReachedEnd = vi.fn();
  const view = renderInLocale(
    <GroupedList<Row>
      items={ROWS}
      dateOf={(row) => row.date}
      keyOf={(row) => row.id}
      renderItem={(row) => <span>{row.name}</span>}
      hasMore
      status="idle"
      onReachedEnd={onReachedEnd}
      {...overrides}
    />,
    locale,
  );
  return { onReachedEnd, ...view };
};

beforeEach(() => {
  observers = [];
  vi.stubGlobal('IntersectionObserver', StubIntersectionObserver);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('GroupedList', () => {
  it('heads each month, and each day one level below it, adding no landmarks', () => {
    renderList();
    const headings = screen.getAllByRole('heading').map((heading) => [
      heading.tagName, heading.textContent,
    ]);
    expect(headings).toEqual([
      ['H3', 'September 2026'],
      ['H4', 'Sat, Sep 12'],
      ['H4', 'Tue, Sep 1'],
      ['H3', 'August 2026'],
      ['H4', 'Mon, Aug 31'],
    ]);
    expect(screen.queryAllByRole('region')).toHaveLength(0);
  });

  it('keeps a month or day that comes back after another apart, without key clashes', () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    renderList({
      items: [
        { id: 'a', date: '2026-09-12', name: 'First' },
        { id: 'b', date: '2026-08-31', name: 'Second' },
        { id: 'c', date: '2026-09-12', name: 'Third' },
      ],
    });
    expect(screen.getAllByRole('heading', { level: 3, name: 'September 2026' })).toHaveLength(2);
    expect(error).not.toHaveBeenCalled();
    error.mockRestore();
  });

  it('writes the month and day in the interface language, the month capitalised', () => {
    renderList({}, 'pt-BR');
    const heading = screen.getByRole('heading', { level: 3, name: 'setembro de 2026' });
    expect(heading.className).toContain('first-letter:uppercase');
    expect(screen.getByRole('heading', { level: 4, name: 'sáb., 12 de set.' })).toBeTruthy();
  });

  it('lists a day\'s rows in order, hairlines between them', () => {
    renderList();
    const [firstDay] = screen.getAllByRole('list');
    const rows = Array.from(firstDay!.children);
    expect(rows.map((row) => row.textContent)).toEqual(['Netflix', 'Coffee Shop']);
    expect(rows[0]!.className).toContain('not-last:border-b');
  });

  it('puts the caller\'s asides at the ends of the month headers and day bands', () => {
    renderList({
      monthAside: (month) => `${month} count`,
      dayAside: (date) => `${date} total`,
    });
    expect(screen.getByText('2026-09 count')).toBeTruthy();
    expect(screen.getByText('2026-08 count')).toBeTruthy();
    expect(screen.getByText('2026-09-12 total')).toBeTruthy();
    expect(screen.getByText('2026-08-31 total')).toBeTruthy();
  });

  it('heads the months at the level asked, the days one below', () => {
    renderList({ headingLevel: 2 });
    expect(screen.getAllByRole('heading', { level: 2 })).toHaveLength(2);
    expect(screen.getAllByRole('heading', { level: 3 })).toHaveLength(3);
  });

  it('sticks the month headers under the App Shell\'s header, or where the caller says', () => {
    const { rerenderInLocale } = renderList();
    const header = () => screen.getByRole('heading', { name: 'September 2026' }).parentElement!;
    expect(header().style.top).toBe('var(--spacing-shell-header)');
    rerenderInLocale(
      <GroupedList<Row>
        items={ROWS}
        dateOf={(row) => row.date}
        keyOf={(row) => row.id}
        renderItem={(row) => <span>{row.name}</span>}
        hasMore
        status="idle"
        onReachedEnd={() => {}}
        stickyTop="120px"
      />,
    );
    expect(header().style.top).toBe('120px');
  });

  it('asks for the next page once the sentinel nears the view, then disarms', () => {
    const { onReachedEnd } = renderList();
    expect(observers).toHaveLength(1);
    expect(observers[0]!.options?.rootMargin).toBe('0px 0px 400px 0px');
    expect(observers[0]!.observe).toHaveBeenCalledTimes(1);
    sentinelSeen(false);
    expect(onReachedEnd).not.toHaveBeenCalled();
    sentinelSeen(true);
    expect(onReachedEnd).toHaveBeenCalledTimes(1);
    expect(observers[0]!.disconnect).toHaveBeenCalled();
  });

  it('calls the latest handler the caller passed', () => {
    const { rerenderInLocale, onReachedEnd } = renderList();
    const latest = vi.fn();
    rerenderInLocale(
      <GroupedList<Row>
        items={ROWS}
        dateOf={(row) => row.date}
        keyOf={(row) => row.id}
        renderItem={(row) => <span>{row.name}</span>}
        hasMore
        status="idle"
        onReachedEnd={latest}
      />,
    );
    expect(observers).toHaveLength(1);
    sentinelSeen(true);
    expect(latest).toHaveBeenCalledTimes(1);
    expect(onReachedEnd).not.toHaveBeenCalled();
  });

  it('watches nothing while loading, after a failure, at the end, or before the first page', () => {
    renderList({ status: 'loading' });
    renderList({ status: 'error' });
    renderList({ hasMore: false });
    renderList({ items: [] });
    expect(observers).toHaveLength(0);
  });

  it('asks again once the page it asked for has loaded and the sentinel is still in view', () => {
    const { rerenderInLocale, onReachedEnd } = renderList();
    sentinelSeen(true);
    expect(onReachedEnd).toHaveBeenCalledTimes(1);
    rerenderInLocale(listWith({ items: ROWS, status: 'loading', onReachedEnd }));
    expect(observers).toHaveLength(1);
    rerenderInLocale(listWith({ items: [...ROWS, MORE], status: 'idle', onReachedEnd }));
    expect(observers).toHaveLength(2);
    sentinelSeen(true);
    expect(onReachedEnd).toHaveBeenCalledTimes(2);
  });

  it('arms again when a new page arrives without the status ever leaving idle', () => {
    const { rerenderInLocale, onReachedEnd } = renderList();
    sentinelSeen(true);
    rerenderInLocale(listWith({ items: [...ROWS, MORE], status: 'idle', onReachedEnd }));
    expect(observers).toHaveLength(2);
    sentinelSeen(true);
    expect(onReachedEnd).toHaveBeenCalledTimes(2);
  });

  it('stops watching when it unmounts', () => {
    const { unmount } = renderList();
    unmount();
    expect(observers[0]!.disconnect).toHaveBeenCalled();
  });

  it('shows skeleton rows under the last month while the next page loads', () => {
    renderList({ status: 'loading' });
    const status = screen.getByRole('status', { name: 'Loading more' });
    expect(status.getAttribute('aria-busy')).toBe('true');
    expect(screen.getAllByRole('heading', { level: 3 })).toHaveLength(2);
    expect(status.compareDocumentPosition(screen.getByText('Rent')))
      .toBe(Node.DOCUMENT_POSITION_PRECEDING);
  });

  it('says just "loading" while the first page loads', () => {
    renderList({ items: [], status: 'loading' }, 'pt-BR');
    expect(screen.getByRole('status', { name: 'Carregando' })).toBeTruthy();
  });

  it('keeps an empty live region at the end, so a failure is heard when it appears', () => {
    const { rerenderInLocale, onReachedEnd } = renderList();
    const region = screen.getByRole('status');
    expect(region.textContent).toBe('');
    rerenderInLocale(listWith({ items: ROWS, status: 'error', onReachedEnd }));
    expect(screen.getByRole('status')).toBe(region);
    expect(region.textContent).toBe('Couldn\'t load more.');
  });

  it('offers to try again when a page failed, asking with no arguments', () => {
    const { onReachedEnd } = renderList({ status: 'error' });
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(onReachedEnd).toHaveBeenCalledExactlyOnceWith();
  });

  it('keeps focus at the list\'s end when "Try again" goes away', () => {
    const { rerenderInLocale, onReachedEnd } = renderList({ status: 'error' });
    const retry = screen.getByRole('button', { name: 'Try again' });
    retry.focus();
    fireEvent.click(retry);
    rerenderInLocale(listWith({ items: ROWS, status: 'loading', onReachedEnd }));
    expect(document.activeElement).not.toBe(document.body);
    expect(document.activeElement?.getAttribute('tabindex')).toBe('-1');
  });

  it('shows the caller\'s empty state only when nothing loaded and nothing follows', () => {
    const empty = <p>Nothing yet</p>;
    const { unmount } = renderList({ items: [], hasMore: true, empty });
    expect(screen.queryByText('Nothing yet')).toBeNull();
    unmount();
    const { unmount: unmountFailed } = renderList({
      items: [], hasMore: false, status: 'error', empty,
    });
    expect(screen.queryByText('Nothing yet')).toBeNull();
    unmountFailed();
    renderList({ items: [], hasMore: false, empty });
    expect(screen.getByText('Nothing yet')).toBeTruthy();
  });

  it('shows nothing after the last row at the end of a list', () => {
    const { container } = renderList({ hasMore: false, empty: <p>Nothing yet</p> });
    expect(screen.queryByText('Nothing yet')).toBeNull();
    expect(container.querySelector('[aria-hidden="true"]')).toBeNull();
  });
});
