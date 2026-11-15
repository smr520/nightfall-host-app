import { isHostingProfile, normalizePreferences, portablePreferences, type HostPreferences } from './preferences';
import { isSetupMemory } from './setup-memory';
import { decodeSession, migrateGame } from './save-schema';
import type { Game, Session } from './types';

export const BACKUP_FORMAT = 'nightfall-host-backup';
export const BACKUP_VERSION = 1;
export const EMPTY_CURRENT_SESSION = '{"__nightfallEmptyCurrentSession":true}';

export type BackupPayload = {
  format: typeof BACKUP_FORMAT;
  version: typeof BACKUP_VERSION;
  exportedAt: number;
  session: Session | null;
  history: Game[];
  preferences: HostPreferences;
};

export type ParsedBackup = {
  backup: BackupPayload;
  legacy: boolean;
};

const isObject = (value: unknown): value is Record<string, unknown> => !!value && typeof value === 'object' && !Array.isArray(value);

function parseJson(value: unknown, label: string): unknown {
  if (typeof value !== 'string') return value;
  try { return JSON.parse(value) as unknown; }
  catch { throw new Error(`${label}不是有效的 JSON 数据`); }
}

function parseSession(value: unknown): Session | null {
  if (value === null) return null;
  const parsed = parseJson(value, '进行中对局');
  if (isObject(parsed) && parsed.__nightfallEmptyCurrentSession === true) return null;
  if (!isObject(parsed) || !Array.isArray(parsed.undo) || !Array.isArray(parsed.redo)) throw new Error('进行中对局结构无效');
  try {
    const current = migrateGame(parsed.current);
    [...parsed.undo, ...parsed.redo].forEach(item => {
      if (migrateGame(item).id !== current.id) throw new Error('撤回记录来自不同对局');
    });
  } catch { throw new Error('进行中对局或其撤回记录无法读取'); }
  return decodeSession(JSON.stringify(parsed)).session;
}

function parseHistory(value: unknown): Game[] {
  const parsed = parseJson(value, '历史记录');
  if (parsed === null) return [];
  if (!Array.isArray(parsed)) throw new Error('历史记录必须是列表');
  const games = parsed.map(entry => migrateGame(entry));
  if (games.some(game => game.stage !== 'ended')) throw new Error('历史记录包含尚未结束的对局');
  if (new Set(games.map(game => game.id)).size !== games.length) throw new Error('历史记录包含重复对局编号');
  return games;
}

function parsePreferences(value: unknown): HostPreferences {
  const parsed = parseJson(value, '个性化方案');
  if (parsed === null) return normalizePreferences({});
  if (!isObject(parsed)) throw new Error('个性化方案结构无效');

  const mode = parsed.hostingMode;
  if (mode !== undefined && mode !== 'standard' && mode !== 'quick' && mode !== 'custom') throw new Error('个性化方案的主持模式无效');
  const profiles = parsed.profiles;
  if (profiles !== undefined && (!Array.isArray(profiles) || profiles.length > 20 || !profiles.every(isHostingProfile))) throw new Error('个性化方案包含无效或过多的方案');
  const profileList = (profiles ?? []) as HostPreferences['profiles'];
  if (new Set(profileList.map(profile => profile.id)).size !== profileList.length) throw new Error('个性化方案包含重复编号');
  const selectedProfileId = parsed.selectedProfileId;
  if (selectedProfileId !== undefined && (typeof selectedProfileId !== 'string' || !profileList.some(profile => profile.id === selectedProfileId))) {
    throw new Error('所选个性化方案不存在');
  }
  if (parsed.lastSetup !== undefined && !isSetupMemory(parsed.lastSetup)) throw new Error('上次开局设置无效');
  return portablePreferences(normalizePreferences(parsed));
}

function validateLegacyRecovery(value: unknown): void {
  if (value === undefined || value === null) return;
  const entries = parseJson(value, '恢复备份');
  if (!Array.isArray(entries)) throw new Error('恢复备份必须是列表');
  for (const entry of entries) {
    if (!isObject(entry) || typeof entry.source !== 'string' || typeof entry.raw !== 'string' || typeof entry.reason !== 'string' || typeof entry.at !== 'number' || !Number.isFinite(entry.at)) {
      throw new Error('恢复备份中包含无效记录');
    }
  }
}

export function parseBackup(raw: string): ParsedBackup {
  let input: unknown;
  try { input = JSON.parse(raw) as unknown; }
  catch { throw new Error('备份不是有效的 JSON 文件'); }
  if (!isObject(input)) throw new Error('备份内容必须是对象');

  if (input.format === BACKUP_FORMAT) {
    if (input.version !== BACKUP_VERSION) throw new Error(`暂不支持此备份版本：${String(input.version)}`);
    if (typeof input.exportedAt !== 'number' || !Number.isFinite(input.exportedAt)) throw new Error('备份导出时间无效');
    if (!Object.prototype.hasOwnProperty.call(input, 'session') || !Object.prototype.hasOwnProperty.call(input, 'history') || !Object.prototype.hasOwnProperty.call(input, 'preferences')) {
      throw new Error('备份缺少必要数据');
    }
    if ((input.session !== null && !isObject(input.session)) || !Array.isArray(input.history) || !isObject(input.preferences)) throw new Error('备份字段结构无效');
    const backup: BackupPayload = {
      format: BACKUP_FORMAT,
      version: BACKUP_VERSION,
      exportedAt: input.exportedAt,
      session: parseSession(input.session),
      history: parseHistory(input.history),
      preferences: parsePreferences(input.preferences),
    };
    return { backup, legacy: false };
  }

  if (!Object.prototype.hasOwnProperty.call(input, 'current') || !Object.prototype.hasOwnProperty.call(input, 'history') || !Object.prototype.hasOwnProperty.call(input, 'preferences')) {
    throw new Error('无法识别此备份格式');
  }
  validateLegacyRecovery(input.recovery);
  return {
    backup: {
      format: BACKUP_FORMAT,
      version: BACKUP_VERSION,
      exportedAt: 0,
      session: parseSession(input.current),
      history: parseHistory(input.history),
      preferences: parsePreferences(input.preferences),
    },
    legacy: true,
  };
}

export function createBackup(payload: Omit<BackupPayload, 'format' | 'version' | 'exportedAt'>, exportedAt = Date.now()): BackupPayload {
  return {
    format: BACKUP_FORMAT,
    version: BACKUP_VERSION,
    exportedAt,
    session: payload.session,
    history: payload.history,
    preferences: portablePreferences(normalizePreferences(payload.preferences)),
  };
}
