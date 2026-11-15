import crypto from 'node:crypto';
import nodemailer from 'nodemailer';
import { getDb } from '../db/database.js';
import { config } from '../config.js';

export interface EmailMessage {
  toEmail: string;
  toName: string;
  subject: string;
  bodyText: string;
  recipientUserId?: string;
  notificationEventId: string;
}

export interface DeliveryResult {
  status: 'SENT' | 'DELIVERED' | 'FAILED' | 'RETRYING';
  providerMessageId?: string;
  errorCode?: string;
}

export async function sendEmail(message: EmailMessage): Promise<DeliveryResult> {
  const db = getDb();
  const deliveryId = crypto.randomUUID();
  const now = new Date().toISOString();

  // 1. SMTP Provider Integration (campuscoders / custom SMTP)
  if (config.emailProvider === 'smtp') {
    try {
      const host = config.smtpHost || 'mail.campuscoders.co.in';
      const resolvedHost = host === 'mail.campuscoders.co.in' ? '174.138.177.173' : host;

      const transporter = nodemailer.createTransport({
        host: resolvedHost,
        port: config.smtpPort || 587,
        secure: (config.smtpPort || 587) === 465, // true for 465, false for 587
        auth: {
          user: config.smtpUser,
          pass: config.smtpPass
        },
        tls: {
          rejectUnauthorized: false,
          servername: host
        }
      });

      const info = await transporter.sendMail({
        from: `"Sahaaya Care Coordination" <${config.notificationFromEmail}>`,
        to: `"${message.toName}" <${message.toEmail}>`,
        subject: message.subject,
        text: message.bodyText
      });

      const providerMsgId = info.messageId || `smtp_${Date.now()}`;

      db.prepare(`
        INSERT INTO notification_deliveries (
          id, notification_event_id, recipient_user_id, recipient_email, recipient_name,
          channel, provider, subject, body_text, provider_message_id,
          status, attempt_count, sent_at, metadata, created_at
        ) VALUES (?, ?, ?, ?, ?, 'EMAIL', 'smtp', ?, ?, ?, 'SENT', 1, ?, ?, ?)
      `).run(
        deliveryId,
        message.notificationEventId,
        message.recipientUserId || null,
        message.toEmail,
        message.toName,
        message.subject,
        message.bodyText,
        providerMsgId,
        now,
        JSON.stringify({ response: info.response, host: config.smtpHost }),
        now
      );

      return {
        status: 'SENT',
        providerMessageId: providerMsgId
      };
    } catch (err: any) {
      console.error('[SMTP Transport Error]:', err?.message || err);
      db.prepare(`
        INSERT INTO notification_deliveries (
          id, notification_event_id, recipient_user_id, recipient_email, recipient_name,
          channel, provider, subject, body_text, status, attempt_count,
          last_error_code, created_at
        ) VALUES (?, ?, ?, ?, ?, 'EMAIL', 'smtp', ?, ?, 'FAILED', 1, ?, ?)
      `).run(
        deliveryId,
        message.notificationEventId,
        message.recipientUserId || null,
        message.toEmail,
        message.toName,
        message.subject,
        message.bodyText,
        err?.message || 'SMTP_TRANSMISSION_ERROR',
        now
      );

      return {
        status: 'FAILED',
        errorCode: err?.message || 'SMTP_TRANSMISSION_ERROR'
      };
    }
  }

  // 2. SendGrid Integration
  if (config.sendgridApiKey) {
    try {
      const response = await fetch('https://api.sendgrid.com/v3/mail/send', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${config.sendgridApiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          personalizations: [{ to: [{ email: message.toEmail, name: message.toName }] }],
          from: { email: config.notificationFromEmail, name: 'Sahaaya Care Coordination' },
          subject: message.subject,
          content: [{ type: 'text/plain', value: message.bodyText }]
        })
      });

      if (response.ok) {
        const sgMsgId = response.headers.get('x-message-id') || `sg_${Date.now()}`;
        db.prepare(`
          INSERT INTO notification_deliveries (
            id, notification_event_id, recipient_user_id, recipient_email, recipient_name,
            channel, provider, subject, body_text, provider_message_id,
            status, attempt_count, sent_at, metadata, created_at
          ) VALUES (?, ?, ?, ?, ?, 'EMAIL', 'sendgrid', ?, ?, ?, 'SENT', 1, ?, '{}', ?)
        `).run(
          deliveryId,
          message.notificationEventId,
          message.recipientUserId || null,
          message.toEmail,
          message.toName,
          message.subject,
          message.bodyText,
          sgMsgId,
          now,
          now
        );
        return { status: 'SENT', providerMessageId: sgMsgId };
      } else {
        const errText = await response.text();
        db.prepare(`
          INSERT INTO notification_deliveries (
            id, notification_event_id, recipient_user_id, recipient_email, recipient_name,
            channel, provider, subject, body_text, status, attempt_count,
            last_error_code, created_at
          ) VALUES (?, ?, ?, ?, ?, 'EMAIL', 'sendgrid', ?, ?, 'FAILED', 1, ?, ?)
        `).run(
          deliveryId,
          message.notificationEventId,
          message.recipientUserId || null,
          message.toEmail,
          message.toName,
          message.subject,
          message.bodyText,
          `HTTP ${response.status}: ${errText.slice(0, 150)}`,
          now
        );
        return { status: 'FAILED', errorCode: `HTTP_${response.status}` };
      }
    } catch (err: any) {
      db.prepare(`
        INSERT INTO notification_deliveries (
          id, notification_event_id, recipient_user_id, recipient_email, recipient_name,
          channel, provider, subject, body_text, status, attempt_count,
          last_error_code, created_at
        ) VALUES (?, ?, ?, ?, ?, 'EMAIL', 'sendgrid', ?, ?, 'FAILED', 1, ?, ?)
      `).run(
        deliveryId,
        message.notificationEventId,
        message.recipientUserId || null,
        message.toEmail,
        message.toName,
        message.subject,
        message.bodyText,
        err.message,
        now
      );
      return { status: 'FAILED', errorCode: err.message };
    }
  }

  // 3. Mock Sandbox Provider (Deterministic fallback & offline demo)
  const mockMessageId = `mock_msg_${crypto.randomBytes(8).toString('hex')}`;

  db.prepare(`
    INSERT INTO notification_deliveries (
      id, notification_event_id, recipient_user_id, recipient_email, recipient_name,
      channel, provider, subject, body_text, provider_message_id,
      status, attempt_count, sent_at, delivered_at, metadata, created_at
    ) VALUES (?, ?, ?, ?, ?, 'EMAIL', 'mock-sandbox', ?, ?, ?, 'SENT', 1, ?, ?, '{}', ?)
  `).run(
    deliveryId,
    message.notificationEventId,
    message.recipientUserId || null,
    message.toEmail,
    message.toName,
    message.subject,
    message.bodyText,
    mockMessageId,
    now,
    now,
    now
  );

  return {
    status: 'SENT',
    providerMessageId: mockMessageId
  };
}

export function getDeliveriesForProfile(careProfileId: string, limit = 50) {
  const db = getDb();
  return db.prepare(`
    SELECT d.*, e.event_type, e.entity_type, e.entity_id
    FROM notification_deliveries d
    JOIN notification_events e ON d.notification_event_id = e.id
    WHERE e.care_profile_id = ?
    ORDER BY d.created_at DESC
    LIMIT ?
  `).all(careProfileId, limit) as any[];
}
