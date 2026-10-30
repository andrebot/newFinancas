import {
  describe, expect, it, vi,
} from 'vitest';
import { periodBar } from '../../../../src/config/constants';
import {
  centreSelected, scrollByWheel, wheelStep, type WheelTurn,
} from '../../../../src/kit/periodBar/stripScroll';

// The period bar's swiped strip (BDT: Interaction tier → unit): the wheel's
// step and the centring, over stand-in geometry (jsdom lays nothing out). The
// hook runs in the bar's own suite.

/**
 * Stands in for a strip's geometry.
 *
 * @param scrollLeft - How far it is scrolled.
 * @param clientWidth - Its visible width.
 * @param scrollWidth - Its full content width.
 * @returns The strip.
 */
const strip = (scrollLeft: number, clientWidth = 300, scrollWidth = 700) => (
  { scrollLeft, clientWidth, scrollWidth } as HTMLElement
);

/**
 * Builds a wheel turn in pixels unless told otherwise.
 *
 * @param deltaY - The vertical delta.
 * @param deltaX - The horizontal delta.
 * @param deltaMode - The deltas' unit.
 * @returns The turn.
 */
const turn = (
  deltaY: number,
  deltaX = 0,
  deltaMode: number = WheelEvent.DOM_DELTA_PIXEL,
): WheelTurn => (
  { deltaY, deltaX, deltaMode }
);

describe('wheelStep', () => {
  it('scrolls the strip sideways by a vertical turn', () => {
    expect(wheelStep(strip(100), turn(120))).toBe(120);
    expect(wheelStep(strip(100), turn(-120))).toBe(-120);
  });

  it('counts a turn in lines in pixels', () => {
    expect(wheelStep(strip(100), turn(3, 0, WheelEvent.DOM_DELTA_LINE)))
      .toBe(3 * periodBar.wheelLinePx);
  });

  it('leaves a sideways or still turn to the browser', () => {
    expect(wheelStep(strip(100), turn(0))).toBeUndefined();
    expect(wheelStep(strip(100), turn(40, 60))).toBeUndefined();
    expect(wheelStep(strip(100), turn(40, -40))).toBeUndefined();
  });

  it('hands the turn to the page at the end it points to', () => {
    expect(wheelStep(strip(0), turn(-120))).toBeUndefined();
    expect(wheelStep(strip(400), turn(120))).toBeUndefined();
    expect(wheelStep(strip(0), turn(120))).toBe(120);
  });

  it('leaves a strip that doesn’t overflow alone', () => {
    expect(wheelStep(strip(0, 700, 700), turn(120))).toBeUndefined();
  });
});

describe('scrollByWheel', () => {
  /**
   * Turns the wheel over a stand-in strip.
   *
   * @param target - The strip.
   * @param deltaY - The vertical delta.
   * @returns The event's preventDefault spy.
   */
  const wheel = (target: HTMLElement, deltaY: number) => {
    const event = {
      ...turn(deltaY), currentTarget: target, preventDefault: vi.fn(),
    } as unknown as WheelEvent;
    scrollByWheel(event);
    return event.preventDefault;
  };

  it('scrolls the strip and keeps the page still', () => {
    const target = { ...strip(100), scrollBy: vi.fn() } as unknown as HTMLElement;
    expect(wheel(target, 80)).toHaveBeenCalledOnce();
    expect(target.scrollBy).toHaveBeenCalledExactlyOnceWith({ left: 80 });
  });

  it('lets the page scroll once the strip is at that end', () => {
    const target = { ...strip(0), scrollBy: vi.fn() } as unknown as HTMLElement;
    expect(wheel(target, -80)).not.toHaveBeenCalled();
    expect(target.scrollBy).not.toHaveBeenCalled();
  });
});

describe('centreSelected', () => {
  it('does nothing before the strip mounts or without a selected month', () => {
    const target = document.createElement('div');
    target.scrollTo = vi.fn();
    expect(() => centreSelected(null, 'instant')).not.toThrow();
    centreSelected(target, 'instant');
    expect(target.scrollTo).not.toHaveBeenCalled();
  });
});
