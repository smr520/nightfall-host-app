import { ROLES, isVillager, isWolf } from './roles';
import { tableRules } from './table-rules';
import { roleDeathSkill } from './role-behavior';
import { queueLastWords } from './last-words';
import type { Cause, Game, Player } from './types';
import { alive, log, player } from './shared';
import { beginNight } from './night';
import { pendingResolutionRank } from './flow';

export function nightDeaths(g: Game): { seat: number; cause: Cause }[] {
  if (g.night.manualDeaths) return g.night.manualDeaths.map(death => ({ ...death }));
  const n = g.night;
  const special = g.special ?? {};
  const result: { seat: number; cause: Cause }[] = [];
  const dancePool = special.dance?.pool ?? [];
  const dancer = g.players.find(p => p.role === 'dancer');
  const danceShield = !!dancer && dancePool.includes(dancer.seat);
  const dreamTarget = n.targets['dreamer'] ?? null;
  const lightTarget = n.targets['light-earl'] ?? null;
  const borrowed = special.treasure?.borrowed ?? null;
  const borrowedDream = borrowed === 'dreamer' ? n.targets['treasure-master'] ?? null : null;
  const damageImmunity = (seat: number) => seat === dreamTarget || seat === borrowedDream || seat === lightTarget;
  if (n.knife !== null) {
    const guarded = n.guard === n.knife;
    // 已记录的保护在同批夜间死亡后仍有效，不能因施法者同时中毒而改变预览结果。
    const sheltered = lightTarget === n.knife;
    const inDance = danceShield && dancePool.includes(n.knife);
    const saved = n.save;
    if (player(g, n.knife).role !== 'fox' && !sheltered && !inDance && !damageImmunity(n.knife) && ((!guarded && !saved) || (guarded && saved && g.rules.guardSave === 'die'))) result.push({ seat: n.knife, cause: 'knife' });
  }
  const poisonSeats = new Set<number>();
  if (n.poison !== null) poisonSeats.add(n.poison);
  const poisonerTarget = n.targets['poisoner'] ?? null;
  if (special.poisonerUsed && poisonerTarget !== null) poisonSeats.add(poisonerTarget);
  const borrowedPoison = borrowed === 'poisoner' ? n.targets['treasure-master'] ?? null : null;
  if (borrowedPoison !== null) poisonSeats.add(borrowedPoison);
  for (const seat of poisonSeats) {
    const previous = result.findIndex(d => d.seat === seat);
    if (previous >= 0) result.splice(previous, 1);
    if (damageImmunity(seat) || ROLES[player(g, seat).role].poisonImmune) continue;
    result.push({ seat, cause: 'poison' });
  }
  // 舞池固定三人，狼/非狼人数不会相等，天亮时人数较少一方的舞池玩家出局。
  if (dancePool.length === 3) {
    const wolfSeats = dancePool.filter(seat => isWolf(player(g, seat).role));
    const goodSeats = dancePool.filter(seat => !isWolf(player(g, seat).role));
    if (wolfSeats.length !== goodSeats.length) {
      for (const seat of wolfSeats.length < goodSeats.length ? wolfSeats : goodSeats) {
        if (!result.some(death => death.seat === seat)) result.push({ seat, cause: 'dance' });
      }
    }
  }
  if (dreamTarget !== null) {
    const dreamer = g.players.find(p => p.role === 'dreamer');
    const dreamerDied = !!dreamer && result.some(death => death.seat === dreamer.seat);
    const repeated = special.dreamerLast === dreamTarget;
    if ((dreamerDied || repeated) && lightTarget !== dreamTarget && !result.some(death => death.seat === dreamTarget)) {
      result.push({ seat: dreamTarget, cause: 'dream' });
    }
  }
  const demonTarget = n.targets['hunter-demon'] ?? null;
  if (demonTarget !== null) {
    const demon = g.players.find(p => p.role === 'hunter-demon' && p.alive);
    const hunted = g.players.find(p => p.seat === demonTarget);
    if (demon && hunted) {
      const victim = isWolf(hunted.role) ? hunted.seat : demon.seat;
      if (!result.some(death => death.seat === victim)) result.push({ seat: victim, cause: 'demon-hunt' });
    }
  }
  for (const seat of n.checkDeaths ?? []) {
    if (!result.some(death => death.seat === seat)) result.push({ seat, cause: 'check' });
  }
  return result.sort((a, b) => a.seat - b.seat);
}

export function getNightAnnouncement(g: Game): string {
  const deaths = nightDeaths(g);
  return deaths.length ? `昨夜 ${deaths.map(d => `${d.seat} 号`).join('、')} 出局` : '昨夜平安夜';
}

export function privateDeathDetails(deaths: { seat: number; cause: Cause }[]): string {
  const descriptions: Record<Cause, string> = { knife: '刀伤', poison: '中毒', exile: '被放逐', shot: '技能带走', explode: '自爆', ruling: '主持裁定', link: '跟随出局', dance: '舞池出局', hunt: '猎杀时刻', check: '查验出局', dream: '梦亡', 'demon-hunt': '猎魔' };
  return deaths.length ? `（${deaths.map(death => `${death.seat}号${descriptions[death.cause]}`).join('、')}）` : '';
}

/** 白泽之外仍有其他存活神职时才能传承。 */
function hasOtherGoodGod(g: Game, seat: number) {
  return g.players.some(p => p.alive && p.seat !== seat && ROLES[p.role].camp === 'good' && !isVillager(p.role));
}

