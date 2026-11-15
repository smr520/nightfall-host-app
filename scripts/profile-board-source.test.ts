import { BOARD_LIBRARY, boardSeats, type BoardCatalog } from '../src/game/boards';
import { DEFAULT_RULES } from '../src/game/config';
import { isHostingProfile, normalizePreferences, profileBoard, type HostingProfile } from '../src/game/preferences';

describe('saved profile board references', () => {
  const source = BOARD_LIBRARY[0];
  const catalog: BoardCatalog = { origins: ['netease', 'jingcheng'], edition: '测试来源版本', verification: 'reference', sources: [{ title: '阵容依据', url: 'https://example.com/lineup', scope: 'lineup' }] };
  const originalCatalog = source.catalog;
  const profile = (patch: Partial<HostingProfile> = {}): HostingProfile => ({
    id: 'source-plan', name: '保留来源方案', boardName: source.name, sourceBoardId: source.id,
    roles: boardSeats(source), rules: DEFAULT_RULES, ...patch,
  });

  beforeAll(() => { source.catalog = catalog; });
  afterAll(() => { source.catalog = originalCatalog; });

  it('normalizes the optional ID and accepts old plans without it', () => {
    expect(normalizePreferences({ profiles: [profile({ sourceBoardId: ` ${source.id} ` })] }).profiles[0].sourceBoardId).toBe(source.id);
    const legacy = profile(); delete legacy.sourceBoardId;
    expect(isHostingProfile(legacy)).toBe(true);
    expect(profileBoard(legacy).catalog).toBeUndefined();
    expect(profileBoard(legacy).sourceBoardId).toBeUndefined();
    expect(isHostingProfile(profile({ sourceBoardId: '' }))).toBe(false);
    expect(isHostingProfile(profile({ sourceBoardId: 'x'.repeat(101) }))).toBe(false);
  });

  it('inherits exact-source metadata after seat swaps but remains a custom plan', () => {
    const reversed = profile({ roles: [...boardSeats(source)].reverse(), boardName: '同阵容的自定义名字' });
    expect(profileBoard(reversed)).toMatchObject({ tag: 'custom', name: reversed.boardName, sourceBoardId: source.id, catalog });
  });

  it('does not infer a source from the same name or attach metadata to changed counts', () => {
    const edited = profile(); edited.roles[0] = 'villager';
    expect(profileBoard(edited).catalog).toBeUndefined();
    expect(profileBoard(edited).sourceBoardId).toBeUndefined();
    const legacy = profile(); delete legacy.sourceBoardId;
    expect(profileBoard(legacy).catalog).toBeUndefined();
  });

  it('keeps unknown references in storage for compatibility without inventing catalog details', () => {
    const future = profile({ sourceBoardId: 'future-source-board' });
    expect(normalizePreferences({ profiles: [future] }).profiles[0].sourceBoardId).toBe('future-source-board');
    expect(profileBoard(future).catalog).toBeUndefined();
    expect(profileBoard(future).sourceBoardId).toBeUndefined();
  });
});
