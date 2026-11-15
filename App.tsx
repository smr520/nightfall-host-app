import { StatusBar } from 'expo-status-bar';
import { useKeepAwake } from 'expo-keep-awake';
import { usePreventScreenCapture } from 'expo-screen-capture';
import React, { useEffect, useRef, useState } from 'react';
import { Alert, BackHandler, KeyboardAvoidingView, Platform, Pressable, ScrollView, Share, StyleSheet, Text, View } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { clearDamagedSession, clearSession, exportBackup, exportRawData, getWarnings, persistAppRole, persistSession, readAppRole, readHistory, restoreBackup, retryPersistSession, readSession, type AppRole } from './src/storage';
import { applyAction } from './src/game/engine';
import { requiresAbandonConfirmation } from './src/game/host-ui';
import { archiveTransition, addHistoryGame, redoSession, removeHistoryGame, undoSession } from './src/game/session';
import type { Action, Game, Role, Rules, Session } from './src/game/types';
import { colors, spacing, type } from './src/theme';
import { GameScreen } from './src/ui/GameScreen';
import { HistoryScreen } from './src/ui/HistoryScreen';
import { HomeScreen } from './src/ui/HomeScreen';
import { SetupScreen } from './src/ui/SetupScreen';
import { PersonalizationScreen } from './src/ui/PersonalizationScreen';
import { PlayerScreen } from './src/ui/player/PlayerScreen';
import { playerNotebookStorage } from './src/player/device-storage';
import { SkillTableScreen } from './src/ui/SkillTableScreen';
import { ReferenceModal } from './src/ui/ReferenceModal';
import { DataBackupScreen } from './src/ui/DataBackupScreen';
import { RoleGate } from './src/ui/RoleGate';
import { Button, PageTransition, TabBar } from './src/ui/kit';
import { Icon } from './src/ui/Icon';
import { MotionProvider } from './src/ui/motion';
import { rulesForHostingMode } from './src/game/preferences';
import { gameFromSetup, refreshSetupMemory, setupMemoryFromGame, type SetupMemory } from './src/game/setup-memory';
import { useHostingPreferences } from './src/hooks/useHostingPreferences';

type MainTab = 'home' | 'skills' | 'personalization';
type Screen = MainTab | 'setup' | 'game' | 'history' | 'backup' | 'profile-editor';
const MAIN_TABS: { key: MainTab; label: string }[] = [
  { key: 'home', label: '主持' },
  { key: 'skills', label: '技能表' },
  { key: 'personalization', label: '个性化' },
];

