// Composition root for the local operations (OQ-97): wires real I/O into the
// tested operations and maps the command line to one of them. No logic lives
// here, so it is excluded from unit coverage; the restore drill exercises it.
import { spawn } from 'node:child_process';
import { createReadStream, createWriteStream } from 'node:fs';
import {
  access, chmod, mkdir, readdir, readFile, rm, writeFile,
} from 'node:fs/promises';
import { randomBytes } from 'node:crypto';
import os from 'node:os';
import path from 'node:path';
import { pipeline } from 'node:stream/promises';
import { createLogger, logger as rootLogger } from '@financas/logging';
import { parseRestoreArgs } from './args';
import { resolveBackupConfig } from './config';
import { fillSecrets } from './envSecrets';
import {
  runBackup, runRestore, runRestoreDrill, type DockerFiles, type OpsDeps,
} from './operations';

const REPO_ROOT = path.resolve(import.meta.dirname, '../../..');

// Every message goes through the shared logger (OQ-110): console + ops-*.log.
const logger = createLogger({ label: 'ops', actor: 'system' });

const docker: OpsDeps['docker'] = async (args, files: DockerFiles = {}) => {
  const child = spawn('docker', [...args], { cwd: REPO_ROOT, stdio: ['pipe', 'pipe', 'inherit'] });
  const exited = new Promise<number | null>((resolve, reject) => {
    child.on('error', reject);
    child.on('close', resolve);
  });
  const input = files.stdin
    ? pipeline(createReadStream(files.stdin), child.stdin)
    : child.stdin.end();
  const chunks: Buffer[] = [];
  const output = files.stdout
    ? pipeline(child.stdout, createWriteStream(files.stdout, { mode: 0o600 }))
    : child.stdout.forEach((chunk: Buffer) => {
      chunks.push(chunk);
    });
  await Promise.all([input, output]);
  const code = await exited;
  if (code !== 0) throw new Error(`docker ${args.join(' ')} exited with ${code}`);
  return Buffer.concat(chunks).toString('utf8');
};

const deps: OpsDeps = {
  docker,
  listDir: (dir) => readdir(dir).catch(() => []),
  // Backups hold household financial data: owner-only directory and files.
  ensureDir: async (dir) => {
    await mkdir(dir, { recursive: true, mode: 0o700 });
  },
  remove: (file) => rm(file),
  exists: (file) => access(file).then(() => true, () => false),
  now: () => new Date(),
  log: (message) => logger.info(message),
};

const config = resolveBackupConfig(process.env, os.homedir());
const [command, ...rest] = process.argv.slice(2);

const commands: Record<string, () => Promise<unknown>> = {
  backup: () => runBackup(deps, config),
  restore: () => runRestore(deps, config, parseRestoreArgs(rest)),
  'env-secrets': async () => {
    const envFile = path.join(REPO_ROOT, '.env');
    const generate = (key: string) => (key === 'MFA_ENCRYPTION_KEY'
      ? randomBytes(32).toString('base64')
      : randomBytes(48).toString('base64url'));
    const result = fillSecrets(await readFile(envFile, 'utf8'), generate);
    await writeFile(envFile, result.text);
    // It now holds secrets: owner-only, even if the file already existed.
    await chmod(envFile, 0o600);
    const list = (keys: string[]) => keys.join(', ') || 'none';
    logger.info(`Generated: ${list(result.filled)}; kept: ${list(result.kept)}`);
  },
  'restore-drill': async () => {
    const result = await runRestoreDrill(deps, config);
    const { tables, mismatches } = result;
    logger.info(`Drill: ${tables} tables compared, ${mismatches.length} mismatch(es)`);
    result.mismatches.forEach((line) => logger.warn(`  ${line}`));
    if (result.mismatches.length > 0) process.exitCode = 1;
  },
};

const run = command ? commands[command] : undefined;

if (!run) {
  logger.error('Usage: ops <backup | restore [file] [--into-live] | restore-drill | env-secrets>');
  process.exitCode = 2;
  rootLogger.end();
} else {
  run()
    .catch((error: unknown) => {
      logger.error(error instanceof Error ? error.message : String(error));
      process.exitCode = 1;
    })
    // Close the log file so the process can exit.
    .finally(() => rootLogger.end());
}
