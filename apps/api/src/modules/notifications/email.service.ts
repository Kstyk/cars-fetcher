import nodemailer, { type Transporter } from 'nodemailer';
import { emailConfigured, env } from '../../config/env.js';
import { logger } from '../../config/logger.js';
import type { Notification } from '../../db/schema.js';

let transporter: Transporter | null = null;
let warnedOnce = false;

function getTransporter(): Transporter | null {
  if (!emailConfigured) {
    if (!warnedOnce) {
      logger.warn(
        'SMTP nie skonfigurowane (SMTP_HOST/SMTP_USER/SMTP_PASS) - e-maile nie będą wysyłane.',
      );
      warnedOnce = true;
    }
    return null;
  }

  transporter ??= nodemailer.createTransport({
    host: env.SMTP_HOST,
    port: env.SMTP_PORT,
    secure: env.SMTP_SECURE,
    auth: { user: env.SMTP_USER, pass: env.SMTP_PASS },
  });

  return transporter;
}

export interface EmailPayload {
  to: string;
  notification: Pick<Notification, 'type' | 'title' | 'body'>;
  /** Deep link the button should point at - the listing, or the app itself. */
  actionUrl: string;
  actionLabel: string;
}

/** Throws on failure so the caller can record it against the notification row. */
export async function sendNotificationEmail(payload: EmailPayload): Promise<void> {
  const transport = getTransporter();
  if (!transport) throw new Error('SMTP nie jest skonfigurowane');

  const { notification, actionUrl, actionLabel } = payload;
  await transport.sendMail({
    from: env.SMTP_FROM,
    to: payload.to,
    subject: notification.title,
    html: renderLayout({
      title: notification.title,
      bodyHtml: notification.body
        ? `<p style="margin:0 0 20px;font-size:14px;line-height:1.5;color:#52525b;">${escapeHtml(notification.body)}</p>`
        : '',
      actionUrl,
      actionLabel,
      footer:
        'Otrzymujesz tę wiadomość, bo masz włączone powiadomienia e-mail w Cars Fetcher. Zmień to w ustawieniach profilu.',
    }),
  });
}

/** Throws on failure - caller (registration/resend) treats this as best-effort. */
export async function sendVerificationEmail(to: string, token: string): Promise<void> {
  const transport = getTransporter();
  if (!transport) throw new Error('SMTP nie jest skonfigurowane');

  const verifyUrl = `${env.APP_URL}/verify-email?token=${encodeURIComponent(token)}`;

  await transport.sendMail({
    from: env.SMTP_FROM,
    to,
    subject: 'Potwierdź swój adres e-mail - Cars Fetcher',
    html: renderLayout({
      title: 'Potwierdź swój adres e-mail',
      bodyHtml:
        '<p style="margin:0 0 20px;font-size:14px;line-height:1.5;color:#52525b;">' +
        'Kliknij przycisk poniżej, aby potwierdzić swój adres e-mail. Link jest ważny przez 24 godziny.</p>',
      actionUrl: verifyUrl,
      actionLabel: 'Potwierdź e-mail',
      footer: 'Jeśli nie zakładałeś konta w Cars Fetcher, zignoruj tę wiadomość.',
    }),
  });
}

interface LayoutOptions {
  title: string;
  bodyHtml: string;
  actionUrl: string;
  actionLabel: string;
  footer: string;
}

// Inlined styles: most mail clients strip <style> blocks entirely.
function renderLayout({ title, bodyHtml, actionUrl, actionLabel, footer }: LayoutOptions): string {
  return `<!doctype html>
<html lang="pl">
  <body style="margin:0;padding:0;background:#f4f4f5;font-family:-apple-system,Segoe UI,Roboto,sans-serif;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="padding:24px 0;">
      <tr>
        <td align="center">
          <table role="presentation" width="480" cellpadding="0" cellspacing="0"
                 style="background:#ffffff;border-radius:12px;overflow:hidden;border:1px solid #e4e4e7;">
            <tr>
              <td style="background:#2563eb;padding:20px 28px;">
                <span style="color:#ffffff;font-size:16px;font-weight:600;">Cars Fetcher</span>
              </td>
            </tr>
            <tr>
              <td style="padding:28px;">
                <h1 style="margin:0 0 12px;font-size:18px;color:#18181b;">${escapeHtml(title)}</h1>
                ${bodyHtml}
                <a href="${actionUrl}"
                   style="display:inline-block;background:#2563eb;color:#ffffff;text-decoration:none;
                          padding:10px 20px;border-radius:8px;font-size:14px;font-weight:500;">
                  ${escapeHtml(actionLabel)}
                </a>
              </td>
            </tr>
            <tr>
              <td style="padding:16px 28px;background:#fafafa;border-top:1px solid #e4e4e7;">
                <p style="margin:0;font-size:12px;color:#a1a1aa;">
                  ${escapeHtml(footer)}
                </p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
