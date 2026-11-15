import { NIGHT_ROLE_ORDER, ROLES, ROLE_IDS, isVillager, isWolf } from './roles';
import type { Role } from './roles';
import type { Counts, Rules } from './types';

export type BoardTag = 'official' | 'tournament' | 'classic' | 'custom';
export type BoardOrigin = 'netease' | 'jingcheng' | 'community';
export type BoardCatalog = {
  origins: BoardOrigin[];
  edition: string;
  verification: 'official' | 'reference';
  sources: { title: string; url: string; scope: 'lineup' | 'rules' | 'role' }[];
};
/** 先洗牌扣底、再入座的牌池型板子 */
export type BoardDeck = 'jingcheng-treasure';

export type Board = {
  id: string;
  name: string;
  subtitle: string;
  tag: BoardTag;
  playerCount: number;
  roles: Partial<Record<Role, number>>;
  /** 完整角色计数，含 0 */
  counts: Counts;
  note?: string;
  source?: string;
  /** 该板子尚未锁定的规则点 */
  unresolved?: string[];
  /** 该板子偏好的桌规 */
  rules?: Partial<Rules>;
  /** Source and edition describe this exact configuration, not every board with a similar name. */
  catalog?: BoardCatalog;
  /** Preserved only while a saved profile still has the source board's exact role counts. */
  sourceBoardId?: string;
  /** 牌池型板子：roles 为完整牌池，选用时抽出实际入座阵容 */
  deck?: BoardDeck;
};

const sourceOfficial = '官方赛事资料 langrensha.163.com';
const sourceClassic = '线下通用玩法';

export function emptyCounts(): Counts {
  return Object.fromEntries(ROLE_IDS.map(role => [role, 0])) as Counts;
}

function fill(roles: Partial<Record<Role, number>>): Counts {
  const counts = emptyCounts();
  for (const [role, n] of Object.entries(roles)) counts[role as Role] = n ?? 0;
  return counts;
}

/** 根据角色构成生成夜间行动顺序；wolves 由狼队任意角色触发 */
export function nightCallsFor(counts: Counts): (Role | 'wolves')[] {
  const calls: (Role | 'wolves')[] = [];
  if (ROLE_IDS.some(role => isWolf(role) && counts[role] > 0 && role !== 'gargoyle')) calls.push('wolves');
  for (const role of NIGHT_ROLE_ORDER) {
    if (role === 'wolf' || counts[role] <= 0) continue;
    calls.push(role);
  }
  return calls.sort((a, b) => orderOf(a) - orderOf(b));
}

export function orderOf(call: Role | 'wolves'): number {
  if (call === 'wolves') return ROLES.wolf.night!.order;
  return ROLES[call].night?.order ?? 999;
}

export function callTitle(call: Role | 'wolves'): string {
  if (call === 'wolves') return '狼人行动';
  return ROLES[call].night?.targetLabel ? `${ROLES[call].name}行动` : ROLES[call].name;
}

function make(input: Omit<Board, 'counts' | 'playerCount'> & { playerCount?: number }): Board {
  const counts = fill(input.roles);
  const playerCount = input.playerCount ?? Object.values(counts).reduce((a, b) => a + b, 0);
  return { ...input, counts, playerCount };
}

const officialBase = (id: string, name: string, subtitle: string, roles: Partial<Record<Role, number>>, note: string, unresolved: string[] = [], catalog: BoardCatalog = leagueCatalog('reference')): Board =>
  make({ id, name, subtitle, tag: 'official', roles, note, source: sourceOfficial, unresolved, catalog });

const CITY_LEAGUE = { title: '网易：第六届狼人杀城市联赛赛事总规则（2024-03-11）', url: 'https://langrensha.163.com/20240311/31024_1142591.html' };
function leagueCatalog(verification: BoardCatalog['verification']): BoardCatalog {
  return { origins: ['netease'], edition: '城市联赛 12 人官方版型', verification, sources: [{ ...CITY_LEAGUE, scope: verification === 'official' ? 'lineup' : 'rules' }] };
}
const netease = (edition: string, title: string, url: string): BoardCatalog => ({ origins: ['netease'], edition, verification: 'official', sources: [{ title, url, scope: 'lineup' }] });
const jingcheng = (edition: string, sources: BoardCatalog['sources'], verification: BoardCatalog['verification'] = 'reference'): BoardCatalog => ({ origins: ['jingcheng'], edition, verification, sources });
/** 特殊公开阵容：没有普通平民边，胜负按好人清空判定。 */
const freeLineup: Partial<Rules> = { table: { lineupMode: 'free' } };

