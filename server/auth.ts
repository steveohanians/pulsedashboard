import passport from "passport";
import { Strategy as LocalStrategy } from "passport-local";
import { Express } from "express";
import session from "express-session";
import { scrypt, randomBytes, timingSafeEqual } from "crypto";
import { promisify } from "util";
import { storage } from "./storage";
import { User as SelectUser } from "@shared/schema";
import { authLimiter } from "./middleware/rateLimiter";
import { APP_CONFIG, requireSessionSecret } from "./config";
import logger from "./utils/logging/logger";

// Standardized error response helper
export function sendError(res: any, status: number, code: string, message: string, details?: any) {
  return res.status(status).json({
    code,
    message,
    ...(details && { details })
  });
}

// Tenant access validation helper
export function assertClientAccess(user: any, clientId: string): void {
  if (!user) {
    throw new Error('UNAUTHENTICATED');
  }
  
  // Admin users can access all clients
  if (user.role === 'Admin') {
    return;
  }
  
  // Regular users can only access their own client
  if (user.clientId !== clientId) {
    throw new Error('FORBIDDEN');
  }
}

declare global {
  namespace Express {
    interface User extends SelectUser {}
  }
}

const scryptAsync = promisify(scrypt);

async function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  const buf = (await scryptAsync(password, salt, 64)) as Buffer;
  return `${buf.toString("hex")}.${salt}`;
}

async function comparePasswords(supplied: string, stored: string) {
  const [hashed, salt] = stored.split(".");
  const hashedBuf = Buffer.from(hashed, "hex");
  const suppliedBuf = (await scryptAsync(supplied, salt, 64)) as Buffer;
  return timingSafeEqual(hashedBuf, suppliedBuf);
}

// Standardized middleware functions with consistent error codes
export function requireAuth(req: any, res: any, next: any) {
  // Development mode: auto-authenticate admin user if no one is logged in
  if (!req.isAuthenticated() && process.env.NODE_ENV === 'development') {
    logger.info('Development auto-login attempted', { endpoint: req.originalUrl });
    return storage.getUser('admin-user-id').then(async (adminUser) => {
      if (adminUser) {
        req.login(adminUser, (err: any) => {
          if (err) {
            logger.warn('Development auto-login failed in requireAuth', { error: err.message });
            return sendError(res, 401, "UNAUTHENTICATED", "Authentication required");
          }
          logger.info('Development auto-login successful in requireAuth', { userId: adminUser.id });
          return next();
        });
      } else {
        // Create admin user if it doesn't exist in development
        try {
          logger.info('Creating admin user for development');
          const newAdminUser = await storage.createUser({
            email: 'admin@example.com',
            password: await hashPassword('admin123'),
            name: 'Admin User',
            role: 'Admin' as const
          });
          
          req.login(newAdminUser, (err: any) => {
            if (err) {
              logger.warn('Development auto-login failed after creating admin user', { error: err.message });
              return sendError(res, 401, "UNAUTHENTICATED", "Authentication required");
            }
            logger.info('Development auto-login successful with new admin user', { userId: newAdminUser.id });
            return next();
          });
        } catch (createError) {
          logger.warn('Failed to create admin user in development', { error: (createError as Error).message });
          return sendError(res, 401, "UNAUTHENTICATED", "Authentication required");
        }
      }
    }).catch((error: Error) => {
      logger.warn('Failed to auto-authenticate in requireAuth', { error: error.message });
      return sendError(res, 401, "UNAUTHENTICATED", "Authentication required");
    });
  }
  
  if (!req.isAuthenticated()) {
    logger.warn('Unauthorized access attempt', { 
      endpoint: req.originalUrl,
      method: req.method,
      ip: req.ip
    });
    return sendError(res, 401, "UNAUTHENTICATED", "Authentication required");
  }
  next();
}

export function requireAdmin(req: any, res: any, next: any) {
  if (!req.isAuthenticated()) {
    logger.warn('Unauthenticated admin access attempt', { 
      endpoint: req.originalUrl,
      method: req.method,
      ip: req.ip
    });
    return sendError(res, 401, "UNAUTHENTICATED", "Authentication required");
  }
  
  if (req.user.role !== "Admin") {
    logger.warn('Non-admin access attempt to admin route', { 
      endpoint: req.originalUrl,
      method: req.method,
      userId: req.user.id,
      userRole: req.user.role,
      ip: req.ip
    });
    return sendError(res, 403, "FORBIDDEN", "Admin access required");
  }
  
  next();
}

