import { BOARD_LIBRARY, boardById, boardRoles, type Board } from '../game/boards';
import { ROLE_REFERENCE } from '../game/role-reference';
import { campOf, isRole, isVillager, type Role } from '../game/roles';

export const PLAYER_COUNT_MIN = 6;
export const PLAYER_COUNT_MAX = 16;
export const SEAT_MARKS = ['unknown', 'wolf', 'good', 'god', 'villager'] as const;
export type SeatMark = typeof SEAT_MARKS[number];

export const SEAT_MARK_LABELS: Record<SeatMark, string> = {
  unknown: '未知',
  wolf: '疑似狼',
  good: '偏好',
  god: '疑似神',
  villager: '疑似民',
};

export const SEAT_MARK_SHORT: Record<SeatMark, string> = {
  unknown: '',
  wolf: '狼',
  good: '好',
  god: '神',
  villager: '民',
};

export const EVENT_PHASES = ['night', 'day', 'other'] as const;
export type EventPhase = typeof EVENT_PHASES[number];
export const EVENT_PHASE_LABELS: Record<EventPhase, string> = {
  night: '夜间信息',
  day: '白天信息',
  other: '其他',
};

export type SeatNote = { mark: SeatMark; roleGuess: Role | null; note: string; eliminated: boolean };
export type PlayerVote = { id: string; round: number; voter: number; target: number | null };
export type PlayerEvent = { id: string; round: number; phase: EventPhase; text: string };
export type PlayerSkillUse = { id: string; round: number; skill: string; target: number | null; result: string };

export type PlayerNotebook = {
  version: 4;
  boardId: string;
  boardName: string;
  gameName: string;
  playerCount: number;
  ownSeat: number;
  ownRole: Role;
  seatNotes: Record<number, SeatNote>;
  votes: PlayerVote[];
  events: PlayerEvent[];
  skillUses: PlayerSkillUse[];
  summary: string;
  updatedAt: number;
};

export const MAX_SEAT_NOTE = 500;
export const MAX_SUMMARY = 2000;
export const MAX_EVENT_TEXT = 300;
export const MAX_SKILL_NAME = 30;
export const MAX_SKILL_RESULT = 300;
export const MAX_EVENTS = 300;
export const MAX_SKILL_USES = 200;

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

let recordSequence = 0;
function nextRecordId(prefix: string): string {
  recordSequence = (recordSequence + 1) % 100000;
  return `${prefix}-${Date.now().toString(36)}-${recordSequence}`;
}

export function createPlayerNotebook(input: {
  boardId: string;
  boardName?: string;
  gameName: string;
  playerCount: number;
  ownSeat: number;
  ownRole: Role;
}): PlayerNotebook {
  const playerCount = Math.trunc(input.playerCount);
  const ownSeat = Math.trunc(input.ownSeat);
  const board = boardById(input.boardId);
  if (!board) throw new Error('本局板子无效');
  if (!Number.isInteger(playerCount) || playerCount < PLAYER_COUNT_MIN || playerCount > PLAYER_COUNT_MAX) throw new Error(`人数必须是 ${PLAYER_COUNT_MIN}–${PLAYER_COUNT_MAX}`);
  if (playerCount !== board.playerCount) throw new Error(`人数由「${board.name}」决定，应为 ${board.playerCount} 人`);
  if (!Number.isInteger(ownSeat) || ownSeat < 1 || ownSeat > playerCount) throw new Error('座位号超出本局人数');
  if (!isRole(input.ownRole)) throw new Error('身份无效');
  if (!boardRoles(board).includes(input.ownRole)) throw new Error('该身份不属于本局板子');
  const seatNotes = Object.fromEntries(Array.from({ length: playerCount }, (_, index) => [index + 1, { mark: 'unknown' as SeatMark, roleGuess: null, note: '', eliminated: false }])) as Record<number, SeatNote>;
  return {
    version: 4,
    boardId: board.id,
    boardName: board.name,
    gameName: input.gameName.trim().slice(0, 24),
    playerCount,
    ownSeat,
    ownRole: input.ownRole,
    seatNotes,
    votes: [],
    events: [],
    skillUses: [],
    summary: '',
    updatedAt: Date.now(),
  };
}

export function setSeatMark(notebook: PlayerNotebook, seat: number, mark: SeatMark): PlayerNotebook {
  const current = notebook.seatNotes[seat];
  if (!current) throw new Error('座位不存在');
  const roleGuess = current.mark === mark ? current.roleGuess : null;
  return {
    ...notebook,
    seatNotes: { ...notebook.seatNotes, [seat]: { ...current, mark, roleGuess } },
    updatedAt: Date.now(),
  };
}

