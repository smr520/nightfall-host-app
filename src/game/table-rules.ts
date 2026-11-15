import type { Rules, TableRules } from './types';

export type ResolvedTableRules = {
  lineupMode: 'standard' | 'free';
  firstNightKnife: boolean;
  guardRepeat: boolean;
  sheriffTie: 'pk' | 'none';
  exileTie: 'pk' | 'none';
  exileRecord: 'detailed' | 'quick';
  notes: string;
};

const MAX_NOTES_LENGTH = 1200;

/** Resolve a partial table configuration without changing legacy defaults. */
export function tableRules(rules: Pick<Rules, 'table'> | TableRules | undefined): ResolvedTableRules {
  const value = 'table' in (rules ?? {}) ? (rules as Pick<Rules, 'table'>).table : rules as TableRules | undefined;
  return {
    lineupMode: value?.lineupMode === 'free' ? 'free' : 'standard',
    firstNightKnife: value?.firstNightKnife !== false,
    guardRepeat: value?.guardRepeat === true,
    sheriffTie: value?.sheriffTie === 'none' ? 'none' : 'pk',
    exileTie: value?.exileTie === 'none' ? 'none' : 'pk',
    exileRecord: value?.exileRecord === 'quick' ? 'quick' : 'detailed',
    notes: typeof value?.notes === 'string' ? value.notes : '',
  };
}

/** Validate the optional persisted table configuration. */
export function validateTableRules(value: unknown): value is TableRules | undefined {
  if (value === undefined) return true;
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const table = value as Record<string, unknown>;
  if (table.lineupMode !== undefined && table.lineupMode !== 'standard' && table.lineupMode !== 'free') return false;
  if (table.firstNightKnife !== undefined && typeof table.firstNightKnife !== 'boolean') return false;
  if (table.guardRepeat !== undefined && typeof table.guardRepeat !== 'boolean') return false;
  if (table.sheriffTie !== undefined && table.sheriffTie !== 'pk' && table.sheriffTie !== 'none') return false;
  if (table.exileTie !== undefined && table.exileTie !== 'pk' && table.exileTie !== 'none') return false;
  if (table.exileRecord !== undefined && table.exileRecord !== 'detailed' && table.exileRecord !== 'quick') return false;
  if (table.notes !== undefined && (typeof table.notes !== 'string' || table.notes.length > MAX_NOTES_LENGTH)) return false;
  return true;
}

export { MAX_NOTES_LENGTH };
