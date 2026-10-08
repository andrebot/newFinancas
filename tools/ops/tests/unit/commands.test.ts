import { describe, expect, it } from 'vitest';
import {
  countMismatches, createDatabaseCommand, dropDatabaseCommand, dumpCommand, parseRowCounts,
  restoreCommand, rowCountsCommand,
} from '../../src/commands';

describe('container commands', () => {
  it('run every client tool inside the db service, without a TTY', () => {
    [dumpCommand(), dropDatabaseCommand('x'), createDatabaseCommand('x'), restoreCommand('x'),
      rowCountsCommand('x')].forEach((command) => {
      expect(command.slice(0, 4)).toEqual(['compose', 'exec', '-T', 'db']);
    });
  });

  it('dump the live database in custom format as the owner', () => {
    expect(dumpCommand().slice(4))
      .toEqual(['pg_dump', '--username', 'financas', '--format', 'custom', 'financas']);
  });

  it('drop forcefully and only if present; create owned by the owner role', () => {
    expect(dropDatabaseCommand('financas_restore')).toContain('--force');
    expect(dropDatabaseCommand('financas_restore')).toContain('--if-exists');
    expect(createDatabaseCommand('financas_restore').slice(-3))
      .toEqual(['--owner', 'financas', 'financas_restore']);
  });

  it('restore into the named database and stop on the first error', () => {
    expect(restoreCommand('financas_restore')).toEqual(expect.arrayContaining([
      'pg_restore', '--dbname', 'financas_restore', '--exit-on-error',
    ]));
  });

  it('count rows with unaligned, tuple-only psql output', () => {
    expect(rowCountsCommand('financas')).toEqual(expect.arrayContaining([
      'psql', '--dbname', 'financas', '--no-align', '--tuples-only',
    ]));
  });
});

describe('parseRowCounts', () => {
  it('reads table|count lines and skips blanks', () => {
    expect(parseRowCounts('accounts|3\nusers|12\n\n')).toEqual({ accounts: 3, users: 12 });
  });
});

describe('countMismatches', () => {
  it('reports nothing for identical counts', () => {
    expect(countMismatches({ a: 1, b: 2 }, { b: 2, a: 1 })).toEqual([]);
  });

  it('reports differing and missing tables, sorted', () => {
    expect(countMismatches({ users: 3, accounts: 1 }, { users: 2, extra: 0 })).toEqual([
      'accounts: expected 1, got missing',
      'extra: expected missing, got 0',
      'users: expected 3, got 2',
    ]);
  });
});
