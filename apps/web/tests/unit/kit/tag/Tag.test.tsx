import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Tag, tagClasses } from '../../../../src/kit/tag/Tag';

// Kit component (BDT: Interaction tier → unit): pure rendering, nothing mocked.

describe('tagClasses', () => {
  it('draws a rounded pill that never wraps', () => {
    expect(tagClasses('neutral', 'md'))
      .toContain('inline-flex shrink-0 items-center whitespace-nowrap rounded-full');
  });

  it('tints each tone with its own colour', () => {
    expect(tagClasses('neutral', 'md')).toContain('bg-raised text-muted');
    expect(tagClasses('mint', 'md')).toContain('bg-mint/10 text-mint');
    expect(tagClasses('sky', 'md')).toContain('bg-sky/10 text-sky');
    expect(tagClasses('sun', 'md')).toContain('bg-sun/10 text-sun');
    expect(tagClasses('coral', 'md')).toContain('bg-coral/10 text-coral');
  });

  it('sizes the pill as the mockups do', () => {
    expect(tagClasses('neutral', 'md')).toContain('h-5.5');
    expect(tagClasses('neutral', 'sm')).toContain('h-5 ');
    expect(tagClasses('neutral', 'micro')).toContain('type-micro');
  });

  it('appends the caller’s classes', () => {
    expect(tagClasses('neutral', 'md', 'w-fit').endsWith(' w-fit')).toBe(true);
  });
});

describe('Tag', () => {
  it('is a neutral medium pill holding its text by default', () => {
    render(<Tag>USD</Tag>);

    expect(screen.getByText('USD').className).toBe(tagClasses('neutral', 'md'));
  });

  it('takes its tone, size and extra classes', () => {
    render(<Tag tone="sky" size="sm" className="ml-1">Compartilhada</Tag>);

    expect(screen.getByText('Compartilhada').className).toBe(tagClasses('sky', 'sm', 'ml-1'));
  });

  it('draws no icon unless given one', () => {
    const { container } = render(<Tag>v2</Tag>);

    expect(container.querySelector('svg')).toBeNull();
  });

  it('leads with a decorative icon sized to the tag', () => {
    const { container } = render(<Tag icon="group-outline">Shared</Tag>);

    const icon = container.querySelector('svg')!;
    expect(icon.getAttribute('aria-hidden')).toBe('true');
    expect(icon.getAttribute('class')).toBe('size-3.5');
    expect(container.firstElementChild!.firstElementChild).toBe(icon);
  });

  it('shrinks the icon on the micro tag', () => {
    const { container } = render(<Tag size="micro" icon="lock-outline">v2</Tag>);

    expect(container.querySelector('svg')!.getAttribute('class')).toBe('size-3');
  });
});
