import { DEFAULT_RULES } from './config';
import { BOARD_LIBRARY, countsFromRoles, emptyCounts, nightCallsFor, type Board } from './boards';
import { validateCounts } from './engine';
import { validateFlow } from './flow';
import { isRole } from './roles';
import { isSetupMemory, normalizeSetupMemory, type SetupMemory } from './setup-memory';
import { validateTableRules } from './table-rules';
import type { Role, Rules } from './types';

export type HostingMode = 'standard' | 'quick' | 'custom';

export type HostingProfile = {
  id: string;
  name: string;
  boardName: string;
  /** Explicit catalog reference; legacy plans without it remain custom lineups. */
  sourceBoardId?: string;
  roles: Role[];
  rules: Rules;
};

export type HostPreferences = {
  hostingMode: HostingMode;
  profiles: HostingProfile[];
  selectedProfileId?: string;
  /** 上一局实际使用的完整设置；新局会优先带入并允许一键复用。 */
  lastSetup?: SetupMemory;
};

export const MAX_HOSTING_PROFILES = 20;

export const HOSTING_MODES: { key: HostingMode; title: string; description: string; note: string }[] = [
  { key: 'standard', title: '标准流程', description: '警长、夜间行动、投票和复盘都完整记录。', note: '适合固定板子和正式局' },
  { key: 'quick', title: '熟人快局', description: '减少开场环节，适合连续开局；桌规仍可继续调整。', note: '默认关闭警长' },
  { key: 'custom', title: '我的方案', description: '保存自己的阵容和桌规，下次直接使用。', note: '适合不同线下玩法' },
];

export function rulesForHostingMode(mode: HostingMode): Rules {
  if (mode === 'quick') return { ...DEFAULT_RULES, sheriff: false };
  return { ...DEFAULT_RULES };
}

export function hostingModeLabel(mode: HostingMode): string {
  return HOSTING_MODES.find(item => item.key === mode)?.title ?? '标准流程';
}

const object = (value: unknown): value is Record<string, unknown> => !!value && typeof value === 'object' && !Array.isArray(value);
const oneOf = (value: unknown, options: unknown[]) => options.includes(value);
const text = (value: unknown, maxLength: number): value is string => typeof value === 'string' && !!value.trim() && value.trim().length <= maxLength;

export function isHostingProfile(value: unknown): value is HostingProfile {
  if (!object(value) || !text(value.id, 100) || !text(value.name, 24) || !text(value.boardName, 24)) return false;
  if (value.sourceBoardId !== undefined && !text(value.sourceBoardId, 100)) return false;
  if (!Array.isArray(value.roles) || value.roles.length < 6 || value.roles.length > 16 || !value.roles.every(isRole)) return false;
  const counts = emptyCounts();
  value.roles.forEach(role => { counts[role]++; });
  const rules = value.rules;
  if (!object(rules)) return false;
  const validRules = typeof rules.sheriff === 'boolean'
    && (rules.sheriffTiming === undefined || oneOf(rules.sheriffTiming, ['before-announcement', 'after-announcement']))
    && oneOf(rules.win, ['edge', 'all'])
    && oneOf(rules.selfSave, ['never', 'first', 'always'])
    && typeof rules.doubleMedicine === 'boolean'
    && oneOf(rules.guardSave, ['die', 'live'])
    && typeof rules.hunterPoison === 'boolean'
    && oneOf(rules.sheriffWeight, [1, 1.5])
    && typeof rules.speechSeconds === 'number' && Number.isFinite(rules.speechSeconds) && rules.speechSeconds > 0
    && validateTableRules(rules.table)
    && (rules.flow === undefined || validateFlow(rules.flow, countsFromRoles(counts)));
  if (!validRules) return false;
  try { validateCounts(counts, rules as Rules); } catch { return false; }
  return true;
}

/** Recover valid profiles individually, including preferences saved before profiles existed. */
export function normalizePreferences(value: unknown): HostPreferences {
  const input = object(value) ? value : {};
  const hostingMode: HostingMode = input.hostingMode === 'quick' || input.hostingMode === 'custom' ? input.hostingMode : 'standard';
  const profiles: HostingProfile[] = [];
  if (Array.isArray(input.profiles)) {
    for (const entry of input.profiles) {
      if (!isHostingProfile(entry) || profiles.some(profile => profile.id === entry.id)) continue;
      profiles.push({
        id: entry.id, name: entry.name.trim(), boardName: entry.boardName.trim(), roles: [...entry.roles],
        ...(entry.sourceBoardId ? { sourceBoardId: entry.sourceBoardId.trim() } : {}),
        rules: {
          ...entry.rules,
          sheriffTiming: entry.rules.sheriffTiming ?? 'before-announcement',
          ...(entry.rules.table ? { table: { ...entry.rules.table } } : {}),
          ...(entry.rules.flow ? { flow: {
            ...entry.rules.flow,
            ...(entry.rules.flow.nightOrder ? { nightOrder: [...entry.rules.flow.nightOrder] } : {}),
            ...(entry.rules.flow.scripts ? { scripts: { ...entry.rules.flow.scripts } } : {}),
          } } : {}),
        },
      });
      if (profiles.length === MAX_HOSTING_PROFILES) break;
    }
  }
  const selectedProfileId = typeof input.selectedProfileId === 'string' && profiles.some(profile => profile.id === input.selectedProfileId)
    ? input.selectedProfileId : undefined;
  const lastSetup = isSetupMemory(input.lastSetup) ? normalizeSetupMemory(input.lastSetup) : undefined;
  return {
    hostingMode,
    profiles,
    ...(selectedProfileId ? { selectedProfileId } : {}),
    ...(lastSetup ? { lastSetup } : {}),
  };
}

export function profileBoard(profile: HostingProfile): Board {
  const roles = emptyCounts();
  profile.roles.forEach(role => { roles[role]++; });
  const counts = countsFromRoles(roles);
  const sourceBoard = profile.sourceBoardId ? BOARD_LIBRARY.find(board => board.id === profile.sourceBoardId
    && Object.entries(counts).every(([role, count]) => board.counts[role as Role] === count)) : undefined;
  return {
    id: `profile-${profile.id}`, name: profile.boardName, subtitle: `${profile.roles.length} 人 · 我的方案`, tag: 'custom',
    playerCount: profile.roles.length, roles, counts, night: nightCallsFor(counts), note: `来自方案「${profile.name}」`,
    ...(sourceBoard ? { sourceBoardId: sourceBoard.id } : {}),
    ...(sourceBoard?.catalog ? { catalog: sourceBoard.catalog } : {}),
  };
}
