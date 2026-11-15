// 角色注册表：引擎、板子库、界面都从这里取角色数据。
// 登记角色不代表技能已完整实现；资料与实际处理范围见 role-reference.ts。
import { EXTRA_ROLES, type ExtraRole } from './extra-roles';
import { JINGCHENG_ROLES, type JingchengRole } from './jingcheng-roles';

export type Role =
  | 'wolf' | 'villager' | 'seer' | 'witch' | 'hunter' | 'idiot' | 'guard'
  | 'wolf-beauty' | 'knight' | 'wolf-king' | 'white-wolf-king'
  | 'gargoyle' | 'gravekeeper' | 'dreamer' | 'red-moon-apostle'
  | 'hunter-demon' | 'pure-white' | 'wolf-shaman' | 'nightmare'
  | 'time-wolf-consort' | 'sequence-prince' | 'magic-mirror'
  | 'awakened-hidden-wolf' | 'miracle-merchant' | 'lucky-one'
  | 'evil-knight' | 'lone-girl' | 'sun-eater' | 'light-earl'
  | 'fragrance-shadow' | 'awakened-wolf-king'
  | ExtraRole | JingchengRole;

export type Camp = 'wolf' | 'good' | 'third';

export type NightAction = {
  /** 夜间行动顺序，数字小的先行动 */
  order: number;
  /** 主持人台词 */
  script: string;
  /** 主持人提示（规则要点） */
  help: string;
  /** 是否可以空过（不选目标） */
  canSkip?: boolean;
  /** 只能在自己身上使用 */
  selfOnly?: boolean;
  /** 是否只在第一夜行动 */
  firstNightOnly?: boolean;
  /** 从第几夜开始行动，缺省为第一夜 */
  fromNight?: number;
  /** 指定座位时使用的标题，如「选择守护目标」 */
  targetLabel: string;
};

export type RoleMeta = {
  name: string;
  /** 短名，用于座位格等窄位置 */
  short: string;
  camp: Camp;
  /** 具有能力的平民变体仍计入平民边。 */
  category?: 'villager';
  /** 是否参加狼队共同夜间行动；独立行动的狼人为 false。 */
  wolfTeam?: boolean;
  /** 其他狼人全部出局后可继承狼刀。 */
  lateKnife?: boolean;
  /** 免疫女巫毒药。 */
  poisonImmune?: boolean;
  /** 软件是否支持该牌直接自爆；false 不等于牌面规则禁止自爆。 */
  canSelfExplode?: boolean;
  /** 一句话能力，选板子时展示 */
  tagline: string;
  night?: NightAction;
  /** 出局后需要主持人处理的技能 */
  onDeath?: 'shot' | 'link';
  /** 出局处理提示 */
  deathNote?: string;
};