export function setSeatEliminated(notebook: PlayerNotebook, seat: number, eliminated: boolean): PlayerNotebook {
  const current = notebook.seatNotes[seat];
  if (!current) throw new Error('座位不存在');
  return {
    ...notebook,
    seatNotes: { ...notebook.seatNotes, [seat]: { ...current, eliminated } },
    updatedAt: Date.now(),
  };
}

export function setSeatRoleGuess(notebook: PlayerNotebook, seat: number, role: Role | null): PlayerNotebook {
  const current = notebook.seatNotes[seat];
  if (!current) throw new Error('座位不存在');
  if (role !== null && !isRole(role)) throw new Error('身份无效');
  const board = boardById(notebook.boardId);
  if (role !== null && board && !boardRoles(board).includes(role)) throw new Error('该身份不属于本局板子');
  let mark = current.mark;
  if (role) {
    const camp = ROLE_REFERENCE[role].camp ?? campOf(role);
    if (camp === 'wolf') mark = 'wolf';
    else if (camp === 'good') mark = isVillager(role) ? 'villager' : 'god';
    else mark = 'unknown';
  }
  return {
    ...notebook,
    seatNotes: { ...notebook.seatNotes, [seat]: { ...current, roleGuess: role, mark } },
    updatedAt: Date.now(),
  };
}

export function setSeatNote(notebook: PlayerNotebook, seat: number, note: string): PlayerNotebook {
  if (!notebook.seatNotes[seat]) throw new Error('座位不存在');
  return {
    ...notebook,
    seatNotes: { ...notebook.seatNotes, [seat]: { ...notebook.seatNotes[seat], note: note.slice(0, MAX_SEAT_NOTE) } },
    updatedAt: Date.now(),
  };
}

export function updatePlayerBasics(notebook: PlayerNotebook, input: { gameName: string; ownSeat: number; ownRole: Role }): PlayerNotebook {
  const ownSeat = Math.trunc(input.ownSeat);
  if (!Number.isInteger(ownSeat) || ownSeat < 1 || ownSeat > notebook.playerCount) throw new Error('座位号超出本局人数');
  if (!isRole(input.ownRole)) throw new Error('身份无效');
  const board = boardById(notebook.boardId);
  if (board && !boardRoles(board).includes(input.ownRole)) throw new Error('该身份不属于本局板子');
  return {
    ...notebook,
    gameName: input.gameName.trim().slice(0, 24),
    ownSeat,
    ownRole: input.ownRole,
    updatedAt: Date.now(),
  };
}

export function addVote(notebook: PlayerNotebook, vote: Omit<PlayerVote, 'id'>): PlayerNotebook {
  if (!Number.isInteger(vote.round) || vote.round < 1 || vote.round > 20) throw new Error('轮次无效');
  if (!notebook.seatNotes[vote.voter]) throw new Error('投票人座位不存在');
  if (vote.target !== null && !notebook.seatNotes[vote.target]) throw new Error('得票人座位不存在');
  if (notebook.votes.length >= 500) throw new Error('票型记录已满');
  return {
    ...notebook,
    votes: [...notebook.votes, { ...vote, id: nextRecordId('vote') }],
    updatedAt: Date.now(),
  };
}

export function removeVote(notebook: PlayerNotebook, id: string): PlayerNotebook {
  return { ...notebook, votes: notebook.votes.filter(vote => vote.id !== id), updatedAt: Date.now() };
}

export function addEvent(notebook: PlayerNotebook, event: Omit<PlayerEvent, 'id'>): PlayerNotebook {
  if (!Number.isInteger(event.round) || event.round < 1 || event.round > 20) throw new Error('轮次无效');
  if (!EVENT_PHASES.includes(event.phase)) throw new Error('事件类型无效');
  const text = event.text.trim().slice(0, MAX_EVENT_TEXT);
  if (!text) throw new Error('事件内容不能为空');
  if (notebook.events.length >= MAX_EVENTS) throw new Error('事件记录已满');
  return {
    ...notebook,
    events: [...notebook.events, { id: nextRecordId('event'), round: event.round, phase: event.phase, text }],
    updatedAt: Date.now(),
  };
}

export function removeEvent(notebook: PlayerNotebook, id: string): PlayerNotebook {
  return { ...notebook, events: notebook.events.filter(event => event.id !== id), updatedAt: Date.now() };
}

