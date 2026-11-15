import { resolveNightOrder, validateFlow } from './flow';
import { ROLES, ROLE_IDS, isVillager, isWolf } from './roles';
import { isValidSpeechSeconds, validateSpeechDurations } from './speech';
import { tableRules, validateTableRules } from './table-rules';
import type { Counts, Game, Role, Rules, Stage } from './types';
import { clone, demand, emptyNight, log } from './shared';
import { nextNightCall } from './night';

export function validateCounts(c: Counts, rules?: Pick<Rules, 'table' | 'flow'>) {
  ROLE_IDS.forEach(r => demand(Number.isInteger(c[r]) && c[r] >= 0 && c[r] <= 9, `${ROLES[r].name}数量必须是 0–9 的整数`));
  const total = Object.values(c).reduce((a, b) => a + b, 0);
  demand(total >= 6 && total <= 16, '支持 6–16 人局');
  demand(wolvesTotal(c) >= 1, '至少需要一名狼人');
  if (tableRules(rules?.table).lineupMode === 'free') {
    demand(ROLE_IDS.some(r => !isWolf(r) && c[r] > 0), '特殊阵容至少需要一个非狼人身份');
    return;
  }
  demand(ROLE_IDS.some(r => isVillager(r) && c[r] > 0), '至少需要一名村民');
  demand(ROLE_IDS.some(r => ROLES[r].camp === 'good' && !isVillager(r) && c[r] > 0), '至少需要一种神职');
  demand(c.seer + c.witch + c.hunter + c.idiot + c.guard <= 8, '常规神职数量过多');
}

function wolvesTotal(c: Counts) {
  return ROLE_IDS.filter(isWolf).reduce((sum, role) => sum + c[role], 0);
}

export function createGame(name: string, board: string, players: { name: string; role: Role }[], rules: Rules, options: { privateNotes?: string[]; treasure?: { reserve: Role[]; camp: 'wolf' | 'good' } } = {}): Game {
  demand(!players.some(p => p.role === 'lucky-one'), '幸运儿是附加能力状态，不是独立身份。请保留玩家原身份并在主持记录中注明附加能力');
  const c = Object.fromEntries(ROLE_IDS.map(r => [r, players.filter(p => p.role === r).length])) as Counts;
  validateCounts(c, rules);
  const modeledThird = new Set<Role>(['fox', 'treasure-master']);
  demand(!players.some(p => ROLES[p.role].camp === 'third' && !modeledThird.has(p.role)) || rules.flow?.manualVictory === true, '含第三方或可变阵营身份，须由主持人判定胜负');
  demand(['edge', 'all'].includes(rules.win), '胜负规则无效');
  demand(isValidSpeechSeconds(rules.speechSeconds), '默认发言计时无效');
  demand(validateSpeechDurations(rules.speechDurations), '分阶段发言计时无效');
  demand(validateTableRules(rules.table), '本桌规则无效');
  demand(rules.flow === undefined || validateFlow(rules.flow, c), '自定义流程无效，请检查夜间顺序和主持词');
  const now = Date.now();
  const nightCalls = resolveNightOrder(c, rules.flow);
  const identityAtNightfall = rules.flow?.identityCheck === 'at-nightfall';
  const identityDuringNight = rules.flow?.identityCheck === 'during-night';
  const initialStage: Stage = identityAtNightfall ? 'identity-check' : 'dawn';
  const g: Game = {
    schema: 2, id: `${now}-${Math.random().toString(36).slice(2, 8)}`, name: name.trim() || '线下狼人杀', board,
    startedAt: now, day: 1, stage: initialStage, nightCalls,
    ...(identityAtNightfall || identityDuringNight ? { identityConfirmed: [] } : {}), rules: clone(rules),
    players: players.map((p, i) => ({ ...p, name: p.name.trim().slice(0, 16), seat: i + 1, alive: true, exposed: false })),
    night: emptyNight(), nightAnnouncement: undefined, lastGuard: null, medicine: { save: true, poison: true }, sheriff: null,
    sheriffDone: !rules.sheriff, signup: [], vote: null, pending: [], announcementReady: false, resume: 'discussion', events: [],
    ...(options.treasure ? { special: { treasure: { reserve: [...options.treasure.reserve], camp: options.treasure.camp } } } : {}),
  };
  if (!identityAtNightfall) nextNightCall(g, null);
  log(g, `创建 ${board}，身份已录入`, '对局开始');
  if (identityAtNightfall) log(g, '已启用天黑后逐人身份确认', '身份确认阶段');
  if (identityDuringNight) log(g, '已启用夜间行动时逐步确认身份');
  options.privateNotes?.forEach(note => { if (note.trim()) log(g, note.trim()); });
  return g;
}
