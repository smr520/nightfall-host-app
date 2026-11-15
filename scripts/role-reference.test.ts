import { ROLE_IDS } from '../src/game/roles';
import { REFERENCE_SOURCES, ROLE_REFERENCE } from '../src/game/role-reference';

describe('role reference coverage and implementation boundaries', () => {
  it('provides a complete, sourced guide for every selectable role', () => {
    expect(Object.keys(ROLE_REFERENCE).sort()).toEqual([...ROLE_IDS].sort());
    const sources = new Set(REFERENCE_SOURCES.map(source => source.id));
    expect(sources.size).toBe(REFERENCE_SOURCES.length);
    for (const role of ROLE_IDS) {
      const guide = ROLE_REFERENCE[role];
      expect(guide.timing.trim()).not.toBe('');
      expect(guide.overview.trim()).not.toBe('');
      expect(guide.skills.length).toBeGreaterThan(0);
      expect(guide.cautions.length).toBeGreaterThan(0);
      expect(guide.hostNotes.length).toBeGreaterThan(0);
      expect(guide.automationNote.trim()).not.toBe('');
      expect(guide.sourceIds.length).toBeGreaterThan(0);
      expect(guide.sourceIds.every(id => sources.has(id))).toBe(true);
    }
  });

  it('distinguishes reference rules from unimplemented special-role effects', () => {
    expect(ROLE_REFERENCE.guard.automation).toBe('automatic');
    expect(ROLE_REFERENCE.knight.automation).toBe('manual');
    expect(ROLE_REFERENCE.nightmare.automation).toBe('automatic');
    expect(ROLE_REFERENCE['light-earl'].automationNote).toContain('挡狼刀');
    expect(ROLE_REFERENCE['light-earl'].cautions.join('')).toContain('首夜不行动');
    expect(ROLE_REFERENCE['lone-girl'].camp).toBe('third');
    expect(ROLE_REFERENCE['lone-girl'].automationNote).toContain('固定当好人');
    expect(ROLE_REFERENCE['lucky-one'].overview).toContain('附加能力状态');
    expect(ROLE_REFERENCE['evil-knight'].needsTableAgreement).toBe(true);
    expect(ROLE_REFERENCE['evil-knight'].overview).toContain('版本待确认');
  });
});
