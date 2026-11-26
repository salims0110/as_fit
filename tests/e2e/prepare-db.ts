import { execFileSync, execSync } from 'node:child_process';

// Recreates the *_test database, then migrates and seeds it. Runs before the E2E web server starts.
const url = process.env.DATABASE_URL ?? '';
const parsed = url ? new URL(url) : null;
const dbName = parsed ? parsed.pathname.slice(1) : '';
if (!/^[a-zA-Z0-9_]+_test$/.test(dbName)) {
  throw new Error(`Refusing to reset non-test database "${dbName}"`);
}

function resolveTargetContainer(): string {
  if (process.env.E2E_DB_CONTAINER?.trim()) return process.env.E2E_DB_CONTAINER.trim();
  try {
    const running = execFileSync('docker', ['ps', '--filter', 'name=^asfit-test-db$', '--format', '{{.Names}}'], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim();
    if (running === 'asfit-test-db') return 'asfit-test-db';
  } catch {
    // Fall back to default container name below
  }
  return 'asfit-db';
}

const container = resolveTargetContainer();
const dbUser = parsed?.username ? decodeURIComponent(parsed.username) : 'asfit';

const psql = (sql: string) =>
  execFileSync('docker', ['exec', container, 'psql', '-U', dbUser, '-d', 'postgres', '-v', 'ON_ERROR_STOP=1', '-c', sql], {
    stdio: 'pipe',
  });

psql(`DROP DATABASE IF EXISTS "${dbName}" WITH (FORCE)`);
psql(`CREATE DATABASE "${dbName}"`);
execSync('pnpm exec drizzle-kit migrate', { stdio: 'pipe' });
execSync('pnpm exec tsx src/server/db/seed.ts', { stdio: 'inherit' });
