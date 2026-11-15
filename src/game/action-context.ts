import type { Action, Cause, Game, NightCall, Player, Role, Stage, Vote } from './types';

export type ActionOf<T extends Action['type']> = Extract<Action, { type: T }>;

/** 每个操作函数共享的引擎能力；由 engine.ts 在装配时分发。 */
export type ActionContext = {
  demand: (ok: unknown, message: string) => void;
  player: (g: Game, n: number) => Player;
  target: (g: Game, n: number | null) => void;
  requireStage: (g: Game, ...stages: Stage[]) => void;
  log: (g: Game, text: string, publicText?: string) => void;
  nextNightCall: (g: Game, from: NightCall | null) => void;
  actor: (g: Game, role: Role) => Player | undefined;
  knifeActors: (g: Game) => Player[];
  alive: (g: Game) => Player[];
  canVote: (p: Player) => boolean;
  makeVote: (g: Game, kind: Vote['kind'], candidates: number[], round?: number) => Vote;
  tally: (g: Game) => { seat: number; votes: number }[];
  exile: (g: Game, seat: number) => void;
  afterSheriff: (g: Game) => void;
  resolveDelayedDeaths: (g: Game) => void;
  advance: (g: Game) => void;
  nightDeaths: (g: Game) => { seat: number; cause: Cause }[];
  privateDeathDetails: (deaths: { seat: number; cause: Cause }[]) => string;
  getNightAnnouncement: (g: Game) => string;
  kill: (g: Game, seat: number, cause: Cause) => void;
  end: (g: Game, winner: 'good' | 'wolf' | 'third' | 'draw', reason: string) => void;
  addMark: (g: Game, seat: number) => void;
  moveVoteMark: (g: Game, voter: number, previous: number | null | undefined, next: number | null) => void;
  nineTailsVoter: (g: Game, seat: number) => boolean;
  callActorAlive: (g: Game, call: NightCall) => boolean;
};
