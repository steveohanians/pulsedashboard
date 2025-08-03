import passport from "passport";
import { Strategy as LocalStrategy } from "passport-local";
import { Express } from "express";
import session from "express-session";
import { scrypt, randomBytes, timingSafeEqual } from "crypto";
import { promisify } from "util";
import { storage } from "./storage";
import { User as SelectUser } from "@shared/schema";
import { authLimiter } from "./middleware/rateLimiter";
import logger from "./utils/logger";

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

export function setupAuth(app: Express) {
  const sessionSettings: session.SessionOptions = {
    secret: process.env.SESSION_SECRET!,
    resave: false,
    saveUninitialized: true,  // Save sessions to database  
    store: storage.sessionStore,
    cookie: {
      secure: false,  // Allow non-HTTPS for development
      httpOnly: true, // Prevent XSS access to cookies
      sameSite: 'lax', // Allow cross-site requests for login
      maxAge: 24 * 60 * 60 * 1000 // 24 hours
    }
  };

  app.set("trust proxy", 1);
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

  app.post("/api/register", authLimiter, async (req, res, next) => {
    try {
      const existingUser = await storage.getUserByEmail(req.body.email);
      if (existingUser) {
        logger.security("Registration attempt with existing email", { email: req.body.email });
        return res.status(400).json({ message: "Email already exists" });
      }

      const user = await storage.createUser({
        ...req.body,
        password: await hashPassword(req.body.password),
      });

      logger.info("New user registered", { userId: user.id, email: user.email });

      req.login(user, (err) => {
        if (err) return next(err);
        res.status(201).json(user);
      });
    } catch (error) {
      logger.error("Registration error", { error: (error as Error).message, email: req.body.email });
      next(error);
    }
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
      res.sendStatus(200);
    });
  });

  app.get("/api/user", (req, res) => {
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
