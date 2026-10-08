import { describe, expect, it } from 'vitest';
import { resolveBackupConfig } from '../../src/config';

describe('resolveBackupConfig', () => {
  it('defaults to the XDG data directory under home, keeping 30', () => {
    expect(resolveBackupConfig({}, '/home/me'))
      .toEqual({ dir: '/home/me/.local/share/financas/backups', keep: 30 });
  });

  it('honours XDG_DATA_HOME', () => {
    expect(resolveBackupConfig({ XDG_DATA_HOME: '/data' }, '/home/me').dir)
      .toBe('/data/financas/backups');
  });

  it('honours BACKUP_DIR and BACKUP_KEEP', () => {
    expect(resolveBackupConfig({ BACKUP_DIR: '/mnt/bk', BACKUP_KEEP: '7' }, '/home/me'))
      .toEqual({ dir: '/mnt/bk', keep: 7 });
  });

  it.each(['0', '-1', '2.5', 'many'])('rejects BACKUP_KEEP=%s', (keep) => {
    expect(() => resolveBackupConfig({ BACKUP_KEEP: keep }, '/home/me')).toThrow(/BACKUP_KEEP/);
  });
});
