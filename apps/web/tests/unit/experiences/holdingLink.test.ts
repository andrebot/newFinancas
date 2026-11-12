import { describe, expect, it } from 'vitest';
import holdingLinkOf from '../../../src/experiences/holdingLink';

// Where a link to one Holding leads (BDT: unit, pure).

describe('holdingLinkOf (OQ-243)', () => {
  it('opens Investments\' Holdings tab on the Holding', () => {
    expect(holdingLinkOf('h 1')).toBe('/investments?tab=holdings&holding=h+1');
  });
});