export function setupAuth(app: Express) {
  const sessionSettings: session.SessionOptions = {
    secret: requireSessionSecret(),
    resave: false,
    saveUninitialized: true,  // Save sessions to database  
    store: storage.sessionStore,
    cookie: {
      secure: APP_CONFIG.SECURITY.COOKIE_SECURE,
      httpOnly: true, // Prevent XSS access to cookies
      sameSite: 'lax', // Allow cross-site requests for login
      maxAge: APP_CONFIG.SECURITY.SESSION_MAX_AGE
    }
  };

  app.set("trust proxy", APP_CONFIG.SECURITY.TRUST_PROXY ? 1 : 0);
  app.use(session(sessionSettings));
  app.use(passport.initialize());
  app.use(passport.session());

  passport.use(
    new LocalStrategy({
      usernameField: 'email',
      passwordField: 'password'
    }, async (email, password, done) => {
      const user = await storage.getUserByEmail(email);
      if (!user || !(await comparePasswords(password, user.password))) {
        logger.security("Failed login attempt", { email, ip: "unknown" });
        return done(null, false);
      } else {
        // Update last login timestamp
        await storage.updateUser(user.id, { lastLogin: new Date() });
        logger.info("Successful login", { userId: user.id, email: user.email });
        return done(null, user);
      }
    }),
  );

  passport.serializeUser((user, done) => done(null, user.id));
  passport.deserializeUser(async (id: string, done) => {
    const user = await storage.getUser(id);
    done(null, user);
  });



  app.post("/api/login", authLimiter, passport.authenticate("local"), (req, res) => {
    const user = req.user;
    if (!user) {
      return res.status(401).json({ message: "Login failed" });
    }
    return res.status(200).json(user);
  });

  app.post("/api/logout", (req, res, next) => {
    req.logout((err) => {
      if (err) return next(err);
      res.status(200).json({ success: true, message: "Logged out successfully" });
    });
  });

  app.get("/api/user", async (req, res) => {
    // Development mode: auto-authenticate admin user if no one is logged in
    if (!req.isAuthenticated() && process.env.NODE_ENV === 'development') {
      try {
        const adminUser = await storage.getUser('admin-user-id');
        if (adminUser) {
          req.login(adminUser, (err) => {
            if (err) {
              logger.warn('Development auto-login failed', { error: err.message });
              return res.sendStatus(401);
            }
            logger.info('Development auto-login successful', { userId: adminUser.id });
            return res.json(adminUser);
          });
          return;
        }
      } catch (error) {
        logger.warn('Failed to auto-authenticate in development', { error: (error as Error).message });
      }
    }
    
    if (!req.isAuthenticated()) return res.sendStatus(401);
    res.json(req.user);
  });

  // Password reset routes
  app.post("/api/forgot-password", authLimiter, async (req, res) => {
    try {
      const { email } = req.body;
      const user = await storage.getUserByEmail(email);
      
      if (!user) {
        // Don't reveal if email exists for security
        return res.json({ message: "If that email exists, a reset link has been sent." });
      }

      const token = randomBytes(32).toString('hex');
      const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour from now

      await storage.createPasswordResetToken({
        userId: user.id,
        token,
        expiresAt,
        used: false
      });

      logger.info("Password reset token created", { userId: user.id, email });
      
      // TODO: Send email with reset link containing the token
      // For now, we'll just log it for development
      logger.info("Password reset token (dev mode)", { token, email });

      res.json({ message: "If that email exists, a reset link has been sent." });
    } catch (error) {
      logger.error("Password reset request error", { error: (error as Error).message });
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.post("/api/reset-password", authLimiter, async (req, res) => {
    try {
      const { token, newPassword } = req.body;
      
      if (!token || !newPassword) {
        return res.status(400).json({ message: "Token and new password are required" });
      }

      const resetToken = await storage.getPasswordResetToken(token);
      
      if (!resetToken || resetToken.used || resetToken.expiresAt < new Date()) {
        return res.status(400).json({ message: "Invalid or expired reset token" });
      }

      // Hash the new password
      const hashedPassword = await hashPassword(newPassword);
      
      // Update user password
      await storage.updateUser(resetToken.userId, { password: hashedPassword });
      
      // Mark token as used
      await storage.usePasswordResetToken(resetToken.token);

      logger.info("Password reset completed", { userId: resetToken.userId });

      res.json({ message: "Password has been reset successfully" });
    } catch (error) {
      logger.error("Password reset error", { error: (error as Error).message });
      res.status(500).json({ message: "Internal server error" });
    }
  });
}
