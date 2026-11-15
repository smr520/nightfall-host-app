import { hostingSupport } from './support-policy';
import { ROLE_CATALOG } from './role-catalog';
import { ROLE_REFERENCE } from './role-reference';
import { ROLES } from './roles';
import type { Role } from './types';

export type HostTaskLevel = 'automatic' | 'partial' | 'manual';

export type HostTask = {
  role: Role;
  name: string;
  level: HostTaskLevel;
  levelLabel: string;
  cardType: string;
  timing: string;
  note: string;
};

const LEVEL_LABELS: Record<HostTaskLevel, string> = {
  automatic: '自动处理 · 操作提醒',
  partial: '部分自动 · 需核对',
  manual: '主持人处理',
};

/**
 * Concrete in-game work that cannot safely disappear into role reference text.
 * The note comes from the same support policy that raises safer flow defaults.
 */
export function hostTasks(roles: readonly Role[]): HostTask[] {
  return hostingSupport(roles).checks.map(check => {
    const reference = ROLE_REFERENCE[check.role];
    const level: HostTaskLevel = reference.automation;
    return {
      role: check.role,
      name: ROLES[check.role].name,
      level,
      levelLabel: LEVEL_LABELS[level],
      cardType: ROLE_CATALOG[check.role].type === 'status' ? '附加状态' : '身份牌',
      timing: reference.timing,
      note: check.note,
    };
  });
}

export function hostTaskLogText(task: HostTask, detail: string): string {
  return `主持清单：${task.name}（${task.levelLabel}）· ${detail.trim()}`;
}

export function completedHostTaskLogs(
  events: readonly { day: number; text: string }[],
  day: number,
): string[] {
  return events
    .filter(event => event.day === day && event.text.startsWith('主持清单：'))
    .map(event => event.text);
}