export function addSkillUse(notebook: PlayerNotebook, use: Omit<PlayerSkillUse, 'id'>): PlayerNotebook {
  if (!Number.isInteger(use.round) || use.round < 1 || use.round > 20) throw new Error('轮次无效');
  const skill = use.skill.trim().slice(0, MAX_SKILL_NAME);
  if (!skill) throw new Error('技能名称不能为空');
  if (use.target !== null && !notebook.seatNotes[use.target]) throw new Error('技能目标座位不存在');
  if (notebook.skillUses.length >= MAX_SKILL_USES) throw new Error('技能记录已满');
  return {
    ...notebook,
    skillUses: [...notebook.skillUses, { id: nextRecordId('skill'), round: use.round, skill, target: use.target, result: use.result.trim().slice(0, MAX_SKILL_RESULT) }],
    updatedAt: Date.now(),
  };
}

export function removeSkillUse(notebook: PlayerNotebook, id: string): PlayerNotebook {
  return { ...notebook, skillUses: notebook.skillUses.filter(use => use.id !== id), updatedAt: Date.now() };
}

export function setSummary(notebook: PlayerNotebook, summary: string): PlayerNotebook {
  return { ...notebook, summary: summary.slice(0, MAX_SUMMARY), updatedAt: Date.now() };
}

function baseIsValid(value: Record<string, unknown>, version: 1 | 2 | 3 | 4): boolean {
  if (typeof value.gameName !== 'string' || value.gameName.length > 24) return false;
  if (!Number.isInteger(value.playerCount) || (value.playerCount as number) < PLAYER_COUNT_MIN || (value.playerCount as number) > PLAYER_COUNT_MAX) return false;
  const playerCount = value.playerCount as number;
  if (!Number.isInteger(value.ownSeat) || (value.ownSeat as number) < 1 || (value.ownSeat as number) > playerCount) return false;
  if (!isRole(value.ownRole)) return false;
  if (!isRecord(value.seatNotes) || Object.keys(value.seatNotes).length !== playerCount) return false;
  for (let seat = 1; seat <= playerCount; seat += 1) {
    const note = value.seatNotes[String(seat)];
    if (!isRecord(note)) return false;
    if (!SEAT_MARKS.includes(note.mark as SeatMark)) return false;
    if (typeof note.note !== 'string' || note.note.length > MAX_SEAT_NOTE) return false;
    if (version >= 2 && note.roleGuess !== null && !isRole(note.roleGuess)) return false;
    if (version >= 4 && typeof note.eliminated !== 'boolean') return false;
    if (version === 1 && note.roleGuess !== undefined && note.roleGuess !== null && !isRole(note.roleGuess)) return false;
  }
  if (!Array.isArray(value.votes) || value.votes.length > 500) return false;
  for (const vote of value.votes) {
    if (!isRecord(vote) || typeof vote.id !== 'string' || !vote.id) return false;
    if (!Number.isInteger(vote.round) || (vote.round as number) < 1 || (vote.round as number) > 20) return false;
    if (!Number.isInteger(vote.voter) || (vote.voter as number) < 1 || (vote.voter as number) > playerCount) return false;
    if (vote.target !== null && (!Number.isInteger(vote.target) || (vote.target as number) < 1 || (vote.target as number) > playerCount)) return false;
  }
  if (typeof value.summary !== 'string' || value.summary.length > MAX_SUMMARY) return false;
  return typeof value.updatedAt === 'number' && Number.isFinite(value.updatedAt);
}

export function isValidPlayerNotebook(value: unknown): value is PlayerNotebook {
  if (!isRecord(value) || value.version !== 4 || !baseIsValid(value, 4)) return false;
  if (typeof value.boardId !== 'string' || !value.boardId.trim() || value.boardId.length > 100) return false;
  if (typeof value.boardName !== 'string' || !value.boardName.trim() || value.boardName.length > 40) return false;
  const board = boardById(value.boardId);
  if (board) {
    if (value.playerCount !== board.playerCount) return false;
    if (!boardRoles(board).includes(value.ownRole as Role)) return false;
    const boardRoleSet = new Set(boardRoles(board));
    for (const note of Object.values(value.seatNotes as Record<number, SeatNote>)) {
      if (note.roleGuess && !boardRoleSet.has(note.roleGuess as Role)) return false;
    }
  }
  if (!Array.isArray(value.events) || value.events.length > MAX_EVENTS) return false;
  for (const event of value.events) {
    if (!isRecord(event) || typeof event.id !== 'string' || !event.id) return false;
    if (!Number.isInteger(event.round) || (event.round as number) < 1 || (event.round as number) > 20) return false;
    if (!EVENT_PHASES.includes(event.phase as EventPhase)) return false;
    if (typeof event.text !== 'string' || !event.text.trim() || event.text.length > MAX_EVENT_TEXT) return false;
  }
  if (!Array.isArray(value.skillUses) || value.skillUses.length > MAX_SKILL_USES) return false;
  for (const use of value.skillUses) {
    if (!isRecord(use) || typeof use.id !== 'string' || !use.id) return false;
    if (!Number.isInteger(use.round) || (use.round as number) < 1 || (use.round as number) > 20) return false;
    if (typeof use.skill !== 'string' || !use.skill.trim() || use.skill.length > MAX_SKILL_NAME) return false;
    if (use.target !== null && (!Number.isInteger(use.target) || (use.target as number) < 1 || (use.target as number) > (value.playerCount as number))) return false;
    if (typeof use.result !== 'string' || use.result.length > MAX_SKILL_RESULT) return false;
  }
  return true;
}

