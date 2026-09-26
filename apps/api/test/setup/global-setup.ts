import { execSync } from 'node:child_process';
import { join } from 'node:path';
import { useTestDatabase } from './env';

/** Applies migrations to the test schema once before the e2e suite runs. */
export default function globalSetup(): void {
  useTestDatabase();
  execSync('npx prisma migrate deploy', {
    cwd: join(__dirname, '..', '..'),
    env: process.env,
    stdio: 'inherit',
  });
}
