import { BOARD_LIBRARY, boardSeats, countsFromRoles, emptyCounts, nightCallsFor, type Board } from './boards';
import { createGame, validateCounts } from './engine';
import { validateFlow } from './flow';
import { drawJingchengTreasure, treasureReserveLog } from './jingcheng-draw';
import { isRole, type Role } from './roles';
import { isValidSpeechSeconds, speechSecondsForRules, validateSpeechDurations } from './speech';
import { validateTableRules } from './table-rules';
import type { Game, Rules } from './types';
import type { HostingMode } from './preferences';

/** 一局开始时的完整赛前设置，用于下一局原样带入。 */
export type SetupMemory = {
  version: 1;
  mode: HostingMode;
  /** 能从板子库找到时保留编号；自定义阵容不填。 */
  boardId?: string;
  boardName: string;
  roles: Role[];
  rules: Rules;
  /** 与 roles 一一对应；空字符串表示当时没有填写姓名。 */
  playerNames: string[];
  gameName: string;
  savedAt: number;
};

/** Build a fresh remember record without calling time functions during render. */
export function makeSetupMemory(input: Omit<SetupMemory, 'version' | 'savedAt'>): SetupMemory {
  return { version: 1, ...input, savedAt: Date.now() };
}

/** Mark a reused setup as the latest one, so it wins over older session fallbacks. */
export function refreshSetupMemory(setup: SetupMemory, mode: HostingMode): SetupMemory {
  return { ...setup, mode, savedAt: Date.now() };
}

const object = (value: unknown): value is Record<string, unknown> => !!value && typeof value === 'object' && !Array.isArray(value);
const oneOf = (value: unknown, options: unknown[]) => options.includes(value);
const text = (value: unknown, maxLength: number): value is string => typeof value === 'string' && !!value.trim() && value.trim().length <= maxLength;
const shortText = (value: unknown, maxLength: number): value is string => typeof value === 'string' && value.length <= maxLength;

function cloneRules(rules: Rules): Rules {
  return JSON.parse(JSON.stringify(rules)) as Rules;
}

function validRules(value: unknown, roles: Role[]): value is Rules {
  if (!object(value)) return false;
  const counts = emptyCounts();
  roles.forEach(role => { counts[role] += 1; });
  const rules = value as unknown as Rules;
  const valid = typeof rules.sheriff === 'boolean'
    && (rules.sheriffTiming === undefined || oneOf(rules.sheriffTiming, ['before-announcement', 'after-announcement']))
    && oneOf(rules.win, ['edge', 'all'])
    && oneOf(rules.selfSave, ['never', 'first', 'always'])
    && typeof rules.doubleMedicine === 'boolean'
    && oneOf(rules.guardSave, ['die', 'live'])
    && typeof rules.hunterPoison === 'boolean'
    && oneOf(rules.sheriffWeight, [1, 1.5])
    && isValidSpeechSeconds(rules.speechSeconds)
    && validateSpeechDurations(rules.speechDurations)
    && validateTableRules(rules.table)
    && (rules.flow === undefined || validateFlow(rules.flow, countsFromRoles(counts)));
  if (!valid) return false;
  try { validateCounts(counts, rules); } catch { return false; }
  return true;
}

export function isSetupMemory(value: unknown): value is SetupMemory {
  if (!object(value) || value.version !== 1) return false;
  if (!oneOf(value.mode, ['standard', 'quick', 'custom'])) return false;
  if (value.boardId !== undefined && !text(value.boardId, 100)) return false;
  if (!text(value.boardName, 24)) return false;
  if (!Array.isArray(value.roles) || value.roles.length < 6 || value.roles.length > 16 || !value.roles.every(isRole)) return false;
  if (!Array.isArray(value.playerNames) || value.playerNames.length !== value.roles.length || !value.playerNames.every(name => shortText(name, 12))) return false;
  if (!text(value.gameName, 24)) return false;
  if (typeof value.savedAt !== 'number' || !Number.isFinite(value.savedAt) || value.savedAt < 0) return false;
  return validRules(value.rules, value.roles);
}

/** 深拷贝，避免设置页继续修改时影响已经保存的记忆。 */
export function normalizeSetupMemory(value: SetupMemory): SetupMemory {
  return {
    ...value,
    roles: [...value.roles],
    rules: cloneRules(value.rules),
    playerNames: [...value.playerNames],
  };
}

