import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

describe('docker-compose.test.yml E2E configuration', () => {
  const compose = readFileSync(join(process.cwd(), 'docker-compose.test.yml'), 'utf8');
  const playwrightCfg = readFileSync(join(process.cwd(), 'playwright.config.ts'), 'utf8');

  it('binds ephemeral PostgreSQL 16 to loopback port 5433 with asfit_test database', () => {
    expect(compose).toContain('image: postgres:16-alpine');
    expect(compose).toContain('container_name: asfit-test-db');
    expect(compose).toContain('POSTGRES_DB: ${E2E_POSTGRES_DB:-asfit_test}');
    expect(compose).toContain('"127.0.0.1:${E2E_POSTGRES_PORT:-5433}:5432"');
  });

  it('uses tmpfs in-memory storage and a readiness healthcheck', () => {
    expect(compose).toContain('tmpfs:');
    expect(compose).toContain('/var/lib/postgresql/data');
    expect(compose).toContain('pg_isready');
  });

  it('matches playwright.config.ts default test database URL', () => {
    expect(playwrightCfg).toContain('localhost:5433/asfit_test');
  });
});
