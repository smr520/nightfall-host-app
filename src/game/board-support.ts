import { BOARD_LIBRARY, boardRoles, type Board } from './boards';
import { ROLE_REFERENCE } from './role-reference';
import { ROLES } from './roles';
import type { Role } from './types';

export type BoardSupportLevel = 'verified' | 'guided' | 'experimental';

export type BoardSupport = {
  level: BoardSupportLevel;
  label: string;
  shortLabel: string;
  summary: string;
  reasons: string[];
  manualRoles: Role[];
  partialRoles: Role[];
  unresolvedCount: number;
};

export const BOARD_SUPPORT_LABELS: Record<BoardSupportLevel, { label: string; shortLabel: string; summary: string }> = {
  verified: {
    label: '已验证',
    shortLabel: '验证',
    summary: '基础流程、自动结算和主持路径已通过整局验证，仍需按本桌桌规确认。',
  },
  guided: {
    label: '主持引导',
    shortLabel: '引导',
    summary: '包含部分自动技能或公开规则差异，软件会在开局前给出主持提醒。',
  },
  experimental: {
    label: '实验中',
    shortLabel: '实验',
    summary: '包含多个主要人工处理技能或未锁定规则，建议由熟悉该板的主持人使用。',
  },
};

/** Core lineups covered by the complete seeded workflow and dedicated rule regressions. */
const VERIFIED_BOARD_IDS = new Set([
  'standard-12',
  '12-guard',
  '6-quick',
  '8-standard',
  '9-classic',
  '10-standard',
  '15-standard',
]);

const LEVEL_RANK: Record<BoardSupportLevel, number> = {
  verified: 0,
  guided: 1,
  experimental: 2,
};

function uniqueRoles(roles: readonly Role[]): Role[] {
  return [...new Set(roles)];
}

function roleNames(roles: readonly Role[]): string {
  return roles.map(role => ROLES[role].name).join('、');
}

export function boardSupport(board: Board): BoardSupport {
  const roles = boardRoles(board);
  const manualRoles = uniqueRoles(roles.filter(role => ROLE_REFERENCE[role].automation === 'manual'));
  const partialRoles = uniqueRoles(roles.filter(role => ROLE_REFERENCE[role].automation === 'partial'));
  const unresolvedCount = board.unresolved?.length ?? 0;
  const referenceSource = board.catalog?.verification === 'reference'
    || (!board.catalog && board.tag === 'custom');
  const hostBurden = manualRoles.length * 2 + unresolvedCount + partialRoles.length * 0.5;
  const sourceBoard = board.sourceBoardId
    ? BOARD_LIBRARY.find(candidate => candidate.id === board.sourceBoardId)
    : undefined;
  const supportSourceId = VERIFIED_BOARD_IDS.has(board.id) ? board.id : sourceBoard?.id;
  const verifiedCore = !!supportSourceId
    && VERIFIED_BOARD_IDS.has(supportSourceId)
    && manualRoles.length === 0
    && unresolvedCount === 0;

  let level: BoardSupportLevel;
  if (verifiedCore) level = 'verified';
  else if (hostBurden >= 4 || unresolvedCount >= 3 || manualRoles.length >= 3) level = 'experimental';
  else level = 'guided';

  const labels = BOARD_SUPPORT_LABELS[level];
  const reasons: string[] = [];
  if (manualRoles.length) reasons.push(`主要人工处理：${roleNames(manualRoles)}`);
  if (partialRoles.length) reasons.push(`部分自动技能：${roleNames(partialRoles)}`);
  if (unresolvedCount) reasons.push(`${unresolvedCount} 项规则差异需在开局前确认`);
  if (referenceSource) reasons.push('来源版型仍需按实体牌或本桌规则核对');
  if (level === 'verified') reasons.push('核心阵容与整局主持流程已验证');
  if (!reasons.length) reasons.push('当前阵容未发现额外主持处理项');

  return {
    level,
    label: labels.label,
    shortLabel: labels.shortLabel,
    summary: labels.summary,
    reasons,
    manualRoles,
    partialRoles,
    unresolvedCount,
  };
}

export function compareBoardSupport(left: Board, right: Board): number {
  const levelDifference = LEVEL_RANK[boardSupport(left).level] - LEVEL_RANK[boardSupport(right).level];
  if (levelDifference) return levelDifference;
  return left.playerCount - right.playerCount || left.name.localeCompare(right.name, 'zh-CN');
}
