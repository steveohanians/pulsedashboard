/**
 * Authentication middleware functions
 * Centralized authentication utilities for route protection
 */

import { Request, Response, NextFunction } from 'express';

/**
 * Middleware to check if user is authenticated
 */
export function isAuthenticated(req: Request, res: Response, next: NextFunction) {
  if (!req.isAuthenticated()) {
    return res.status(401).json({ message: "Authentication required" });
  }
  next();
}

/**
 * Middleware to check if user is authenticated
 * Alias for isAuthenticated for consistency
 */
export function requireAuth(req: Request, res: Response, next: NextFunction) {
  return isAuthenticated(req, res, next);
}

/**
 * Middleware to check if user is authenticated and has admin role
 */
export function requireAdmin(req: Request, res: Response, next: NextFunction) {
  if (!req.isAuthenticated()) {
    return res.status(401).json({ message: "Authentication required" });
  }
  
  if (req.user?.role !== "Admin") {
    return res.status(403).json({ message: "Admin access required" });
  }
  
  next();
}

/**
 * Middleware to check admin role (legacy alias)
 */
export function adminRequired(req: Request, res: Response, next: NextFunction) {
  return requireAdmin(req, res, next);
}