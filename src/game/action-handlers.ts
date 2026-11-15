import { DAWN_CAUSES } from './flow';
import { ROLES, isCallScheduled, isVillager, isWolf } from './roles';
import { tableRules } from './table-rules';
import type { Action, Game, NightCall } from './types';
import type { ActionContext, ActionOf } from './action-context';
import { addCheckDeath, isNightmareFeared } from './action-helpers';
import { createDeathActionHandlers } from './death-action-handlers';

export function createActionHandlers(ctx: ActionContext) {
  const death = createDeathActionHandlers(ctx);

  function dispatch(g: Game, action: Action) {
    switch (action.type) {
      case 'skip-night': applySkipNight(g, action); break;
      case 'guard': applyGuard(g, action); break;
      case 'wolves': applyWolves(g, action); break;
      case 'seer': applySeer(g, action); break;
      case 'witch': applyWitch(g, action); break;
      case 'call': applyCall(g, action); break;
      case 'dance': applyDance(g, action); break;
      case 'borrow': applyBorrow(g, action); break;
      case 'hunt': applyHunt(g); break;
      case 'heir': applyHeir(g, action); break;
      case 'dawn': applyDawn(g); break;
      case 'set-dawn-deaths': applySetDawnDeaths(g, action); break;
      case 'announce-dawn': applyAnnounceDawn(g); break;
      case 'last-words': applyLastWords(g, action); break;
      case 'signup': applySignup(g, action); break;
      case 'ballot': applyBallot(g, action); break;
      case 'ballots': applyBallots(g, action); break;
      case 'count': applyCount(g); break;
      case 'start-exile': applyStartExile(g); break;
      case 'next-night': applyNextNight(g); break;
      case 'hunter': death.hunter(g, action); break;
      case 'shot': death.shot(g, action); break;
      case 'link': death.link(g, action); break;
      case 'badge': death.badge(g, action); break;
      case 'explode': death.explode(g, action); break;
      case 'ruling': death.ruling(g, action); break;
      case 'note': applyNote(g, action); break;
      case 'finish': death.finish(g, action); break;
    }
  }

  function applySkipNight(g: Game, action: ActionOf<'skip-night'>) {
    const call = g.stage as NightCall;
    ctx.demand(g.nightCalls.includes(call), '只能跳过当前夜间行动，不能跳过出局技能或投票结算');
    const active = ctx.callActorAlive(g, call);
    if (call === 'nine-tails' || call === 'dancer') ctx.demand(!active, call === 'nine-tails' ? '九尾每夜必须标记一名玩家' : '舞者每夜必须选择三名玩家共舞');
    else if (call !== 'wolves' && ROLES[call].night?.canSkip === false) ctx.demand(!active, `${ROLES[call].name}本夜必须行动`);
    if (call === 'guard') g.night.guard = null;
    else if (call === 'wolves') g.night.knife = null;
    else if (call === 'seer') g.night.inspect = null;
    else if (call === 'witch') { g.night.save = false; g.night.poison = null; }
    else g.night.targets[call] = null;
    const name = call === 'wolves' ? '狼人行动' : `${ROLES[call].name}行动`;
    ctx.log(g, `跳过${name}；${action.reason?.trim() || (active ? '主持人确认本夜不行动' : '行动角色已出局')}`);
    ctx.nextNightCall(g, call);
  }

  function applyGuard(g: Game, action: ActionOf<'guard'>) {
    ctx.requireStage(g, 'guard');
    ctx.target(g, action.target);
    const guard = ctx.actor(g, 'guard');
    ctx.demand(guard || action.target === null, '守卫已出局，只能空过');
    ctx.demand(!guard || !isNightmareFeared(g, guard.seat), '守卫本夜被恐惧，不能行动');
    ctx.demand(tableRules(g.rules).guardRepeat || action.target === null || action.target !== g.lastGuard, '不能连续两夜守同一人');
    g.night.guard = action.target;
    ctx.log(g, `守卫：${action.target === null ? '空守' : `守护 ${action.target} 号`}`);
    ctx.nextNightCall(g, 'guard');
  }

  function applyWolves(g: Game, action: ActionOf<'wolves'>) {
    ctx.requireStage(g, 'wolves');
    ctx.target(g, action.target);
    ctx.demand(g.day !== 1 || tableRules(g.rules).firstNightKnife || action.target === null, '本板首夜仅确认狼队，不能击杀');
    ctx.demand(ctx.knifeActors(g).length > 0 || action.target === null, '没有可动刀的角色，只能空过');
    g.night.knife = action.target;
    ctx.log(g, `狼人：${action.target === null ? '空刀' : `刀 ${action.target} 号`}`);
    ctx.nextNightCall(g, 'wolves');
  }

  function applySeer(g: Game, action: ActionOf<'seer'>) {
    ctx.requireStage(g, 'seer');
    ctx.target(g, action.target);
    const seer = ctx.actor(g, 'seer');
    ctx.demand(seer || action.target === null, '预言家已出局，只能空过');
    ctx.demand(!seer || !isNightmareFeared(g, seer.seat), '预言家本夜被恐惧，不能行动');
    ctx.demand(action.target === null || action.target !== seer?.seat, '预言家不能查验自己');
    g.night.inspect = action.target;
    if (action.target === null) ctx.log(g, '预言家：未查验');
    else {
      const checked = ctx.player(g, action.target);
      ctx.log(g, `预言家查验 ${action.target} 号：${isWolf(checked.role) ? '狼人' : '好人'}`);
      if (checked.role === 'fox') {
        addCheckDeath(g, action.target);
        ctx.log(g, `预言家查验 ${action.target} 号命中咒狐，天亮时出局`);
      }
    }
    ctx.nextNightCall(g, 'seer');
  }

  function applyWitch(g: Game, action: ActionOf<'witch'>) {
    ctx.requireStage(g, 'witch');
    ctx.target(g, action.poison);
    const witch = ctx.actor(g, 'witch');
    ctx.demand(witch || (!action.save && action.poison === null), '女巫已出局，只能空过');
    ctx.demand(!witch || !isNightmareFeared(g, witch.seat), '女巫本夜被恐惧，不能行动');
    ctx.demand(!action.save || g.medicine.save, '解药已用完');
    ctx.demand(action.poison === null || g.medicine.poison, '毒药已用完');
    ctx.demand(!action.save || g.night.knife !== null, '空刀不能使用解药');
    ctx.demand(g.rules.doubleMedicine || !(action.save && action.poison !== null), '本局禁止同夜双药');
    if (action.save && g.night.knife === witch?.seat) ctx.demand(g.rules.selfSave === 'always' || (g.rules.selfSave === 'first' && g.day === 1), '本局规则不允许此时自救');
    g.night.save = action.save;
    g.night.poison = action.poison;
    if (action.save) g.medicine.save = false;
    if (action.poison !== null) g.medicine.poison = false;
    ctx.log(g, `女巫：${action.save ? '使用解药' : '不用解药'}，${action.poison !== null ? `毒 ${action.poison} 号` : '不用毒药'}`);
    ctx.nextNightCall(g, 'witch');
  }

  function applyCall(g: Game, action: ActionOf<'call'>) {
    const call = action.callId as NightCall;
    ctx.demand(g.nightCalls.includes(call), '这个行动不在本局流程里');
    ctx.demand(!['wolves', 'guard', 'seer', 'witch', 'dancer'].includes(call), call === 'dancer' ? '舞者请使用舞池操作' : '基础角色请使用对应行动，不能跳过技能校验');
    ctx.requireStage(g, call);
    ctx.target(g, action.target);
    const meta = call === 'wolves' ? ROLES.wolf : ROLES[call];
    ctx.demand(ctx.callActorAlive(g, call) || action.target === null, '行动角色已出局，只能空过');
    ctx.demand(isCallScheduled(call, g.day), meta.night?.firstNightOnly ? '这个技能只能在首夜行动' : `这个技能从第 ${meta.night?.fromNight ?? 1} 夜开始行动`);
    if (call === 'nine-tails') {
      const markTarget = action.target;
      ctx.demand(markTarget !== null, '九尾每夜必须标记一名玩家');
      ctx.addMark(g, markTarget!);
      ctx.log(g, `九尾标记 ${markTarget} 号（共 ${g.special?.marks?.[markTarget!] ?? 1} 层）`);
    } else if (call === 'baize') {
      if (action.target === null) ctx.log(g, '白泽：本夜不清除标记');
      else {
        const cleared = g.special?.marks?.[action.target] ?? 0;
        if (g.special?.marks) delete g.special.marks[action.target];
        ctx.log(g, `白泽清除 ${action.target} 号的 ${cleared} 层标记`);
      }
    } else if (call === 'mech-wolf') {
      ctx.demand(!g.special?.mechLearned, '机械狼整局只能学习一次');
      if (action.target === null) ctx.log(g, '机械狼：本夜不学习');
      else {
        const learned = ctx.player(g, action.target).role;
        g.special = { ...(g.special ?? {}), mechLearned: learned };
        ctx.log(g, `机械狼学习 ${action.target} 号：${ROLES[learned].name}；仅主持人可见`);
      }
    } else if (call === 'treasure-master') {
      ctx.demand(g.special?.treasure?.borrowed != null, '请先选择今晚借用的底牌');
      ctx.log(g, `盗宝大师借用${ROLES[g.special!.treasure!.borrowed!].name}：${action.target === null ? '本夜不使用' : `${action.target} 号`}`);
    } else if (call === 'poisoner') {
      const used = g.special?.poisonerUsed === true;
      ctx.demand(action.target === null || !used, '毒师的毒药整局只有一瓶');
      if (action.target !== null) g.special = { ...(g.special ?? {}), poisonerUsed: true };
      ctx.log(g, `毒师：${action.target === null ? '本夜不用毒' : `毒 ${action.target} 号（整局唯一一瓶）`}`);
    } else if (call === 'dreamer') {
      const targetSeat = action.target;
      ctx.demand(targetSeat !== null || !ctx.actor(g, 'dreamer'), '摄梦人本夜必须选择梦游者');
      if (targetSeat === null) ctx.log(g, '摄梦人：本夜不选择梦游者');
      else ctx.log(g, `摄梦人：${targetSeat} 号梦游${g.special?.dreamerLast === targetSeat ? '（连续第二夜，天亮时梦亡）' : ''}`);
    } else if (call === 'nightmare') {
      const targetSeat = action.target;
      ctx.demand(targetSeat !== null || !ctx.actor(g, 'nightmare'), '噩梦之影本夜必须选择恐惧目标');
      if (targetSeat === null) ctx.log(g, '噩梦之影：本夜不恐惧');
      else {
        ctx.demand(g.special?.nightmareLast !== targetSeat, '不能连续两夜恐惧同一目标');
        const fearedPlayer = ctx.player(g, targetSeat);
        ctx.log(g, `噩梦之影恐惧 ${targetSeat} 号${isWolf(fearedPlayer.role) ? '（狼队今晚无法袭击）' : '（目标当夜技能失效）'}`);
      }
    } else if (call === 'hunter-demon') {
      const targetSeat = action.target;
      ctx.demand(targetSeat !== null || !ctx.actor(g, 'hunter-demon'), '猎魔人本夜必须选择狩猎目标');
      if (targetSeat === null) ctx.log(g, '猎魔人：本夜不狩猎');
      else ctx.log(g, `猎魔人狩猎 ${targetSeat} 号`);
    } else if (call === 'light-earl') {
      const targetSeat = action.target;
      ctx.demand(targetSeat !== null || !ctx.actor(g, 'light-earl'), '流光伯爵本夜必须选择庇护目标');
      if (targetSeat === null) ctx.log(g, '流光伯爵：本夜不庇护');
      else {
        ctx.demand(targetSeat !== ctx.actor(g, 'light-earl')?.seat, '流光伯爵不能庇护自己');
        ctx.demand(g.special?.lightEarlLast !== targetSeat, '不能连续两夜庇护同一人');
        ctx.log(g, `流光伯爵庇护 ${targetSeat} 号`);
      }
    } else if (call === 'gargoyle') {
      const targetSeat = action.target;
      if (targetSeat === null) ctx.log(g, '石像鬼：本夜不查验');
      else {
        const gargoyle = ctx.actor(g, 'gargoyle');
        ctx.demand(gargoyle && targetSeat !== gargoyle.seat, '石像鬼不能查验自己');
        const checked = g.special?.gargoyleChecked ?? [];
        ctx.demand(!checked.includes(targetSeat), `${targetSeat} 号已经查验过`);
        g.special = { ...(g.special ?? {}), gargoyleChecked: [...checked, targetSeat] };
        ctx.log(g, `石像鬼查验 ${targetSeat} 号：${ROLES[ctx.player(g, targetSeat).role].name}；仅主持人可见`);
      }
    } else if (call === 'pure-white' || call === 'wolf-shaman' || call === 'magic-mirror' || call === 'medium') {
      const targetSeat = action.target;
      if (targetSeat === null) ctx.log(g, `${meta.name}：本夜不查验`);
      else {
        const checked = ctx.player(g, targetSeat);
        if (call === 'wolf-shaman') ctx.demand(!isWolf(checked.role), '狼巫只能查验非狼人阵营玩家');
        const observed = call === 'medium' && checked.role === 'treasure-master' && g.special?.treasure?.borrowed
          ? g.special.treasure.borrowed
          : checked.role;
        ctx.log(g, `${meta.name}查验 ${targetSeat} 号：${ROLES[observed].name}；仅主持人可见`);
        if (g.day >= 2 && call === 'pure-white' && isWolf(checked.role)) addCheckDeath(g, targetSeat);
        if (g.day >= 2 && call === 'wolf-shaman' && checked.role === 'pure-white') addCheckDeath(g, targetSeat);
      }
    } else ctx.log(g, `${meta.name}：${action.target === null ? '本夜不行动' : `${action.target} 号`}${meta.night ? `（${meta.night.targetLabel}）` : ''}`);
    g.night.targets[call] = action.target;
    ctx.nextNightCall(g, call);
  }

  function applyDance(g: Game, action: ActionOf<'dance'>) {
    ctx.requireStage(g, 'dancer');
    ctx.demand(ctx.actor(g, 'dancer'), '舞者已出局，本夜无需共舞');
    ctx.demand(action.seats.length === 3, '舞池必须选择三名玩家');
    ctx.demand(new Set(action.seats).size === 3, '舞池玩家不能重复');
    const visited = g.special?.danceVisited ?? [];
    action.seats.forEach(seat => {
      ctx.demand(ctx.player(g, seat).alive, '只能选择存活玩家');
      ctx.demand(!visited.includes(seat), `${seat} 号已经进过舞池，整局只能进一次`);
    });
    const pool = [...action.seats].sort((a, b) => a - b);
    g.special = { ...(g.special ?? {}), dance: { pool }, danceVisited: [...visited, ...action.seats] };
    ctx.log(g, `舞池：${pool.map(seat => `${seat} 号`).join('、')}`);
    ctx.nextNightCall(g, 'dancer');
  }

  function applyBorrow(g: Game, action: ActionOf<'borrow'>) {
    ctx.requireStage(g, 'treasure-master');
    const treasure = g.special?.treasure;
    ctx.demand(treasure, '本局没有底牌记录，无法借用');
    ctx.demand(treasure!.reserve.includes(action.card), '只能借用底牌中的身份');
    ctx.demand(action.card !== treasure!.lastBorrowed, '不能连续两夜借用同一张底牌');
    g.special!.treasure = { ...treasure!, borrowed: action.card };
    ctx.log(g, `盗宝大师今晚借用：${ROLES[action.card].name}${action.card === 'medium' ? '（查验结果见私密提示）' : ''}`);
  }

  function applyHunt(g: Game) {
    ctx.requireStage(g, 'discussion');
    const nine = ctx.actor(g, 'nine-tails');
    ctx.demand(nine, '九尾已出局，不能发动猎杀时刻');
    const marked = ctx.alive(g).filter(p => (g.special?.marks?.[p.seat] ?? 0) > 0);
    const a = 1 + marked.length;
    const b = ctx.alive(g).length - a;
    if (a <= b) {
      ctx.log(g, `九尾猎杀时刻：A（九尾与标记）=${a}，B（其余）=${b}，未达成`, '九尾发动猎杀时刻，未达成');
      return;
    }
    const victims = ctx.alive(g).filter(p => p.seat !== nine!.seat && !marked.some(mark => mark.seat === p.seat));
    victims.forEach(p => ctx.kill(g, p.seat, 'hunt'));
    const seats = victims.map(p => `${p.seat} 号`).join('、');
    ctx.log(g, `九尾猎杀时刻成功：A=${a}，B=${b}；${seats}出局且不能发动技能`, `九尾猎杀时刻：${seats}出局`);
    g.resume = 'night';
    ctx.advance(g);
  }

  function applyHeir(g: Game, action: ActionOf<'heir'>) {
    ctx.requireStage(g, 'heir');
    ctx.demand(action.target !== null, '必须指定一名存活玩家为继承人');
    ctx.target(g, action.target);
    const pending = g.pending.shift()!;
    const heirSeat = action.target;
    ctx.demand(heirSeat !== pending.seat, '不能选择白泽自己');
    const heir = ctx.player(g, heirSeat!);
    const kind = isWolf(heir.role) ? 'wolf' : isVillager(heir.role) ? 'villager' : 'god';
    g.special = { ...(g.special ?? {}), heir: { seat: heir.seat, kind } };
    const label = kind === 'villager' ? '平民（神民双阵营）' : kind === 'god' ? '神职（夜间出局后延迟到投票结束）' : '狼人阵营（不受影响）';
    ctx.log(g, `白泽传承：${heir.seat} 号（${ROLES[heir.role].name}）为继承人 · ${label}`);
    ctx.advance(g);
  }

  function applyDawn(g: Game) {
    ctx.requireStage(g, 'dawn');
    ctx.demand(!g.rules.flow?.manualDawn || !!g.night.manualDeaths, '请先确认昨夜出局名单，再继续天亮流程');
    const deaths = ctx.nightDeaths(g);
    const announcement = deaths.length ? `昨夜 ${deaths.map(d => `${d.seat} 号`).join('、')} 出局` : '昨夜平安夜';
    g.nightAnnouncement = announcement;
    const firstDaySheriff = g.day === 1 && g.rules.sheriff && !g.sheriffDone;
    const beforeAnnouncement = g.rules.sheriffTiming !== 'after-announcement';
    g.announcementReady = firstDaySheriff && beforeAnnouncement;
    if (g.announcementReady) {
      ctx.log(g, `昨夜结算待公布：${announcement}`);
      g.stage = 'sheriff-signup';
      return;
    }
    g.lastGuard = g.night.guard;
    deaths.forEach(d => ctx.kill(g, d.seat, d.cause));
    ctx.log(g, `${announcement}${ctx.privateDeathDetails(deaths)}`, announcement);
    ctx.log(g, '主持人确认并公布昨夜结果', announcement);
    g.resume = 'discussion';
    ctx.advance(g);
  }

  function applySetDawnDeaths(g: Game, action: ActionOf<'set-dawn-deaths'>) {
    ctx.requireStage(g, 'dawn');
    ctx.demand(g.rules.flow?.manualDawn === true, '本局未开启天亮手动复核');
    ctx.demand(action.reason.trim().length >= 2, '请填写至少两个字的复核原因');
    const seats = action.deaths.map(death => death.seat);
    ctx.demand(new Set(seats).size === seats.length, '昨夜出局名单不能重复');
    action.deaths.forEach(death => {
      ctx.demand(g.players.some(p => p.seat === death.seat && p.alive), '出局名单只能包含当前存活的座位');
      ctx.demand((DAWN_CAUSES as readonly string[]).includes(death.cause), '昨夜出局原因无效');
    });
    g.night.manualDeaths = action.deaths.map(death => ({ ...death })).sort((a, b) => a.seat - b.seat);
    g.night.manualReason = action.reason.trim();
    ctx.log(g, `主持人复核昨夜名单：${seats.join('、') || '无人'}；原因：${g.night.manualReason}`, '昨夜名单已复核');
  }

  function applyAnnounceDawn(g: Game) {
    ctx.requireStage(g, 'dawn-announcement');
    const deaths = ctx.nightDeaths(g);
    g.lastGuard = g.night.guard;
    deaths.forEach(d => ctx.kill(g, d.seat, d.cause));
    const announcement = typeof g.nightAnnouncement === 'string' ? g.nightAnnouncement : ctx.getNightAnnouncement(g);
    ctx.log(g, `${announcement}${ctx.privateDeathDetails(deaths)}`, announcement);
    ctx.log(g, '主持人确认并公布昨夜结果', announcement);
    g.announcementReady = false;
    g.resume = 'discussion';
    ctx.advance(g);
  }

  function applyLastWords(g: Game, action: ActionOf<'last-words'>) {
    ctx.requireStage(g, 'last-words');
    const pending = g.pending[0];
    ctx.demand(pending?.kind === 'last-words', '当前没有待处理的遗言');
    g.pending.shift();
    const result = `${pending!.seat} 号${action.speak ? '发表遗言' : '放弃遗言'}`;
    ctx.log(g, result, result);
    ctx.advance(g);
  }

  function applySignup(g: Game, action: ActionOf<'signup'>) {
    ctx.requireStage(g, 'sheriff-signup');
    ctx.demand(new Set(action.seats).size === action.seats.length, '参选名单重复');
    action.seats.forEach(n => ctx.demand(ctx.canVote(ctx.player(g, n)), '参选人必须存活且未翻牌'));
    g.signup = [...action.seats];
    ctx.log(g, `最终上警：${action.seats.join('、') || '无人'}`, `最终上警：${action.seats.join('、') || '无人'}`);
    if (action.seats.length < 2) {
      g.sheriff = action.seats[0] ?? null;
      g.sheriffDone = true;
      ctx.log(g, g.sheriff ? `${g.sheriff} 号直接当选警长` : '无人上警，警徽流失', g.sheriff ? `${g.sheriff} 号当选警长` : '警徽流失');
      ctx.afterSheriff(g);
    } else {
      g.vote = ctx.makeVote(g, 'sheriff', action.seats);
      g.stage = 'sheriff-vote';
    }
  }

  function applyBallot(g: Game, action: ActionOf<'ballot'>) {
    ctx.requireStage(g, 'sheriff-vote', 'exile-vote');
    ctx.demand(g.vote && g.vote.voters.includes(action.voter), '该玩家没有本轮投票权');
    ctx.demand(action.target === null || g.vote!.candidates.includes(action.target), '只能投给本轮候选人');
    const previous = g.vote!.ballots[action.voter];
    g.vote!.ballots[action.voter] = action.target;
    ctx.moveVoteMark(g, action.voter, previous, action.target);
    if (action.target !== null && ctx.nineTailsVoter(g, action.voter)) ctx.log(g, `九尾投票标记 ${action.target} 号`);
    ctx.log(g, `${action.voter} 号${action.target === null ? '弃票' : `投给 ${action.target} 号`}`, `${action.voter} 号${action.target === null ? '弃票' : `投给 ${action.target} 号`}`);
  }

  function applyBallots(g: Game, action: ActionOf<'ballots'>) {
    ctx.requireStage(g, 'sheriff-vote', 'exile-vote');
    ctx.demand(Array.isArray(action.voters) && action.voters.length > 0, '请至少选择一名投票人');
    ctx.demand(new Set(action.voters).size === action.voters.length, '投票人名单重复');
    action.voters.forEach(voter => ctx.demand(g.vote && g.vote.voters.includes(voter), `${voter} 号没有本轮投票权`));
    ctx.demand(action.target === null || g.vote!.candidates.includes(action.target), '只能投给本轮候选人');
    action.voters.forEach(voter => {
      ctx.moveVoteMark(g, voter, g.vote!.ballots[voter], action.target);
      g.vote!.ballots[voter] = action.target;
    });
    const seats = [...action.voters].sort((a, b) => a - b).map(seat => `${seat} 号`).join('、');
    const summary = `${seats}${action.target === null ? '弃票' : `投给 ${action.target} 号`}`;
    ctx.log(g, summary, summary);
  }

  function applyCount(g: Game) {
    ctx.requireStage(g, 'sheriff-vote', 'exile-vote');
    const v = g.vote!;
    ctx.demand(v.voters.every(n => Object.prototype.hasOwnProperty.call(v.ballots, n)), '还有未录入的投票，请明确选择弃票或目标');
    const totals = ctx.tally(g);
    const max = Math.max(0, ...totals.map(t => t.votes));
    const tied = totals.filter(t => t.votes === max).map(t => t.seat);
    const summary = totals.map(t => `${t.seat}号 ${t.votes}票`).join('，');
    ctx.log(g, `${v.kind === 'sheriff' ? '警长' : '放逐'}第 ${v.round} 轮：${summary || '无人有投票权'}`, summary);
    const tieRule = v.kind === 'sheriff' ? tableRules(g.rules).sheriffTie : tableRules(g.rules).exileTie;
    if (max > 0 && tied.length > 1 && v.round === 1 && tieRule === 'pk') {
      g.vote = ctx.makeVote(g, v.kind, tied, 2);
      ctx.log(g, `平票 PK：${tied.join('、')} 号`, `平票 PK：${tied.join('、')} 号`);
      return;
    }
    const elected = max > 0 && tied.length === 1 ? tied[0] : null;
    if (v.kind === 'sheriff') {
      g.sheriff = elected;
      g.sheriffDone = true;
      ctx.log(g, elected === null ? '本轮无当选人，警徽流失' : `${elected} 号当选警长`, elected === null ? '警徽流失' : `${elected} 号当选警长`);
      ctx.afterSheriff(g);
    } else if (elected !== null) ctx.exile(g, elected);
    else {
      ctx.log(g, '本轮无人被放逐', '本轮无人被放逐');
      ctx.resolveDelayedDeaths(g);
      g.resume = 'night';
      ctx.advance(g);
    }
  }

  function applyStartExile(g: Game) {
    ctx.requireStage(g, 'discussion');
    g.vote = ctx.makeVote(g, 'exile', ctx.alive(g).filter(p => !p.exposed).map(p => p.seat));
    g.stage = 'exile-vote';
    ctx.log(g, '开始放逐投票', '开始放逐投票');
  }

  function applyNextNight(g: Game) {
    ctx.requireStage(g, 'discussion');
    ctx.log(g, '主持人确认跳过放逐，进入下一夜', '本日不放逐');
    ctx.resolveDelayedDeaths(g);
    g.resume = 'night';
    ctx.advance(g);
  }

  function applyNote(g: Game, action: ActionOf<'note'>) {
    ctx.demand(typeof action.text === 'string' && action.text.trim().length > 0, '请填写备忘内容');
    ctx.demand(action.text.trim().length <= 1200, '备忘内容不能超过 1200 字');
    ctx.log(g, `主持备忘：${action.text.trim()}`);
  }

  return { dispatch };
}
