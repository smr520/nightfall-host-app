import type { Game, Vote } from './types';
import { canVote, log, player } from './shared';
import { advance, kill, resolveDelayedDeaths } from './dawn';

export function makeVote(g: Game, kind: Vote['kind'], candidates: number[], round = 1): Vote {
  const voters = g.players.filter(p => canVote(p) && (kind !== 'sheriff' && round === 1 || !candidates.includes(p.seat))).map(p => p.seat);
  return { kind, round, candidates, voters, ballots: {} };
}

export function tally(g: Game): { seat: number; votes: number }[] {
  if (!g.vote) return [];
  const vote = g.vote;
  return vote.candidates.map(seat => ({
    seat,
    votes: Object.entries(vote.ballots).reduce((sum, [voter, choice]) => {
      if (choice !== seat) return sum;
      const sheriffDouble = vote.kind === 'exile' && Number(voter) === g.sheriff;
      return sum + (sheriffDouble ? g.rules.sheriffWeight : 1);
    }, 0),
  }));
}

export function exile(g: Game, seat: number) {
  const p = player(g, seat);
  if (p.role === 'idiot' && !p.exposed) {
    p.exposed = true;
    if (g.sheriff === seat) { g.sheriff = null; g.pending.push({ kind: 'badge', seat }); }
    log(g, `${seat} 号白痴翻牌免死，失去投票权`, `${seat} 号白痴翻牌免死，失去投票权`);
  } else { kill(g, seat, 'exile'); log(g, `${seat} 号被放逐`, `${seat} 号被放逐`); }
  resolveDelayedDeaths(g);
  g.resume = 'night'; advance(g);
}

export function afterSheriff(g: Game) {
  if (g.announcementReady) { g.stage = 'dawn-announcement'; return; }
  g.resume = 'discussion';
  advance(g);
}