export function migratePlayerNotebook(value: unknown): PlayerNotebook | null {
  if (!isRecord(value)) return null;
  if (value.version !== 1 && value.version !== 2 && value.version !== 3 && value.version !== 4) return null;
  if (!baseIsValid(value, value.version)) return null;
  const playerCount = value.playerCount as number;
  const oldSeats = value.seatNotes as Record<string, { mark: SeatMark; note: string; roleGuess?: Role | null; eliminated?: boolean }>;
  const seatNotes = Object.fromEntries(Array.from({ length: playerCount }, (_, index) => {
    const note = oldSeats[String(index + 1)];
    return [index + 1, { mark: note.mark, roleGuess: note.roleGuess ?? null, note: note.note, eliminated: note.eliminated === true }];
  })) as Record<number, SeatNote>;
  const ownRole = value.ownRole as Role;
  const savedBoard = typeof value.boardId === 'string' ? boardById(value.boardId) : undefined;
  const guesses = Object.values(seatNotes).flatMap(note => note.roleGuess ? [note.roleGuess] : []);
  const savedRoles = savedBoard ? boardRoles(savedBoard) : [];
  const savedBoardMatches = !!savedBoard
    && savedBoard.playerCount === playerCount
    && savedRoles.includes(ownRole)
    && guesses.every(role => savedRoles.includes(role));
  const hasSavedBoard = typeof value.boardId === 'string' && value.boardId.trim().length > 0;
  const board = savedBoardMatches
    ? savedBoard
    : hasSavedBoard
      ? undefined
      : inferBoard(playerCount, ownRole, guesses);
  const fallbackBoardName = `旧版自定义（${playerCount} 人）`;
  const savedBoardName = typeof value.boardName === 'string' && value.boardName.trim()
    ? value.boardName
    : undefined;
  const boardName = savedBoardMatches
    ? savedBoard.name
    : savedBoard
      ? fallbackBoardName
      : savedBoardName ?? fallbackBoardName;
  const unknownSavedBoardId = hasSavedBoard && !savedBoard ? value.boardId as string : undefined;
  const migrated: PlayerNotebook = {
    version: 4,
    boardId: board?.id ?? unknownSavedBoardId ?? `legacy-custom-${playerCount}`,
    boardName,
    gameName: value.gameName as string,
    playerCount,
    ownSeat: value.ownSeat as number,
    ownRole,
    seatNotes,
    votes: value.votes as PlayerVote[],
    events: value.version === 1 ? [] : value.events as PlayerEvent[],
    skillUses: value.version === 1 ? [] : value.skillUses as PlayerSkillUse[],
    summary: value.summary as string,
    updatedAt: value.updatedAt as number,
  };
  return isValidPlayerNotebook(migrated) ? migrated : null;
}

function inferBoard(playerCount: number, ownRole: Role, guesses: Role[]): Board | undefined {
  const candidates = BOARD_LIBRARY
    .filter(board => {
      const roles = boardRoles(board);
      return board.playerCount === playerCount
        && roles.includes(ownRole)
        && guesses.every(role => roles.includes(role));
    });
  return candidates.length === 1 ? candidates[0] : undefined;
}

export function notebookMarkCounts(notebook: PlayerNotebook): Record<SeatMark, number> {
  const counts: Record<SeatMark, number> = { unknown: 0, wolf: 0, good: 0, god: 0, villager: 0 };
  for (const note of Object.values(notebook.seatNotes)) counts[note.mark] += 1;
  return counts;
}
