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
  it('names each month in a section headed by it, and each day under it', () => {
    renderList();
    const september = screen.getByRole('region', { name: 'September 2026' });
    expect(screen.getByRole('heading', { level: 3, name: 'September 2026' })).toBeTruthy();
    expect(screen.getByRole('heading', { level: 3, name: 'August 2026' })).toBeTruthy();
    expect(september.querySelectorAll('h4')).toHaveLength(2);
    expect(screen.getByRole('heading', { level: 4, name: 'Sat, Sep 12' })).toBeTruthy();
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

  it('sticks the month headers at the top, or where the caller says', () => {
    const { rerenderInLocale } = renderList();
    const header = () => screen.getByRole('heading', { name: 'September 2026' }).parentElement!;
    expect(header().style.top).toBe('0px');
    rerenderInLocale(
      <GroupedList<Row>
        items={ROWS}
        dateOf={(row) => row.date}
        keyOf={(row) => row.id}
        renderItem={(row) => <span>{row.name}</span>}
        hasMore
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
        onReachedEnd={latest}
      />,
    );
    expect(observers).toHaveLength(1);
    sentinelSeen(true);
    expect(latest).toHaveBeenCalledTimes(1);
    expect(onReachedEnd).not.toHaveBeenCalled();
  });

  it('watches nothing while a page loads, after one failed, or at the end', () => {
    renderList({ status: 'loading' });
    renderList({ status: 'error' });
    renderList({ hasMore: false });
    expect(observers).toHaveLength(0);
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
    expect(screen.getAllByRole('region')).toHaveLength(2);
  });

  it('says just "loading" while the first page loads', () => {
    renderList({ items: [], status: 'loading' }, 'pt-BR');
    expect(screen.getByRole('status', { name: 'Carregando' })).toBeTruthy();
  });

  it('offers to try again when a page failed', () => {
    const { onReachedEnd } = renderList({ status: 'error' });
    expect(screen.getByRole('status').textContent).toBe('Couldn\'t load more.');
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(onReachedEnd).toHaveBeenCalledTimes(1);
  });

  it('shows the caller\'s empty state only when nothing loaded and nothing follows', () => {
    const empty = <p>Nothing yet</p>;
    const { unmount } = renderList({ items: [], hasMore: true, empty });
    expect(screen.queryByText('Nothing yet')).toBeNull();
    unmount();
    renderList({ items: [], hasMore: false, empty });
    expect(screen.getByText('Nothing yet')).toBeTruthy();
  });

  it('shows nothing after the last row at the end of a list', () => {
    const { container } = renderList({ hasMore: false, empty: <p>Nothing yet</p> });
    expect(screen.queryByText('Nothing yet')).toBeNull();
    expect(container.querySelector('[aria-hidden="true"]')).toBeNull();
  });
});