export const BOARD_LIBRARY: Board[] = [
  officialBase('standard-12', '预女猎白', '12 人 · 4 狼 4 民 · 预言家 / 女巫 / 猎人 / 白痴',
    { wolf: 4, villager: 4, seer: 1, witch: 1, hunter: 1, idiot: 1 },
    '最通用的 12 人标准板，官方赛事与线下局最常见。', [], leagueCatalog('official')),
  officialBase('wolf-beauty-knight', '狼美人骑士', '12 人 · 3 狼 + 狼美人 · 骑士 / 守卫',
    { wolf: 3, 'wolf-beauty': 1, villager: 4, seer: 1, witch: 1, knight: 1, guard: 1 },
    '狼美人出局带走被魅惑者；骑士白天可决斗。',
    ['魅惑与骑士决斗、女巫毒的结算顺序以本桌规则为准。'], leagueCatalog('official')),
  officialBase('wolf-king-guard', '狼王守卫', '12 人 · 3 狼 + 狼王 · 猎人 / 守卫',
    { wolf: 3, 'wolf-king': 1, villager: 4, seer: 1, witch: 1, hunter: 1, guard: 1 },
    '狼王出局可开枪，守卫提供夜间保护。',
    ['狼王被毒、被放逐时是否都能开枪，按本桌规则。'], leagueCatalog('official')),
  officialBase('white-wolf-king-guard', '白狼王守卫', '12 人 · 3 狼 + 白狼王 · 猎人 / 守卫',
    { wolf: 3, 'white-wolf-king': 1, villager: 4, seer: 1, witch: 1, hunter: 1, guard: 1 },
    '白狼王自爆带人，是节奏更快的守卫板。',
    ['白狼王自爆带人与警徽吞没条件按本桌规则。']),
  officialBase('gargoyle-gravekeeper', '石像鬼守墓人', '12 人 · 3 狼 + 石像鬼 · 守墓人',
    { wolf: 3, gargoyle: 1, villager: 4, seer: 1, witch: 1, hunter: 1, gravekeeper: 1 },
    '石像鬼验身份、守墓人验放逐阵营。',
    ['石像鬼何时继承刀权、守墓人信息公布时点按本桌规则。'], leagueCatalog('official')),
  officialBase('wolf-king-dreamer', '狼王摄梦人', '12 人 · 3 狼 + 狼王 · 摄梦人',
    { wolf: 3, 'wolf-king': 1, villager: 4, seer: 1, witch: 1, hunter: 1, dreamer: 1 },
    '摄梦人每晚让人梦游，梦亡规则是核心争议点。',
    ['连续梦游与梦亡的结算按本桌规则。'], leagueCatalog('official')),
  officialBase('red-moon-hunter', '赤月猎魔人', '12 人 · 3 狼 + 赤月使徒 · 猎魔人 / 白痴',
    { wolf: 3, 'red-moon-apostle': 1, villager: 4, seer: 1, witch: 1, 'hunter-demon': 1, idiot: 1 },
    '猎魔人夜间狩猎，赤月使徒带特殊胜负条件。',
    ['赤月使徒自爆与猎魔人狩猎的判定按本桌规则。']),
  officialBase('pure-white-night-shadow', '纯白夜影', '12 人 · 3 狼 + 狼巫 · 纯白之女 / 守卫',
    { wolf: 3, 'wolf-shaman': 1, villager: 4, 'pure-white': 1, witch: 1, hunter: 1, guard: 1 },
    '纯白之女与狼巫互相验人，验到可能直接出局。',
    ['查验即死的条件与先后顺序按本桌规则。']),
  officialBase('nightmare-shadow', '噩梦之影', '12 人 · 3 狼 + 噩梦之影 · 摄梦人',
    { wolf: 3, nightmare: 1, villager: 4, seer: 1, witch: 1, hunter: 1, dreamer: 1 },
    '噩梦之影先手恐惧，封锁当夜技能。',
    ['被恐惧的女巫是否能看到刀口，按本桌规则。'], leagueCatalog('official')),
  officialBase('eternal-sequence', '永序之轮', '12 人 · 3 狼 + 蚀时狼妃 · 定序王子',
    { wolf: 3, 'time-wolf-consort': 1, villager: 4, seer: 1, witch: 1, guard: 1, 'sequence-prince': 1 },
    '封锁与改票，是这个板子的两个关键机制。',
    ['封锁目标与定序王子改票窗口按本桌规则。']),
  officialBase('mirror-trace', '镜影迷踪', '12 人 · 3 狼 + 觉醒隐狼 · 魔镜少女',
    { wolf: 3, 'awakened-hidden-wolf': 1, villager: 4, witch: 1, hunter: 1, guard: 1, 'magic-mirror': 1 },
    '觉醒隐狼模仿技能，魔镜少女提供信息。',
    ['隐狼技能池与魔镜反馈按本桌规则。']),
  officialBase('sun-hunt', '猎日逐光', '12 人 · 3 狼 + 蚀日侍女 · 流光伯爵',
    { wolf: 3, 'sun-eater': 1, villager: 4, seer: 1, witch: 1, dreamer: 1, 'light-earl': 1 },
    '吞噬与庇护的对冲板，技能得分在赛事中另有细则。',
    ['吞噬目标、反噬和结算顺序按本桌规则。']),
  officialBase('wolf-plan', '狼王计划', '12 人 · 4 狼（含狼美人、刺客白狼王）· 4 张彩蛋神 + 漩涡平民',
    { wolf: 2, 'wolf-beauty': 1, 'assassin-white-wolf-king': 1, villager: 3, 'vortex-villager': 1, 'moon-seer': 1, 'venom-witch': 1, 'marksman-hunter': 1, 'awakened-guard': 1 },
    '2026 年网易新板，五张彩蛋牌都不能按普通同名牌结算。',
    ['公告只概述了刺杀、幻境查验、毒印连锁、狙击和操控投票，细则需赛前写入补充约定。'],
    netease('网易 2026-08 狼王计划', '网易官方：狼王计划板子配置与玩法（2026-08-11）', 'https://langrensha.com/news/activity/20260811/26906_1310700.html')),
  officialBase('awakened-knight', '觉醒骑士', '12 人 · 3 狼 + 觉醒狼美人 · 觉醒骑士 / 觉醒守卫',
    { wolf: 3, 'awakened-wolf-beauty': 1, villager: 4, seer: 1, witch: 1, 'awakened-knight': 1, 'awakened-guard': 1 },
    '觉醒骑士可连续决斗，觉醒狼美人以替代出局制造反转。',
    ['觉醒守卫与觉醒狼美人的完整牌文需按实物牌核对。'],
    netease('网易 2026-08 觉醒骑士', '网易官方：觉醒骑士技能与完整配置（2026-08-11）', 'https://langrensha.com/news/activity/20260811/26906_1310699.html')),
  make({ id: 'salon-night', name: '沙龙之夜', subtitle: '12 人 · 4 狼 · 7 神 · 咒狐（无平民）', tag: 'official',
    roles: { wolf: 1, 'awakened-wolf-beauty': 1, 'sun-eater': 1, 'time-wolf-consort': 1, 'awakened-seer': 1, 'magic-mirror': 1, witch: 1, 'hunter-demon': 2, 'miracle-merchant': 1, dreamer: 1, fox: 1 },
    source: sourceOfficial, rules: freeLineup,
    note: '网易首个全女性角色板，暗牌场；咒狐胜负自动判定。',
    unresolved: ['暗牌场：出局后不翻开身份牌。', '咒狐被查验、被刀的口径需赛前确认。'],
    catalog: netease('网易 2026-03 沙龙之夜', '网易官方：沙龙之夜配置、咒狐胜负与角色交互（2026-03-06）', 'https://langrensha.com/news/official/20260306/26904_1289873.html') }),

  make({ id: 'jingcheng-s15-treasure-master', name: '盗宝大师', subtitle: '12 人 · 15 张牌池洗牌扣 3 张底牌', tag: 'tournament', playerCount: 12,
    roles: { wolf: 3, 'wolf-king': 1, villager: 5, medium: 1, poisoner: 1, hunter: 1, dreamer: 1, raven: 1, 'treasure-master': 1 },
    deck: 'jingcheng-treasure', source: '京城大师赛 S15·天空之城',
    rules: { table: { firstNightKnife: false } },
    note: '选用时自动洗牌：12 张入座、3 张底牌只给盗宝大师看。首夜狼人不发动击杀。',
    unresolved: ['乌鸦技能口径、借用一次性技能的消耗、遗言与警徽细则需赛前确认。'],
    catalog: jingcheng('S15·天空之城（2024-08-01 规则图）', [
      { title: '京城 S15《盗宝大师》公开规则帖', url: 'https://www.sina.cn/news/detail/5062652760689279.html', scope: 'rules' },
      { title: '京城 S15·天空之城规则图', url: 'https://wx3.sinaimg.cn/middle/4c0fb4baly1hs8mqybrzaj25ea2qs1kz.jpg', scope: 'lineup' },
    ], 'official') }),
  make({ id: 'jingcheng-qingqiu', name: '青丘夜影', subtitle: '12 人 · 3 狼 + 九尾 · 预言家 / 女巫 / 守卫 / 白泽', tag: 'tournament',
    roles: { wolf: 3, 'nine-tails': 1, villager: 4, seer: 1, witch: 1, guard: 1, baize: 1 }, source: '京城大师赛原创板型',
    note: '九尾标记积累人数后发动猎杀时刻，白泽清除标记并传承身份。屠边。',
    unresolved: ['标记数量与猎杀时刻判定需主持人逐夜记录。'],
    catalog: jingcheng('2026-09-11 大师赛版本', [{ title: '京城大师赛《青丘夜影》板型介绍', url: 'https://www.sina.cn/news/detail/5339887734885313.html', scope: 'rules' }]) }),
  make({ id: 'jingcheng-masquerade', name: '假面舞会', subtitle: '12 人 · 3 狼 + 假面 · 预言家 / 女巫 / 舞者 / 白痴', tag: 'tournament',
    roles: { wolf: 3, masked: 1, villager: 4, seer: 1, witch: 1, dancer: 1, idiot: 1 }, source: '京城大师赛原创板型',
    note: '舞者第二夜起拉三人进舞池，人少的阵营出局；假面可偷换舞池身份。',
    unresolved: ['舞池平局与假面置换后的查验口径需赛前确认。'],
    catalog: jingcheng('京城大师赛常驻版型', [{ title: '京城大师赛《假面舞会》板子规则详解（转载）', url: 'https://www.233leyuan.com/post-detail/2066966750562693120', scope: 'rules' }]) }),
  make({ id: 'jingcheng-masquerade-10', name: '假面舞会（10 人）', subtitle: '10 人 · 2 狼 + 假面 · 预言家 / 女巫 / 舞者', tag: 'tournament',
    roles: { wolf: 2, masked: 1, villager: 4, seer: 1, witch: 1, dancer: 1 }, source: '京城大师赛原创板型',
    note: '假面舞会的 10 人配置，去掉一狼和白痴。',
    unresolved: ['舞池平局与假面置换后的查验口径需赛前确认。'],
    catalog: jingcheng('京城大师赛常驻版型', [{ title: '京城大师赛《假面舞会》板子规则详解（转载）', url: 'https://www.233leyuan.com/post-detail/2066966750562693120', scope: 'rules' }]) }),
  make({ id: 'jingcheng-mech-wolf', name: '机械狼通灵师', subtitle: '12 人 · 3 狼 + 机械狼 · 通灵师 / 女巫 / 猎人 / 守卫', tag: 'tournament',
    roles: { wolf: 3, 'mech-wolf': 1, villager: 4, medium: 1, witch: 1, hunter: 1, guard: 1 }, source: '京城大师赛常驻版型',
    rules: { selfSave: 'never', flow: { nightOrder: ['mech-wolf', 'guard', 'wolves', 'witch', 'medium'] } },
    note: '机械狼不进狼窝，学习身份继承技能；通灵师查具体身份。',
    unresolved: ['学到守卫的盾能否挡毒、学到狼人的额外刀等细则，按本桌采用的赛事版本。'],
    catalog: jingcheng('京城大师赛常驻版型（参考 LAL 规则库）', [{ title: 'LAL 规则库：机械狼通灵师', url: 'https://werewolves.games/ji-xie-lang/', scope: 'rules' }]) }),

  make({ id: '9-classic', name: '九人标准', subtitle: '9 人 · 3 狼 3 民 · 预女猎', tag: 'classic',
    roles: { wolf: 3, villager: 3, seer: 1, witch: 1, hunter: 1 }, source: sourceClassic,
    note: '最轻量的标准局，一晚上能打两三把。' }),
  make({ id: '12-guard', name: '预女猎守', subtitle: '12 人 · 4 狼 4 民 · 守救博弈', tag: 'classic',
    roles: { wolf: 4, villager: 4, seer: 1, witch: 1, hunter: 1, guard: 1 }, source: sourceClassic,
    note: '用守卫替换白痴，守救同守同救的争议最多。' }),
  make({ id: '6-quick', name: '六人速开', subtitle: '6 人 · 2 狼 2 民 · 预女', tag: 'classic',
    roles: { wolf: 2, villager: 2, seer: 1, witch: 1 }, source: sourceClassic,
    note: '等人凑不齐时的快局，节奏极短。' }),
  make({ id: '8-standard', name: '八人局', subtitle: '8 人 · 2 狼 3 民 · 预女猎', tag: 'classic',
    roles: { wolf: 2, villager: 3, seer: 1, witch: 1, hunter: 1 }, source: sourceClassic,
    note: '两狼局，好人信息更完整。' }),
  make({ id: '10-standard', name: '十人局', subtitle: '10 人 · 3 狼 4 民 · 预女猎', tag: 'classic',
    roles: { wolf: 3, villager: 4, seer: 1, witch: 1, hunter: 1 }, source: sourceClassic,
    note: '十人三狼，线下最常用的中等规模。' }),
  make({ id: '15-standard', name: '十五人局', subtitle: '15 人 · 5 狼 5 民 · 预女猎白守', tag: 'classic',
    roles: { wolf: 5, villager: 5, seer: 1, witch: 1, hunter: 1, idiot: 1, guard: 1 }, source: sourceClassic,
    note: '大桌局，发言计时和警长流程尤其重要。' }),

  make({ id: 'miracle-merchant', name: '奇迹商人', subtitle: '12 人 · 3 狼 + 狼王 · 预言家 / 女巫 / 守卫 / 奇迹商人', tag: 'official',
    roles: { wolf: 3, 'wolf-king': 1, villager: 4, seer: 1, witch: 1, guard: 1, 'miracle-merchant': 1 }, source: sourceOfficial,
    note: '商人把一次性技能赠给保留原身份的幸运儿，选中狼人会反噬。',
    unresolved: ['幸运儿是附加状态，不单独占座；赠送技能、使用时机与反噬由主持人核对。'],
    catalog: netease('网易 2020-06 奇迹商人', '网易官方：新角色奇迹商人来袭（12/10 人配置）', 'https://langrensha.163.com/news/official/20200611/26904_885985.html') }),
  make({ id: 'evil-knight', name: '恶灵骑士', subtitle: '12 人 · 3 狼 + 恶灵骑士 · 预言家 / 女巫 / 猎人 / 守卫', tag: 'official',
    roles: { wolf: 3, 'evil-knight': 1, villager: 4, seer: 1, witch: 1, hunter: 1, guard: 1 }, source: sourceOfficial,
    note: '恶灵骑士被查验或用毒时可能反伤，守卫的守护可以阻断反伤。',
    unresolved: ['软件名为恶灵骑士，官网资料列名恶夜骑士，开局前核对牌面版本与反伤次数。'],
    catalog: netease('网易 2017-12 恶灵骑士', '网易官方：Pandakill 同款板子恶灵骑士（12 人配置）', 'https://langrensha.163.com/news/official/2017/12/27/26904_732083.html') }),
  make({ id: 'lone-girl', name: '孤独少女', subtitle: '12 人 · 4 狼 3 民 · 预言家 / 女巫 / 猎人 / 守卫 / 孤独少女', tag: 'official',
    roles: { wolf: 4, villager: 3, 'lone-girl': 1, seer: 1, witch: 1, hunter: 1, guard: 1 }, source: sourceOfficial,
    note: '孤独少女首夜崇拜一人，胜负归属跟随崇拜对象。',
    unresolved: ['孤独少女的阵营与个人胜负需在赛前确认，并由主持人判定结束。'],
    catalog: { origins: ['netease'], edition: '12 人孤独少女（暗恋者）', verification: 'reference', sources: [{ title: '12 人孤独少女板子配置', url: 'https://youmindao.com/langrensha/298.html', scope: 'lineup' }] } }),
  make({ id: 'awakened-wolf-king', name: '觉醒狼王', subtitle: '12 人 · 3 狼 + 觉醒狼王 · 预言家 / 女巫 / 奇迹商人 / 摄梦人', tag: 'official',
    roles: { wolf: 3, 'awakened-wolf-king': 1, villager: 4, 'miracle-merchant': 1, seer: 1, witch: 1, dreamer: 1 }, source: sourceOfficial,
    note: '觉醒狼王拥有两次狼王爪，可夜间传授给狼队友；与狼王、白狼王是不同牌。',
    unresolved: ['狼王爪归属、传授与次数由主持人逐次记录。'],
    catalog: { origins: ['netease'], edition: '12 人觉醒狼王', verification: 'reference', sources: [{ title: '觉醒狼王角色与 12 人板子配置', url: 'https://baike.baidu.com/item/%E8%A7%89%E9%86%92%E7%8B%BC%E7%8E%8B/63277920', scope: 'lineup' }] } }),
  make({ id: 'fragrance-shadow', name: '寻香识命', subtitle: '12 人 · 3 狼 + 寻香魅影 · 觉醒预言家 / 女巫 / 猎人 / 守卫', tag: 'official',
    roles: { wolf: 3, 'fragrance-shadow': 1, villager: 4, 'awakened-seer': 1, witch: 1, hunter: 1, guard: 1 }, source: sourceOfficial,
    note: '寻香魅影独立行动并缠绕两名玩家；觉醒预言家查验具体身份。',
    unresolved: ['双目标缠绕、跟随次数与独立刀权由主持人阅读牌面后执行。'],
    catalog: netease('网易 2023-03 寻香识命', '网易官方：觉醒预言家与寻香魅影正式登场（12 人配置）', 'https://langrensha.com/news/official/20230302/26904_1076159.html') }),
];

