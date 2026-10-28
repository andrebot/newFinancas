import { describe, expect, it } from 'vitest';
import yearMonths from '../../../../src/engines/reporting/months';

describe('yearMonths', () => {
  it('lists January to December of the year', () => {
    const months = yearMonths(2026);

    expect(months).toHaveLength(12);
    expect(months[0]).toEqual({ year: 2026, month: 1 });
    expect(months[11]).toEqual({ year: 2026, month: 12 });
  });
});
