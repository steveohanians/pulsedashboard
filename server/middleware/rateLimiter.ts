// Simple in-memory rate limiting implementation
interface RateLimitRecord {
  count: number;
  resetTime: number;
}

const rateLimitStore = new Map<string, RateLimitRecord>();

// Utility to clear rate limit store (useful for development/testing)
export function clearRateLimit(ip?: string, path?: string): void {
  if (ip && path) {
    // Clear specific IP and path combination
    const key = `${ip}:${path}`;
    rateLimitStore.delete(key);
  } else if (ip) {
    // Clear all entries for specific IP
    const keysToDelete = Array.from(rateLimitStore.keys()).filter(key => key.startsWith(`${ip}:`));
    keysToDelete.forEach(key => rateLimitStore.delete(key));
  } else {
    // Clear all rate limits
    rateLimitStore.clear();
  }
}

import type { Request, Response, NextFunction } from 'express';

function createRateLimiter(windowMs: number, maxRequests: number, errorMessage: string) {
  return (req: Request, res: Response, next: NextFunction) => {
    const ip = req.ip || req.connection.remoteAddress;
    const key = `${ip}:${req.route?.path || req.path}`;
    const now = Date.now();
    
    // Clean expired entries
    if (rateLimitStore.size > 1000) {
      // Snapshot entries to avoid concurrent modification during iteration
      const entries = Array.from(rateLimitStore.entries());
      const expiredKeys: string[] = [];
      
      // Compute expired keys from snapshot
      for (const [key, record] of entries) {
        if (now > record.resetTime) {
          expiredKeys.push(key);
        }
      }
      
      // Delete expired keys after iteration
      expiredKeys.forEach(key => rateLimitStore.delete(key));
    }
    
    let record = rateLimitStore.get(key);
    
    if (!record || now > record.resetTime) {
      record = { count: 1, resetTime: now + windowMs };
      rateLimitStore.set(key, record);
      return next();
    }
    
    if (record.count >= maxRequests) {
      return res.status(429).json({ error: errorMessage });
    }
    
    record.count++;
    next();
  };
}

// General API rate limiting - Relaxed for development
export const generalLimiter = createRateLimiter(
  15 * 60 * 1000, // 15 minutes
  1000, // max requests (increased from 100)
  'Too many requests from this IP, please try again later.'
);

// Authentication rate limiting
export const authLimiter = createRateLimiter(
  15 * 60 * 1000, // 15 minutes
  5, // max requests
  'Too many login attempts from this IP, please try again later.'
);

// File upload rate limiting - Relaxed for development
export const uploadLimiter = createRateLimiter(
  60 * 60 * 1000, // 1 hour
  100, // max requests (increased from 10)
  'Too many file uploads from this IP, please try again later.'
);

// Admin action rate limiting - Relaxed for development
export const adminLimiter = createRateLimiter(
  5 * 60 * 1000, // 5 minutes
  500, // max requests (increased from 50)
  'Too many admin requests from this IP, please try again later.'
);