export const ROLES: Record<Role, RoleMeta> = {
  wolf: {
    name: '狼人', short: '狼', camp: 'wolf',
    tagline: '每夜共同选择刀口，白天可自爆。',
    night: { order: 30, script: '狼人请睁眼。请统一意见，指认今晚要击杀的目标。狼人请闭眼。', help: '只记录狼队最终统一的目标；空刀必须明确确认。', canSkip: true, targetLabel: '记录狼队刀口' },
  },
  villager: { name: '村民', short: '民', camp: 'good', tagline: '没有夜间技能，靠发言和投票找出狼人。' },
  seer: {
    name: '预言家', short: '预', camp: 'good', tagline: '每夜查验一名玩家的阵营。',
    night: { order: 50, script: '预言家请睁眼。今晚你要查验谁？请确认结果后闭眼。', help: '查验结果只告诉预言家，不进入公开播报。', canSkip: true, targetLabel: '选择查验目标' },
  },
  witch: {
    name: '女巫', short: '女', camp: 'good', tagline: '一瓶解药一瓶毒药，用药限制按桌规。',
    night: { order: 60, script: '女巫请睁眼。今晚的刀口是……你要使用解药吗？你要使用毒药吗？女巫请闭眼。', help: '可以只用其中一瓶，也可以两瓶都不用。', targetLabel: '选择毒药目标' },
  },
  hunter: {
    name: '猎人', short: '猎', camp: 'good', tagline: '出局后可开枪带走一名玩家。',
    onDeath: 'shot', deathNote: '猎人出局，按本局规则确认是否开枪。',
  },
  idiot: {
    name: '白痴', short: '痴', camp: 'good', tagline: '首次被放逐翻牌免死，之后失去投票权。',
  },
  guard: {
    name: '守卫', short: '守', camp: 'good', tagline: '每夜守护一人，通常不能连续两夜守同一人。',
    night: { order: 10, script: '守卫请睁眼。今晚你要守护谁？确认后请闭眼。', help: '可以自守，也可以空守；通常不能连续两夜守同一人。', canSkip: true, targetLabel: '选择守护目标' },
  },
  'wolf-beauty': {
    name: '狼美人', short: '美人', camp: 'wolf', tagline: '每夜魅惑一人，出局时带走被魅惑者。',
    night: { order: 35, script: '狼美人请睁眼。今晚你要魅惑谁？请闭眼。', help: '通常不能自刀、不能自爆，也不能连续两夜魅惑同一人。', canSkip: true, targetLabel: '选择魅惑目标' },
    onDeath: 'link', deathNote: '狼美人出局，被魅惑者随之出局。',
  },
  knight: { name: '骑士', short: '骑', camp: 'good', tagline: '白天可决斗，狼人出局；决斗到好人则骑士出局。' },
  'wolf-king': {
    name: '狼王', short: '狼王', camp: 'wolf', tagline: '出局后按本局规则开枪带走一人。',
    onDeath: 'shot', deathNote: '狼王出局，按本局规则确认是否开枪。',
  },
  'white-wolf-king': {
    name: '白狼王', short: '白狼', camp: 'wolf', tagline: '白天自爆时可带走一名玩家。',
    onDeath: 'shot', deathNote: '白狼王出局，按本局规则确认是否带人。',
  },
  gargoyle: {
    name: '石像鬼', short: '石', camp: 'wolf', tagline: '与狼队互不见面，每夜查验具体身份。',
    night: { order: 40, script: '石像鬼请睁眼。今晚你要查验谁？请闭眼。', help: '石像鬼通常不与狼队见面；其他狼人全部出局后继承刀权。', canSkip: true, targetLabel: '选择查验目标' },
    lateKnife: true,
  },
  gravekeeper: { name: '守墓人', short: '墓', camp: 'good', tagline: '夜间得知上一白天被放逐者的阵营。' },
  dreamer: {
    name: '摄梦人', short: '梦', camp: 'good', tagline: '每夜让人梦游，连续梦游与梦亡按板子执行。',
    night: { order: 70, script: '摄梦人请睁眼。今晚你要让谁进入梦境？请闭眼。', help: '梦游者免疫夜间伤害；连续两夜梦游同一人，或摄梦人夜间出局时，当夜梦游者梦亡。', canSkip: false, targetLabel: '选择梦游目标' },
  },
  'red-moon-apostle': {
    name: '赤月使徒', short: '赤月', camp: 'wolf', tagline: '赤月板的特殊狼人，自爆与存活条件特殊。',
    night: { order: 32, script: '赤月使徒请睁眼，与狼队确认今晚行动。', help: '自爆条件与胜负关联按本局板子执行。', canSkip: true, targetLabel: '记录赤月使徒行动' },
  },
  'hunter-demon': {
    name: '猎魔人', short: '魔', camp: 'good', tagline: '第二夜起每夜狩猎一人，猎中好人会反噬自身。', poisonImmune: true,
    night: { order: 65, script: '猎魔人请睁眼。今晚你要狩猎谁？请闭眼。', help: '第二夜起行动；猎中狼人则目标出局，猎中好人则猎魔人出局。猎魔人免疫女巫毒药。', canSkip: false, fromNight: 2, targetLabel: '选择狩猎目标' },
  },
  'pure-white': {
    name: '纯白之女', short: '纯白', camp: 'good', tagline: '每夜查验具体身份，验到狼人可能直接出局。',
    night: { order: 55, script: '纯白之女请睁眼。今晚你要查验谁？请闭眼。', help: '查验即出局的判定按本局板子执行。', canSkip: true, targetLabel: '选择查验目标' },
  },
  'wolf-shaman': {
    name: '狼巫', short: '狼巫', camp: 'wolf', tagline: '可查验特定神职，查验结果按板子执行。',
    night: { order: 57, script: '狼巫请睁眼。今晚你要查验谁？请闭眼。', help: '与纯白之女的查验顺序按本局板子执行。', canSkip: true, targetLabel: '选择查验目标' },
  },
  nightmare: {
    name: '噩梦之影', short: '噩梦', camp: 'wolf', tagline: '每夜恐惧一人，封锁其当夜技能。',
    night: { order: 20, script: '噩梦之影请睁眼。今晚你要恐惧谁？请闭眼。', help: '先于狼人行动；被恐惧者当夜技能失效；若恐惧狼人，狼队当夜无法袭击；不能连续两夜恐惧同一目标。', canSkip: false, targetLabel: '选择恐惧目标' },
  },
  'time-wolf-consort': {
    name: '蚀时狼妃', short: '蚀时', camp: 'wolf', tagline: '封锁目标，针对目标的特定好人技能转回技能使用者。',
    night: { order: 25, script: '蚀时狼妃请睁眼。今晚你要封锁谁？请闭眼。', help: '封锁涉及查验、毒药和守护的效果转向，不等同于普通禁技；当前软件仅记录目标。', canSkip: true, targetLabel: '选择封锁目标' },
  },
  'sequence-prince': { name: '定序王子', short: '王子', camp: 'good', tagline: '每局一次翻牌，增加发言后重新进行放逐投票。' },
  'magic-mirror': {
    name: '魔镜少女', short: '魔镜', camp: 'good', tagline: '每夜查验一名玩家的具体身份。',
    night: { order: 85, script: '魔镜少女请睁眼。今晚你要查验谁？请确认身份结果后闭眼。', help: '反馈具体牌名而非仅好人或狼人；当前软件仅记录目标，需主持人核对并告知结果。', canSkip: true, targetLabel: '选择查验目标' },
  },
  'awakened-hidden-wolf': {
    name: '觉醒隐狼', short: '隐狼', camp: 'wolf', tagline: '可模仿部分神职技能，技能池按板子执行。',
    night: { order: 33, script: '觉醒隐狼请睁眼，确认本夜模仿的技能与目标。', help: '可模仿的技能池与使用限制按本局板子执行。', canSkip: true, targetLabel: '记录隐狼模仿目标' },
  },
  'miracle-merchant': {
    name: '奇迹商人', short: '商人', camp: 'good', tagline: '整局一次赠予其他玩家一种一次性技能。',
    night: { order: 5, script: '奇迹商人请睁眼。请选择今晚给出的技能和目标。', help: '技能池与使用次数按本局板子执行。', canSkip: true, firstNightOnly: true, targetLabel: '选择技能承受者' },
  },
  'lucky-one': { name: '幸运儿', short: '幸运', camp: 'good', tagline: '商人赋予的附加能力状态，仍需保留原身份。' },
  'evil-knight': {
    name: '恶灵骑士', short: '恶灵', camp: 'wolf', tagline: '被毒时可能反伤女巫。',
    deathNote: '恶灵骑士被毒，按板子确认是否反伤女巫。',
  },
  'lone-girl': {
    name: '孤独少女', short: '少女', camp: 'good', tagline: '首夜崇拜一人，胜负收益随目标改变。',
    night: { order: 6, script: '孤独少女请睁眼。今晚你要崇拜谁？请闭眼。', help: '崇拜对象的阵营会影响本局收益，按板子执行。', firstNightOnly: true, targetLabel: '选择崇拜目标' },
  },
  'sun-eater': {
    name: '蚀日侍女', short: '蚀日', camp: 'wolf', tagline: '第二夜起夺取好人技能，令目标当夜失去该技能。',
    night: { order: 75, script: '蚀日侍女请睁眼，确认本夜吞噬的技能。', help: '核对吞噬与借用技能的两个目标；当前软件只记录吞噬目标，未处理能力转移。', canSkip: true, targetLabel: '选择吞噬目标' },
  },
  'light-earl': {
    name: '流光伯爵', short: '流光', camp: 'good', tagline: '第二夜起庇护其他玩家，免疫夜间伤害。',
    night: { order: 72, script: '流光伯爵请睁眼。今晚你要庇护谁？请闭眼。', help: '第二夜起行动；不能自保，不能连续两夜庇护同一人；庇护可挡狼刀、毒药与梦亡。', canSkip: false, fromNight: 2, targetLabel: '选择庇护目标' },
  },
  'fragrance-shadow': {
    name: '寻香魅影', short: '寻香', camp: 'wolf', tagline: '施加氤氲缠绕，白天出局条件特殊。',
    night: { order: 80, script: '寻香魅影请睁眼。今晚你要缠绕谁？请闭眼。', help: '缠绕与白天出局条件按本局板子执行。', canSkip: true, targetLabel: '选择缠绕目标' },
  },
  'awakened-wolf-king': {
    name: '觉醒狼王', short: '觉醒', camp: 'wolf', tagline: '觉醒板特殊狼人，技能解锁条件按板子执行。',
    onDeath: 'shot', deathNote: '觉醒狼王出局，按板子确认技能结果。',
  },
  ...EXTRA_ROLES,
  ...JINGCHENG_ROLES,
};

