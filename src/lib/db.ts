import { DatabaseSync } from 'node:sqlite';
import path from 'path';
import { mkdirSync } from 'fs';

const DB_DIR = path.join(process.cwd(), 'data');
const DB_PATH = path.join(DB_DIR, 'webnario.db');

let _db: DatabaseSync | null = null;

export function getDb(): DatabaseSync {
  if (_db) return _db;
  mkdirSync(DB_DIR, { recursive: true });
  _db = new DatabaseSync(DB_PATH);
  _db.exec("PRAGMA journal_mode = WAL");
  _db.exec("PRAGMA foreign_keys = ON");
  initSchema(_db);
  return _db;
}

function initSchema(db: DatabaseSync): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS editions (
      id TEXT PRIMARY KEY,
      live_date TEXT NOT NULL,
      video_source TEXT DEFAULT 'upload',
      video_url TEXT DEFAULT '',
      video_duration INTEGER DEFAULT 7200,
      sales_page_url TEXT DEFAULT '',
      chat_enabled INTEGER DEFAULT 1,
      chat_mode TEXT DEFAULT 'general',
      cta_enabled INTEGER DEFAULT 0,
      cta_url TEXT DEFAULT '',
      cta_text TEXT DEFAULT '',
      cta_start_seconds INTEGER DEFAULT 0,
      cta_end_seconds INTEGER DEFAULT 3600,
      viewer_min INTEGER DEFAULT 210,
      viewer_max INTEGER DEFAULT 220,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS registrations (
      id TEXT PRIMARY KEY,
      edition_id TEXT NOT NULL,
      name TEXT NOT NULL,
      email TEXT NOT NULL,
      ip TEXT NOT NULL,
      consumed INTEGER DEFAULT 0,
      consumed_at TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      UNIQUE(edition_id, email),
      UNIQUE(edition_id, ip)
    );

    CREATE TABLE IF NOT EXISTS comments (
      id TEXT PRIMARY KEY,
      edition_id TEXT NOT NULL,
      registration_id TEXT,
      type TEXT NOT NULL,
      author_name TEXT NOT NULL,
      text TEXT NOT NULL,
      video_timestamp INTEGER,
      is_pinned INTEGER DEFAULT 0,
      pin_start_seconds INTEGER,
      pin_end_seconds INTEGER,
      visible INTEGER DEFAULT 1,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS events (
      id TEXT PRIMARY KEY,
      edition_id TEXT NOT NULL,
      registration_id TEXT,
      type TEXT NOT NULL,
      metadata TEXT DEFAULT '{}',
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_reg_edition ON registrations(edition_id);
    CREATE INDEX IF NOT EXISTS idx_reg_email ON registrations(email);
    CREATE INDEX IF NOT EXISTS idx_reg_ip ON registrations(ip);
    CREATE INDEX IF NOT EXISTS idx_comments_edition ON comments(edition_id);
    CREATE INDEX IF NOT EXISTS idx_comments_ts ON comments(video_timestamp);
    CREATE INDEX IF NOT EXISTS idx_events_edition ON events(edition_id);
  `);

  // Migrations — safe to run on every startup
  try { db.exec('ALTER TABLE comments ADD COLUMN reply TEXT'); } catch {}
  try { db.exec('ALTER TABLE comments ADD COLUMN reply_author TEXT'); } catch {}
}

export type Edition = {
  id: string;
  live_date: string;
  video_source: 'upload' | 'youtube';
  video_url: string;
  video_duration: number;
  sales_page_url: string;
  chat_enabled: number;
  chat_mode: 'general' | 'isolated';
  cta_enabled: number;
  cta_url: string;
  cta_text: string;
  cta_start_seconds: number;
  cta_end_seconds: number;
  viewer_min: number;
  viewer_max: number;
  created_at: string;
};

export type Registration = {
  id: string;
  edition_id: string;
  name: string;
  email: string;
  ip: string;
  consumed: number;
  consumed_at: string | null;
  created_at: string;
};

export type Comment = {
  id: string;
  edition_id: string;
  registration_id: string | null;
  type: 'real_user' | 'real_staff' | 'simulated_user' | 'simulated_staff' | 'simulated_purchase';
  author_name: string;
  text: string;
  video_timestamp: number | null;
  is_pinned: number;
  pin_start_seconds: number | null;
  pin_end_seconds: number | null;
  visible: number;
  reply: string | null;
  reply_author: string | null;
  created_at: string;
};

export type Event = {
  id: string;
  edition_id: string;
  registration_id: string | null;
  type: string;
  metadata: string;
  created_at: string;
};
