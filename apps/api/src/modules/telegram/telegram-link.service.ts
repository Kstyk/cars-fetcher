import crypto from 'node:crypto';
import { eq } from 'drizzle-orm';
import { env, telegramConfigured } from '../../config/env.js';
import { logger } from '../../config/logger.js';
import { db } from '../../db/client.js';
import { notificationPreferences } from '../../db/schema.js';
import {
  getTelegramBotUsername,
  getTelegramUpdates,
  sendTelegramMessage,
  type TelegramUpdate,
} from './telegram.client.js';

let cachedBotUsername: string | null = null;
let pollTimer: ReturnType<typeof setInterval> | null = null;
let pollOffset = 0;
let polling = false;

export interface TelegramLinkStatus {
  configured: boolean;
  linked: boolean;
  /** Telegram @handle, when the user has one and has linked. */
  username: string | null;
  /** `t.me/<bot>?start=<token>` the user opens to complete linking. Null once already linked. */
  deepLink: string | null;
}

async function ensureBotUsername(): Promise<string | null> {
  if (!telegramConfigured) return null;
  if (cachedBotUsername) return cachedBotUsername;
  try {
    cachedBotUsername = await getTelegramBotUsername();
  } catch (err) {
    logger.error({ err }, 'Nie udało się pobrać nazwy bota Telegram (sprawdź TELEGRAM_BOT_TOKEN)');
  }
  return cachedBotUsername;
}

/**
 * Current link state plus, when not yet linked, a fresh deep link. Reuses an
 * already-issued unconsumed token instead of minting a new one on every
 * page view, so refreshing the profile page doesn't invalidate a link the
 * user is mid-click on in another tab.
 */
export async function getTelegramLinkStatus(userId: string): Promise<TelegramLinkStatus> {
  if (!telegramConfigured) {
    return { configured: false, linked: false, username: null, deepLink: null };
  }

  const [prefs] = await db
    .select()
    .from(notificationPreferences)
    .where(eq(notificationPreferences.userId, userId))
    .limit(1);

  if (prefs?.telegramChatId) {
    return { configured: true, linked: true, username: prefs.telegramUsername, deepLink: null };
  }

  const token = prefs?.telegramLinkToken ?? crypto.randomBytes(16).toString('hex');
  if (prefs?.telegramLinkToken !== token) {
    await db
      .insert(notificationPreferences)
      .values({ userId, telegramLinkToken: token })
      .onConflictDoUpdate({
        target: notificationPreferences.userId,
        set: { telegramLinkToken: token },
      });
  }

  const botUsername = await ensureBotUsername();
  return {
    configured: true,
    linked: false,
    username: null,
    deepLink: botUsername ? `https://t.me/${botUsername}?start=${token}` : null,
  };
}

export async function unlinkTelegram(userId: string): Promise<void> {
  await db
    .update(notificationPreferences)
    .set({
      telegramChatId: null,
      telegramUsername: null,
      telegramEnabled: false,
      telegramLinkToken: null,
    })
    .where(eq(notificationPreferences.userId, userId));
}

export async function sendTelegramNotification(chatId: string, text: string): Promise<void> {
  await sendTelegramMessage(chatId, text);
}

/* --------------------------------- polling -------------------------------- */

async function processUpdate(update: TelegramUpdate): Promise<void> {
  const message = update.message;
  if (!message?.text) return;

  const match = /^\/start\s+(\S+)/.exec(message.text.trim());
  const token = match?.[1];
  if (!token) return;
  const chatId = String(message.chat.id);

  const [prefs] = await db
    .select()
    .from(notificationPreferences)
    .where(eq(notificationPreferences.telegramLinkToken, token))
    .limit(1);

  if (!prefs) {
    await sendTelegramMessage(
      chatId,
      'Ten link jest nieaktualny lub już użyty. Wygeneruj nowy w Cars Fetcher (Profil → Powiadomienia).',
    ).catch(() => {});
    return;
  }

  await db
    .update(notificationPreferences)
    .set({
      telegramChatId: chatId,
      telegramUsername: message.from?.username ?? null,
      telegramLinkToken: null,
      telegramEnabled: true,
    })
    .where(eq(notificationPreferences.userId, prefs.userId));

  await sendTelegramMessage(
    chatId,
    '✅ Połączono z Cars Fetcher. Powiadomienia (nowe oferty, spadki cen) będą teraz też trafiać tutaj.',
  ).catch((err) => logger.warn({ err }, 'Nie udało się wysłać potwierdzenia linkowania Telegram'));

  logger.info({ userId: prefs.userId }, 'Konto Telegram połączone');
}

async function pollTick(): Promise<void> {
  if (polling) return;
  polling = true;
  try {
    const updates = await getTelegramUpdates(pollOffset);
    for (const update of updates) {
      pollOffset = update.update_id + 1;
      try {
        await processUpdate(update);
      } catch (err) {
        logger.warn({ err, updateId: update.update_id }, 'Błąd przetwarzania update Telegram');
      }
    }
  } catch (err) {
    logger.warn({ err }, 'Telegram getUpdates nie powiodło się');
  } finally {
    polling = false;
  }
}

/**
 * Polls `getUpdates` on an interval instead of registering a webhook - this
 * deployment is LAN-only with no public HTTPS endpoint for Telegram to call
 * into, so the bot has to pull.
 */
export function startTelegramPolling(): void {
  if (!telegramConfigured) {
    logger.info('Bot Telegram wyłączony (brak TELEGRAM_BOT_TOKEN)');
    return;
  }
  if (pollTimer) return;

  void ensureBotUsername();

  // Fast-forward past whatever is already queued (e.g. stray /start
  // attempts sent while the server was down) instead of replaying the
  // entire backlog at once on boot - offset -1 asks Telegram for just the
  // single most recent update.
  getTelegramUpdates(-1)
    .then((updates) => {
      const last = updates.at(-1);
      if (last) pollOffset = last.update_id + 1;
    })
    .catch((err) => logger.warn({ err }, 'Wstępne pobranie aktualizacji Telegram nie powiodło się'))
    .finally(() => {
      pollTimer = setInterval(() => void pollTick(), env.TELEGRAM_POLL_INTERVAL_MS);
    });

  logger.info('Bot Telegram: polling uruchomiony');
}

export function stopTelegramPolling(): void {
  if (pollTimer) {
    clearInterval(pollTimer);
    pollTimer = null;
  }
}