function queueDeathSkill(g: Game, p: Player, cause: Cause) {
  if (cause === 'hunt' || cause === 'check' || cause === 'dream' || cause === 'demon-hunt') return;
  if (p.role === 'baize' && ['knife', 'poison', 'exile'].includes(cause) && hasOtherGoodGod(g, p.seat)) {
    g.pending.push({ kind: 'heir', seat: p.seat }); return;
  }
  if (p.role === 'mech-wolf' && g.special?.mechLearned === 'hunter' && cause !== 'poison') {
    g.pending.push({ kind: 'shot', seat: p.seat, role: 'hunter' }); return;
  }
  const skill = roleDeathSkill(p.role, cause, g.rules);
  if (skill === 'hunter') { g.pending.push({ kind: 'hunter', seat: p.seat }); return; }
  if (skill === 'shot') { g.pending.push({ kind: 'shot', seat: p.seat, role: p.role }); return; }
  if (skill === 'link') {
    const charmed = g.night.targets['wolf-beauty'] ?? null;
    if (charmed !== null && charmed !== p.seat && player(g, charmed).alive) g.pending.push({ kind: 'link', seat: p.seat, role: p.role, target: charmed });
  }
}

export function kill(g: Game, seat: number, cause: Cause) {
  const p = player(g, seat);
  if (!p.alive) return;
  const heir = g.special?.heir;
  // 神职继承人夜间出局：先宣布死亡，投票结束后才正式离场。
  if (heir?.seat === seat && heir.kind === 'god' && (cause === 'knife' || cause === 'poison')) {
    g.special!.delayedDeaths = [...(g.special!.delayedDeaths ?? []), { seat, cause }];
    log(g, `${seat} 号神职继承人夜间出局，本轮投票结束后离场`, `${seat} 号出局`);
    return;
  }
  p.alive = false; p.death = { day: g.day, cause };
  queueLastWords(g, seat, cause);
  queueDeathSkill(g, p, cause);
  if (g.sheriff === seat) { g.sheriff = null; g.pending.push({ kind: 'badge', seat }); }
}

/** 神职继承人延迟离场：投票流程结束后正式出局。 */
export function resolveDelayedDeaths(g: Game) {
  const list = g.special?.delayedDeaths;
  if (!list?.length) return;
  g.special!.delayedDeaths = [];
  for (const death of list) {
    const p = player(g, death.seat);
    if (!p.alive) continue;
    p.alive = false; p.death = { day: g.day, cause: death.cause };
    queueLastWords(g, p.seat, death.cause);
    queueDeathSkill(g, p, death.cause);
    if (g.sheriff === p.seat) { g.sheriff = null; g.pending.push({ kind: 'badge', seat: p.seat }); }
    log(g, `${p.seat} 号神职继承人延迟离场，正式出局`);
  }
}

/** 盗宝大师的阵营由底牌决定，继承平民按神民双阵营计。 */
function effectiveCamp(g: Game, p: Player): 'wolf' | 'good' | 'third' {
  if (p.role === 'treasure-master') return g.special?.treasure?.camp ?? 'third';
  return ROLES[p.role].camp;
}
const isDualHeir = (g: Game, p: Player) => g.special?.heir?.seat === p.seat && g.special?.heir?.kind === 'villager';
const foxAlive = (g: Game) => g.players.some(p => p.alive && p.role === 'fox');

export function victory(g: Game): { winner: 'good' | 'wolf' | 'third'; reason: string } | null {
  if (g.players.some(p => p.role === 'treasure-master') && !g.special?.treasure?.camp) return null;
  const living = alive(g);
  const wolves = living.filter(p => effectiveCamp(g, p) === 'wolf');
  const good = living.filter(p => effectiveCamp(g, p) === 'good');
  // 沙龙之夜：好人或狼人任一方清空时咒狐仍在场，咒狐直接获胜。
  if (foxAlive(g) && (!wolves.length || !good.length)) return { winner: 'third', reason: '咒狐仍在场且一方阵营已清空（沙龙之夜）' };
  if (!wolves.length) return { winner: 'good', reason: '所有狼人已出局' };
  if (g.rules.win === 'all') return !good.length ? { winner: 'wolf', reason: '所有好人已出局' } : null;
  // 特殊公开阵容没有平民边：只按好人清空判狼胜。
  if (tableRules(g.rules).lineupMode === 'free') return !good.length ? { winner: 'wolf', reason: '所有好人已出局' } : null;
  const villagers = good.filter(p => isVillager(p.role) || isDualHeir(g, p));
  const gods = good.filter(p => !isVillager(p.role) || isDualHeir(g, p));
  if (!villagers.length) return { winner: 'wolf', reason: '所有村民已出局（屠边）' };
  if (!gods.length) return { winner: 'wolf', reason: '所有神职已出局（屠边）' };
  return null;
}

export function end(g: Game, winner: 'good' | 'wolf' | 'third' | 'draw', reason: string) {
  g.winner = winner; g.endReason = reason; g.endedAt = Date.now(); g.stage = 'ended';
  log(g, `对局结束：${winner === 'good' ? '好人获胜' : winner === 'wolf' ? '狼人获胜' : winner === 'third' ? '第三方获胜' : '平局'}。${reason}`, '对局结束');
}

export function advance(g: Game) {
  g.pending.sort((a, b) => pendingResolutionRank(a.kind, g.rules.flow) - pendingResolutionRank(b.kind, g.rules.flow) || a.seat - b.seat);
  if (g.pending.length) { g.stage = g.pending[0].kind; return; }
  const result = g.rules.flow?.manualVictory ? null : victory(g);
  if (result) { end(g, result.winner, result.reason); return; }
  if (g.resume === 'night') { beginNight(g); return; }
  g.stage = !g.sheriffDone ? 'sheriff-signup' : 'discussion';
}
