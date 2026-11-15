import type { Role } from './roles';

export type { Role };

export type Counts = Record<Role, number>;
export type NightCall = Role | 'wolves';

/** 固定阶段 + 夜间角色行动阶段（阶段名即行动 id） */
export type Stage =
  | 'identity-check' | 'dawn' | 'dawn-announcement' | 'last-words' | 'sheriff-signup' | 'sheriff-vote'
  | 'discussion' | 'exile-vote' | 'hunter' | 'badge' | 'shot' | 'link' | 'heir' | 'ended'
  | NightCall;

export type Cause = 'knife' | 'poison' | 'exile' | 'shot' | 'explode' | 'ruling' | 'link' | 'dance' | 'hunt' | 'check' | 'dream' | 'demon-hunt';

export type Player = {
  seat: number;
  name: string;
  role: Role;
  alive: boolean;
  exposed: boolean;
  death?: { day: number; cause: Cause };
};

export type Rules = {
  sheriff: boolean;
  /** 首日警长竞选与死亡公布的先后；旧存档缺失时按先竞选后公布处理 */
  sheriffTiming?: 'before-announcement' | 'after-announcement';
  win: 'edge' | 'all';
  selfSave: 'never' | 'first' | 'always';
  doubleMedicine: boolean;
  guardSave: 'die' | 'live';
  hunterPoison: boolean;
  sheriffWeight: 1 | 1.5;
  speechSeconds: number;
  /** 各环节独立计时；缺失字段沿用 speechSeconds。 */
  speechDurations?: SpeechDurations;
  /** Optional per-table overrides. Omitted fields use the standard defaults. */
  table?: TableRules;
  /** 可选的主持流程覆盖；不填时使用板子默认流程。 */
  flow?: HostingFlow;
};

export type SpeechDurations = {
  discussion?: number;
  sheriff?: number;
  pk?: number;
  lastWords?: number;
};

export type LastWordsPolicy = {
  /** 首夜因夜间效果出局。 */
  firstNight?: boolean;
  /** 第二夜及以后因夜间效果出局。 */
  laterNight?: boolean;
  /** 被放逐。 */
  exile?: boolean;
  /** 被技能带走或由主持人裁定为技能出局。 */
  skill?: boolean;
  /** 白天自爆。 */
  explode?: boolean;
};

export type TableRules = {
  /** Special published lineups may omit a civilian edge; victory must be confirmed by the host. */
  lineupMode?: 'standard' | 'free';
  /** Some published draw-pool games only allow wolves to recognise one another on night one. */
  firstNightKnife?: boolean;
  /** Whether the guard may protect the same seat on consecutive nights. */
  guardRepeat?: boolean;
  /** First-round sheriff tie handling. */
  sheriffTie?: 'pk' | 'none';
  /** First-round exile tie handling. */
  exileTie?: 'pk' | 'none';
  /** Fast mode records only the final exile seat and omits per-voter ballots. */
  exileRecord?: 'detailed' | 'quick';
  /** Host-facing notes agreed before the game starts. */
  notes?: string;
};

export type HostingFlow = {
  /** 必须包含当前阵容的全部夜间行动，顺序可调整。 */
  nightOrder?: NightCall[];
  /** 按阶段覆盖主持人口播；只影响显示，不改变结算。 */
  scripts?: Partial<Record<Stage, string>>;
  /** 开启后，天亮时必须由主持人明确确认昨夜出局名单。 */
  manualDawn?: boolean;
  /** Keep a dead role's night call as an explicit empty wake-up for the host. */
  keepDeadCalls?: boolean;
  /**
   * after-deal: players look at their cards after dealing.
   * during-night: seat numbers are revealed in context as each role acts.
   * at-nightfall is retained only for reading 1.0.1 sessions that are already in the old
   * pre-night seat-confirmation stage; new games use during-night.
   */
  identityCheck?: 'after-deal' | 'during-night' | 'at-nightfall';
  /** Let the host confirm victory instead of ending automatically for standard camps. */
  manualVictory?: boolean;
  /** 各类死亡是否进入独立遗言队列；全部缺省时保持旧流程。 */
  lastWords?: LastWordsPolicy;
};

export type Night = {
  /** 各自定义角色的行动目标，按行动 id 记录 */
  targets: Record<string, number | null>;
  knife: number | null;
  guard: number | null;
  inspect: number | null;
  save: boolean;
  poison: number | null;
  /** 查验类技能在天亮时造成的出局 */
  checkDeaths?: number[];
  manualDeaths?: { seat: number; cause: Cause }[];
  manualReason?: string;
};

