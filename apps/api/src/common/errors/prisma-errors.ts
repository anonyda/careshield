import { Prisma } from '@prisma/client';

const normalise = (name: string) => name.replace(/_/g, '').toLowerCase();

/**
 * True for a unique-constraint violation (P2002), optionally only when it involves `field`.
 * Prisma may report the target as model fields or column names, so both spellings match.
 */
export function isUniqueViolation(error: unknown, field?: string): boolean {
  if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== 'P2002') {
    return false;
  }
  if (!field) return true;

  const target: unknown = error.meta?.target;
  const names = Array.isArray(target)
    ? target.map(String)
    : [typeof target === 'string' ? target : ''];
  return names.some((name) => normalise(name).includes(normalise(field)));
}
