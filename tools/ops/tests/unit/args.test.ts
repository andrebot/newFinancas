import { describe, expect, it } from 'vitest';
import { parseRestoreArgs } from '../../src/args';

describe('parseRestoreArgs', () => {
  it('defaults to the newest backup, into the scratch database', () => {
    expect(parseRestoreArgs([])).toEqual({ intoLive: false });
  });

  it('reads a file and --into-live in any order', () => {
    expect(parseRestoreArgs(['--into-live', 'a.dump'])).toEqual({ intoLive: true, file: 'a.dump' });
  });

  it('ignores a bare -- separator', () => {
    expect(parseRestoreArgs(['--', '--into-live'])).toEqual({ intoLive: true });
  });

  it('rejects unknown options', () => {
    expect(() => parseRestoreArgs(['--force'])).toThrow(/Unknown option: --force/);
  });

  it('rejects more than one file', () => {
    expect(() => parseRestoreArgs(['a.dump', 'b.dump'])).toThrow(/at most one/);
  });
});
