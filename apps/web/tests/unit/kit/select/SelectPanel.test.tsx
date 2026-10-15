import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { optionClasses, OptionSlot, sectionOffsets } from '../../../../src/kit/select/SelectPanel';

// Kit helpers (BDT: Utility → unit, nothing mocked): the option row's look,
// the slots and where each section starts. The panel's parts are drawn
// through the Select tests.

describe('optionClasses', () => {
  it('highlights the option the keyboard or pointer is on', () => {
    expect(optionClasses(true, false)).toContain('bg-ink/5');
    expect(optionClasses(false, false)).not.toContain('bg-ink/5');
    expect(optionClasses(false, false)).toContain('cursor-pointer');
  });

  it('fades a disabled option and never highlights it', () => {
    const classes = optionClasses(true, true);
    expect(classes).toContain('opacity-45');
    expect(classes).toContain('cursor-not-allowed');
    expect(classes).not.toContain('bg-ink/5');
  });
});

describe('OptionSlot', () => {
  it('draws its content muted', () => {
    const { container } = render(<OptionSlot>BRL</OptionSlot>);

    expect((container.firstChild as HTMLElement).className).toContain('text-muted');
  });

  it('draws nothing when empty', () => {
    const { container } = render(<OptionSlot>{undefined}</OptionSlot>);

    expect(container.firstChild).toBeNull();
  });
});

describe('sectionOffsets', () => {
  it('numbers each section from where the previous one ended', () => {
    const option = { value: 'a', label: 'A' };
    const sections = [
      { options: [option, option] },
      { label: 'G', options: [option] },
      { options: [option, option, option] },
    ];

    expect(sectionOffsets(sections)).toEqual([0, 2, 3]);
  });

  it('gives nothing for no sections', () => {
    expect(sectionOffsets([])).toEqual([]);
  });
});
