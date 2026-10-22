import { fireEvent, render, screen } from '@testing-library/react';
import {
  describe, expect, it, vi,
} from 'vitest';
import {
  OpenableCard, openableCardClasses, openerClasses,
} from '../../../../src/kit/card/OpenableCard';

// Kit component (BDT: Interaction tier → unit): pure rendering, nothing mocked
// but the opener it emits to.

describe('openableCardClasses', () => {
  it('lifts only a card that opens on hover, after the caller\'s layout', () => {
    expect(openableCardClasses(true, 'flex flex-col gap-3')).toBe(
      'relative flex flex-col gap-3 cursor-pointer transition-colors hover:border-muted',
    );
    expect(openableCardClasses(false, 'flex flex-col gap-3')).toBe('relative flex flex-col gap-3');
    expect(openableCardClasses(false)).toBe('relative');
  });
});

describe('openerClasses', () => {
  it('stretches the name button over the card only while it opens', () => {
    expect(openerClasses(true)).toContain('after:absolute after:inset-0');
    expect(openerClasses(false)).toBe('min-w-0 flex-1 break-words text-left');
  });
});

describe('OpenableCard', () => {
  it('opens its item from its one button, named by the item', () => {
    const onOpen = vi.fn();
    render(
      <OpenableCard
        name="Fun Money"
        nameClassName="type-heading-sm"
        aside={<span>USD</span>}
        onOpen={onOpen}
      >
        <p>Covers</p>
      </OpenableCard>,
    );
    const opener = screen.getByRole('button', { name: 'Fun Money' });

    fireEvent.click(opener);
    expect(onOpen).toHaveBeenCalledTimes(1);
    expect(screen.getAllByRole('button')).toHaveLength(1);
    expect(opener.className).toContain('after:inset-0');
    expect(opener.closest('section')?.className).toContain('relative');
    expect(screen.getByText('Fun Money').className).toBe('type-heading-sm');
    expect(screen.getByText('USD')).toBeTruthy();
    expect(screen.getByText('Covers')).toBeTruthy();
  });

  it('is a plain card without an opener: its name a disabled button', () => {
    render(<OpenableCard name="Cards" />);
    const name = screen.getByRole<HTMLButtonElement>('button', { name: 'Cards' });

    expect(name.disabled).toBe(true);
    expect(name.className).not.toContain('after:inset-0');
    expect(name.closest('section')?.className).not.toContain('cursor-pointer');
  });
});
