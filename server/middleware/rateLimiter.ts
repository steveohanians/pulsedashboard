// Simple in-memory rate limiting implementation
interface RateLimitRecord {
  count: number;
  resetTime: number;
}

const rateLimitStore = new Map<string, RateLimitRecord>();

import type { Request, Response, NextFunction } from 'express';

function createRateLimiter(windowMs: number, maxRequests: number, errorMessage: string) {
  return (req: Request, res: Response, next: NextFunction) => {
    const ip = req.ip || req.connection.remoteAddress;
    const key = `${ip}:${req.route?.path || req.path}`;
    const now = Date.now();
    
    // Clean expired entries
    if (rateLimitStore.size > 1000) {
      const keysToDelete: string[] = [];
      rateLimitStore.forEach((record, key) => {
        if (now > record.resetTime) {
          keysToDelete.push(key);
        }
      });
      keysToDelete.forEach(key => rateLimitStore.delete(key));
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

// General API rate limiting
export const generalLimiter = createRateLimiter(
  15 * 60 * 1000, // 15 minutes
  100, // max requests
  'Too many requests from this IP, please try again later.'
);

// Authentication rate limiting
export const authLimiter = createRateLimiter(
  15 * 60 * 1000, // 15 minutes
  5, // max requests
  'Too many login attempts from this IP, please try again later.'
);

// File upload rate limiting
export const uploadLimiter = createRateLimiter(
  60 * 60 * 1000, // 1 hour
  10, // max requests
  'Too many file uploads from this IP, please try again later.'
);

// Admin action rate limiting
export const adminLimiter = createRateLimiter(
  5 * 60 * 1000, // 5 minutes
  50, // max requests
  'Too many admin requests from this IP, please try again later.'
);