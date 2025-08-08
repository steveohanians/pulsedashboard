/**
 * Shared authentication and authorization middleware
 * Consolidates duplicate middleware across route files
 */

import { Request, Response, NextFunction } from 'express';
import logger from '../utils/logger';

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  if (!req.isAuthenticated()) {
    logger.warn('Unauthorized access attempt', { 
      endpoint: req.originalUrl,
      method: req.method
    });
    return res.status(401).json({ message: "Authentication required" });
  }
  next();
}

export function requireAdmin(req: Request, res: Response, next: NextFunction) {
  if (!req.isAuthenticated() || req.user.role !== "Admin") {
    logger.warn('Admin access denied', { 
      endpoint: req.originalUrl,
      method: req.method,
      userId: req.user?.id,
      userRole: req.user?.role
    });
    return res.status(403).json({ message: "Admin access required" });
  }
  next();
}

// Combined middleware for routes that require admin access
export function adminRequired(req: Request, res: Response, next: NextFunction) {
  requireAuth(req, res, (err?: any) => {
    if (err) return next(err);
    requireAdmin(req, res, next);
  });
}