function AppContent() {
  const [screen, setScreen] = useState<Screen>('home');
  const [navigation, setNavigation] = useState({ screen, direction: 1 });
  if (navigation.screen !== screen) {
    const order: Screen[] = ['home', 'skills', 'personalization', 'setup', 'profile-editor', 'game', 'history', 'backup'];
    setNavigation({ screen, direction: order.indexOf(screen) >= order.indexOf(navigation.screen) ? 1 : -1 });
  }
  const [session, setSession] = useState<Session | null>(null);
  const sessionRef = useRef<Session | null>(null);
  const savingRef = useRef(false);
  const removingSession = useRef(false);
  const [history, setHistory] = useState<Game[]>([]);
  const [loading, setLoading] = useState(true);
  const [appRole, setAppRole] = useState<AppRole | null>(null);
  const [appRoleError, setAppRoleError] = useState('');
  const [actionError, setActionError] = useState('');
  const [loadError, setLoadError] = useState('');
  const [saveError, setSaveError] = useState('');
  const [saving, setSaving] = useState(false);
  const [clearing, setClearing] = useState(false);
  const [recoveryWarning, setRecoveryWarning] = useState('');
  const [sessionLoadFailed, setSessionLoadFailed] = useState(false);
  const [loadAttempt, setLoadAttempt] = useState(0);
  const [selectionRevision, setSelectionRevision] = useState(0);
  const {
    preferences, preferencesReadable, preferenceError, preferenceWarning, preferenceSaving,
    editingProfile, setEditingProfile, preferenceWritePending, loadPreferences,
    hostingMode, selectedProfile, lastSetup, changeHostingMode, saveProfile, duplicateProfile, deleteProfile, selectProfile, rememberSetup,
  } = useHostingPreferences();
  const [referenceContext, setReferenceContext] = useState<{ game?: Game; roles?: Role[]; rules?: Rules; initialRole?: Role } | null>(null);
  const saveVersion = useRef(0);
  const mounted = useRef(true);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  usePreventScreenCapture('private-game');
  useKeepAwake('host-session');

  useEffect(() => {
    let cancelled = false;
    Promise.allSettled([readSession(), readHistory(), loadPreferences(), readAppRole()]).then(([saved, old, , savedRole]) => {
      if (cancelled) return;
      const errors: string[] = [];
      if (saved.status === 'fulfilled') { sessionRef.current = saved.value; setSession(saved.value); }
      else errors.push('进行中对局读取失败');
      if (old.status === 'fulfilled') {
        setHistory(saved.status === 'fulfilled' && saved.value
          ? saved.value.current.stage === 'ended' ? addHistoryGame(old.value, saved.value.current) : removeHistoryGame(old.value, saved.value.current.id)
          : old.value);
      } else errors.push('历史记录读取失败');
      if (savedRole.status === 'fulfilled') {
        setAppRole(savedRole.value);
        setAppRoleError('');
      } else {
        setAppRole(null);
        setAppRoleError('身份入口读取失败，请重新选择主持人或玩家；原有存档不受影响。');
      }
      setSessionLoadFailed(saved.status === 'rejected');
      setLoadError(errors.length ? `${errors.join('；')}。原数据未覆盖；恢复前已暂停新建、修改和自动保存。` : '');
      setRecoveryWarning(getWarnings().join('\n'));
      setLoading(false);
    });
    return () => { cancelled = true; };
  }, [loadAttempt, loadPreferences]);

  useEffect(() => {
    if (appRole !== 'host') return;
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      if (screen === 'game' || screen === 'history' || screen === 'backup' || screen === 'personalization' || screen === 'skills') {
        if (screen === 'personalization' && preferenceWritePending.current) return true;
        setActionError('');
        setScreen('home');
        return true;
      }
      return false;
    });
    return () => subscription.remove();
  }, [screen, preferenceWritePending, appRole]);

  const writeBlocked = loading || !!loadError || clearing;
  const retryLoad = () => { setLoading(true); setLoadAttempt(n => n + 1); };
  const retryPreferences = () => {
    void loadPreferences(true).then(loaded => { if (loaded) setRecoveryWarning(getWarnings().join('\n')); });
  };
  const selectMainTab = (tab: MainTab) => {
    if (preferenceWritePending.current && screen === 'personalization') return;
    setActionError('');
    setScreen(tab);
  };
  const chooseRole = (role: AppRole) => {
    setAppRole(role);
    setAppRoleError('');
    setActionError('');
    setScreen('home');
    void persistAppRole(role).catch(() => setAppRoleError('身份选择未能保存，下次打开会重新询问；主持存档和玩家笔记不受影响。'));
  };
  const requestRoleSwitch = () => {
    if (!appRole) return;
    const next: AppRole = appRole === 'host' ? 'player' : 'host';
    Alert.alert(
      next === 'player' ? '切换到玩家模式？' : '切换到主持模式？',
      next === 'player'
        ? '当前主持对局会保留，随时可以切回来继续；玩家笔记只保存在本机。'
        : '将打开本机的主持数据，请确认你是主持人。主持对局和玩家笔记分别保存，不会互相覆盖。',
      [
        { text: '取消', style: 'cancel' },
        { text: '切换', onPress: () => chooseRole(next) },
      ],
    );
  };
  const selectHostingMode = (mode: typeof hostingMode) => {
    if (!changeHostingMode(mode)) {
      if (preferences.profiles.length) setScreen('personalization');
      else { setEditingProfile(undefined); setScreen('profile-editor'); }
    }
  };
  const save = (next: Session, retry = false) => {
    const version = ++saveVersion.current;
    savingRef.current = true;
    setSaving(true);
    void (retry ? retryPersistSession(next) : persistSession(next)).then(() => {
      if (mounted.current && version === saveVersion.current) setSaveError('');
    }).catch(() => {
      if (mounted.current && version === saveVersion.current) setSaveError('对局或复盘保存失败。请保持应用打开，检查存储空间后点“重试保存”；不要开始新局。');
    }).finally(() => {
      if (version === saveVersion.current) {
        savingRef.current = false;
        if (mounted.current) setSaving(false);
      }
    });
  };
  const start = (game: Game, setup?: SetupMemory) => {
    if (loading || !!loadError || removingSession.current || saveError || savingRef.current) return;
    rememberSetup(refreshSetupMemory(setup ?? setupMemoryFromGame(game, hostingMode), hostingMode));
    const next = { current: game, undo: [], redo: [] };
    save(next); setActionError(''); sessionRef.current = next; setSession(next); setScreen('game');
  };
  const removeCurrent = async (destination: Screen, after?: () => void) => {
    if (writeBlocked || removingSession.current || saveError || savingRef.current) return;
    removingSession.current = true;
    setClearing(true);
    let removed = false;
    try {
      const current = sessionRef.current;
      if (current) await persistSession(current);
      await clearSession();
      sessionRef.current = null; setSession(null); setActionError(''); setScreen(destination);
      removed = true;
    } catch { setSaveError('移除未完成：备份或归档保存失败，原对局已保留。请重试保存。'); }
    finally { removingSession.current = false; setClearing(false); }
    if (removed) after?.();
  };
  const newGame = () => {
    if (preferenceWritePending.current) return;
    if (hostingMode === 'custom' && !selectedProfile) { setScreen('personalization'); return; }
    if (writeBlocked || removingSession.current || saveError || savingRef.current) return;
    const current = sessionRef.current;
    if (!current || !requiresAbandonConfirmation(true, current.current.stage)) { setScreen('setup'); return; }
    Alert.alert('当前对局还没结束', '新建对局会替换本机正在进行的对局。要先放弃当前局并继续吗？', [
      { text: '继续主持', style: 'cancel' },
      { text: '放弃并新建', style: 'destructive', onPress: () => { void removeCurrent('setup'); } },
    ]);
  };
  const launchGame = (game: Game, setup: SetupMemory) => {
    if (writeBlocked || removingSession.current || saveError || savingRef.current) return;
    const current = sessionRef.current;
    if (!current || !requiresAbandonConfirmation(true, current.current.stage)) { start(game, setup); return; }
    Alert.alert('当前对局还没结束', '按上次设置新开一局会替换本机正在进行的对局。要先放弃当前局并继续吗？', [
      { text: '继续主持', style: 'cancel' },
      { text: '放弃并新开', style: 'destructive', onPress: () => { void removeCurrent('game', () => start(game, setup)); } },
    ]);
  };
  const repeatSetup = (setup: SetupMemory) => {
    try {
      launchGame(gameFromSetup(setup), setup);
    } catch (error) {
      setActionError(error instanceof Error ? error.message : '上次开局设置无法直接使用，请检查后重试。');
      setScreen('setup');
    }
  };
  const currentSetup = session && (!lastSetup || session.current.startedAt > lastSetup.savedAt)
    ? setupMemoryFromGame(session.current, hostingMode)
    : undefined;
  const latestHistory = history.reduce<Game | undefined>((latest, game) => !latest || game.startedAt > latest.startedAt ? game : latest, undefined);
  const repeatableSetup = currentSetup ?? lastSetup ?? (latestHistory ? setupMemoryFromGame(latestHistory, hostingMode) : undefined);
  const setupPrefill = hostingMode === 'custom' ? undefined : repeatableSetup?.mode === hostingMode ? repeatableSetup : undefined;
  const dispatch = (action: Action): boolean => {
    const current = sessionRef.current;
    if (!current || writeBlocked || removingSession.current) return false;
    try {
      const next = applyAction(current.current, action);
      const updated = { current: next, undo: [...current.undo, current.current].slice(-50), redo: [] };
      setActionError('');
      save(updated);
      sessionRef.current = updated;
      setSession(updated);
      const historyChange = archiveTransition(current.current, next);
      if (historyChange === 'add') setHistory(old => addHistoryGame(old, next));
      if (historyChange === 'remove') setHistory(old => removeHistoryGame(old, next.id));
      return true;
    } catch (error) { setActionError(error instanceof Error ? error.message : '请检查当前状态'); return false; }
  };
  const undo = () => {
    const current = sessionRef.current;
    if (!current || writeBlocked || removingSession.current) return;
    const updated = undoSession(current);
    if (!updated) return;
    setActionError('');
    setSelectionRevision(n => n + 1);
    save(updated);
    sessionRef.current = updated;
    setSession(updated);
    if (archiveTransition(current.current, updated.current) === 'remove') setHistory(old => removeHistoryGame(old, current.current.id));
  };
  const redo = () => {
    const current = sessionRef.current;
    if (!current || writeBlocked || removingSession.current) return;
    const updated = redoSession(current);
    if (!updated) return;
    setActionError('');
    setSelectionRevision(n => n + 1);
    save(updated);
    sessionRef.current = updated;
    setSession(updated);
    if (archiveTransition(current.current, updated.current) === 'add') setHistory(old => addHistoryGame(old, updated.current));
  };
  const reset = () => Alert.alert('移除当前对局？', '移除前会备份原始会话；已结束对局先完成归档。备份或归档失败时不会移除。', [
    { text: '取消', style: 'cancel' },
    { text: '移除', style: 'destructive', onPress: () => { void removeCurrent('home'); } },
  ]);
  const shareRecovery = () => Alert.alert('分享私密存档数据？', '包含全部身份与夜间记录，只应发送给你信任的人。', [
    { text: '取消', style: 'cancel' },
    { text: '继续分享', onPress: () => { void exportRawData().then(message => Share.share({ title: '夜幕原始存档（私密）', message })).catch(() => setRecoveryWarning('原始数据读取或分享失败，未清除任何记录。')); } },
  ]);
  const clearBroken = () => Alert.alert('备份后清除异常会话？', '只清除无法读取的进行中会话，不清除历史。原始字符串先存入恢复备份；备份失败则不清除。', [
    { text: '取消', style: 'cancel' },
    { text: '备份并清除', style: 'destructive', onPress: () => { void clearDamagedSession().then(() => { setSaveError(''); retryLoad(); }).catch(() => setLoadError('备份失败，原始记录未清除。请释放存储空间后重试；新建仍已锁定。')); } },
  ]);

  if (loading) {
    return (
      <View style={styles.splash}>
        <Icon name="moon" size={38} strokeWidth={1.3} />
        <Text style={styles.splashText}>正在打开夜幕</Text>
      </View>
    );
  }

  const hostMessage = [loadError, saveError, recoveryWarning, preferenceWarning, appRoleError].filter(Boolean).join('\n');
  const banner = appRole === 'host' ? hostMessage : appRole === 'player' ? appRoleError : '';
  return (
    <SafeAreaProvider>
      <SafeAreaView style={styles.root} edges={['top', 'bottom', 'left', 'right']}>
        <StatusBar style="dark" />
        <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'android' ? 'height' : undefined}>
          {banner ? (
            <View style={styles.banner}>
              <ScrollView style={styles.bannerScroll} contentContainerStyle={styles.bannerContent}>
                <Text accessibilityRole="alert" style={styles.bannerText}>{banner}</Text>
              </ScrollView>
              <View style={styles.bannerActions}>
                {appRole === 'host' && loadError ? <Button title="重试读档" variant="secondary" small onPress={retryLoad} /> : null}
                {appRole === 'host' && saveError && session && !loadError ? <Button title="重试保存" variant="secondary" small onPress={() => save(session, true)} /> : null}
                {appRole === 'host' ? <Pressable accessibilityRole="button" accessibilityLabel="分享原始数据" onPress={shareRecovery}><Text style={styles.bannerLink}>分享原始数据</Text></Pressable> : null}
                {appRole === 'host' && sessionLoadFailed ? <Button title="备份后清除异常会话" variant="danger" small onPress={clearBroken} /> : null}
              </View>
            </View>
          ) : null}
          {appRole === 'host' && (saving || clearing) ? <Text style={styles.savingText}>{clearing ? '正在备份并移除本局，请稍候…' : '正在保存，请勿替换本局…'}</Text> : null}
          <PageTransition pageKey={appRole === null ? 'role-gate' : appRole === 'player' ? 'player' : screen} direction={navigation.direction}>
          {appRole === null ? <RoleGate onSelect={chooseRole} error={appRoleError || undefined} /> : null}
          {appRole === 'player' ? <PlayerScreen storage={playerNotebookStorage} onOpenReference={setReferenceContext} onSwitchRole={requestRoleSwitch} /> : null}
          {appRole === 'host' ? <>
          {screen === 'home' ? (
            <HomeScreen
              session={session}
              history={history}
              hostingMode={hostingMode}
              selectedProfile={selectedProfile}
              lastSetup={repeatableSetup}
              preferenceError={preferenceError}
              onPersonalize={() => setScreen('personalization')}
              disabled={writeBlocked || !!saveError || saving || preferenceSaving}
              onNew={newGame}
              onRepeat={repeatableSetup ? () => repeatSetup(repeatableSetup) : undefined}
              onResume={() => setScreen('game')}
              onHistory={() => setScreen('history')}
              onUndo={undo}
              onSwitchRole={requestRoleSwitch}
            />
          ) : null}
          {screen === 'skills' ? <SkillTableScreen onOpenGuide={() => setReferenceContext({})} /> : null}
          {screen === 'setup' ? <SetupScreen key="game-setup" mode={hostingMode} initialProfile={hostingMode === 'custom' ? selectedProfile : undefined} initialSetup={setupPrefill} initialRules={hostingMode === 'custom' && selectedProfile ? { ...selectedProfile.rules } : rulesForHostingMode(hostingMode)} onBack={() => setScreen('home')} onStart={start} onOpenReference={setReferenceContext} /> : null}
          {screen === 'personalization' ? <PersonalizationScreen
            profiles={preferences.profiles}
            selectedProfileId={preferences.selectedProfileId}
            hostingMode={hostingMode}
            disabled={!preferencesReadable || preferenceSaving}
            error={preferenceError}
            onRetry={!preferencesReadable ? retryPreferences : undefined}
            onHostingModeChange={selectHostingMode}
            onCreate={() => { setEditingProfile(undefined); setScreen('profile-editor'); }}
            onEdit={profile => { setEditingProfile(profile); setScreen('profile-editor'); }}
            onDuplicate={profile => { void duplicateProfile(profile.id).catch(error => setActionError(error instanceof Error ? error.message : '复制方案失败')); }}
            onBackup={() => setScreen('backup')}
            onSelect={selectProfile}
            onDelete={deleteProfile}
          /> : null}
          {screen === 'profile-editor' ? <SetupScreen key={`profile-${editingProfile?.id ?? 'new'}`} mode="custom" initialProfile={editingProfile} initialRules={editingProfile ? { ...editingProfile.rules } : rulesForHostingMode('standard')} onBack={() => setScreen('personalization')} onStart={start} onSaveProfile={async draft => { await saveProfile(draft); setScreen('personalization'); }} onOpenReference={setReferenceContext} /> : null}
          {screen === 'history' ? <HistoryScreen games={history} onBack={() => setScreen('home')} /> : null}
          {screen === 'backup' ? <DataBackupScreen
            hasActiveSession={!!session && session.current.stage !== 'ended'}
            currentSessionDamaged={sessionLoadFailed}
            onBack={() => setScreen('personalization')}
            onExportBackup={exportBackup}
            onRestoreBackup={async (raw, replaceCurrent) => { await restoreBackup(raw, replaceCurrent); }}
            onImported={() => { setLoading(true); setActionError(''); setLoadError(''); setSaveError(''); setLoadAttempt(value => value + 1); setScreen('home'); }}
          /> : null}
          {screen === 'game' && session ? (
            <GameScreen
              key={session.current.id}
              game={session.current}
              selectionRevision={selectionRevision}
              canUndo={!writeBlocked && session.undo.length > 0}
              canRedo={!writeBlocked && session.redo.length > 0}
              error={actionError}
              onBack={() => setScreen('home')}
              onUndo={undo}
              onRedo={redo}
              onReset={reset}
              onOpenReference={() => setReferenceContext({ game: session.current })}
              dispatch={dispatch}
            />
          ) : null}
          </> : null}
          </PageTransition>
          {appRole === 'host' && MAIN_TABS.some(tab => tab.key === screen) ? <View testID="main-navigation"><TabBar tabs={MAIN_TABS} value={screen as MainTab} onChange={selectMainTab} disabled={screen === 'personalization' && preferenceSaving} /></View> : null}
        </KeyboardAvoidingView>
        <ReferenceModal visible={referenceContext !== null} {...(referenceContext ?? {})} onClose={() => setReferenceContext(null)} />
      </SafeAreaView>
    </SafeAreaProvider>
  );
}

export default function App() { return <MotionProvider><AppContent /></MotionProvider>; }

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  flex: { flex: 1 },
  splash: { flex: 1, backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center', gap: spacing.md },
  splashMark: { fontSize: 42, color: colors.accent },
  splashText: { ...type.footnote },
  banner: { backgroundColor: colors.dangerDim, paddingHorizontal: spacing.lg, paddingVertical: spacing.md, gap: spacing.sm, borderBottomWidth: StyleSheet.hairlineWidth, borderColor: colors.danger },
  bannerScroll: { maxHeight: 88 },
  bannerContent: { paddingRight: spacing.sm },
  bannerText: { color: colors.danger, fontSize: 13, lineHeight: 19 },
  bannerActions: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: spacing.sm },
  bannerLink: { color: colors.text, fontSize: 13, fontWeight: '600', textDecorationLine: 'underline', paddingVertical: spacing.sm },
  savingText: { ...type.footnote, fontSize: 12, textAlign: 'center', paddingVertical: 4, color: colors.textTertiary },
});
