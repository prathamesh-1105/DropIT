import { NextResponse } from 'next/server';

interface RateLimitRecord {
  timestamps: number[];
}

const rateLimitMap = new Map<string, RateLimitRecord>();

// Cleanup stale records periodically
setInterval(() => {
  const now = Date.now();
  for (const [key, record] of rateLimitMap.entries()) {
    record.timestamps = record.timestamps.filter((ts) => now - ts < 60000);
    if (record.timestamps.length === 0) {
      rateLimitMap.delete(key);
    }
  }
}, 60000);

export function getClientIp(req: Request): string {
  const forwarded = req.headers.get('x-forwarded-for');
  if (forwarded) {
    return forwarded.split(',')[0].trim();
  }
  const realIp = req.headers.get('x-real-ip');
  if (realIp) {
    return realIp.trim();
  }
  return '127.0.0.1';
}

export function checkRateLimit(
  req: Request,
  actionKey: string,
  maxRequests: number = 30,
  windowMs: number = 60000
): { success: boolean; response?: NextResponse } {
  const ip = getClientIp(req);
  const key = `${actionKey}:${ip}`;
  const now = Date.now();

  let record = rateLimitMap.get(key);
  if (!record) {
    record = { timestamps: [] };
    rateLimitMap.set(key, record);
  }

  // Filter timestamps within window
  record.timestamps = record.timestamps.filter((ts) => now - ts < windowMs);

  if (record.timestamps.length >= maxRequests) {
    return {
      success: false,
      response: NextResponse.json(
        { error: 'Too many requests. Please try again later.' },
        { status: 429 }
      ),
    };
  }

  record.timestamps.push(now);
  return { success: true };
}
