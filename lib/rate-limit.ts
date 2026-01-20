import { NextRequest } from 'next/server';
import Redis from 'ioredis';

// Redis client singleton
let redisClient: Redis | null = null;
let redisConnectionFailed = false;

function getRedisClient(): Redis | null {
  if (redisConnectionFailed) {
    return null;
  }

  if (!redisClient) {
    const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
    
    // Check if this is an Upstash Redis connection (TLS required)
    const isUpstash = redisUrl.includes('upstash.io') || redisUrl.includes('upstash.com');
    
    try {
      const redisOptions: any = {
        maxRetriesPerRequest: 3,
        connectTimeout: 10000, // Increased timeout for cloud Redis
        lazyConnect: true,
        retryStrategy: (times: number) => {
          if (times > 3) return null; // Stop retrying
          return Math.min(times * 100, 3000); // Retry delay
        },
      };

      // Enable TLS for Upstash (required) or if URL uses rediss://
      if (isUpstash || redisUrl.startsWith('rediss://')) {
        redisOptions.tls = {};
      }

      redisClient = new Redis(redisUrl, redisOptions);

      redisClient.on('error', (err) => {
        console.error('Redis connection error:', err.message);
        redisConnectionFailed = true;
        redisClient = null;
      });

      redisClient.on('connect', () => {
        console.log('Connected to Redis' + (isUpstash ? ' (Upstash)' : ''));
        redisConnectionFailed = false;
      });

      // Attempt to connect
      redisClient.connect().catch((err) => {
        console.warn('Redis not available, falling back to in-memory rate limiting:', err.message);
        redisConnectionFailed = true;
        redisClient = null;
      });
    } catch (err) {
      console.warn('Failed to create Redis client:', err);
      redisConnectionFailed = true;
      return null;
    }
  }

  return redisClient;
}

// Fallback in-memory rate limiting (for when Redis is not available)
const inMemoryStore = new Map<string, { timestamps: number[]; dailyTimestamps: number[] }>();

// Cleanup old entries periodically
setInterval(() => {
  const now = Date.now();
  for (const [key, value] of inMemoryStore.entries()) {
    value.timestamps = value.timestamps.filter(t => now - t < 60000);
    value.dailyTimestamps = value.dailyTimestamps.filter(t => now - t < 86400000);
    
    if (value.timestamps.length === 0 && value.dailyTimestamps.length === 0) {
      inMemoryStore.delete(key);
    }
  }
}, 60000);

export interface RateLimitResult {
  success: boolean;
  remaining: number;
  remainingDaily: number;
  resetInSeconds: number;
}

export function getClientIP(request: NextRequest): string {
  const forwarded = request.headers.get('x-forwarded-for');
  const realIP = request.headers.get('x-real-ip');
  const cfConnectingIP = request.headers.get('cf-connecting-ip');
  
  if (cfConnectingIP) return cfConnectingIP;
  if (forwarded) return forwarded.split(',')[0].trim();
  if (realIP) return realIP;
  
  return 'anonymous';
}

/**
 * Redis-based sliding window rate limiting
 * Falls back to in-memory if Redis is not available
 */
export async function checkRateLimit(request: NextRequest): Promise<RateLimitResult> {
  const ip = getClientIP(request);
  const minuteLimit = parseInt(process.env.RATE_LIMIT_REQUESTS_PER_MINUTE || '15');
  const dayLimit = parseInt(process.env.RATE_LIMIT_REQUESTS_PER_DAY || '60');
  
  const redis = getRedisClient();
  
  if (redis && redis.status === 'ready') {
    return checkRateLimitRedis(redis, ip, minuteLimit, dayLimit);
  } else {
    return checkRateLimitInMemory(ip, minuteLimit, dayLimit);
  }
}

async function checkRateLimitRedis(
  redis: Redis,
  ip: string,
  minuteLimit: number,
  dayLimit: number
): Promise<RateLimitResult> {
  const now = Date.now();
  const minuteKey = `rate-limit:${ip}:minute`;
  const dayKey = `rate-limit:${ip}:day`;
  
  try {
    // Use a Lua script for atomic operations
    const luaScript = `
      local minuteKey = KEYS[1]
      local dayKey = KEYS[2]
      local now = tonumber(ARGV[1])
      local minuteLimit = tonumber(ARGV[2])
      local dayLimit = tonumber(ARGV[3])
      local minuteWindow = 60000
      local dayWindow = 86400000
      
      -- Clean up old entries and count current entries for minute window
      redis.call('ZREMRANGEBYSCORE', minuteKey, '-inf', now - minuteWindow)
      local minuteCount = redis.call('ZCARD', minuteKey)
      
      -- Clean up old entries and count current entries for day window
      redis.call('ZREMRANGEBYSCORE', dayKey, '-inf', now - dayWindow)
      local dayCount = redis.call('ZCARD', dayKey)
      
      -- Check limits
      if minuteCount >= minuteLimit then
        local oldest = redis.call('ZRANGE', minuteKey, 0, 0, 'WITHSCORES')
        local resetTime = oldest[2] and (oldest[2] + minuteWindow - now) / 1000 or 60
        return {0, minuteLimit - minuteCount, dayLimit - dayCount, math.ceil(resetTime)}
      end
      
      if dayCount >= dayLimit then
        local oldest = redis.call('ZRANGE', dayKey, 0, 0, 'WITHSCORES')
        local resetTime = oldest[2] and (oldest[2] + dayWindow - now) / 1000 or 86400
        return {0, 0, 0, math.ceil(resetTime)}
      end
      
      -- Add current request
      redis.call('ZADD', minuteKey, now, now .. ':' .. math.random())
      redis.call('ZADD', dayKey, now, now .. ':' .. math.random())
      
      -- Set TTLs
      redis.call('EXPIRE', minuteKey, 120)
      redis.call('EXPIRE', dayKey, 86400)
      
      return {1, minuteLimit - minuteCount - 1, dayLimit - dayCount - 1, 60}
    `;
    
    const result = await redis.eval(
      luaScript,
      2,
      minuteKey,
      dayKey,
      now.toString(),
      minuteLimit.toString(),
      dayLimit.toString()
    ) as [number, number, number, number];
    
    return {
      success: result[0] === 1,
      remaining: Math.max(0, result[1]),
      remainingDaily: Math.max(0, result[2]),
      resetInSeconds: Math.max(1, result[3]),
    };
  } catch (error) {
    console.error('Redis rate limit error:', error);
    // Fall back to in-memory
    return checkRateLimitInMemory(ip, minuteLimit, dayLimit);
  }
}

