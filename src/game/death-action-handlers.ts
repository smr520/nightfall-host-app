import { canExplode } from './role-behavior';
import { ROLES, isWolf } from './roles';
import type { ActionContext, ActionOf } from './action-context';
import type { Game } from './types';

/** Death-skill, badge and host-finish actions share the same ordered pending queue. */
export function createDeathActionHandlers(ctx: ActionContext) {
  function hunter(g: Game, action: ActionOf<'hunter'>) {
    ctx.requireStage(g, 'hunter');
    ctx.target(g, action.target);
    const skill = g.pending.shift()!;
    const detail = action.target === null ? '不开枪' : `开枪带走 ${action.target} 号`;
    ctx.log(g, `${skill.seat} 号猎人${detail}`, `${skill.seat} 号猎人${detail}`);
    if (action.target !== null) ctx.kill(g, action.target, 'shot');
    ctx.advance(g);
  }

  function shot(g: Game, action: ActionOf<'shot'>) {
    ctx.requireStage(g, 'shot');
    ctx.target(g, action.target);
    const skill = g.pending.shift()!;
    const name = skill.role ? ROLES[skill.role].name : '出局角色';
    const detail = action.target === null ? '放弃带人' : `带走 ${action.target} 号`;
    ctx.log(g, `${skill.seat} 号${name}${detail}`, `${skill.seat} 号${name}${detail}`);
    if (action.target !== null) ctx.kill(g, action.target, 'shot');
    ctx.advance(g);
  }

  function link(g: Game, action: ActionOf<'link'>) {
    ctx.requireStage(g, 'link');
    const skill = g.pending[0];
    ctx.demand(skill?.kind === 'link', '没有待处理的殉情技能');
    ctx.demand(action.target === null || skill.target === undefined || action.target === skill.target, '只能确认已记录的魅惑目标');
    const targetSeat = skill.target ?? action.target;
    const linked = targetSeat === null ? null : ctx.player(g, targetSeat);
    g.pending.shift();
    const detail = linked === null
      ? '无人殉情'
      : linked.alive
        ? `${targetSeat} 号随之出局`
        : `${targetSeat} 号已出局，无需重复殉情`;
    ctx.log(g, `${skill.seat} 号狼美人出局，${detail}`, detail);
    if (linked?.alive) ctx.kill(g, linked.seat, 'link');
    ctx.advance(g);
  }

  function badge(g: Game, action: ActionOf<'badge'>) {
    ctx.requireStage(g, 'badge');
    ctx.target(g, action.target);
    ctx.demand(action.target === null || !ctx.player(g, action.target).exposed, '不能移交给已翻牌白痴');
    const skill = g.pending.shift()!;
    g.sheriff = action.target;
    ctx.log(g, `${skill.seat} 号警徽${action.target === null ? '撕毁' : `移交 ${action.target} 号`}`, action.target === null ? '警徽撕毁' : `${action.target} 号接任警长`);
    ctx.advance(g);
  }

  function explode(g: Game, action: ActionOf<'explode'>) {
    ctx.requireStage(g, 'discussion');
    const player = ctx.player(g, action.seat);
    ctx.demand(
      canExplode(g, action.seat),
      player.alive && isWolf(player.role) ? `${ROLES[player.role].name}不能自爆` : '只有存活狼人可以自爆',
    );
    ctx.kill(g, action.seat, 'explode');
    ctx.log(g, `${action.seat} 号${ROLES[player.role].name}自爆，结束白天`, `${action.seat} 号狼人自爆`);
    g.resume = 'night';
    ctx.advance(g);
  }

  function ruling(g: Game, action: ActionOf<'ruling'>) {
    ctx.requireStage(g, 'discussion');
    ctx.demand(action.reason.trim().length >= 2, '请填写至少两个字的裁定原因');
    const player = ctx.player(g, action.seat);
    ctx.demand(player.alive !== action.alive, '玩家状态未改变');
    if (action.alive) {
      player.alive = true;
      delete player.death;
    } else {
      ctx.kill(g, player.seat, 'ruling');
    }
    ctx.log(g, `人工裁定：${player.seat} 号${action.alive ? '恢复存活' : '出局'}；原因：${action.reason.trim()}`, `${player.seat} 号状态由主持人调整`);
    g.resume = 'discussion';
    ctx.advance(g);
  }

  function finish(g: Game, action: ActionOf<'finish'>) {
    ctx.demand(['good', 'wolf', 'third', 'draw'].includes(action.winner), '胜方无效');
    ctx.demand(action.reason.trim().length >= 2, '请填写结束原因');
    ctx.demand(!g.pending.length || action.discardPending === true, `仍有 ${g.pending.length} 项待办技能或遗言，请先处理或明确放弃`);
    g.pending = [];
    ctx.end(g, action.winner, `主持人裁定：${action.reason.trim()}`);
  }

  return { hunter, shot, link, badge, explode, ruling, finish };
}
