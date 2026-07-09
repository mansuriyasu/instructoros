import { type DecodedIdToken } from 'firebase-admin/auth';
import { NextRequest, NextResponse } from 'next/server';
import { getAdminAuth } from '@/lib/server/firebase-admin';

export class RequestSecurityError extends Error {
  constructor(message: string, public readonly status: number) {
    super(message);
    this.name = 'RequestSecurityError';
  }
}

type RateLimitEntry = { count: number; resetAt: number };
const rateLimits = new Map<string, RateLimitEntry>();

function getBearerToken(request: NextRequest | Request) {
  const header = request.headers.get('authorization') || '';
  const match = header.match(/^Bearer\s+(.+)$/i);
  return match?.[1] || '';
}

export async function requireAuthenticatedUser(request: NextRequest | Request): Promise<DecodedIdToken> {
  const token = getBearerToken(request);
  if (!token) {
    throw new RequestSecurityError('Please sign in before using this feature.', 401);
  }

  try {
    return await getAdminAuth().verifyIdToken(token);
  } catch {
    throw new RequestSecurityError('Your sign-in session has expired. Please sign in again.', 401);
  }
}

export function enforceRateLimit(key: string, limit: number, windowMs: number) {
  const now = Date.now();
  const current = rateLimits.get(key);
  const entry = !current || current.resetAt <= now
    ? { count: 0, resetAt: now + windowMs }
    : current;

  entry.count += 1;
  rateLimits.set(key, entry);

  if (rateLimits.size > 2_000) {
    for (const [existingKey, value] of rateLimits) {
      if (value.resetAt <= now) rateLimits.delete(existingKey);
    }
  }

  if (entry.count > limit) {
    throw new RequestSecurityError('Too many requests. Please wait a few minutes and try again.', 429);
  }
}

export async function requireRateLimitedUser(request: NextRequest | Request, feature: string, limit = 12) {
  const user = await requireAuthenticatedUser(request);
  enforceRateLimit(`${feature}:${user.uid}`, limit, 15 * 60 * 1000);
  return user;
}

export function requestSecurityErrorResponse(error: unknown, fallback: string) {
  if (error instanceof RequestSecurityError) {
    return NextResponse.json({ ok: false, error: error.message }, { status: error.status });
  }

  return NextResponse.json({ ok: false, error: fallback }, { status: 500 });
}
