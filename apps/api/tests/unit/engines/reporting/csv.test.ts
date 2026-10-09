import { describe, expect, it } from 'vitest';
import { encodeCell, toCsv, type CsvColumn } from '../../../../src/engines/reporting/csv';

describe('encodeCell', () => {
  it.each([
    ['plain', 'abc', 'abc'],
    ['a number', 42, '42'],
    ['null', null, ''],
    ['undefined', undefined, ''],
    ['a comma', 'a,b', '"a,b"'],
    ['a quote', 'say "hi"', '"say ""hi"""'],
    ['a line break', 'a\nb', '"a\nb"'],
    ['a formula', '=SUM(A1)', "'=SUM(A1)"],
    ['a leading +', '+55 11', "'+55 11"],
    ['a leading @', '@cmd', "'@cmd"],
    ['a formula with a comma', '=1,2', '"\'=1,2"'],
  ])('encodes %s', (_case, value, expected) => {
    expect(encodeCell(value)).toBe(expected);
  });

  it('leaves negative numbers alone (only text can be a formula)', () => {
    expect(encodeCell(-1050)).toBe('-1050');
  });
});

describe('toCsv', () => {
  interface Row { id: string; note: string | null }
  const columns: CsvColumn<Row>[] = [
    { header: 'id', value: (row) => row.id },
    { header: 'note', value: (row) => row.note },
  ];

  it('writes a header and one CRLF-terminated line per row', () => {
    expect(toCsv(columns, [{ id: '1', note: 'a, b' }, { id: '2', note: null }]))
      .toBe('id,note\r\n1,"a, b"\r\n2,\r\n');
  });

  it('writes only the header when there are no rows', () => {
    expect(toCsv(columns, [])).toBe('id,note\r\n');
  });
});