function checkRateLimitInMemory(
  ip: string,
  minuteLimit: number,
  dayLimit: number
): RateLimitResult {
  const identifier = `rate-limit:${ip}`;
  const now = Date.now();
  
  let entry = inMemoryStore.get(identifier);
  if (!entry) {
    entry = { timestamps: [], dailyTimestamps: [] };
    inMemoryStore.set(identifier, entry);
  }
  
  // Filter to recent requests only
  entry.timestamps = entry.timestamps.filter(t => now - t < 60000);
  entry.dailyTimestamps = entry.dailyTimestamps.filter(t => now - t < 86400000);
  
  // Check per-minute limit
  if (entry.timestamps.length >= minuteLimit) {
    const oldestInMinute = Math.min(...entry.timestamps);
    const resetInSeconds = Math.ceil((oldestInMinute + 60000 - now) / 1000);
    
    return {
      success: false,
      remaining: 0,
      remainingDaily: dayLimit - entry.dailyTimestamps.length,
      resetInSeconds: Math.max(1, resetInSeconds),
    };
  }
  
  // Check per-day limit
  if (entry.dailyTimestamps.length >= dayLimit) {
    const oldestInDay = Math.min(...entry.dailyTimestamps);
    const resetInSeconds = Math.ceil((oldestInDay + 86400000 - now) / 1000);
    
    return {
      success: false,
      remaining: 0,
      remainingDaily: 0,
      resetInSeconds: Math.max(1, resetInSeconds),
    };
  }
  
  // Record this request
  entry.timestamps.push(now);
  entry.dailyTimestamps.push(now);
  
  return {
    success: true,
    remaining: minuteLimit - entry.timestamps.length,
    remainingDaily: dayLimit - entry.dailyTimestamps.length,
    resetInSeconds: 60,
  };
}

// Check for suspicious patterns (basic DDoS protection)
export function checkAbuse(request: NextRequest): { allowed: boolean; reason?: string } {
  const userAgent = request.headers.get('user-agent') || '';
  if (!userAgent || userAgent.length < 10) {
    return { allowed: false, reason: 'Invalid user agent' };
  }
  
  if (request.method === 'POST') {
    const contentLength = parseInt(request.headers.get('content-length') || '0');
    if (contentLength > 500000) {
      return { allowed: false, reason: 'Request too large' };
    }
  }
  
  return { allowed: true };
}

/**
 * Get current rate limit status without consuming a request
 */
export async function getRateLimitStatus(ip: string): Promise<RateLimitResult> {
  const minuteLimit = parseInt(process.env.RATE_LIMIT_REQUESTS_PER_MINUTE || '15');
  const dayLimit = parseInt(process.env.RATE_LIMIT_REQUESTS_PER_DAY || '60');
  
  const redis = getRedisClient();
  
  if (redis && redis.status === 'ready') {
    const now = Date.now();
    const minuteKey = `rate-limit:${ip}:minute`;
    const dayKey = `rate-limit:${ip}:day`;
    
    try {
      await redis.zremrangebyscore(minuteKey, '-inf', now - 60000);
      await redis.zremrangebyscore(dayKey, '-inf', now - 86400000);
      
      const minuteCount = await redis.zcard(minuteKey);
      const dayCount = await redis.zcard(dayKey);
      
      return {
        success: minuteCount < minuteLimit && dayCount < dayLimit,
        remaining: Math.max(0, minuteLimit - minuteCount),
        remainingDaily: Math.max(0, dayLimit - dayCount),
        resetInSeconds: 60,
      };
    } catch {
      // Fall through to in-memory
    }
  }
  
  const entry = inMemoryStore.get(`rate-limit:${ip}`);
  if (!entry) {
    return {
      success: true,
      remaining: minuteLimit,
      remainingDaily: dayLimit,
      resetInSeconds: 60,
    };
  }
  
  const now = Date.now();
  const minuteCount = entry.timestamps.filter(t => now - t < 60000).length;
  const dayCount = entry.dailyTimestamps.filter(t => now - t < 86400000).length;
  
  return {
    success: minuteCount < minuteLimit && dayCount < dayLimit,
    remaining: Math.max(0, minuteLimit - minuteCount),
    remainingDaily: Math.max(0, dayLimit - dayCount),
    resetInSeconds: 60,
  };
}
