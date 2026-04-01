import { execFile } from 'child_process';
import { promisify } from 'util';
import {
  readFileSync,
  writeFileSync,
  renameSync,
  mkdirSync,
  existsSync,
  unlinkSync,
} from 'fs';
import { join } from 'path';
import { homedir } from 'os';

const execFileAsync = promisify(execFile);

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

export const WORMHOLE_DIR = join(homedir(), '.wormhole');
export const SESSIONS_FILE = join(WORMHOLE_DIR, 'sessions.json');
const STALE_DAYS = 7;
const STALE_SECONDS = STALE_DAYS * 24 * 60 * 60;
const SAFE_NAME_RE = /^[a-zA-Z0-9_-]+$/;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface SavedSession {
  workingDir: string;
  claudeSessionId: string | null;
  lastSeen: number; // epoch seconds
}

interface SessionsFile {
  version: 1;
  sessions: Record<string, SavedSession>;
}

// ---------------------------------------------------------------------------
// Read / Write helpers
// ---------------------------------------------------------------------------

export function readSavedSessions(): Record<string, SavedSession> {
  try {
    const raw = readFileSync(SESSIONS_FILE, 'utf8');
    const parsed = JSON.parse(raw) as SessionsFile;
    return parsed.sessions ?? {};
  } catch {
    // File missing or malformed — start fresh
    return {};
  }
}

export function writeSavedSessions(sessions: Record<string, SavedSession>): void {
  // Ensure the directory exists before writing
  mkdirSync(WORMHOLE_DIR, { recursive: true });

  const data: SessionsFile = { version: 1, sessions };
  const json = JSON.stringify(data, null, 2);

  // Atomic write: write to .tmp then rename so readers never see partial data
  const tmp = SESSIONS_FILE + '.tmp';
  writeFileSync(tmp, json, 'utf8');
  renameSync(tmp, SESSIONS_FILE);
}

// ---------------------------------------------------------------------------
// Sync (called every 60 s by server.ts)
// ---------------------------------------------------------------------------

export async function syncSessionsFile(): Promise<void> {
  // 1. Get live tmux sessions
  let liveNames: string[] = [];
  try {
    const { stdout } = await execFileAsync('tmux', [
      'list-sessions',
      '-F',
      '#{session_name}',
    ]);
    liveNames = stdout.trim().split('\n').filter(Boolean);
  } catch {
    // tmux not running — no live sessions
  }

  const liveSet = new Set(liveNames);

  // 2. Read existing persisted sessions
  const sessions = readSavedSessions();
  const now = Math.floor(Date.now() / 1000);

  // 3. Upsert each live session
  for (const name of liveNames) {
    // Get current pane working directory
    let workingDir = sessions[name]?.workingDir ?? '';
    try {
      const { stdout } = await execFileAsync('tmux', [
        'display-message',
        '-p',
        '-t',
        name,
        '#{pane_current_path}',
      ]);
      workingDir = stdout.trim();
    } catch {
      // keep existing workingDir on error
    }

    // Read claudeSessionId from the statusline-hook-written temp file
    let claudeSessionId: string | null = sessions[name]?.claudeSessionId ?? null;
    try {
      const id = readFileSync(`/tmp/wormhole-claude-session-${name}`, 'utf8').trim();
      if (id) claudeSessionId = id;
    } catch {
      // no file yet — keep whatever was persisted
    }

    sessions[name] = {
      workingDir,
      claudeSessionId,
      lastSeen: now,
    };
  }

  // 4. Prune entries that are stale AND not currently live
  for (const [name, session] of Object.entries(sessions)) {
    if (!liveSet.has(name) && now - session.lastSeen > STALE_SECONDS) {
      delete sessions[name];
    }
  }

  // 5. Persist
  writeSavedSessions(sessions);
}

// ---------------------------------------------------------------------------
// Remove / Rename
// ---------------------------------------------------------------------------

export function removeSavedSession(name: string): void {
  const sessions = readSavedSessions();
  delete sessions[name];
  writeSavedSessions(sessions);

  // Clean up associated temp files (best-effort)
  for (const suffix of ['session', 'state']) {
    try {
      unlinkSync(`/tmp/wormhole-claude-${suffix}-${name}`);
    } catch {
      // file may not exist — ignore
    }
  }
}

export function renameSavedSession(oldName: string, newName: string): void {
  const sessions = readSavedSessions();
  if (!(oldName in sessions)) return;

  sessions[newName] = sessions[oldName];
  delete sessions[oldName];
  writeSavedSessions(sessions);
}

// ---------------------------------------------------------------------------
// Resurrect a dead tmux session
// ---------------------------------------------------------------------------

// In-memory mutex: names currently being resurrected
const resurrecting = new Set<string>();

export async function resurrectSession(
  name: string,
  session: SavedSession,
): Promise<boolean> {
  // Prevent concurrent resurrection of the same session
  if (resurrecting.has(name)) return true; // already in progress — signal "being handled"
  resurrecting.add(name);

  try {
    // Validate session name to prevent unexpected tmux behavior
    if (!SAFE_NAME_RE.test(name)) return false;

    // Validate claudeSessionId format before interpolating into shell command
    if (session.claudeSessionId && !SAFE_NAME_RE.test(session.claudeSessionId)) {
      session.claudeSessionId = null;
    }

    // Validate working directory still exists
    if (!existsSync(session.workingDir)) {
      // Directory is gone — remove the stale entry and give up
      removeSavedSession(name);
      return false;
    }

    // Create a new detached tmux session rooted at the original working dir
    await execFileAsync('tmux', [
      'new-session',
      '-d',
      '-s',
      name,
      '-c',
      session.workingDir,
    ]);

    // Launch Claude Code inside the session
    const cldCmd = session.claudeSessionId
      ? `cld --resume ${session.claudeSessionId}`
      : 'cld';

    await execFileAsync('tmux', [
      'send-keys',
      '-t',
      name,
      cldCmd,
      'Enter',
    ]);

    return true;
  } catch {
    return false;
  } finally {
    resurrecting.delete(name);
  }
}
