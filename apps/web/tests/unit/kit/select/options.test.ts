import { describe, expect, it } from 'vitest';
import {
  filterSections, findOption, flattenSections, isGroup,
  normalizeForSearch, toSections, type SelectEntry,
} from '../../../../src/kit/select/options';

// Kit helper (BDT: Utility → unit, nothing mocked): sections, flattening
// and search.

type Category = 'moradia' | 'aluguel' | 'luz' | 'mercado' | 'saude' | 'lazer';

const entries: readonly SelectEntry<Category>[] = [
  { value: 'mercado', label: 'Mercado' },
  { value: 'saude', label: 'Saúde', disabledReason: 'em Essenciais' },
  {
    group: 'Moradia',
    options: [{ value: 'aluguel', label: 'Aluguel' }, { value: 'luz', label: 'Luz' }],
  },
  { value: 'lazer', label: 'Lazer' },
];

describe('isGroup', () => {
  it('tells a group from a loose option', () => {
    expect(isGroup(entries[2]!)).toBe(true);
    expect(isGroup(entries[0]!)).toBe(false);
  });
});

describe('toSections', () => {
  it('joins consecutive loose options and gives each group its own section', () => {
    const sections = toSections(entries);

    expect(sections.map((section) => section.label)).toEqual([undefined, 'Moradia', undefined]);
    expect(sections.map((section) => section.options.map((option) => option.value)))
      .toEqual([['mercado', 'saude'], ['aluguel', 'luz'], ['lazer']]);
  });

  it('gives nothing for an empty list', () => {
    expect(toSections([])).toEqual([]);
  });
});

describe('flattenSections', () => {
  it('lists the options in display order', () => {
    expect(flattenSections(toSections(entries)).map((option) => option.value))
      .toEqual(['mercado', 'saude', 'aluguel', 'luz', 'lazer']);
  });
});

describe('findOption', () => {
  it('finds a value inside a group as well as a loose one', () => {
    expect(findOption(entries, 'luz')?.label).toBe('Luz');
    expect(findOption(entries, 'mercado')?.label).toBe('Mercado');
  });

  it('finds nothing while no value is chosen', () => {
    expect(findOption(entries, null)).toBeUndefined();
  });
});

describe('normalizeForSearch', () => {
  it('drops case, accents and outer spaces', () => {
    expect(normalizeForSearch('  Saúde e Ação ')).toBe('saude e acao');
  });
});

describe('filterSections', () => {
  const sections = toSections(entries);

  it('keeps everything for an empty or blank search', () => {
    expect(filterSections(sections, '')).toBe(sections);
    expect(filterSections(sections, '   ')).toBe(sections);
  });

  it('matches labels ignoring case and accents, dropping empty sections', () => {
    const found = filterSections(sections, 'SAUDE');

    expect(flattenSections(found).map((option) => option.value)).toEqual(['saude']);
    expect(found).toHaveLength(1);
  });

  it('keeps a whole group when its heading matches', () => {
    const found = filterSections(sections, 'morad');

    expect(found).toEqual([sections[1]]);
  });

  it('keeps only the matching options of a group whose heading doesn’t match', () => {
    const found = filterSections(sections, 'luz');

    expect(found).toEqual([{ label: 'Moradia', options: [{ value: 'luz', label: 'Luz' }] }]);
  });

  it('gives nothing when nothing matches', () => {
    expect(filterSections(sections, 'viagem')).toEqual([]);
  });
});
