import { BOARD_LIBRARY, type Board } from './boards';
import { ROLES, ROLE_IDS } from './roles';
import { speechDurationsSummary, speechSecondsForRules } from './speech';
import { hasLastWordsPolicy, lastWordsPolicyLabels } from './last-words';
import type { Role, Rules } from './types';
import { tableRules } from './table-rules';
import { shouldKeepDeadCalls } from './flow';

export { ROLES, ROLE_IDS };
export { BOARD_LIBRARY, OFFICIAL_BOARDS, TOURNAMENT_BOARDS, CLASSIC_BOARDS, boardById, boardSeats, isPlayable } from './boards';
export type { Board, BoardTag } from './boards';

export const DEFAULT_RULES: Rules = {
  sheriff: true, sheriffTiming: 'before-announcement', win: 'edge', selfSave: 'first', doubleMedicine: false,
  guardSave: 'die', hunterPoison: false, sheriffWeight: 1.5, speechSeconds: 90,
};

/** 所有板子（兼容旧代码的 BOARDS 名称） */
export const BOARDS: Board[] = BOARD_LIBRARY;

export type StageInfo = { title: string; script: string; help: string; short: string };

type FixedStage = 'identity-check' | 'dawn' | 'dawn-announcement' | 'sheriff-signup' | 'sheriff-vote'
  | 'last-words' | 'discussion' | 'exile-vote' | 'hunter' | 'badge' | 'shot' | 'link' | 'heir' | 'ended';

export const STAGES: Record<FixedStage, StageInfo> = {
  'identity-check': {
    title: '开局身份确认', short: '确认',
    script: '天黑了，请所有玩家闭眼。请按座位顺序逐一确认身份牌，确认无误后继续。',
    help: '按主持人选定的顺序逐人核对；公开口播只读座位，身份只显示在主持端私密提示中。全部确认后才进入第一夜。',
  },
  dawn: {
    title: '夜晚结算', short: '结算',
    script: '天亮了，请所有玩家睁眼。首日如开启警长竞选，请先完成竞选，暂不公布昨夜结果。',
    help: '先核对私密死亡预览；首日有警长时竞选后再公布，其他轮次确认后公布。不要念出死亡原因。',
  },
  'dawn-announcement': {
    title: '公布昨夜结果', short: '公布',
    script: '天亮了。请所有玩家睁眼。昨夜的结果是……',
    help: '确认公开播报内容后再念给玩家；这里不显示死亡原因。',
  },
  'last-words': {
    title: '出局遗言',
    short: '遗言',
    script: '请按赛前约定处理出局玩家的遗言。其他玩家请保持安静。',
    help: '逐人完成或放弃遗言；队列结束后再处理出局技能、警徽和胜负。',
  },
  'sheriff-signup': {
    title: '警长竞选', short: '上警',
    script: '现在开始警长竞选。昨夜结果尚未公布，请上警玩家依次发言、退水，最后确认参选名单。',
    help: '首日先竞选再公布死亡；未公布的夜间死者仍可参选和投票。无人上警则警徽流失。',
  },
  'sheriff-vote': {
    title: '警长投票', short: '警投',
    script: '请有投票资格的玩家投票。三、二、一，请投票。',
    help: '未参选且有投票权的存活玩家投票。平票 PK 一次，再平票警徽流失。',
  },
  discussion: {
    title: '白天发言', short: '发言',
    script: '现在开始白天发言。请按主持人指定的顺序依次发言。',
    help: '发言结束后进入放逐投票；警长可指定发言方向。',
  },
  'exile-vote': {
    title: '放逐投票', short: '放逐',
    script: '发言结束。请投给你希望放逐的玩家，三、二、一。',
    help: '记录每人的一票或弃票。平票进入 PK，再次平票则无人出局。',
  },
  hunter: {
    title: '猎人技能', short: '猎人',
    script: '请按本局规则处理猎人技能。确认是否开枪，以及目标座位。',
    help: '可以不开枪。开枪后继续处理警徽与其他死亡技能，再判断胜负。',
  },
  shot: {
    title: '出局技能', short: '带人',
    script: '请按本局规则处理这名角色的出局技能。',
    help: '可以放弃带人。处理完再继续判断胜负。',
  },
  link: {
    title: '殉情结算', short: '殉情',
    script: '被魅惑的玩家随狼美人一同出局。',
    help: '确认后两名玩家同时出局，再处理其他死亡技能。',
  },
  heir: {
    title: '白泽传承', short: '传承',
    script: '白泽翻牌，请指定一名存活玩家为继承人。',
    help: '继承人无法拒绝。平民继承人变为神民双阵营；神职继承人夜间出局后会延迟到本轮投票结束才离场；狼人或九尾继承人不受影响。',
  },
  badge: {
    title: '警徽处理', short: '警徽',
    script: '请确认警徽移交给谁，或选择撕毁警徽。',
    help: '只能移交给存活且未翻牌的玩家。撕毁后本局不再重新竞选。',
  },
  ended: {
    title: '对局结束', short: '结束',
    script: '本局游戏结束。现在可以公开身份，进入复盘。',
    help: '复盘含全部身份及夜间信息，分享前请确认对局已经结束。',
  },
};

