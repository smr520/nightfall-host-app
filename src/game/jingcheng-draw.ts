import { ROLES, type Role } from './roles';

/**
 * 京城大师赛 S15「天空之城·盗宝大师」的完整 15 张身份池。
 *
 * 这不是普通的 12 人固定座位板：先洗 15 张牌，再扣下 3 张底牌，
 * 其余 12 张才进入玩家座位。
 */
export const JINGCHENG_TREASURE_DECK: readonly Role[] = [
  'medium',
  'poisoner',
  'hunter',
  'dreamer',
  'raven',
  'wolf-king',
  'wolf', 'wolf', 'wolf',
  'villager', 'villager', 'villager', 'villager', 'villager',
  'treasure-master',
];

export type JingchengTreasureCamp = 'wolf' | 'good';

export type JingchengDraw = {
  /** 洗牌后进入座位的 12 张身份，顺序对应发牌顺序。 */
  roles: Role[];
  /** 洗牌后扣下的 3 张底牌，主持人只应把它们交给盗宝大师。 */
  reserve: Role[];
  /** 可直接读给主持人的规则提醒。 */
  notes: string;
  /** 盗宝大师本局所属阵营，由 3 张底牌决定。 */
  treasureCamp: JingchengTreasureCamp;
};

/** 写入主持记录的私密底牌行前缀，夜间提示据此找回底牌。 */
export const TREASURE_RESERVE_PREFIX = '盗宝大师底牌';

const TREASURE_MASTER: Role = 'treasure-master';
const WOLF_ROLES = new Set<Role>(['wolf', 'wolf-king']);
const GOD_ROLES = new Set<Role>(['medium', 'poisoner', 'hunter', 'dreamer', 'raven']);

function shuffle<T>(values: readonly T[], random: () => number): T[] {
  const result = [...values];
  for (let i = result.length - 1; i > 0; i -= 1) {
    const raw = Number(random());
    const value = Number.isFinite(raw) ? Math.min(0.999999999, Math.max(0, raw)) : 0;
    const j = Math.floor(value * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

function isValidReserve(reserve: readonly Role[]): boolean {
  if (reserve.length !== 3 || reserve.includes(TREASURE_MASTER)) return false;
  const wolves = reserve.filter(role => WOLF_ROLES.has(role)).length;
  const gods = reserve.filter(role => GOD_ROLES.has(role)).length;
  const villagers = reserve.filter(role => role === 'villager').length;
  return wolves <= 1 && gods < 3 && villagers < 3;
}

function fallbackDeck(): Role[] {
  // This combination is valid even if the supplied random function always returns 0.
  const reserve: Role[] = ['medium', 'wolf', 'villager'];
  const remaining = [...JINGCHENG_TREASURE_DECK];
  for (const role of reserve) {
    const index = remaining.indexOf(role);
    if (index >= 0) remaining.splice(index, 1);
  }
  return [...reserve, ...remaining];
}

function notesFor(camp: JingchengTreasureCamp): string {
  const campText = camp === 'wolf' ? '狼人阵营' : '好人阵营';
  return [
    '京城大师赛 S15·天空之城：首夜狼人不能发动击杀。',
    `盗宝大师本局为${campText}；首夜获知 3 张底牌，每夜选择其中一张身份并使用其技能。`,
    '连续两夜不能选择同一张身份牌。毒师只有一瓶毒；被毒的猎人或狼王不能发动技能。',
    camp === 'wolf'
      ? '盗宝大师的狼人同伴全部出局后，按本板规则可行使击杀技能。'
      : '盗宝大师按好人阵营参与胜负结算。',
    '底牌只交给盗宝大师查看，主持人需要在开局前确认本桌的遗言、警徽与胜负细则。',
  ].join('\n');
}

/**
 * 洗出一组合法的 S15 盗宝大师牌局。
 *
 * 规则图明确要求：盗宝大师必须在 12 个座位中；3 张底牌最多 1 张狼人，
 * 且不能正好由 3 张神职或 3 张平民组成。随机函数只用于可复现测试，
 * 传入固定序列即可得到稳定发牌结果。
 */
export function drawJingchengTreasure(random: () => number = Math.random): JingchengDraw {
  let deck: Role[] | undefined;
  for (let attempt = 0; attempt < 256; attempt += 1) {
    const candidate = shuffle(JINGCHENG_TREASURE_DECK, random);
    if (isValidReserve(candidate.slice(0, 3))) {
      deck = candidate;
      break;
    }
  }
  deck ??= fallbackDeck();

  const reserve = deck.slice(0, 3);
  const roles = deck.slice(3);
  const treasureCamp: JingchengTreasureCamp = reserve.some(role => WOLF_ROLES.has(role)) ? 'wolf' : 'good';
  return { roles, reserve, treasureCamp, notes: notesFor(treasureCamp) };
}

export function isValidJingchengReserve(reserve: readonly Role[]): boolean {
  return isValidReserve(reserve);
}

/** 仅主持人可见的底牌记录，写入对局的私密主持记录。 */
export function treasureReserveLog(draw: Pick<JingchengDraw, 'reserve' | 'treasureCamp'>): string {
  return `${TREASURE_RESERVE_PREFIX}：${draw.reserve.map(role => ROLES[role].name).join('、')}（本局归${draw.treasureCamp === 'wolf' ? '狼人' : '好人'}阵营）`;
}

