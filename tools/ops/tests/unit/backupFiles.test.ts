import { describe, expect, it } from 'vitest';
import {
  backupFileName, backupsToPrune, isBackupFile, latestBackup, newestFirst,
} from '../../src/backupFiles';

const OLD = 'financas-20261001T000000Z.dump';
const MID = 'financas-20261005T120000Z.dump';
const NEW = 'financas-20261008T143005Z.dump';

describe('backupFileName', () => {
  it('stamps the UTC moment, without milliseconds', () => {
    expect(backupFileName(new Date('2026-10-08T14:30:05.123Z'))).toBe(NEW);
  });
});

describe('isBackupFile', () => {
  it.each([OLD, NEW])('accepts %s', (name) => {
    expect(isBackupFile(name)).toBe(true);
  });

  it.each(['notes.txt', 'financas-2026.dump', `${NEW}.tmp`, 'other-20261008T143005Z.dump'])(
    'rejects %s',
    (name) => {
      expect(isBackupFile(name)).toBe(false);
    },
  );
});

describe('newestFirst / latestBackup', () => {
  it('orders backups newest first and ignores other files', () => {
    expect(newestFirst([MID, 'notes.txt', NEW, OLD])).toEqual([NEW, MID, OLD]);
    expect(latestBackup([MID, NEW, OLD])).toBe(NEW);
  });

  it('has no latest backup in an empty directory', () => {
    expect(latestBackup(['notes.txt'])).toBeUndefined();
  });
});

describe('backupsToPrune', () => {
  it('returns everything beyond the newest `keep`', () => {
    expect(backupsToPrune([OLD, NEW, MID, 'notes.txt'], 2)).toEqual([OLD]);
  });

  it('prunes nothing while within the retention', () => {
    expect(backupsToPrune([OLD, NEW], 30)).toEqual([]);
  });
});
