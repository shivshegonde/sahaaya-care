import dotenv from 'dotenv';
import path from 'path';

// Load .env from workspace root
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

export const config = {
  port: parseInt(process.env.PORT || '4003', 10),
  projectId: process.env.PROJECT_ID || process.env.GCP_PROJECT_ID || 'ai-builder-sql-copilot',
  gcsRegion: process.env.GCS_REGION || 'asia-south1',
  geminiApiKey: process.env.GEMINI_API_KEY || '',
  geminiModel: process.env.GEMINI_MODEL || 'gemini-3.8-flash',
  jwtSecret: process.env.JWT_SECRET || 'sahaaya-care-secure-jwt-default-key-hackathon',
  emailProvider: process.env.EMAIL_PROVIDER || (process.env.SMTP_SERVER || process.env['SMTP Server'] ? 'smtp' : 'mock'),
  smtpHost: (process.env.SMTP_HOST || process.env.SMTP_SERVER || process.env['SMTP Server'] || '').trim(),
  smtpPort: parseInt((process.env.SMTP_PORT || process.env.port || '587').toString().trim(), 10),
  smtpUser: (process.env.SMTP_USER || process.env.SMTP_USERNAME || process.env.Username || '').trim(),
  smtpPass: (process.env.SMTP_PASS || process.env.SMTP_PASSWORD || process.env.Password || '').trim(),
  sendgridApiKey: process.env.SENDGRID_API_KEY || '',
  notificationFromEmail: (process.env.NOTIFICATION_FROM_EMAIL || process.env.Username || 'alerts@sahaayacare.example.com').trim(),
  demoMode: process.env.DEMO_MODE !== 'false',
  enableAiAssistant: process.env.ENABLE_AI_ASSISTANT !== 'false',
  defaultGracePeriodMinutes: parseInt(process.env.DEFAULT_GRACE_PERIOD_MINUTES || '30', 10),
  dbPath: process.env.DATABASE_PATH || path.resolve(process.cwd(), 'sahaaya_care.db')
};