export const FIXED_STAGE_IDS = Object.keys(STAGES) as FixedStage[];

function lastWordsPolicySummary(rules: Rules): string | null {
  const policy = rules.flow?.lastWords;
  if (!policy) return null;
  const enabled = lastWordsPolicyLabels(rules);
  return enabled.length ? `遗言：${enabled.join('、')}` : '遗言：全部关闭';
}

export function ruleSummary(r: Rules, roles?: Role[]): string[] {
  const has = (role: Role) => roles === undefined || roles.includes(role);
  const table = tableRules(r);
  const medicine = has('witch') ? [`女巫${r.selfSave === 'never' ? '不可自救' : r.selfSave === 'first' ? '仅首夜可自救' : '可自救'} · ${r.doubleMedicine ? '允许同夜双药' : '禁止同夜双药'}`] : [];
  const guard = has('guard') ? [`${has('witch') ? `守救同人${r.guardSave === 'die' ? '死亡' : '存活'} · ` : ''}守卫${table.guardRepeat ? '可以' : '不能'}连续守同人`] : [];
  const deathRules = [
    has('hunter') ? has('witch') ? `猎人被毒${r.hunterPoison ? '可开枪' : '不能开枪'}` : '猎人出局可开枪带走一名玩家' : '',
    has('idiot') ? '白痴翻牌免放逐、失去投票权' : '',
  ].filter(Boolean);
  const lastWords = lastWordsPolicySummary(r);
  return [
    r.sheriff ? `上警 · 警长 ${r.sheriffWeight} 票` : '不上警',
    r.win === 'edge' ? '屠边：狼全灭好人胜；民或神全灭狼人胜' : '屠城：狼全灭好人胜；好人全灭狼人胜',
    `身份确认：${r.flow?.identityCheck === 'during-night' || r.flow?.identityCheck === 'at-nightfall' ? '夜间行动时逐项确认座位' : '发牌后玩家自行看牌'}`,
    ...(table.firstNightKnife ? [] : ['首夜狼人只互相确认，不发动击杀']),
    ...medicine,
    ...guard,
    ...(deathRules.length ? [deathRules.join(' · ')] : []),
    r.sheriff ? `首日顺序：${r.sheriffTiming === 'after-announcement' ? '先公布死亡，再竞选' : '先竞选，再公布死亡'}；死亡技能、警徽处理后判胜负` : '首日无警长竞选，确认夜间结果后进入白天',
    ...(r.sheriff ? [`警长平票：${table.sheriffTie === 'pk' ? 'PK 一轮，再平票则警徽流失' : '不 PK，警徽流失'}`] : []),
    `放逐记录：${table.exileRecord === 'quick' ? '快速记录最终被票出者，不逐人录票' : '逐人录票并自动处理平票'}`,
    ...(table.exileRecord === 'quick' ? [] : [`放逐平票：${table.exileTie === 'pk' ? 'PK 一轮，再平票则无人出局' : '不 PK，无人出局'}`]),
    ...(lastWords ? [lastWords] : []),
    ...(r.speechDurations ? [`分阶段计时：${speechDurationsSummary(r)}`] : []),
    `已出局角色：${shouldKeepDeadCalls(r) ? '默认保留夜间口播，不录入行动' : '跳过后续夜间环节'}`,
    ...(r.flow?.manualVictory ? ['特殊胜负或未自动处理技能：由主持人核对后，在“更多”中手动确认获胜阵营'] : []),
    ...(table.notes ? [`本桌补充约定（主持人执行）：${table.notes}`] : []),
  ];
}

/** A public pregame script contains table rules, never the seat-to-role mapping. */
export function openingRulesScript(rules: Rules, roles: Role[]): string {
  const table = tableRules(rules);
  const timing = [`白天正式发言按 ${speechSecondsForRules(rules, 'discussion')} 秒`];
  if (rules.sheriff) timing.push(`警上按 ${speechSecondsForRules(rules, 'sheriff')} 秒`);
  const usesExilePk = table.exileRecord !== 'quick' && table.exileTie === 'pk';
  if (rules.sheriff && table.sheriffTie === 'pk' || usesExilePk) {
    timing.push(`PK 按 ${speechSecondsForRules(rules, 'pk')} 秒`);
  }
  if (hasLastWordsPolicy(rules)) timing.push(`遗言按 ${speechSecondsForRules(rules, 'lastWords')} 秒`);
  return `各位玩家，开局前先确认今晚的桌规。\n\n${ruleSummary(rules, roles).map(line => `${line}。`).join('\n\n')}\n\n${timing.join('、')}计时。补充约定由主持人按约定执行。请现在提出规则疑问，确认后开始游戏。`;
}
