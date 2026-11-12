import {
  afterEach, describe, expect, it, vi,
} from 'vitest';
import downloadTextFile from '../../../src/utilities/downloadTextFile';

// Utility (BDT: unit, only the external sink mocked): the browser's object
// URLs and the download a link click starts.

afterEach(() => {
  vi.restoreAllMocks();
});

describe('downloadTextFile', () => {
  it('saves the text under the name, then frees the object URL', async () => {
    const createObjectURL = vi.fn((_blob: Blob) => 'blob:codes');
    const revokeObjectURL = vi.fn();
    Object.assign(URL, { createObjectURL, revokeObjectURL });
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function record(
      this: HTMLAnchorElement,
    ) {
      expect([this.href, this.download]).toEqual(['blob:codes', 'backup-codes.txt']);
    });

    downloadTextFile('backup-codes.txt', 'AAAA-BBBB\n');

    expect(click).toHaveBeenCalledTimes(1);
    const blob = createObjectURL.mock.calls[0]![0];
    expect(blob.type).toBe('text/plain;charset=utf-8');
    expect(await blob.text()).toBe('AAAA-BBBB\n');
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:codes');
  });

  it('saves a CSV with its own type (OQ-243)', () => {
    const createObjectURL = vi.fn((_blob: Blob) => 'blob:csv');
    Object.assign(URL, { createObjectURL, revokeObjectURL: vi.fn() });
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});

    downloadTextFile('audit-log.csv', 'a,b\r\n', 'text/csv');

    expect(createObjectURL.mock.calls[0]![0].type).toBe('text/csv;charset=utf-8');
  });
});
