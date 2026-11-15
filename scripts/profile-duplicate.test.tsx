import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';
import { DEFAULT_RULES } from '../src/game/config';
import type { HostingProfile } from '../src/game/preferences';
import { useHostingPreferences } from '../src/hooks/useHostingPreferences';
import { readPreferences, persistPreferences } from '../src/storage';
import { PersonalizationScreen } from '../src/ui/PersonalizationScreen';

jest.mock('../src/storage', () => ({ readPreferences: jest.fn(), persistPreferences: jest.fn().mockResolvedValue(undefined) }));

const fixture = (id = 'original', name = '周五固定桌'): HostingProfile => ({ id, name, boardName: '六人', roles: ['wolf', 'wolf', 'villager', 'villager', 'seer', 'witch'], rules: { ...DEFAULT_RULES, table: { notes: '现场补充约定' }, flow: { manualDawn: true, manualVictory: true, scripts: { discussion: '请依次发言。' } } } });

async function mountHook(profiles = [fixture()]) {
  (readPreferences as jest.Mock).mockResolvedValue({ hostingMode: 'custom', selectedProfileId: profiles[0].id, profiles });
  let api!: ReturnType<typeof useHostingPreferences>;
  function Harness() { api = useHostingPreferences(); return null; }
  let renderer!: TestRenderer.ReactTestRenderer;
  act(() => { renderer = TestRenderer.create(<Harness />); });
  await act(async () => { await api.loadPreferences(); });
  return { api: () => api, unmount: () => act(() => renderer.unmount()) };
}

describe('copying reusable host profiles', () => {
  beforeEach(() => { jest.clearAllMocks(); (persistPreferences as jest.Mock).mockResolvedValue(undefined); });

  it('copies the full plan into independent data and selects the saved copy', async () => {
    const app = await mountHook();
    const original = app.api().selectedProfile!;
    await act(async () => { await app.api().duplicateProfile(original.id); });
    const copy = app.api().selectedProfile!;
    expect(copy.id).not.toBe(original.id);
    expect(copy.name).toBe('周五固定桌 副本');
    expect(copy.roles).toEqual(original.roles);
    expect(copy.roles).not.toBe(original.roles);
    expect(copy.rules).toEqual(original.rules);
    expect(copy.rules.flow?.scripts).not.toBe(original.rules.flow?.scripts);
    expect(copy.rules.table).not.toBe(original.rules.table);
    expect(app.api().preferences.profiles[0]).toBe(original);
    expect(persistPreferences).toHaveBeenCalledWith(expect.objectContaining({ profiles: [original, copy], selectedProfileId: copy.id }));
    app.unmount();
  });

  it('creates distinct short names and ids when repeatedly copying a long-named plan', async () => {
    const app = await mountHook([fixture('long', '长'.repeat(24))]);
    await act(async () => { await app.api().duplicateProfile('long'); });
    await act(async () => { await app.api().duplicateProfile('long'); });
    const profiles = app.api().preferences.profiles;
    expect(new Set(profiles.map(profile => profile.id)).size).toBe(3);
    expect(new Set(profiles.map(profile => profile.name)).size).toBe(3);
    expect(profiles.every(profile => profile.name.length <= 24)).toBe(true);
    expect(profiles[2].name).toContain('副本2');
    app.unmount();
  });

  it('keeps the original and current selection when the copied plan cannot be saved', async () => {
    const app = await mountHook();
    (persistPreferences as jest.Mock).mockRejectedValueOnce(new Error('disk full'));
    await act(async () => { await expect(app.api().duplicateProfile('original')).rejects.toThrow('disk full'); });
    expect(app.api().preferences.profiles).toHaveLength(1);
    expect(app.api().selectedProfile?.id).toBe('original');
    expect(app.api().preferenceError).toContain('原方案仍保留');
    app.unmount();
  });

  it('enforces the existing twenty-plan limit without replacing another plan', async () => {
    const app = await mountHook(Array.from({ length: 20 }, (_, index) => fixture(`table-${index}`)));
    await act(async () => { await expect(app.api().duplicateProfile('table-0')).rejects.toThrow('最多保存 20 个方案'); });
    expect(persistPreferences).not.toHaveBeenCalled();
    expect(app.api().preferences.profiles).toHaveLength(20);
    app.unmount();
  });

  it('offers a copy button and disables it when saving or at the profile limit', () => {
    const onDuplicate = jest.fn();
    const props = { hostingMode: 'custom' as const, onHostingModeChange: jest.fn(), onCreate: jest.fn(), onEdit: jest.fn(), onSelect: jest.fn(), onDelete: jest.fn(), onDuplicate };
    let renderer!: TestRenderer.ReactTestRenderer;
    act(() => { renderer = TestRenderer.create(<PersonalizationScreen {...props} profiles={[fixture()]} />); });
    const button = () => renderer.root.findAll(node => node.props.accessibilityLabel === '复制方案：周五固定桌' && typeof node.props.onPress === 'function')[0];
    act(() => button().props.onPress());
    expect(onDuplicate).toHaveBeenCalledWith(fixture());
    act(() => renderer.update(<PersonalizationScreen {...props} profiles={[fixture()]} disabled />));
    expect(button().props.disabled).toBe(true);
    act(() => renderer.update(<PersonalizationScreen {...props} profiles={Array.from({ length: 20 }, (_, index) => fixture(`table-${index}`))} />));
    expect(button().props.disabled).toBe(true);
    act(() => renderer.unmount());
  });
});