export const ROLE_IDS = Object.keys(ROLES) as Role[];
export const isRole = (value: unknown): value is Role => typeof value === 'string' && Object.prototype.hasOwnProperty.call(ROLES, value);
export const campOf = (role: Role): Camp => ROLES[role].camp;
export const isWolf = (role: Role) => campOf(role) === 'wolf';
export const isVillager = (role: Role) => role === 'villager' || ROLES[role].category === 'villager';
const INDEPENDENT_WOLVES = new Set<Role>(['gargoyle', 'awakened-hidden-wolf', 'fragrance-shadow']);
export const isWolfTeam = (role: Role) => isWolf(role) && ROLES[role].wolfTeam !== false && !INDEPENDENT_WOLVES.has(role);
export const roleName = (role: Role) => ROLES[role].name;

/** 该夜间行动在第 day 夜是否轮到（首夜限定、从第 N 夜起行动） */
export function isCallScheduled(call: Role | 'wolves', day: number): boolean {
  if (call === 'wolves') return true;
  const night = ROLES[call].night;
  if (!night) return false;
  if (night.firstNightOnly && day > 1) return false;
  return day >= (night.fromNight ?? 1);
}

/** 所有会行动的夜间角色，按 order 排序 */
export const NIGHT_ROLE_ORDER = ROLE_IDS
  .filter(role => ROLES[role].night)
  .sort((a, b) => (ROLES[a].night!.order) - (ROLES[b].night!.order));

export const WOLF_TEAM_ROLES: Role[] = ROLE_IDS.filter(isWolf);
