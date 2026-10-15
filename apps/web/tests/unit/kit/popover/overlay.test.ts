import { describe, expect, it } from 'vitest';
import { overlay } from '../../../../src/config/constants';
import {
  fitToViewport, fitToViewportAndReference, OVERLAY_SURFACE, overlayMiddleware,
} from '../../../../src/kit/popover/overlay';

// Kit helper (BDT: Utility → unit, nothing mocked): the shared positioning
// steps and the viewport fit they end with.

describe('overlayMiddleware', () => {
  it('gaps, flips, shifts and fits, in that order', () => {
    const names = overlayMiddleware().map((step) => step.name);
    expect(names).toEqual(['offset', 'flip', 'shift', 'size']);
  });

  it('fits to the viewport only, unless asked to match the reference width', () => {
    // @floating-ui/react keeps each step's options as `[options, deps]`.
    const applyOf = (middleware: ReturnType<typeof overlayMiddleware>) => (
      (middleware[3]!.options as [{ apply: unknown }])[0].apply
    );

    expect(applyOf(overlayMiddleware())).toBe(fitToViewport);
    expect(applyOf(overlayMiddleware({ matchReferenceWidth: true })))
      .toBe(fitToViewportAndReference);
  });

  it('keeps the page gutter from the viewport edges', () => {
    const [, flipStep, shiftStep, sizeStep] = overlayMiddleware();
    [flipStep, shiftStep, sizeStep].forEach((step) => {
      // @floating-ui/react keeps each step's options as `[options, deps]`.
      expect(step!.options).toEqual([
        expect.objectContaining({ padding: overlay.viewportPadding }),
        undefined,
      ]);
    });
  });
});

describe('fitToViewport', () => {
  it('caps the panel at the space left', () => {
    const floating = document.createElement('div');

    fitToViewport({ availableWidth: 343, availableHeight: 500, elements: { floating } });

    expect(floating.style.maxWidth).toBe('343px');
    expect(floating.style.maxHeight).toBe('500px');
  });

  it('never sets a negative cap when there is no room', () => {
    const floating = document.createElement('div');

    fitToViewport({ availableWidth: -12, availableHeight: -1, elements: { floating } });

    expect(floating.style.maxWidth).toBe('0px');
    expect(floating.style.maxHeight).toBe('0px');
  });
});

describe('fitToViewportAndReference', () => {
  it('caps the panel and keeps it at least as wide as its reference', () => {
    const floating = document.createElement('div');

    fitToViewportAndReference({
      availableWidth: 343,
      availableHeight: 500,
      elements: { floating },
      rects: { reference: { width: 280 } },
    });

    expect(floating.style.maxWidth).toBe('343px');
    expect(floating.style.maxHeight).toBe('500px');
    expect(floating.style.minWidth).toBe('280px');
  });
});

describe('OVERLAY_SURFACE', () => {
  it('is the raised, bordered, shadowed surface that scrolls inside', () => {
    const classes = OVERLAY_SURFACE.split(' ');
    const expected = [
      'bg-raised', 'border-line', 'rounded-2xl', 'shadow-overlay', 'overflow-y-auto',
    ];
    expected.forEach((token) => expect(classes).toContain(token));
  });
});
