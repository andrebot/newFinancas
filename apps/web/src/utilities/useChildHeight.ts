import { useCallback, useEffect, useState } from 'react';

// LayoutUtility: how tall one of a container's children is, kept current as
// it resizes — for a page that stacks something sticky under another sticky
// element whose height it doesn't set (the phone's period bar over the
// ledger's month headers, OQ-217). No journey knowledge: the caller names the
// child by a selector.

/**
 * Measures the first element inside a container that matches a selector.
 *
 * @param selector - Which child to measure, e.g. `[data-region="overview-bar"]`.
 * @returns A ref callback for the container, and the child's height in pixels
 *   (0 until it is measured, or when there is no such child).
 */
export default function useChildHeight(selector: string) {
  const [container, setContainer] = useState<HTMLElement | null>(null);
  const [height, setHeight] = useState(0);
  const ref = useCallback((element: HTMLElement | null) => setContainer(element), []);

  useEffect(() => {
    const child = container?.querySelector<HTMLElement>(selector);
    if (!child) return undefined;
    const update = () => setHeight(child.offsetHeight);
    update();
    const observer = new ResizeObserver(update);
    observer.observe(child);
    return () => observer.disconnect();
  }, [container, selector]);

  return [ref, height] as const;
}