export const OFFICIAL_BOARDS = BOARD_LIBRARY.filter(board => board.tag === 'official');
export const TOURNAMENT_BOARDS = BOARD_LIBRARY.filter(board => board.tag === 'tournament');
export const CLASSIC_BOARDS = BOARD_LIBRARY.filter(board => board.tag === 'classic');

export function boardOrigins(board: Board): BoardOrigin[] {
  if (board.catalog) return board.catalog.origins;
  return board.tag === 'official' ? ['netease'] : ['community'];
}

export function boardById(id: string): Board | undefined {
  return BOARD_LIBRARY.find(board => board.id === id);
}

/** 板子阵容是否可以直接开局 */
export function isPlayable(board: Board): boolean {
  const wolves = ROLE_IDS.filter(isWolf).reduce((sum, role) => sum + board.counts[role], 0);
  const villagers = ROLE_IDS.filter(isVillager).reduce((sum, role) => sum + board.counts[role], 0);
  const good = ROLE_IDS.filter(role => !isWolf(role)).reduce((sum, role) => sum + board.counts[role], 0);
  const free = board.rules?.table?.lineupMode === 'free';
  return wolves >= 1 && (free ? good >= 1 : villagers >= 1 && good - villagers >= 1) && board.playerCount >= 6 && board.playerCount <= 16;
}

/** 把板子展开成座位角色表 */
export function boardSeats(board: Board): Role[] {
  return ROLE_IDS.flatMap(role => Array.from({ length: board.counts[role] }, () => role));
}

/** Unique identity cards used by this board, in registry order. */
export function boardRoles(board: Board): Role[] {
  return ROLE_IDS.filter(role => (board.counts[role] ?? 0) > 0);
}

export { fill as countsFromRoles };
