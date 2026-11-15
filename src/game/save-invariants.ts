import type { Game } from './types';

export type GameInvariantIssue = {
  code:
    | 'alive-with-death'
    | 'dead-without-death'
    | 'dead-sheriff-without-badge'
    | 'pending-stage-mismatch'
    | 'pending-seat-alive'
    | 'ineligible-voter'
    | 'ineligible-candidate'
    | 'result-without-ended'
    | 'ended-without-result'
    | 'ended-with-pending'
    | 'invalid-quick-exile';
  message: string;
  seat?: number;
};

/**
 * Semantic checks for persisted state. Structural validation lives in save-schema;
 * these rules reject states that look typed but can never be produced by a safe flow.
 */
export function gameInvariantIssues(game: Game): GameInvariantIssue[] {
  const issues: GameInvariantIssue[] = [];
  const bySeat = new Map(game.players.map(player => [player.seat, player]));
  const hasEndedResult = game.winner !== undefined && game.endedAt !== undefined;
  const hasPartialEndedResult = (game.winner === undefined) !== (game.endedAt === undefined);

  if (hasPartialEndedResult) {
    issues.push({ code: 'result-without-ended', message: '胜负与结束时间必须同时存在或同时缺失' });
  }
  if (game.stage === 'ended' && !hasEndedResult) {
    issues.push({ code: 'ended-without-result', message: '已结束对局必须保存胜负和结束时间' });
  }
  if (game.stage !== 'ended' && hasEndedResult) {
    issues.push({ code: 'result-without-ended', message: '未结束阶段不能提前保存结束结果' });
  }
  if (game.stage === 'ended' && game.pending.length) {
    issues.push({ code: 'ended-with-pending', message: '已结束对局不能保留未处理的技能或遗言' });
  }

  for (const player of game.players) {
    if (player.alive && player.death) {
      issues.push({ code: 'alive-with-death', message: `${player.seat}号仍存活但已有死亡记录`, seat: player.seat });
    }
    if (!player.alive && !player.death) {
      issues.push({ code: 'dead-without-death', message: `${player.seat}号已出局但缺少死亡记录`, seat: player.seat });
    }
  }

  const pendingBadge = game.pending.find(item => item.kind === 'badge');
  if (game.sheriff !== null) {
    const sheriff = bySeat.get(game.sheriff);
    if (!sheriff) {
      issues.push({ code: 'dead-sheriff-without-badge', message: '警长座位不存在', seat: game.sheriff });
    } else if (!sheriff.alive && pendingBadge?.seat !== sheriff.seat) {
      issues.push({
        code: 'dead-sheriff-without-badge',
        message: `${sheriff.seat}号警长已出局但未进入警徽处理`,
        seat: sheriff.seat,
      });
    }
  }

  for (const pending of game.pending) {
    const player = bySeat.get(pending.seat);
    const queueHead = game.pending[0];
    if (queueHead === pending && game.stage !== pending.kind) {
      issues.push({
        code: 'pending-stage-mismatch',
        message: `待办 ${pending.kind} 与当前阶段 ${game.stage} 不一致`,
        seat: pending.seat,
      });
    }
    if (player?.alive) {
      issues.push({
        code: 'pending-seat-alive',
        message: `${pending.seat}号仍有待办技能但当前标记为存活`,
        seat: pending.seat,
      });
    }
  }

  const voteIsStillCollecting = game.vote !== null
    && game.vote.result === undefined
    && (game.stage === 'sheriff-vote' || game.stage === 'exile-vote');
  if (game.vote?.kind === 'exile' && game.rules.table?.exileRecord === 'quick'
    && (game.vote.round !== 1 || game.vote.voters.length || Object.keys(game.vote.ballots).length)) {
    issues.push({ code: 'invalid-quick-exile', message: '快速放逐不能保存轮次、投票人或逐人票' });
  }
  if (game.vote && voteIsStillCollecting) {
    for (const voter of game.vote.voters) {
      const player = bySeat.get(voter);
      if (!player?.alive || player.exposed) {
        issues.push({ code: 'ineligible-voter', message: `${voter}号没有本轮投票权`, seat: voter });
      }
    }
    for (const candidate of game.vote.candidates) {
      if (!bySeat.get(candidate)?.alive) {
        issues.push({ code: 'ineligible-candidate', message: `${candidate}号已出局却仍在候选名单`, seat: candidate });
      }
    }
  }

  return issues;
}

export function hasValidGameInvariants(game: Game): boolean {
  return gameInvariantIssues(game).length === 0;
}
