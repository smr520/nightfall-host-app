import type { Role, Rules } from './types';

type HostCheck = {
  note: string;
  manualDawn?: boolean;
  manualVictory?: boolean;
};

/** Only concrete missing mechanics need extra host handling; partial support alone is not a reason. */
const HOST_CHECKS: Partial<Record<Role, HostCheck>> = {
  knight: { note: '白天决斗后，点主持页“自爆 / 人工裁定”更新出局；决斗次数记在“现场备忘”。' },
  gargoyle: { note: '单独唤醒并核对已查验名单；其余狼人出局后，刀权由主持人处理。', manualDawn: true },
  gravekeeper: { note: '夜间另行唤醒，按上一白天的放逐记录，私下告知阵营。' },
  dreamer: { note: '核对今夜与上夜梦游目标、免伤和梦亡，再修正天亮名单。', manualDawn: true },
  'red-moon-apostle': { note: '封印、延迟出局与最后一狼的胜负时机由主持人处理。', manualDawn: true, manualVictory: true },
  'hunter-demon': { note: '核对第二夜起行动、目标阵营、反噬和免毒，再修正天亮名单。', manualDawn: true },
  'pure-white': { note: '区分首夜与后续查验；查验致死结果需加入天亮名单。', manualDawn: true },
  'wolf-shaman': { note: '核对合法查验目标；第二夜起查杀纯白之女时修正天亮名单。', manualDawn: true },
  nightmare: { note: '记录恐惧目标及上夜目标；被封锁角色或狼队的行动由主持人空过。', manualDawn: true },
  'time-wolf-consort': { note: '核对查验、守护与用毒的实际受效者，并记录封锁能力是否耗尽。', manualDawn: true },
  'sequence-prince': { note: '额外发言、重投和一次性次数由主持人安排；必要时撤回至投票前重录。', manualVictory: true },
  'awakened-hidden-wolf': { note: '模仿能力、狼队互认与独立刀权由主持人记录，结束前核对完整技能。', manualDawn: true, manualVictory: true },
  'miracle-merchant': { note: '在“现场备忘”记录获赠者、技能及次数，保留原身份；用药或出局技能结果由主持人核对。', manualDawn: true, manualVictory: true },
  'evil-knight': { note: '核对夜间免死、反伤与次数，按实际结果修正天亮名单。', manualDawn: true },
  'lone-girl': { note: '保密记录崇拜对象；本局由主持人判定结束，并在结束原因中记录其胜负归属。', manualVictory: true },
  'sun-eater': { note: '记录吞噬目标、借用技能的目标与禁用状态，再核对本夜全部伤害。', manualDawn: true },
  'light-earl': { note: '核对第二夜起行动、自保与连续目标限制，并处理毒药等特殊免伤。', manualDawn: true },
  'fragrance-shadow': { note: '另行记录缠绕双方、跟随次数和刀权；发生跟随出局后核对胜负。', manualDawn: true, manualVictory: true },
  'awakened-wolf-king': { note: '逐次记录狼王爪的归属、传授与剩余次数，完整处理带人后再结束。', manualVictory: true },
  medium: { note: '私下反馈具体身份；查验盗宝大师或已学习的机械狼时，先核对其当夜状态。' },
  poisoner: { note: '毒药整局只有一瓶，软件自动扣除并在天亮结算；被毒的猎人与狼王不会发动技能。' },
  raven: { note: '乌鸦效果先写入补充约定；涉及票数时由主持人在计票后核对。' },
  'treasure-master': { note: '软件自动记录底牌、阵营与借用限制；借用摄梦、毒师、通灵师时自动结算，其余技能按牌面处理。' },
  'nine-tails': { note: '软件自动累计标记（含投票标记）并判定猎杀时刻；B 方出局后自动进入夜晚。' },
  baize: { note: '软件自动清除标记，并在白泽出局时进入传承流程。' },
  dancer: { note: '舞池自动结算少数阵营出局；平票时天亮手动复核。' },
  masked: { note: '查验是否在舞池会自动显示；面具置换身份仍由主持人记录。' },
  'mech-wolf': { note: '学习身份自动记录；学到猎人时自动获得出局开枪，其他技能按牌面处理。' },
};

export function hostingSupport(roles: readonly Role[]) {
  const checks = Array.from(new Set(roles)).flatMap(role => HOST_CHECKS[role] ? [{ role, ...HOST_CHECKS[role]! }] : []);
  return {
    checks,
    manualDawn: checks.some(check => check.manualDawn),
    manualVictory: checks.some(check => check.manualVictory),
  };
}

/** Infer safer defaults without overriding a host's explicit saved choice. */
export function withSupportDefaults(rules: Rules, roles: readonly Role[]): Rules {
  const support = hostingSupport(roles);
  const manualDawn = support.manualDawn && rules.flow?.manualDawn === undefined;
  const manualVictory = support.manualVictory && rules.flow?.manualVictory === undefined;
  if (!manualDawn && !manualVictory) return rules;
  return { ...rules, flow: { ...rules.flow, ...(manualDawn ? { manualDawn: true } : {}), ...(manualVictory ? { manualVictory: true } : {}) } };
}
