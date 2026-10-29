import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import {
  Avatar, avatarClasses, avatarInitials, avatarTone,
} from '../../../../src/kit/avatar/Avatar';
import { avatar } from '../../../../src/config/constants';

// Kit component (BDT: Interaction tier → unit): pure rendering, nothing mocked.

describe('avatarInitials', () => {
  it('takes the first letter of each name', () => {
    expect(avatarInitials('Jane', 'Doe')).toBe('JD');
  });

  it('uppercases and ignores surrounding spaces', () => {
    expect(avatarInitials('  élodie', ' ñúñez ')).toBe('ÉÑ');
  });

  it('keeps a character outside the BMP whole', () => {
    expect(avatarInitials('𝒜da', 'Lee')).toBe('𝒜L');
  });

  it('skips a blank name', () => {
    expect(avatarInitials('Jane', '   ')).toBe('J');
  });
});

describe('avatarTone', () => {
  it('gives the signed-in user mint', () => {
    expect(avatarTone('any-id', true)).toBe('mint');
  });

  it('gives a member one of the member tones, the same every time', () => {
    const tone = avatarTone('3f1c9a52-7d1e-4b8a-9c0f-2a6b5e4d1c33', false);

    expect(avatar.memberTones).toContain(tone);
    expect(avatarTone('3f1c9a52-7d1e-4b8a-9c0f-2a6b5e4d1c33', false)).toBe(tone);
  });

  it('spreads members over every member tone', () => {
    const tones = new Set(['a', 'b', 'c', 'd', 'e', 'f'].map((id) => avatarTone(id, false)));

    expect([...tones].sort()).toEqual([...avatar.memberTones].sort());
  });
});

describe('avatarClasses', () => {
  it('draws a tinted circle in the display font', () => {
    expect(avatarClasses('mint', 'md'))
      .toContain('grid shrink-0 place-items-center rounded-full font-display font-extrabold');
  });

  it('tints each tone at 15% with its own ink', () => {
    expect(avatarClasses('mint', 'md')).toContain('bg-mint/15 text-mint');
    expect(avatarClasses('sky', 'md')).toContain('bg-sky/15 text-sky');
    expect(avatarClasses('sun', 'md')).toContain('bg-sun/15 text-sun');
    expect(avatarClasses('lilac', 'md')).toContain('bg-lilac/15 text-lilac');
  });

  it('sizes the circle as the mockups do', () => {
    expect(avatarClasses('mint', 'md')).toContain('size-10 type-body');
    expect(avatarClasses('mint', 'lg')).toContain('size-16 type-heading-lg');
  });

  it('appends the caller’s classes', () => {
    expect(avatarClasses('mint', 'md', 'ml-2').endsWith(' ml-2')).toBe(true);
  });
});

describe('Avatar', () => {
  it('shows the initials in a medium circle by default, hidden from screen readers', () => {
    const { container } = render(<Avatar firstName="Alex" lastName="Rivera" tone="sky" />);

    const circle = container.firstElementChild!;
    expect(circle.textContent).toBe('AR');
    expect(circle.getAttribute('aria-hidden')).toBe('true');
    expect(circle.className).toBe(avatarClasses('sky', 'md'));
  });

  it('takes its size and extra classes', () => {
    const { container } = render(
      <Avatar firstName="Jane" lastName="Doe" tone="mint" size="lg" className="ml-1" />,
    );

    expect(container.firstElementChild!.className).toBe(avatarClasses('mint', 'lg', 'ml-1'));
  });
});
