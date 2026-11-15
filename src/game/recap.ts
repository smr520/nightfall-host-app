import { winnerLabel } from './host-ui';
import { ROLES } from './roles';
import type { Cause, Game } from './types';

const deathCauseLabels: Record<Cause, string> = {
  knife: '狼人击杀', poison: '毒药', exile: '放逐', shot: '开枪', explode: '自爆', ruling: '人工裁定', link: '殉情', dance: '舞池出局', hunt: '猎杀时刻', check: '查验出局', dream: '梦亡', 'demon-hunt': '猎魔',
};

/** Plain text recap for deliberate sharing. It always includes a privacy warning. */
export function formatRecap(game: Game): string {
  const result = game.winner ? winnerLabel(game.winner) : '对局尚未结束';
  const roster = game.players.map(player => `${String(player.seat).padStart(2, '0')}号 ${player.name || '未命名'} · ${ROLES[player.role].name} · ${player.alive ? '存活' : `出局（${deathCauseLabels[player.death?.cause ?? 'ruling']}）`}`).join('\n');
  const events = game.events.length
    ? game.events.map(event => `第${event.day}天 · ${event.text}${event.publicText && event.publicText !== event.text ? `\n  对外播报：${event.publicText}` : ''}`).join('\n')
    : '暂无记录';
  return [
    '夜幕 · 狼人杀复盘',
    `对局：${game.name}`,
    `板子：${game.board} · ${game.players.length}人`,
    `结果：${result}${game.endReason ? `（${game.endReason}）` : ''}`,
    '',
    '身份与座位',
    roster,
    '',
    '时间线',
    events,
    '',
    '隐私提示：本复盘包含完整身份、出局原因和主持记录，请确认所有玩家已结束游戏后再分享。',
  ].join('\n');
}
