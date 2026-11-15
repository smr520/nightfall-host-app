import { ROLE_REFERENCE } from '../game/role-reference';
import { ROLES, ROLE_IDS, type Camp, type Role } from '../game/roles';

export const CAMP_ORDER: Camp[] = ['wolf', 'good', 'third'];
export const CAMP_LABELS: Record<Camp, string> = { wolf: '狼人阵营', good: '好人阵营', third: '第三方' };
export const PLAYER_ROLE_IDS = ROLE_IDS.filter(role => role !== 'lucky-one');

export function campOfRole(role: Role): Camp {
  return ROLE_REFERENCE[role].camp ?? ROLES[role].camp;
}

export function filterPlayerRoles(query: string, roles: readonly Role[] = PLAYER_ROLE_IDS): Role[] {
  const needle = query.trim().toLocaleLowerCase();
  if (!needle) return [...roles];
  return roles.filter(role => {
    const reference = ROLE_REFERENCE[role];
    return [ROLES[role].name, ROLES[role].short, ROLES[role].tagline, reference.overview, ...reference.skills]
      .join(' ')
      .toLocaleLowerCase()
      .includes(needle);
  });
}
