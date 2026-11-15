import { ROLES } from './roles';
import { canSkipNightAction } from './role-behavior';
import type { NightCall, Stage } from './types';

export type GameWinner = 'good' | 'wolf' | 'third' | 'draw';

export function isNightStage(stage: Stage): boolean {
  if (stage === 'wolves') return true;
  return Object.prototype.hasOwnProperty.call(ROLES, stage) && !!ROLES[stage as keyof typeof ROLES].night;
}

export function getStageActionLabel({
  stage,
  targetRequired,
  selectedTarget,
  selectedVoter,
  voteRecorded,
}: {
  stage: Stage;
  targetRequired: boolean;
  selectedTarget: number | null;
  selectedVoter: number | null;
  voteRecorded: boolean;
}): string {
  if (stage === 'guard') return !targetRequired ? '守卫已出局，跳过并继续' : selectedTarget === null ? canSkipNightAction(stage) ? '选择守护目标，或空守' : '选择守护目标' : `确认守护 ${selectedTarget} 号`;
  if (stage === 'wolves') return !targetRequired ? '无存活狼人，跳过并继续' : selectedTarget === null ? canSkipNightAction(stage) ? '选择刀口，或空刀' : '选择刀口' : `确认刀口：${selectedTarget} 号`;
  if (stage === 'seer') return !targetRequired ? '预言家已出局，跳过并继续' : selectedTarget === null ? canSkipNightAction(stage) ? '选择查验目标，或空过' : '选择查验目标' : `确认查验 ${selectedTarget} 号`;
  if (stage === 'witch') return !targetRequired ? '女巫已出局，跳过并继续' : '确认女巫用药';
  if (isNightStage(stage)) {
    const role = stage as keyof typeof ROLES;
    const meta = ROLES[role];
    const label = meta.night?.targetLabel ?? '选择目标';
    if (!targetRequired) return `${meta.name}已出局，跳过并继续`;
    if (selectedTarget !== null) return `确认${meta.name}目标：${selectedTarget} 号`;
    return canSkipNightAction(stage as NightCall) ? `${label}，或空过` : label;
  }
  if (stage === 'dawn') return '确认夜间结算';
  if (stage === 'dawn-announcement') return '确认并公布昨夜结果';
  if (stage === 'identity-check') return '确认当前玩家身份';
  if (stage === 'last-words') return '确认遗言结束';
  if (stage === 'heir') return '确认白泽继承人';
  if (stage === 'sheriff-signup') return '确认上警名单';
  if (stage === 'sheriff-vote' || stage === 'exile-vote') {
    if (voteRecorded) return '完成计票';
    if (selectedVoter === null) return '选择待录投票人';
    if (selectedTarget === null) return `选择 ${selectedVoter} 号投给谁`;
    return `记录 ${selectedVoter} 号投给 ${selectedTarget} 号`;
  }
  if (stage === 'discussion') return '开始放逐投票';
  return '';
}

export function isCurrentGameActive(stage: Stage): boolean {
  return stage !== 'ended';
}

export function requiresAbandonConfirmation(hasSession: boolean, stage?: Stage): boolean {
  return hasSession && stage !== undefined && stage !== 'ended';
}

export function isSheriffWeightSelected(weight: number, option: number): boolean {
  return weight === option;
}

export function canHandOffBadge(player: { seat: number; alive: boolean; exposed: boolean }, sheriffSeat: number): boolean {
  return player.alive && !player.exposed && player.seat !== sheriffSeat;
}

export function canNightStageProceed(stage: Stage, actorAlive: boolean): boolean {
  return isNightStage(stage) ? actorAlive : true;
}

export function isRulingReasonValid(reason: string): boolean {
  return reason.trim().length >= 2;
}

export function shouldHighlightCatalogBoard(selectedCatalogId: string, itemId: string): boolean {
  return selectedCatalogId === itemId;
}

export function winnerLabel(winner: GameWinner): string {
  if (winner === 'wolf') return '狼人阵营胜利';
  if (winner === 'good') return '好人阵营胜利';
  if (winner === 'third') return '第三方胜利';
  return '平局';
}
