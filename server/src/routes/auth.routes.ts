import { Router, Request, Response } from 'express';
import crypto from 'node:crypto';
import { getDb } from '../db/database.js';
import {
  requireAuth,
  hashPassword,
  verifyPassword,
  generateToken
} from '../services/auth.js';

export const authRouter = Router();

// In-memory brute-force protection for sensitive authentication endpoints
const loginAttempts = new Map<string, { failedCount: number; lockedUntil: number }>();

authRouter.post('/auth/register', (req: Request, res: Response) => {
  try {
    const { email, password, displayName, roleTitle, preferredLanguage } = req.body;
    if (!email || !password || !displayName) {
      res.status(400).json({ error: 'Email, password, and display name are required.' });
      return;
    }

    if (typeof password !== 'string' || password.length < 8) {
      res.status(400).json({ error: 'Password must be at least 8 characters long for security.' });
      return;
    }

    const db = getDb();
    const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(email.toLowerCase().trim());
    if (existing) {
      res.status(409).json({ error: 'An account with this email already exists.' });
      return;
    }

    const userId = crypto.randomUUID();
    const passwordHash = hashPassword(password);
    const now = new Date().toISOString();

    db.prepare(`
      INSERT INTO users (id, auth_subject, email, display_name, password_hash, preferred_language, role_title, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      userId,
      `email|${userId}`,
      email.toLowerCase().trim(),
      displayName.trim(),
      passwordHash,
      preferredLanguage || 'en',
      roleTitle || 'Family',
      now,
      now
    );

    const user = {
      id: userId,
      email: email.toLowerCase().trim(),
      displayName: displayName.trim(),
      preferredLanguage: preferredLanguage || 'en',
      roleTitle: roleTitle || 'Family'
    };

    const token = generateToken(user);
    res.status(201).json({ user, token });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

authRouter.post('/auth/login', (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      res.status(400).json({ error: 'Email and password are required.' });
      return;
    }

    const normEmail = email.toLowerCase().trim();
    const nowMs = Date.now();
    const attemptRecord = loginAttempts.get(normEmail);

    if (attemptRecord && attemptRecord.lockedUntil > nowMs) {
      const waitSec = Math.ceil((attemptRecord.lockedUntil - nowMs) / 1000);
      res.status(429).json({ error: `Account temporarily locked due to excessive failed attempts. Please retry in ${waitSec} seconds.` });
      return;
    }

    const db = getDb();
    const row = db.prepare('SELECT * FROM users WHERE email = ?').get(normEmail) as any;
    if (!row || !verifyPassword(password, row.password_hash)) {
      const failed = (attemptRecord?.failedCount || 0) + 1;
      const lockedUntil = failed >= 5 ? nowMs + 5 * 60 * 1000 : 0;
      loginAttempts.set(normEmail, { failedCount: failed, lockedUntil });

      res.status(401).json({ error: 'Invalid email or password.' });
      return;
    }

    // Reset attempt counter on success
    loginAttempts.delete(normEmail);

    const user = {
      id: row.id,
      email: row.email,
      displayName: row.display_name,
      preferredLanguage: row.preferred_language,
      roleTitle: row.role_title
    };

    const token = generateToken(user);
    res.json({ user, token });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

authRouter.get('/me', requireAuth, (req: Request, res: Response) => {
  res.json({ user: req.user });
});
