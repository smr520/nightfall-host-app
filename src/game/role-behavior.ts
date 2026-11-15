import type { Cause, Game, NightCall, Rules } from './types';
import type { Role } from './roles';
import { ROLES, isWolf } from './roles';

export type DeathSkill = 'hunter' | 'shot' | 'link';
const NO_SELF_EXPLOSION = new Set<Role>(['gargoyle', 'awakened-hidden-wolf', 'evil-knight', 'fragrance-shadow']);

/** Resolve the registered death skill against the actual cause of death. */
export function roleDeathSkill(role: Role, cause: Cause, rules: Rules): DeathSkill | null {
  // A wolf-beauty link disables the linked player's skills, including death skills.
  if (cause === 'link') return null;

  if (role === 'hunter') {
    if (cause === 'ruling' || cause === 'knife' || cause === 'exile') return 'hunter';
    return cause === 'poison' && rules.hunterPoison ? 'hunter' : null;
  }

  if (role === 'white-wolf-king') return cause === 'explode' ? 'shot' : null;
  if (role === 'wolf-beauty') return ['exile', 'shot', 'ruling'].includes(cause) ? 'link' : null;

  const trigger = ROLES[role].onDeath;
  if (trigger === 'shot' && cause !== 'poison') return 'shot';
  if (trigger === 'link' && cause !== 'poison') return 'link';
  return null;
}

export function canSelfExplode(role: Role): boolean {
  return isWolf(role) && ROLES[role].canSelfExplode !== false && !NO_SELF_EXPLOSION.has(role);
}

/** Shared by the host controls and action validation so a visible skip is always legal. */
export function canSkipNightAction(call: NightCall): boolean {
  if (call === 'nine-tails' || call === 'dancer') return false;
  return call === 'wolves' || ROLES[call].night?.canSkip !== false;
}

/** 界面与引擎共用同一判断，避免“按钮可选但结算拒绝”。 */
export function canExplode(g: Game, seat: number): boolean {
  const p = g.players.find(player => player.seat === seat);
  return !!p && p.alive && canSelfExplode(p.role);
}
