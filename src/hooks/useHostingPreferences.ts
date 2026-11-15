import { useCallback, useEffect, useRef, useState } from 'react';
import { persistPreferences, readPreferences } from '../storage';
import { MAX_HOSTING_PROFILES, normalizePreferences, type HostPreferences, type HostingMode, type HostingProfile, type HostTextSize } from '../game/preferences';
import type { SetupMemory } from '../game/setup-memory';
import { createHostPinCredential, verifyHostPinCredential } from '../host-lock';

type ProfileDraft = Omit<HostingProfile, 'id'>;

/** Own preference persistence independently of game/session recovery and navigation. */
export function useHostingPreferences() {
  const [preferences, setPreferences] = useState<HostPreferences>(() => normalizePreferences({}));
  const [preferencesReadable, setPreferencesReadable] = useState(false);
  const [preferenceError, setPreferenceError] = useState('');
  const [preferenceWarning, setPreferenceWarning] = useState('');
  const [preferenceSaving, setPreferenceSaving] = useState(false);
  const [editingProfile, setEditingProfile] = useState<HostingProfile>();
  const preferenceWritePending = useRef(false);
  const preferencesRef = useRef(preferences);
  const readable = useRef(false);
  const mounted = useRef(true);
  const pendingRead = useRef<Promise<boolean> | null>(null);

  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);

  // Share an in-flight startup read (including Strict Mode effect replay), and
  // use the same guard as writes so a retry cannot replace an uncommitted edit.
  const loadPreferences = useCallback((retry = false): Promise<boolean> => {
    if (pendingRead.current) return pendingRead.current;
    if (preferenceWritePending.current) return Promise.resolve(false);
    preferenceWritePending.current = true;
    readable.current = false;
    setPreferencesReadable(false);
    if (retry) setPreferenceSaving(true);
    const request = readPreferences().then(value => {
      if (!mounted.current) return false;
      const next = normalizePreferences(value);
      preferencesRef.current = next;
      readable.current = true;
      setPreferences(next);
      setPreferencesReadable(true);
      setPreferenceError('');
      setPreferenceWarning('');
      return true;
    }).catch(() => {
      if (mounted.current) {
        setPreferenceError(retry
          ? '个性化设置仍无法读取，请检查存储空间后重试。已有方案未被覆盖。'
          : '个性化设置读取失败。请重试读取，恢复前不会覆盖已有方案。');
        setPreferenceWarning('个性化设置读取失败，可到“个性化设置”重试；本次可使用标准流程。');
      }
      return false;
    }).finally(() => {
      pendingRead.current = null;
      preferenceWritePending.current = false;
      if (mounted.current) setPreferenceSaving(false);
    });
    pendingRead.current = request;
    return request;
  }, []);

  const writePreferences = async (update: (current: HostPreferences) => HostPreferences) => {
    if (!readable.current || preferenceWritePending.current) throw new Error('个性化设置暂不可写入');
    const next = update(preferencesRef.current);
    preferenceWritePending.current = true;
    setPreferenceSaving(true);
    setPreferenceError('');
    try {
      await persistPreferences(next);
      if (mounted.current) {
        preferencesRef.current = next;
        setPreferences(next);
      }
    } catch (error) {
      if (mounted.current) setPreferenceError('个性化设置保存失败，请检查存储空间后重试。原方案仍保留。');
      throw error;
    } finally {
      preferenceWritePending.current = false;
      if (mounted.current) setPreferenceSaving(false);
    }
  };

  const changeHostingMode = (mode: HostingMode): boolean => {
    const current = preferencesRef.current;
    if (mode === 'custom' && !current.profiles.some(profile => profile.id === current.selectedProfileId)) return false;
    void writePreferences(value => ({ ...value, hostingMode: mode })).catch(() => undefined);
    return true;
  };
  const saveProfile = async (draft: ProfileDraft) => {
    await writePreferences(current => {
      if (!editingProfile && current.profiles.length >= MAX_HOSTING_PROFILES) throw new Error(`最多保存 ${MAX_HOSTING_PROFILES} 个方案`);
      const profile = { ...draft, id: editingProfile?.id ?? `profile-${Date.now()}-${Math.random().toString(36).slice(2, 8)}` };
      const profiles = editingProfile
        ? current.profiles.map(item => item.id === profile.id ? profile : item)
        : [...current.profiles, profile];
      return { ...current, hostingMode: 'custom', profiles, selectedProfileId: profile.id };
    });
    if (mounted.current) setEditingProfile(undefined);
  };
  const duplicateProfile = async (id: string) => {
    await writePreferences(current => {
      if (current.profiles.length >= MAX_HOSTING_PROFILES) throw new Error(`最多保存 ${MAX_HOSTING_PROFILES} 个方案`);
      const source = current.profiles.find(profile => profile.id === id);
      if (!source) throw new Error('原方案已不存在，请重新选择');
      let copyNumber = 1;
      let name: string;
      do {
        const suffix = copyNumber === 1 ? ' 副本' : ` 副本${copyNumber}`;
        name = `${source.name.slice(0, 24 - suffix.length).trimEnd()}${suffix}`;
        copyNumber++;
      } while (current.profiles.some(profile => profile.name === name));
      const baseId = `profile-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      let newId = baseId;
      let serial = 1;
      while (current.profiles.some(profile => profile.id === newId)) newId = `${baseId}-${serial++}`;
      const profile: HostingProfile = { ...JSON.parse(JSON.stringify(source)), id: newId, name };
      return { ...current, hostingMode: 'custom', profiles: [...current.profiles, profile], selectedProfileId: newId };
    });
  };
  const deleteProfile = (id: string) => {
    void writePreferences(current => {
      const profiles = current.profiles.filter(profile => profile.id !== id);
      const selectedProfileId = current.selectedProfileId === id ? profiles[0]?.id : current.selectedProfileId;
      return { ...current, profiles, selectedProfileId, hostingMode: current.hostingMode === 'custom' && !selectedProfileId ? 'standard' : current.hostingMode };
    }).catch(() => undefined);
  };
  const selectProfile = (id: string) => {
    void writePreferences(current => ({ ...current, hostingMode: 'custom', selectedProfileId: id })).catch(() => undefined);
  };
  /** Remember the setup that actually started a game; failure must never block the game itself. */
  const rememberSetup = (setup: SetupMemory) => {
    void writePreferences(current => ({ ...current, lastSetup: setup })).catch(() => undefined);
  };
  const changeTextSize = (textSize: HostTextSize) => {
    void writePreferences(current => ({ ...current, textSize })).catch(() => undefined);
  };
  const setHostPin = async (pin: string) => {
    const credential = await createHostPinCredential(pin);
    await writePreferences(current => ({ ...current, hostPin: credential }));
  };
  const clearHostPin = async () => {
    await writePreferences(current => {
      const { hostPin: _hostPin, ...rest } = current;
      return rest;
    });
  };
  const verifyHostPin = async (pin: string) => {
    const credential = preferencesRef.current.hostPin;
    return credential ? verifyHostPinCredential(credential, pin) : true;
  };

  return {
    preferences, preferencesReadable, preferenceError, preferenceWarning, preferenceSaving,
    editingProfile, setEditingProfile, preferenceWritePending, loadPreferences,
    hostingMode: preferences.hostingMode,
    selectedProfile: preferences.profiles.find(profile => profile.id === preferences.selectedProfileId),
    lastSetup: preferences.lastSetup,
    textSize: preferences.textSize ?? 'standard',
    hostPin: preferences.hostPin,
    changeHostingMode, changeTextSize, setHostPin, clearHostPin, verifyHostPin,
    saveProfile, duplicateProfile, deleteProfile, selectProfile, rememberSetup,
  };
}
