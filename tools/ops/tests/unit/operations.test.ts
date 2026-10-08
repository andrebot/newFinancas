import {
  describe, expect, it, vi,
} from 'vitest';
import {
  resolveBackupPath, restoreInto, runBackup, runRestore, runRestoreDrill,
  type DockerFiles, type OpsDeps,
} from '../../src/operations';

const DIR = '/bk';
const CONFIG = { dir: DIR, keep: 2 };
const NOW = new Date('2026-10-08T14:30:05Z');
const NEW = 'financas-20261008T143005Z.dump';
const OLDER = ['financas-20261001T000000Z.dump', 'financas-20261005T000000Z.dump'];

/**
 * Builds fake I/O: a directory listing, existing files, and canned `docker` output.
 *
 * @param options - Directory contents, existing paths and per-command stdout.
 * @param options.files - Names listed in the backup directory.
 * @param options.existing - Paths `exists` reports as present.
 * @param options.stdout - Returns stdout for a docker command line.
 * @returns The fake dependencies, with spies.
 */
const fakeDeps = (options: {
  files?: string[];
  existing?: string[];
  stdout?: (args: readonly string[]) => string;
} = {}) => ({
  docker: vi.fn(async (args: readonly string[], _files?: DockerFiles) => (
    options.stdout?.(args) ?? ''
  )),
  listDir: vi.fn(async () => options.files ?? []),
  ensureDir: vi.fn(async () => {}),
  remove: vi.fn(async () => {}),
  exists: vi.fn(async (file: string) => (options.existing ?? []).includes(file)),
  now: () => NOW,
  log: vi.fn(),
}) satisfies OpsDeps;

/**
 * Lists the client tool of every docker call, in order (e.g. `dropdb financas_restore`).
 *
 * @param deps - Fake dependencies after a run.
 * @returns One `tool database` entry per call.
 */
const toolCalls = (deps: ReturnType<typeof fakeDeps>) => deps.docker.mock.calls.map(
  ([args]) => `${args[4]} ${args.at(-1)}`,
);

describe('runBackup', () => {
  it('dumps into a timestamped file in the backup directory', async () => {
    const deps = fakeDeps({ files: [NEW] });

    expect(await runBackup(deps, CONFIG)).toBe(`${DIR}/${NEW}`);
    expect(deps.ensureDir).toHaveBeenCalledWith(DIR);
    expect(deps.docker)
      .toHaveBeenCalledWith(expect.arrayContaining(['pg_dump']), { stdout: `${DIR}/${NEW}` });
    expect(deps.remove).not.toHaveBeenCalled();
  });

  it('prunes backups beyond the retention, oldest first', async () => {
    const deps = fakeDeps({ files: [...OLDER, NEW] });

    await runBackup(deps, CONFIG);

    expect(deps.remove).toHaveBeenCalledTimes(1);
    expect(deps.remove).toHaveBeenCalledWith(`${DIR}/${OLDER[0]}`);
    expect(deps.log).toHaveBeenCalledWith('Pruned 1 old backup(s), keeping 2');
  });
});

describe('resolveBackupPath', () => {
  it('uses the newest backup when no file is given', async () => {
    const deps = fakeDeps({ files: [...OLDER, NEW], existing: [`${DIR}/${NEW}`] });

    expect(await resolveBackupPath(deps, CONFIG)).toBe(`${DIR}/${NEW}`);
  });

  it('treats a bare name as a file in the backup directory, and a path as is', async () => {
    const deps = fakeDeps({ existing: [`${DIR}/${NEW}`, '/elsewhere/x.dump'] });

    expect(await resolveBackupPath(deps, CONFIG, NEW)).toBe(`${DIR}/${NEW}`);
    expect(await resolveBackupPath(deps, CONFIG, '/elsewhere/x.dump')).toBe('/elsewhere/x.dump');
  });

  it('fails when there are no backups, or the file is missing', async () => {
    await expect(resolveBackupPath(fakeDeps(), CONFIG)).rejects.toThrow('No backups in /bk');
    await expect(resolveBackupPath(fakeDeps(), CONFIG, 'gone.dump'))
      .rejects.toThrow('Backup not found: /bk/gone.dump');
  });
});

describe('restoreInto', () => {
  it('recreates the database, then restores the file through stdin', async () => {
    const deps = fakeDeps();

    await restoreInto(deps, '/bk/x.dump', 'financas_restore');

    expect(toolCalls(deps)).toEqual([
      'dropdb financas_restore', 'createdb financas_restore', 'pg_restore --exit-on-error',
    ]);
    expect(deps.docker.mock.calls[2]![1]).toEqual({ stdin: '/bk/x.dump' });
  });
});

describe('runRestore', () => {
  it('restores into the scratch database by default, without a safety backup', async () => {
    const deps = fakeDeps({ files: [NEW], existing: [`${DIR}/${NEW}`] });

    expect(await runRestore(deps, CONFIG, { intoLive: false })).toBe('financas_restore');
    expect(toolCalls(deps)).not.toContain('pg_dump financas');
  });

  it('takes a safety backup before overwriting the live database', async () => {
    const deps = fakeDeps({ files: [NEW], existing: [`${DIR}/x.dump`] });

    expect(await runRestore(deps, CONFIG, { intoLive: true, file: 'x.dump' })).toBe('financas');
    expect(toolCalls(deps)).toEqual([
      'pg_dump financas', 'dropdb financas', 'createdb financas', 'pg_restore --exit-on-error',
    ]);
    expect(deps.log).toHaveBeenCalledWith(expect.stringContaining('Safety backup'));
  });
});

describe('runRestoreDrill', () => {
  const counts = (byDatabase: Record<string, string>) => (args: readonly string[]) => (
    args.includes('psql') ? byDatabase[args[args.indexOf('--dbname') + 1]!]! : ''
  );

  it('backs up, restores into scratch, compares, and drops the scratch copy', async () => {
    const deps = fakeDeps({
      files: [NEW],
      stdout: counts({ financas: 'users|2\naccounts|1', financas_restore: 'users|2\naccounts|1' }),
    });

    expect(await runRestoreDrill(deps, CONFIG))
      .toEqual({ backup: `${DIR}/${NEW}`, tables: 2, mismatches: [] });
    expect(toolCalls(deps).at(-1)).toBe('dropdb financas_restore');
  });

  it('reports tables whose counts differ', async () => {
    const deps = fakeDeps({
      files: [NEW],
      stdout: counts({ financas: 'users|2', financas_restore: 'users|1' }),
    });

    expect((await runRestoreDrill(deps, CONFIG)).mismatches).toEqual(['users: expected 2, got 1']);
  });

  it('drops the scratch copy even when comparing fails', async () => {
    const deps = fakeDeps({ files: [NEW] });
    deps.docker.mockImplementation(async (args: readonly string[]) => {
      if (args.includes('psql')) throw new Error('psql failed');
      return '';
    });

    await expect(runRestoreDrill(deps, CONFIG)).rejects.toThrow('psql failed');
    expect(toolCalls(deps).at(-1)).toBe('dropdb financas_restore');
  });
});
