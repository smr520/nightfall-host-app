import { nightCallsFor } from './boards';
import { validateLastWordsPolicy } from './last-words';
import { ROLES, isRole } from './roles';
import type { Counts, HostingFlow, NightCall } from './types';

const FIXED_FLOW_STAGES = ['dawn', 'dawn-announcement', 'last-words', 'sheriff-signup', 'sheriff-vote', 'discussion', 'exile-vote', 'hunter', 'badge', 'shot', 'link', 'heir', 'ended'];
const validCall = (value: unknown): value is NightCall => value === 'wolves' || isRole(value) && !!ROLES[value].night;
const validScriptStage = (value: string) => FIXED_FLOW_STAGES.includes(value) || validCall(value);
export const DAWN_CAUSES = ['knife', 'poison', 'shot', 'ruling', 'link', 'dance', 'check', 'dream', 'demon-hunt'] as const;

const sameSet = (left: NightCall[], right: NightCall[]) => left.length === right.length && new Set(left).size === left.length && left.every(item => right.includes(item));

export function resolveNightOrder(counts: Counts, flow?: HostingFlow): NightCall[] {
  const defaultOrder = nightCallsFor(counts);
  const requested = flow?.nightOrder;
  if (requested === undefined) return defaultOrder;
  if (!sameSet(requested, defaultOrder)) throw new Error('自定义夜间顺序必须包含当前阵容的全部行动，且每项只能出现一次');
  if (requested.includes('wolves') && requested.includes('witch') && requested.indexOf('witch') < requested.indexOf('wolves')) throw new Error('女巫用药需要先知道刀口，请把狼人行动放在女巫之前');
  return [...requested];
}

export function reconcileNightOrder(counts: Counts, current?: NightCall[]): NightCall[] {
  const defaultOrder = nightCallsFor(counts);
  if (!current?.length) return defaultOrder;
  const retained = current.filter((call, index) => defaultOrder.includes(call) && current.indexOf(call) === index);
  const result = [...retained, ...defaultOrder.filter(call => !retained.includes(call))];
  if (result.includes('wolves') && result.includes('witch') && result.indexOf('witch') < result.indexOf('wolves')) {
    result.splice(result.indexOf('wolves'), 1); result.splice(result.indexOf('witch'), 0, 'wolves');
  }
  return result;
}

export function validateFlow(value: unknown, counts?: Counts): value is HostingFlow {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const flow = value as Record<string, unknown>;
  if (flow.manualDawn !== undefined && typeof flow.manualDawn !== 'boolean') return false;
  if (flow.keepDeadCalls !== undefined && typeof flow.keepDeadCalls !== 'boolean') return false;
  if (flow.manualVictory !== undefined && typeof flow.manualVictory !== 'boolean') return false;
  if (!validateLastWordsPolicy(flow.lastWords)) return false;
  if (flow.nightOrder !== undefined) {
    if (!Array.isArray(flow.nightOrder) || flow.nightOrder.some(call => !validCall(call)) || new Set(flow.nightOrder).size !== flow.nightOrder.length) return false;
    if (counts) {
      try { resolveNightOrder(counts, { nightOrder: flow.nightOrder as NightCall[] }); } catch { return false; }
    }
  }
  if (flow.scripts !== undefined) {
    if (!flow.scripts || typeof flow.scripts !== 'object' || Array.isArray(flow.scripts)) return false;
    if (Object.entries(flow.scripts as Record<string, unknown>).some(([stage, script]) => !validScriptStage(stage) || typeof script !== 'string' || script.length > 1200)) return false;
  }
  return true;
}

export function flowForCounts(counts: Counts, flow?: HostingFlow): HostingFlow | undefined {
  if (!flow) return undefined;
  return { ...flow, nightOrder: resolveNightOrder(counts, flow) };
}
