import { env } from '../../config/env.js';

const API_BASE = 'https://api.telegram.org';

interface TelegramApiResponse<T> {
  ok: boolean;
  result?: T;
  description?: string;
}

export interface TelegramMessage {
  message_id: number;
  chat: { id: number };
  from?: { id: number; username?: string };
  text?: string;
  date: number;
}

export interface TelegramUpdate {
  update_id: number;
  message?: TelegramMessage;
}

function requireToken(): string {
  if (!env.TELEGRAM_BOT_TOKEN) throw new Error('TELEGRAM_BOT_TOKEN nie jest skonfigurowany');
  return env.TELEGRAM_BOT_TOKEN;
}

async function callTelegram<T>(method: string, params?: Record<string, unknown>): Promise<T> {
  const res = await fetch(`${API_BASE}/bot${requireToken()}/${method}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params ?? {}),
  });

  const body = (await res.json()) as TelegramApiResponse<T>;
  if (!body.ok || body.result === undefined) {
    throw new Error(`Telegram ${method} nie powiodło się: ${body.description ?? res.status}`);
  }
  return body.result;
}

/** Plain text/HTML message to one chat - `chatId` is what `processUpdate` captured from `message.chat.id`. */
export async function sendTelegramMessage(chatId: string, text: string): Promise<void> {
  await callTelegram('sendMessage', {
    chat_id: chatId,
    text,
    parse_mode: 'HTML',
    disable_web_page_preview: false,
  });
}

/**
 * Long-poll fetch of pending updates. `offset` is the next `update_id` to
 * receive - Telegram treats any lower id as already acknowledged and drops
 * it from the queue server-side. `timeout: 0` keeps this a quick request;
 * the caller supplies the actual polling cadence via a setInterval loop
 * instead of Telegram's own long-poll hold, which keeps behaviour simple to
 * reason about (no half-open HTTP request hanging across a deploy).
 */
export async function getTelegramUpdates(offset: number): Promise<TelegramUpdate[]> {
  return callTelegram<TelegramUpdate[]>('getUpdates', {
    offset,
    timeout: 0,
    allowed_updates: ['message'],
  });
}

export async function getTelegramBotUsername(): Promise<string> {
  const me = await callTelegram<{ username?: string }>('getMe');
  if (!me.username) throw new Error('Bot Telegram nie ma ustawionej nazwy użytkownika');
  return me.username;
}
