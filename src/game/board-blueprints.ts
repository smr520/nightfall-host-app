/**
 * Source-backed identity-pool data for draw-based boards.
 * The playable library entry (BOARD_LIBRARY, `deck`) deals seats from this pool;
 * a confirmed card pool is still different from confirmed automatic skill resolution.
 */
export type BlueprintCardGroup = 'wolf' | 'god' | 'villager' | 'special';

export type BlueprintCard = {
  id: string;
  name: string;
  group: BlueprintCardGroup;
  count: number;
};

export type BoardBlueprint = {
  id: string;
  name: string;
  origin: 'jingcheng' | 'netease' | 'community';
  edition: string;
  completeness: 'core-template' | 'needs-confirmation';
  lineupStatus: 'confirmed-identity-pool' | 'needs-confirmation';
  playability: 'reference-only' | 'draw-board';
  playerCount: number;
  identityPoolSize: number;
  identityPool: readonly BlueprintCard[];
  reserve: {
    drawCount: number;
    excludedCardIds: readonly string[];
    groupLimits: readonly { group: BlueprintCardGroup; max: number }[];
  };
  rules: readonly string[];
  hostChecks: readonly string[];
  unresolved: readonly string[];
  sources: readonly {
    title: string;
    url: string;
    publishedAt: string;
    scope: 'lineup' | 'rules';
  }[];
};

export const JINGCHENG_TREASURE_MASTER: BoardBlueprint = {
  id: 'jingcheng-s15-treasure-master',
  name: '京城大师赛·盗宝大师',
  origin: 'jingcheng',
  edition: 'S15·天空之城 / 2024-08-01 公开规则图及问答',
  completeness: 'core-template',
  lineupStatus: 'confirmed-identity-pool',
  playability: 'draw-board',
  playerCount: 12,
  identityPoolSize: 15,
  identityPool: [
    { id: 'wolf', name: '狼人', group: 'wolf', count: 3 },
    { id: 'wolf-king', name: '狼王', group: 'wolf', count: 1 },
    { id: 'villager', name: '平民', group: 'villager', count: 5 },
    { id: 'medium', name: '通灵师', group: 'god', count: 1 },
    { id: 'poisoner', name: '毒师', group: 'god', count: 1 },
    { id: 'hunter', name: '猎人', group: 'god', count: 1 },
    { id: 'dreamer', name: '摄梦人', group: 'god', count: 1 },
    { id: 'raven', name: '乌鸦', group: 'god', count: 1 },
    { id: 'treasure-master', name: '盗宝大师', group: 'special', count: 1 },
  ],
  reserve: {
    drawCount: 3,
    excludedCardIds: ['treasure-master'],
    groupLimits: [{ group: 'wolf', max: 1 }, { group: 'god', max: 2 }, { group: 'villager', max: 2 }],
  },
  rules: [
    '15 张身份牌中 12 张入座、3 张扣底；盗宝大师必须入座，不会成为底牌。',
    '底牌至多一张狼人牌，且不能全为神职或全为平民；实际入座阵容随底牌变化。',
    '本版本首夜狼队不能击杀；毒师仅有一瓶毒药，被毒的猎人和狼王不能发动出局技能。',
    '盗宝大师首夜获知底牌。底牌有狼人则归狼队，同伴全部出局后取得击杀能力；否则归好人，神民归类取底牌中较多的一类。',
    '盗宝大师每夜借用一张底牌的技能，不能连续两夜选同一张；始终在自己的行动阶段执行。',
    '通灵师查验盗宝大师时，反馈其当夜借用的身份，不把盗宝大师固定当作某个阵营身份。',
    '盗宝摄梦因刀伤或毒药出局时，关联的猎人或狼王不能开枪；隔夜再梦同一人不触发梦亡。',
    '盗宝摄梦的梦游目标当晚免疫夜间伤害，包括毒师的毒。',
  ],
  hostChecks: [
    '先核对 15 张牌、三张底牌及入座身份，再确定盗宝大师阵营与屠边归类。',
    '逐夜记录借用牌、行动阶段和技能目标；不能用普通狼队或普通摄梦人的阶段代替。',
    '毒师不是女巫，乌鸦不是现有同名近似技能；未实现的角色机制由主持人处理。',
  ],
  unresolved: [
    '通灵师、毒师、乌鸦、盗宝大师已有独立行动和目标记录；借用摄梦/毒师/通灵师与继承刀权自动结算。',
    '仍需明确乌鸦技能口径、借用一次性技能的消耗规则及其他特殊交互。',
  ],
  sources: [
    {
      title: '京城大师赛新版型《盗宝大师》规则及技能介绍（公开规则帖）',
      url: 'https://www.sina.cn/news/detail/5062652760689279.html',
      publishedAt: '2024-08-01',
      scope: 'rules',
    },
    {
      title: '京城大师赛 S15·天空之城《盗宝大师》规则图',
      url: 'https://wx3.sinaimg.cn/middle/4c0fb4baly1hs8mqybrzaj25ea2qs1kz.jpg',
      publishedAt: '2024-08-01',
      scope: 'lineup',
    },
  ],
};

export const BOARD_BLUEPRINTS: readonly BoardBlueprint[] = [JINGCHENG_TREASURE_MASTER];

/** Validate physical reserve cards before deriving the actual seated lineup. */
export function validateBlueprintReserve(blueprint: BoardBlueprint, cardIds: readonly string[]): string[] {
  const issues: string[] = [];
  if (cardIds.length !== blueprint.reserve.drawCount) issues.push(`必须选择 ${blueprint.reserve.drawCount} 张底牌。`);
  const seen = new Map<string, number>();
  const groups = new Map<BlueprintCardGroup, number>();
  for (const id of cardIds) {
    const card = blueprint.identityPool.find(entry => entry.id === id);
    if (!card) {
      issues.push('底牌包含不属于本版本的身份。');
      continue;
    }
    const count = (seen.get(id) ?? 0) + 1;
    seen.set(id, count);
    if (count > card.count) issues.push(`${card.name}底牌超过牌池数量。`);
    if (blueprint.reserve.excludedCardIds.includes(id)) issues.push(`${card.name}不能成为底牌。`);
    groups.set(card.group, (groups.get(card.group) ?? 0) + 1);
  }
  for (const limit of blueprint.reserve.groupLimits) {
    if ((groups.get(limit.group) ?? 0) > limit.max) issues.push('底牌阵营组合不符合本版本限制。');
  }
  return [...new Set(issues)];
}

/** Derive seated cards from physically drawn reserve cards (manual-deal alternative to drawJingchengTreasure). */
export function blueprintSeatedCards(blueprint: BoardBlueprint, reserveCardIds: readonly string[]): BlueprintCard[] {
  const issues = validateBlueprintReserve(blueprint, reserveCardIds);
  if (issues.length) throw new Error(issues.join(''));
  return blueprint.identityPool.map(card => ({
    ...card,
    count: card.count - reserveCardIds.filter(id => id === card.id).length,
  })).filter(card => card.count > 0);
}
