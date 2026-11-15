import { ROLES, isWolf } from './roles';
import type { Game, Night, Player, Role } from './types';

export const emptyNight = (): Night => ({ targets: {}, knife: null, guard: null, inspect: null, save: false, poison: null, checkDeaths: undefined, manualDeaths: undefined, manualReason: undefined });
export const clone = <T,>(v: T): T => JSON.parse(JSON.stringify(v));
export const demand = (ok: unknown, message: string): void => { if (!ok) throw new Error(message); };

export const alive = (g: Game) => g.players.filter(p => p.alive);
export const canVote = (p: Player) => p.alive && !p.exposed;
export const actor = (g: Game, role: Role) => g.players.find(p => p.role === role && p.alive);

export function seatName(g: Game, seat: number | null): string {
  if (seat === null) return '无人';
  const name = g.players.find(p => p.seat === seat)?.name;
  return name ? `${seat} 号 · ${name}` : `${seat} 号`;
}

export const wolvesAlive = (g: Game) => g.players.filter(p => p.alive && isWolf(p.role));
export const goodAlive = (g: Game) => g.players.filter(p => p.alive && ROLES[p.role].camp === 'good');

export function log(g: Game, text: string, publicText?: string) {
  g.events.push({ id: g.events.length + 1, at: Date.now(), day: g.day, stage: g.stage, text, publicText });
}

export function player(g: Game, n: number): Player {
  const p = g.players.find(p => p.seat === n);
  demand(p, '座位不存在');
  return p!;
}

export function target(g: Game, n: number | null) {
  if (n !== null) demand(player(g, n).alive, '只能选择存活玩家');
}

export function requireStage(g: Game, ...stages: Game['stage'][]) {
  demand(stages.includes(g.stage), '当前阶段不能执行该操作');
}
