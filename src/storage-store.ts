import { createPersistenceQueue } from './storage-queue';
import { decodeSession, migrateGame } from './game/save-schema';
import { createBackup, EMPTY_CURRENT_SESSION, parseBackup } from './game/backup';
import type { Game, Session } from './game/types';
import { normalizePreferences, type HostingProfile } from './game/preferences';
import { isSetupMemory, type SetupMemory } from './game/setup-memory';

export interface KeyValueStorage {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
  removeItem(key: string): Promise<void>;
  multiSet?: (keyValuePairs: [string, string][]) => Promise<void>;
}
export const STORAGE_KEYS = {
  current: 'nightfall.current.v1', history: 'nightfall.history.v1', recovery: 'nightfall.recovery.v1', preferences: 'nightfall.preferences.v1', appRole: 'nightfall.appRole.v1',
};


export type StoredPreferences = { hostingMode?: string; profiles?: HostingProfile[]; selectedProfileId?: string; lastSetup?: SetupMemory };
export type AppRole = 'host' | 'player';
export const isAppRole = (value: unknown): value is AppRole => value === 'host' || value === 'player';

export function createGameStorage(kv: KeyValueStorage) {
  const queue = createPersistenceQueue();
  const preferencesQueue = createPersistenceQueue();
  const appRoleQueue = createPersistenceQueue();
  let sessionReadable = false;
  let historyReadable = false;
  let preferencesReadable = false;
  const warnings = new Map<string, string>();
  const historyState = new Map<string, boolean>();
  let backupQueue: Promise<void> = Promise.resolve();
  const activeReads = new Set<Promise<unknown>>();
  let restoreInFlight = false;
  const recoveryError = () => new Error('存档尚未安全读取，禁止覆盖。请先重试或备份后清除损坏记录。');
  const restoreError = () => new Error('正在导入本机备份，请稍候再操作。');
  function requireWritable() { if (!sessionReadable || !historyReadable) throw recoveryError(); }
  function requireNotRestoring() { if (restoreInFlight) throw restoreError(); }
  function trackRead<T>(operation: () => Promise<T>): Promise<T> {
    requireNotRestoring();
    const pending = operation();
    activeReads.add(pending);
    void pending.then(() => activeReads.delete(pending), () => activeReads.delete(pending));
    return pending;
  }
  async function finishAcceptedWork() {
    // A failed old read must settle before transfer, but recovery is allowed to
    // replace that very damaged record. Its original caller owns the read error.
    await Promise.all([queue.idle(), preferencesQueue.idle(), Promise.allSettled([...activeReads])]);
    // Accepted reads may discover corruption and enqueue a raw recovery backup.
    // Wait for that final queue only after those reads have finished producing it.
    await backupQueue;
  }

  function backup(source: string, raw: string, reason: string): Promise<void> {
    const pending = backupQueue.then(() => backupNow(source, raw, reason));
    backupQueue = pending.catch(() => undefined);
    return pending;
  }
  async function backupNow(source: string, raw: string, reason: string) {
    const existing = await kv.getItem(STORAGE_KEYS.recovery);
    const records: unknown = existing === null ? [] : JSON.parse(existing);
    if (!Array.isArray(records)) throw new Error('备份目录损坏，未覆盖原记录');
    if (records.some(item => item && item.source === source && item.raw === raw)) return;
    // Keep raw bytes, not just parsed fields; a failed backup aborts any destructive action.
    await kv.setItem(STORAGE_KEYS.recovery, JSON.stringify([...records, { source, raw, reason, at: Date.now() }]));
  }

  async function readSession(): Promise<Session | null> {
    return trackRead(readSessionNow);
  }
  async function readSessionNow(): Promise<Session | null> {
    sessionReadable = false;
    const raw = await kv.getItem(STORAGE_KEYS.current);
    if (raw === null || raw === EMPTY_CURRENT_SESSION) { sessionReadable = true; warnings.delete('session'); return null; }
    try {
      const decoded = decodeSession(raw);
      if (decoded.repaired) {
        await backup(STORAGE_KEYS.current, raw, '旧版迁移或隔离损坏撤销快照');
        warnings.set('session', '旧存档已兼容恢复；原始数据已备份。');
      } else warnings.delete('session');
      sessionReadable = true;
      return decoded.session;
    } catch {
      throw new Error('进行中存档读取失败，原始记录未被覆盖。');
    }
  }

  async function readHistory(): Promise<Game[]> {
    return trackRead(readHistoryNow);
  }

  // Already accepted queue commands must finish before a backup transfer.
  async function readHistoryNow(): Promise<Game[]> {
    let raw: string | null;
    try { raw = await kv.getItem(STORAGE_KEYS.history); }
    catch (error) { historyReadable = false; throw error; }
    if (raw === null) { historyReadable = true; warnings.delete('history'); return []; }
    let parsed: unknown;
    try { parsed = JSON.parse(raw); } catch { parsed = null; }
    if (!Array.isArray(parsed)) {
      try { await backup(STORAGE_KEYS.history, raw, '历史列表损坏'); }
      catch (error) { historyReadable = false; throw error; }
      warnings.set('history', '历史列表损坏，原始数据已隔离备份；当前对局不受影响。');
      historyReadable = true;
      return [];
    }
    const games: Game[] = [];
    let rejected = 0;
    let repaired = false;
    for (const entry of parsed) {
      try {
        const game = migrateGame(entry);
        repaired ||= JSON.stringify(game) !== JSON.stringify(entry);
        if (game.stage !== 'ended') { rejected++; continue; }
        if (games.some(existing => existing.id === game.id)) { rejected++; continue; }
        games.push(game);
      } catch { rejected++; }
    }
    if (rejected || repaired) {
      try { await backup(STORAGE_KEYS.history, raw, '隔离损坏历史条目或迁移旧历史'); }
      catch (error) { historyReadable = false; throw error; }
      warnings.set('history', `历史记录中 ${rejected} 条异常已隔离；合法记录可继续使用，原始数据已备份。`);
    } else warnings.delete('history');
    historyReadable = true;
    return games;
  }

  async function archiveNow(game: Game) {
    const old = await readHistoryNow();
    await kv.setItem(STORAGE_KEYS.history, JSON.stringify([game, ...old.filter(item => item.id !== game.id)].slice(0, 30)));
  }
  async function removeArchiveNow(id: string) {
    const old = await readHistoryNow();
    if (old.some(item => item.id === id)) await kv.setItem(STORAGE_KEYS.history, JSON.stringify(old.filter(item => item.id !== id)));
  }
  function persistHistoryGame(game: Game): Promise<void> {
    let snapshot: Game;
    try {
      requireNotRestoring(); requireWritable(); snapshot = migrateGame(game);
      if (snapshot.stage !== 'ended') throw new Error('只有已结束的对局可以归档复盘');
    } catch (error) { return Promise.reject(error); }
    // Mark pending archives too, so an immediate undo queues a removal rather than
    // incorrectly trusting the previous 'not archived' cache entry.
    historyState.set(snapshot.id, true);
    return queue.command(() => archiveNow(snapshot)).catch(error => { historyState.delete(snapshot.id); throw error; });
  }
  function removeArchivedGame(id: string): Promise<void> {
    try { requireNotRestoring(); requireWritable(); } catch (error) { return Promise.reject(error); }
    historyState.set(id, false);
    return queue.command(() => removeArchiveNow(id)).catch(error => { historyState.delete(id); throw error; });
  }
  function persistSession(session: Session): Promise<void> {
    let snapshot: Session;
    try { requireNotRestoring(); requireWritable(); snapshot = decodeSession(JSON.stringify(session)).session; } catch (error) { return Promise.reject(error); }
    // History commands cannot be cancelled by a new snapshot or clear command.
    const historyWork = snapshot.current.stage === 'ended'
      ? persistHistoryGame(snapshot.current)
      : historyState.get(snapshot.current.id) !== false ? removeArchivedGame(snapshot.current.id) : Promise.resolve();
    const currentWork = queue.run(STORAGE_KEYS.current, async () => {
      const previous = await kv.getItem(STORAGE_KEYS.current);
      if (previous !== null) {
        let previousGame: Game;
        if (previous !== EMPTY_CURRENT_SESSION) {
          try { previousGame = decodeSession(previous).session.current; } catch { sessionReadable = false; throw recoveryError(); }
          if (previousGame.id !== snapshot.current.id) {
            await backup(STORAGE_KEYS.current, previous, '替换上一场对局');
            if (previousGame.stage === 'ended') await archiveNow(previousGame);
          }
        }
      }
      await kv.setItem(STORAGE_KEYS.current, JSON.stringify(snapshot));
    });
    return Promise.all([historyWork, currentWork]).then(() => undefined);
  }
  async function retryPersistSession(session: Session): Promise<void> {
    requireNotRestoring();
    const snapshot = decodeSession(JSON.stringify(session)).session;
    // Refresh storage permissions without replacing the UI's unsaved in-memory game.
    // A damaged CURRENT still blocks; a transient history read may now recover.
    await Promise.all([readSession(), readHistory()]);
    await persistSession(snapshot);
  }
  function clearSession(): Promise<void> {
    try { requireNotRestoring(); requireWritable(); } catch (error) { return Promise.reject(error); }
    return queue.command(async () => {
      const raw = await kv.getItem(STORAGE_KEYS.current);
      if (raw !== null && raw !== EMPTY_CURRENT_SESSION) {
        const current = decodeSession(raw).session.current;
        await backup(STORAGE_KEYS.current, raw, '移除当前对局');
        if (current.stage === 'ended') await archiveNow(current);
      }
      await kv.removeItem(STORAGE_KEYS.current);
    });
  }
  function clearDamagedSession(): Promise<void> {
    try { requireNotRestoring(); } catch (error) { return Promise.reject(error); }
    return queue.command(async () => {
      const raw = await kv.getItem(STORAGE_KEYS.current);
      if (raw !== null) await backup(STORAGE_KEYS.current, raw, '用户确认清除异常会话');
      await kv.removeItem(STORAGE_KEYS.current);
      sessionReadable = true;
      warnings.delete('session');
    });
  }
  async function exportRawData(): Promise<string> {
    requireNotRestoring();
    const [current, history, recovery, preferences] = await Promise.all([kv.getItem(STORAGE_KEYS.current), kv.getItem(STORAGE_KEYS.history), kv.getItem(STORAGE_KEYS.recovery), kv.getItem(STORAGE_KEYS.preferences)]);
    return JSON.stringify({ current, history, recovery, preferences }, null, 2);
  }

  async function exportBackup(): Promise<string> {
    requireNotRestoring();
    restoreInFlight = true;
    try {
      await finishAcceptedWork();
      const [currentRaw, historyRaw, preferencesRaw] = await Promise.all([
        kv.getItem(STORAGE_KEYS.current), kv.getItem(STORAGE_KEYS.history), kv.getItem(STORAGE_KEYS.preferences),
      ]);
      const session = currentRaw === null || currentRaw === EMPTY_CURRENT_SESSION ? null : decodeSession(currentRaw).session;
      const history = historyRaw === null ? [] : (() => {
        const parsed: unknown = JSON.parse(historyRaw);
        if (!Array.isArray(parsed)) throw new Error('历史记录损坏，无法导出备份');
        const games: Game[] = [];
        for (const entry of parsed) {
          const game = migrateGame(entry);
          if (game.stage !== 'ended') throw new Error('历史记录包含尚未结束的对局');
          if (!games.some(existing => existing.id === game.id)) games.push(game);
        }
        return games;
      })();
      const preferences = preferencesRaw === null ? normalizePreferences({}) : normalizePreferences(JSON.parse(preferencesRaw));
      return JSON.stringify(createBackup({ session, history, preferences }), null, 2);
    } finally {
      restoreInFlight = false;
    }
  }

  async function restoreBackup(raw: string, replaceCurrent = false): Promise<{ sessionReplaced: boolean; historyCount: number; profileCount: number }> {
    requireNotRestoring();
    if (typeof kv.multiSet !== 'function') throw new Error('当前存储不支持原子导入，未修改任何数据。');
    restoreInFlight = true;
    try {
      await finishAcceptedWork();
      const parsed = parseBackup(raw).backup;
      const [currentRaw, historyRaw, preferencesRaw, recoveryRaw] = await Promise.all([
        kv.getItem(STORAGE_KEYS.current), kv.getItem(STORAGE_KEYS.history), kv.getItem(STORAGE_KEYS.preferences), kv.getItem(STORAGE_KEYS.recovery),
      ]);
      let localSession: Session | null = null;
      let damagedSession = false;
      if (currentRaw !== null && currentRaw !== EMPTY_CURRENT_SESSION) {
        try { localSession = decodeSession(currentRaw).session; }
        catch { damagedSession = true; }
      }
      const localHistory: Game[] = historyRaw === null ? [] : (() => {
        let value: unknown;
        try { value = JSON.parse(historyRaw); } catch { return []; }
        if (!Array.isArray(value)) return [];
        const games: Game[] = [];
        for (const item of value) {
          try {
            const game = migrateGame(item);
            if (game.stage !== 'ended') continue;
            if (!games.some(existing => existing.id === game.id)) games.push(game);
          } catch { /* The complete raw history is preserved in the import snapshot. */ }
        }
        return games;
      })();
      let localPreferences = normalizePreferences({});
      if (preferencesRaw !== null) {
        try { localPreferences = normalizePreferences(JSON.parse(preferencesRaw)); }
        catch { /* The complete raw preferences are preserved in the import snapshot. */ }
      }
      const localActive = !!localSession && localSession.current.stage !== 'ended';
      if (damagedSession && !replaceCurrent) throw new Error('本机当前对局无法读取。请确认使用备份中的对局替换或清除后再导入。');
      const hadLocalSessionRecord = currentRaw !== null && currentRaw !== EMPTY_CURRENT_SESSION;
      const sessionReplaced = !!parsed.session && (!localSession ? !hadLocalSessionRecord || replaceCurrent : !localActive || replaceCurrent);
      const clearDamagedCurrent = (damagedSession || currentRaw === EMPTY_CURRENT_SESSION) && replaceCurrent && !parsed.session;
      const selectedSession = sessionReplaced ? parsed.session : localSession;
      const mergedHistory = [...parsed.history, ...localHistory.filter(game => !parsed.history.some(incoming => incoming.id === game.id))].slice(0, 30);
      const mergedProfiles = [...parsed.preferences.profiles, ...localPreferences.profiles.filter(profile => !parsed.preferences.profiles.some(incoming => incoming.id === profile.id))].slice(0, 20);
      const selectedProfileId = parsed.preferences.selectedProfileId && mergedProfiles.some(profile => profile.id === parsed.preferences.selectedProfileId)
        ? parsed.preferences.selectedProfileId : localPreferences.selectedProfileId && mergedProfiles.some(profile => profile.id === localPreferences.selectedProfileId)
          ? localPreferences.selectedProfileId : undefined;
      const lastSetup = parsed.preferences.lastSetup ?? localPreferences.lastSetup;
      const mergedPreferences = normalizePreferences({
        ...parsed.preferences,
        profiles: mergedProfiles,
        ...(selectedProfileId ? { selectedProfileId } : {}),
        ...(lastSetup ? { lastSetup } : {}),
      });
      let recoveryRecords: unknown[] = [];
      if (recoveryRaw !== null) {
        const value: unknown = JSON.parse(recoveryRaw);
        if (!Array.isArray(value)) throw new Error('本机恢复备份损坏，导入已取消。');
        recoveryRecords = value;
      }
      // Existing recovery records remain in this same array. Re-embedding their
      // complete JSON in each new snapshot would grow exponentially on imports.
      const original = JSON.stringify({ current: currentRaw, history: historyRaw, recovery: null, preferences: preferencesRaw });
      recoveryRecords.push({ source: 'nightfall.backup.restore', raw: original, reason: '导入备份前保留本机原始数据', at: Date.now() });
      const pairs: [string, string][] = [
        [STORAGE_KEYS.history, JSON.stringify(mergedHistory)],
        [STORAGE_KEYS.preferences, JSON.stringify(mergedPreferences)],
        [STORAGE_KEYS.recovery, JSON.stringify(recoveryRecords)],
      ];
      if (selectedSession) pairs.push([STORAGE_KEYS.current, JSON.stringify(selectedSession)]);
      else if (clearDamagedCurrent) pairs.push([STORAGE_KEYS.current, EMPTY_CURRENT_SESSION]);
      await kv.multiSet(pairs);
      sessionReadable = currentRaw === null || currentRaw === EMPTY_CURRENT_SESSION || clearDamagedCurrent || !damagedSession && !!selectedSession;
      historyReadable = true; preferencesReadable = true;
      historyState.clear();
      return { sessionReplaced, historyCount: mergedHistory.length, profileCount: mergedPreferences.profiles.length };
    } finally {
      restoreInFlight = false;
    }
  }
  async function readPreferences(): Promise<StoredPreferences> {
    return trackRead(readPreferencesNow);
  }
  async function readPreferencesNow(): Promise<StoredPreferences> {
    preferencesReadable = false;
    const raw = await kv.getItem(STORAGE_KEYS.preferences);
    if (raw === null) { preferencesReadable = true; warnings.delete('preferences'); return normalizePreferences({}); }
    let parsed: unknown;
    try { parsed = JSON.parse(raw); } catch { parsed = null; }
    const normalized = normalizePreferences(parsed);
    const validObject = parsed !== null && typeof parsed === 'object' && !Array.isArray(parsed);
    const input = validObject ? parsed as Record<string, unknown> : {};
    const damaged = !validObject
      || (input.hostingMode !== undefined && !['standard', 'quick', 'custom'].includes(input.hostingMode as string))
      || (input.profiles !== undefined && (!Array.isArray(input.profiles) || input.profiles.length !== normalized.profiles.length))
      || (input.lastSetup !== undefined && !isSetupMemory(input.lastSetup));
    if (damaged) {
      await backup(STORAGE_KEYS.preferences, raw, '隔离损坏的个性化方案');
      warnings.set('preferences', '部分个性化方案无法读取，原始数据已备份；其余方案仍可使用。');
    } else {
      warnings.delete('preferences');
    }
    preferencesReadable = true;
    return normalized;
  }
  function persistPreferences(preferences: StoredPreferences): Promise<void> {
    try { requireNotRestoring(); } catch (error) { return Promise.reject(error); }
    if (!preferencesReadable) return Promise.reject(new Error('个性化方案尚未安全读取，请重试后再保存。'));
    const normalized = normalizePreferences(preferences);
    if (preferences.profiles !== undefined && preferences.profiles.length !== normalized.profiles.length) return Promise.reject(new Error('个性化方案无效，未覆盖已保存的设置。'));
    if (preferences.lastSetup !== undefined && !normalized.lastSetup) return Promise.reject(new Error('上次开局设置无效，未覆盖已保存的设置。'));
    const snapshot = JSON.stringify(normalized);
    return preferencesQueue.command(() => kv.setItem(STORAGE_KEYS.preferences, snapshot));
  }
  async function readAppRole(): Promise<AppRole | null> {
    const raw = await kv.getItem(STORAGE_KEYS.appRole);
    if (raw === null) return null;
    if (isAppRole(raw)) {
      warnings.delete('appRole');
      return raw;
    }
    warnings.set('appRole', '身份入口记录无法识别，请重新选择主持人或玩家；主持存档和玩家笔记未受影响。');
    return null;
  }
  function persistAppRole(role: AppRole): Promise<void> {
    try { requireNotRestoring(); } catch (error) { return Promise.reject(error); }
    if (!isAppRole(role)) return Promise.reject(new Error('身份入口无效，未保存。'));
    return appRoleQueue.command(() => kv.setItem(STORAGE_KEYS.appRole, role));
  }
  return { readSession, readHistory, persistSession, retryPersistSession, persistHistoryGame, removeArchivedGame, clearSession, clearDamagedSession, exportRawData, exportBackup, restoreBackup, readPreferences, persistPreferences, readAppRole, persistAppRole, getWarnings: () => [...warnings.values()] };
}
