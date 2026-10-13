import { describe, expect, it } from 'vitest';
import { graphicRole } from '../../../../src/kit/icons/graphicRole';

describe('graphicRole', () => {
  it('names a labelled graphic as an image', () => {
    expect(graphicRole('Visa')).toEqual({ role: 'img', 'aria-label': 'Visa' });
  });

  it.each([undefined, ''])('hides an unlabelled graphic (%j)', (label) => {
    expect(graphicRole(label)).toEqual({ 'aria-hidden': true });
  });
});
