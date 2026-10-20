import { CARD_NETWORKS } from '@financas/reference';
import { describe, expect, it } from 'vitest';
import { creditCard } from '../../../../src/config/constants';
import {
  cardNumberMask, cardNumberParts, cardSurfaceStyle, chipStyle, formatCardNumber,
  groupCardDigits, LOGO_BADGE, parseCardNumber, previewLength,
} from '../../../../src/kit/creditCard/cardNumber';

// Pure mask and preview pieces (BDT: Utility-like → unit, nothing mocked).

describe('groupCardDigits', () => {
  it('puts a space at each gap that more digits follow', () => {
    expect(groupCardDigits('41111111', [4, 8, 12])).toBe('4111 1111');
    expect(groupCardDigits('411111111', [4, 8, 12])).toBe('4111 1111 1');
  });

  it('groups by the gaps it is given', () => {
    expect(groupCardDigits('378282246310005', [4, 10])).toBe('3782 822463 10005');
  });

  it('shows nothing for no digits', () => {
    expect(groupCardDigits('', [4])).toBe('');
  });
});

describe('parseCardNumber', () => {
  it('keeps only the digits', () => {
    expect(parseCardNumber('4111 1111-1111 x1111')).toBe('4111111111111111');
  });

  it('stops at the detected network’s longest length', () => {
    expect(parseCardNumber('3782 822463 100059')).toBe('378282246310005');
    expect(parseCardNumber('5502094242424242999')).toBe('5502094242424242');
    expect(parseCardNumber('41111111111111111111')).toBe('4111111111111111111');
  });
});

describe('formatCardNumber', () => {
  it('groups in fours for most networks', () => {
    expect(formatCardNumber('550209424242')).toBe('5502 0942 4242');
  });

  it('groups Amex 4-6-5 and Diners 4-6-4', () => {
    expect(formatCardNumber('378282246310005')).toBe('3782 822463 10005');
    expect(formatCardNumber('30569309025904')).toBe('3056 930902 5904');
  });

  it('adds the fifth group of a 19-digit number', () => {
    expect(formatCardNumber('4111111111111111111')).toBe('4111 1111 1111 1111 111');
  });
});

describe('cardNumberMask', () => {
  it('reads back what it shows', () => {
    const digits = '378282246310005';

    expect(cardNumberMask.parse(cardNumberMask.format(digits))).toBe(digits);
  });
});

describe('previewLength', () => {
  it('draws the placeholder length when the network allows it', () => {
    expect(previewLength('visa', 0)).toBe(creditCard.placeholderLength);
    expect(previewLength('other', 3)).toBe(creditCard.placeholderLength);
  });

  it('draws a shorter network’s own length', () => {
    expect(previewLength('amex', 2)).toBe(15);
    expect(previewLength('diners', 0)).toBe(14);
  });

  it('grows to the next length that holds what was typed', () => {
    expect(previewLength('visa', 17)).toBe(19);
  });

  it('never draws fewer digits than were typed', () => {
    expect(previewLength('amex', 15)).toBe(15);
  });
});

describe('cardNumberParts', () => {
  it('shows the digits typed, then dots to the card’s length', () => {
    expect(cardNumberParts('mastercard', '550209424242')).toEqual([
      { text: '5502 0942 4242', placeholder: false },
      { text: ' ••••', placeholder: true },
    ]);
  });

  it('splits a group the user is still typing', () => {
    expect(cardNumberParts('amex', '37828')).toEqual([
      { text: '3782 8', placeholder: false },
      { text: '••••• •••••', placeholder: true },
    ]);
  });

  it('shows only dots before anything is typed', () => {
    expect(cardNumberParts('other', '')).toEqual([
      { text: '•••• •••• •••• ••••', placeholder: true },
    ]);
  });

  it('shows only digits once the number is whole', () => {
    expect(cardNumberParts('visa', '4111111111111111')).toEqual([
      { text: '4111 1111 1111 1111', placeholder: false },
    ]);
  });

  it('shows a saved card’s last four digits after the dots', () => {
    expect(cardNumberParts('visa', '', '1111')).toEqual([
      { text: '•••• •••• •••• ', placeholder: true },
      { text: '1111', placeholder: false },
    ]);
  });

  it('prefers the digits typed over the saved last four', () => {
    expect(cardNumberParts('visa', '4111111111111111', '9999')).toEqual([
      { text: '4111 1111 1111 1111', placeholder: false },
    ]);
  });
});

describe('cardSurfaceStyle', () => {
  it('paints each network in its own gradient', () => {
    const [start, end] = creditCard.gradients.visa;

    expect(cardSurfaceStyle('visa'))
      .toEqual({ backgroundImage: `linear-gradient(135deg, ${start}, ${end})` });
  });

  it('has a gradient for every network', () => {
    expect(Object.keys(creditCard.gradients).sort()).toEqual([...CARD_NETWORKS].sort());
  });
});

describe('chipStyle', () => {
  it('paints the chip gold', () => {
    const [light, dark] = creditCard.chip;

    expect(chipStyle()).toEqual({ backgroundImage: `linear-gradient(135deg, ${light}, ${dark})` });
  });
});

describe('LOGO_BADGE', () => {
  it('sits the logo on the theme’s light ink, the generic glyph drawn dark', () => {
    expect(LOGO_BADGE).toContain('bg-ink');
    expect(LOGO_BADGE).toContain('text-bg');
  });
});