function rolesMatch(board: Board, roles: Role[]): boolean {
  if (board.deck || board.playerCount !== roles.length) return false;
  const left = boardSeats(board).slice().sort();
  const right = roles.slice().sort();
  return left.length === right.length && left.every((role, index) => role === right[index]);
}

function findBoard(name: string, roles: Role[], boardId?: string): Board | undefined {
  if (boardId) {
    const exact = BOARD_LIBRARY.find(board => board.id === boardId);
    if (exact?.deck) return exact;
    if (exact && rolesMatch(exact, roles)) return exact;
  }
  const named = BOARD_LIBRARY.filter(board => board.name === name);
  const deck = named.find(board => board.deck);
  if (deck) return deck;
  return named.find(board => rolesMatch(board, roles));
}

function customBoard(name: string, roles: Role[]): Board {
  const counts = emptyCounts();
  roles.forEach(role => { counts[role] += 1; });
  const roleCounts = Object.fromEntries(Object.entries(counts).filter(([, count]) => count > 0)) as Partial<Record<Role, number>>;
  return {
    id: 'remembered-setup',
    name: name.trim() || '上次阵容',
    subtitle: `${roles.length} 人 · 沿用上次设置`,
    tag: 'custom',
    playerCount: roles.length,
    roles: roleCounts,
    counts,
    night: nightCallsFor(counts),
    note: '来自上次开局设置',
  };
}

/** 找到设置页要展示的板子；自定义阵容会重建成一个临时板子。 */
export function boardForSetup(memory: SetupMemory): Board {
  return findBoard(memory.boardName, memory.roles, memory.boardId) ?? customBoard(memory.boardName, memory.roles);
}

/** 直接用记住的设置开局；牌池型板子会重新洗牌，其余板子保留上次的座位身份。 */
export function gameFromSetup(memory: SetupMemory): Game {
  const board = boardForSetup(memory);
  const draw = board.deck ? drawJingchengTreasure() : null;
  const roles = draw ? draw.roles : memory.roles;
  const players = roles.map((role, index) => ({
    name: memory.playerNames[index] || `${index + 1}号玩家`,
    role,
  }));
  return createGame(memory.gameName, board.name, players, cloneRules(memory.rules), {
    privateNotes: draw ? [treasureReserveLog(draw)] : [],
    ...(draw ? { treasure: { reserve: [...draw.reserve], camp: draw.treasureCamp } } : {}),
  });
}

const DEFAULT_PLAYER_NAME = /^\d+号玩家$/;

/** 从已经结束的对局反推设置，作为旧数据没有记忆时的兜底。 */
export function setupMemoryFromGame(game: Game, mode: HostingMode): SetupMemory {
  const roles = game.players.map(player => player.role);
  const board = findBoard(game.board, roles);
  return {
    version: 1,
    mode,
    ...(board ? { boardId: board.id } : {}),
    boardName: game.board.trim().slice(0, 24) || '上次阵容',
    roles,
    rules: cloneRules(game.rules),
    playerNames: game.players.map(player => DEFAULT_PLAYER_NAME.test(player.name) ? '' : player.name.slice(0, 12)),
    gameName: game.name.trim().slice(0, 24) || '周末局',
    savedAt: game.endedAt ?? game.startedAt,
  };
}

export function setupSummary(memory: Pick<SetupMemory, 'rules' | 'playerNames'>): string {
  const parts = [
    memory.rules.sheriff ? '有警长' : '无警长',
    memory.rules.win === 'all' ? '屠城' : '屠边',
    `发言 ${speechSecondsForRules(memory.rules, 'discussion')} 秒`,
  ];
  if (memory.rules.flow?.nightOrder || memory.rules.flow?.scripts) parts.push('自定义流程');
  if (memory.rules.flow?.identityCheck === 'during-night' || memory.rules.flow?.identityCheck === 'at-nightfall') parts.push('夜间行动时确认身份');
  if (memory.rules.table?.exileRecord === 'quick') parts.push('快速放逐记录');
  if (memory.rules.flow?.manualDawn) parts.push('天亮复核');
  if (memory.rules.flow?.manualVictory) parts.push('主持人判胜');
  if (memory.rules.table?.notes?.trim()) parts.push('含本桌约定');
  const named = memory.playerNames.filter(name => name.trim()).length;
  if (named) parts.push(`已记 ${named} 个姓名`);
  return parts.join(' · ');
}