export type Vote = {
  kind: 'sheriff' | 'exile';
  round: number;
  candidates: number[];
  voters: number[];
  ballots: Record<number, number | null>;
  result?: string;
};

export type Pending = {
  kind: 'last-words' | 'hunter' | 'shot' | 'link' | 'badge' | 'heir';
  seat: number;
  role?: Role;
  /** link 类型需要带走的座位 */
  target?: number;
};

/** 特殊板子的自动结算状态；旧存档缺失时按空状态处理。 */
export type SpecialState = {
  /** 九尾标记：座位 → 层数（隐藏信息） */
  marks?: Record<number, number>;
  /** 毒师毒药是否已用完 */
  poisonerUsed?: boolean;
  /** 今夜舞池；固定三人，不存在平票 */
  dance?: { pool: number[] };
  /** 进过舞池的座位，整局累计 */
  danceVisited?: number[];
  /** 机械狼学到的身份，整局一次 */
  mechLearned?: Role;
  /** 石像鬼已经查验过的座位，整局不能重复 */
  gargoyleChecked?: number[];
  /** 摄梦人上夜目标 */
  dreamerLast?: number | null;
  /** 噩梦之影上夜恐惧目标 */
  nightmareLast?: number | null;
  /** 流光伯爵上夜庇护目标 */
  lightEarlLast?: number | null;
  /** 盗宝大师：底牌、阵营与当夜/上夜借用的身份 */
  treasure?: { reserve: Role[]; camp: 'wolf' | 'good'; borrowed?: Role | null; lastBorrowed?: Role | null };
  /** 白泽传承：继承人及其类型 */
  heir?: { seat: number; kind: 'villager' | 'god' | 'wolf' };
  /** 神职继承人夜间出局后，延迟到投票结束才离场 */
  delayedDeaths?: { seat: number; cause: Cause }[];
};

export type Event = { id: number; at: number; day: number; stage: Stage; text: string; publicText?: string };

export type Game = {
  schema: 2;
  id: string;
  name: string;
  board: string;
  startedAt: number;
  endedAt?: number;
  day: number;
  stage: Stage;
  /** 本局夜间行动顺序，随角色构成生成 */
  nightCalls: NightCall[];
  /** 渐进确认模式中已经随正常行动核对的身份座位；旧存档也可保存逐座预确认进度。 */
  identityConfirmed?: number[];
  players: Player[];
  rules: Rules;
  night: Night;
  lastGuard: number | null;
  medicine: { save: boolean; poison: boolean };
  sheriff: number | null;
  sheriffDone: boolean;
  signup: number[];
  vote: Vote | null;
  pending: Pending[];
  announcementReady: boolean;
  nightAnnouncement?: string;
  resume: 'discussion' | 'night';
  events: Event[];
  /** 特殊板子的自动结算状态 */
  special?: SpecialState;
  winner?: 'good' | 'wolf' | 'third' | 'draw';
  endReason?: string;
};

export type Session = { current: Game; undo: Game[]; redo: Game[] };

export type Action =
  | { type: 'skip-night'; reason?: string }
  | { type: 'guard'; target: number | null }
  | { type: 'wolves'; target: number | null }
  | { type: 'seer'; target: number | null }
  | { type: 'witch'; save: boolean; poison: number | null }
  | { type: 'call'; callId: string; target: number | null }
  | { type: 'confirm-identity'; seat: number }
  | { type: 'dawn' }
  | { type: 'set-dawn-deaths'; deaths: { seat: number; cause: Cause }[]; reason: string }
  | { type: 'announce-dawn' }
  | { type: 'last-words'; speak: boolean }
  | { type: 'signup'; seats: number[] }
  | { type: 'ballot'; voter: number; target: number | null }
  | { type: 'ballots'; voters: number[]; target: number | null }
  | { type: 'count' }
  | { type: 'exile-result'; target: number | null }
  | { type: 'start-exile' }
  | { type: 'next-night' }
  | { type: 'hunter'; target: number | null }
  | { type: 'badge'; target: number | null }
  | { type: 'shot'; target: number | null }
  | { type: 'link'; target: number | null }
  | { type: 'dance'; seats: number[] }
  | { type: 'hunt' }
  | { type: 'borrow'; card: Role }
  | { type: 'heir'; target: number | null }
  | { type: 'explode'; seat: number }
  | { type: 'ruling'; seat: number; alive: boolean; reason: string }
  | { type: 'note'; text: string }
  | { type: 'finish'; winner: 'good' | 'wolf' | 'third' | 'draw'; reason: string; discardPending?: boolean };
