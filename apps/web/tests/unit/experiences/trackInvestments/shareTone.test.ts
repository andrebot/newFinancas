import { describe, expect, it } from 'vitest';
import shareTone from '../../../../src/experiences/trackInvestments/shareTone';

// A share's colour by its place (BDT: pure helper, unit, nothing mocked).

describe('shareTone', () => {
  it('colours by place, largest first, and repeats past the last tone', () => {
    expect(shareTone(0)).toBe('mint');
    expect(shareTone(1)).toBe('sky');
    expect(shareTone(8)).toBe('mint');
  });
});
