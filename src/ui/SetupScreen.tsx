import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, Animated, BackHandler, Keyboard, ScrollView, Text, TextInput, View, useWindowDimensions, type ScrollViewInstance } from 'react-native';
import { colors, spacing, type } from '../theme';
import { BOARD_LIBRARY, countsFromRoles, nightCallsFor, type Board } from '../game/boards';
import { treasureReserveLog } from '../game/jingcheng-draw';
import { createGame, validateCounts } from '../game/engine';
import { openingRulesScript, ruleSummary } from '../game/config';
import { tableRules } from '../game/table-rules';
import { isIdentityCard } from '../game/role-catalog';
import { reconcileNightOrder } from '../game/flow';
import { ROLE_REFERENCE } from '../game/role-reference';
import { ROLES, ROLE_IDS, isWolf } from '../game/roles';
import type { Counts, Game, Role, Rules } from '../game/types';
import { Button, InlineError, Sheet, TopBar } from './kit';
import { Icon } from './Icon';
import { usePageEnter } from './motion';
import { hostingModeLabel, profileBoard, rulesForHostingMode, type HostingMode, type HostingProfile } from './preferences';
import { boardForSetup, makeSetupMemory, type SetupMemory } from '../game/setup-memory';
import { clampFontScale, useResponsive } from './responsive';
import { WorkflowSettings } from './setup/WorkflowSettings';
import { boardIntroduction } from '../game/board-reference';
import { hostingSupport, withSupportDefaults } from '../game/support-policy';
import { mergeRuleOverrides, mergeRules, ruleChanges, rulesForBoard } from '../game/board-rules';
import { matchesFilter, type Filter } from './setup/board-filter';
import { dealBoard } from './setup/deal';
import { BoardLibrarySheet, CustomBoardSheet, RoleSwapSheet } from './setup/SetupSheets';
import { BoardStep, RosterStep, RulesStep } from './setup/SetupSteps';
import { styles } from './setup/styles';
import type { Step, TreasureDeal } from './setup/types';

export function SetupScreen({ mode, initialRules, initialProfile, initialSetup, onBack, onStart, onSaveProfile, onOpenReference }: {
  mode: HostingMode;
  initialRules: Rules;
  initialProfile?: HostingProfile;
  initialSetup?: SetupMemory;
  onBack: () => void;
  onStart: (game: Game, setup: SetupMemory) => void;
  onSaveProfile?: (profile: Omit<HostingProfile, 'id'>) => Promise<void>;
  onOpenReference?: (context: { roles: Role[]; rules: Rules; initialRole?: Role }) => void;
}) {
  const editingProfile = !!onSaveProfile;
  const { fontScale } = useWindowDimensions();
  const responsive = useResponsive();
  const seatNumberWidth = Math.max(38, Math.ceil(26 * clampFontScale(fontScale)));
  const [step, setStep] = useState<Step>(0);
  const [stepDirection, setStepDirection] = useState(1);
  const stepMotion = usePageEnter(String(step), stepDirection);
  const contentScroll = useRef<ScrollViewInstance>(null);
  useEffect(() => { contentScroll.current?.scrollTo({ y: 0, animated: false }); }, [step]);
  const [initialState] = useState(() => {
    const defaultName = initialProfile ? editingProfile ? initialProfile.name : '周末局' : editingProfile ? '' : '周末局';
    if (initialProfile) {
      const startBoard = profileBoard(initialProfile);
      const dealt = startBoard.deck ? dealBoard(startBoard) : { seats: initialProfile.roles };
      return { board: startBoard, ...dealt, name: defaultName, names: [] as string[], fromMemory: false };
    }
    if (initialSetup) {
      const startBoard = boardForSetup(initialSetup);
      const dealt = startBoard.deck ? dealBoard(startBoard) : { seats: initialSetup.roles };
      return { board: startBoard, ...dealt, name: initialSetup.gameName, names: initialSetup.playerNames, fromMemory: true };
    }
    const startBoard = BOARD_LIBRARY[0];
    const dealt = dealBoard(startBoard);
    return { board: startBoard, ...dealt, name: defaultName, names: [] as string[], fromMemory: false };
  });
  const [board, setBoard] = useState<Board>(initialState.board);
  const [deal, setDeal] = useState<TreasureDeal | undefined>(initialState.deal);
  const [usingLastSetup, setUsingLastSetup] = useState(initialState.fromMemory);
  const [name, setName] = useState(initialState.name);
  const [nameError, setNameError] = useState('');
  const profileNameInput = useRef<React.ElementRef<typeof TextInput>>(null);
  const profileNameY = useRef(0);
  const profileSavePending = useRef(false);
  const [baseRules, setBaseRules] = useState(() => mergeRules(initialSetup && !initialProfile ? initialSetup.rules : initialRules));
  const hostRuleOverrides = useRef<Partial<Rules>>({});
  const [rules, setAppliedRules] = useState<Rules>(() => initialSetup && !initialProfile ? mergeRules(initialSetup.rules) : rulesForBoard(baseRules, board));
  const [players, setPlayers] = useState<{ name: string; role: Role }[]>(() => initialState.seats.map((role, index) => ({ name: initialState.names[index] ?? '', role })));
  const [profileSaving, setProfileSaving] = useState(false);
  const [error, setError] = useState('');
  const [libraryOpen, setLibraryOpen] = useState(false);
  const [libraryPreview, setLibraryPreview] = useState<Board | null>(null);
  const [filter, setFilter] = useState<Filter>('all');
  const [boardSearch, setBoardSearch] = useState('');
  const [builderOpen, setBuilderOpen] = useState(false);
  const [builderRoles, setBuilderRoles] = useState<Partial<Record<Role, number>>>({ wolf: 4, villager: 4, seer: 1, witch: 1, hunter: 1, idiot: 1 });
  const [builderName, setBuilderName] = useState('自定义板子');
  const [builderError, setBuilderError] = useState('');
  const [roleSeat, setRoleSeat] = useState<number | null>(null);
  const [flowOpen, setFlowOpen] = useState(false);
  const [openingOpen, setOpeningOpen] = useState(false);
  const [detailsOpen, setDetailsOpen] = useState(editingProfile);

  const [initialSnapshot] = useState(() => JSON.stringify({ board, name, rules, players }));
  const dirty = initialSnapshot !== JSON.stringify({ board, name, rules, players });
  const requestBack = useCallback(() => {
    if (profileSavePending.current || profileSaving) return;
    if (step > 0) { setError(''); setStepDirection(-1); setStep((step - 1) as Step); return; }
    if (!dirty) { onBack(); return; }
    Alert.alert(editingProfile ? '放弃本次方案修改？' : '放弃本次开局设置？', editingProfile ? '本次修改尚未保存，返回后不会保留。已保存的方案不受影响。' : '对局尚未开始，返回后已填写的名称、桌规和座位将不会保留。', [
      { text: '继续设置', style: 'cancel' },
      { text: '放弃设置', style: 'destructive', onPress: onBack },
    ]);
  }, [dirty, editingProfile, onBack, profileSaving, step]);
  useEffect(() => {
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      if (libraryOpen) { if (libraryPreview) setLibraryPreview(null); else setLibraryOpen(false); }
      else if (builderOpen) setBuilderOpen(false);
      else if (roleSeat !== null) setRoleSeat(null);
      else if (openingOpen) setOpeningOpen(false);
      else if (flowOpen) setFlowOpen(false);
      else requestBack();
      return true;
    });
    return () => subscription.remove();
  }, [libraryOpen, libraryPreview, builderOpen, roleSeat, openingOpen, flowOpen, requestBack]);

  const total = players.length;
  const wolfCount = players.filter(p => isWolf(p.role)).length;
  const thirdCount = players.filter(p => ROLE_REFERENCE[p.role].camp === 'third').length;
  const goodCount = total - wolfCount - thirdCount;
  const playerCounts = countsFromRoles(Object.fromEntries(ROLE_IDS.map(role => [role, players.filter(player => player.role === role).length])));
  const currentRoles = ROLE_IDS.filter(role => playerCounts[role] > 0);
  const manualRoles = currentRoles.filter(role => ROLE_REFERENCE[role].automation !== 'automatic');
  const support = hostingSupport(currentRoles);
  const supportedRules = withSupportDefaults(rules, currentRoles);
  const tableSummary = ruleSummary(supportedRules, currentRoles);
  const hasWitch = currentRoles.includes('witch');
  const hasGuard = currentRoles.includes('guard');
  const table = tableRules(rules);
  const hasGuardSave = currentRoles.includes('guard') && hasWitch;
  const hasHunterPoison = currentRoles.includes('hunter') && hasWitch;
  const openReference = (initialRole?: Role) => onOpenReference?.({
    roles: builderOpen ? ROLE_IDS.filter(role => (builderRoles[role] ?? 0) > 0) : players.map(player => player.role),
    rules: { ...supportedRules }, initialRole,
  });
  const normalizedRules = (): Rules => ({ ...supportedRules, flow: supportedRules.flow ? { ...supportedRules.flow, nightOrder: reconcileNightOrder(playerCounts, supportedRules.flow.nightOrder) } : undefined });
  const setRules = (next: Rules, previous = rules) => {
    const edits = ruleChanges(previous, next);
    hostRuleOverrides.current = mergeRuleOverrides(hostRuleOverrides.current, edits);
    setAppliedRules(mergeRules(rules, edits));
  };

  const applyBoard = (next: Board) => {
    if (next !== board) {
      const dealt = dealBoard(next);
      setBoard(next);
      setDeal(dealt.deal);
      setPlayers(old => dealt.seats.map((role, index) => ({ name: old[index]?.name ?? '', role })));
      setAppliedRules(rulesForBoard(baseRules, next, hostRuleOverrides.current));
    }
    setError('');
    setLibraryOpen(false);
    setLibraryPreview(null);
  };
  const redeal = () => Alert.alert('重新洗牌？', '重新抽取 3 张底牌和 12 张入座身份；已填写的姓名保留。', [
    { text: '取消', style: 'cancel' },
    { text: '重新洗牌', onPress: () => {
      const dealt = dealBoard(board);
      setDeal(dealt.deal);
      setPlayers(old => dealt.seats.map((role, index) => ({ name: old[index]?.name ?? '', role })));
    } },
  ]);
  const closeLibrary = () => { setLibraryOpen(false); setLibraryPreview(null); };
  const previewBoard = (item: Board) => { setLibraryPreview(item); setLibraryOpen(true); };
  const chooseBoard = (item: Board) => { applyBoard(item); };

  const visibleBoards = BOARD_LIBRARY.filter(item => {
    const query = boardSearch.trim().toLocaleLowerCase();
    const matchesSearch = !query || [item.name, item.subtitle, boardIntroduction(item).overview, ...ROLE_IDS.filter(role => (item.roles[role] ?? 0) > 0).map(role => ROLES[role].name)]
      .join(' ').toLocaleLowerCase().includes(query);
    return matchesFilter(item, filter) && matchesSearch;
  });

  const applyCustom = () => {
    if (ROLE_IDS.some(role => !isIdentityCard(role) && (builderRoles[role] ?? 0) > 0)) { setBuilderError('幸运儿是附加状态，不单独占座。请移除旧的幸运儿身份，补回该玩家的原身份。'); return; }
    const counts = countsFromRoles(builderRoles);
    const count = Object.values(counts).reduce((a, b) => a + b, 0);
    const sameLineup = !board.deck && ROLE_IDS.every(role => counts[role] === board.counts[role]);
    const keepBoardRules = !!board.rules && (sameLineup || table.lineupMode === 'free');
    try { validateCounts(counts, keepBoardRules ? rules : undefined); }
    catch (e) { setBuilderError(e instanceof Error ? e.message : '请检查阵容人数与角色'); return; }
    const sourceBoardId = sameLineup ? board.sourceBoardId ?? (board.tag !== 'custom' ? board.id : undefined) : undefined;
    const next: Board = {
      id: 'custom', name: builderName.trim() || '自定义板子', subtitle: `${count} 人 · 自定义阵容`, tag: 'custom',
      playerCount: count, roles: builderRoles, counts, night: nightCallsFor(counts), note: '由你在开局前自定义的阵容。',
      ...(keepBoardRules ? { rules: board.rules } : {}),
      ...(sourceBoardId ? { sourceBoardId, ...(board.catalog ? { catalog: board.catalog } : {}) } : {}),
    };
    setBuilderOpen(false);
    applyBoard(next);
  };

  const editLineup = () => {
    setBuilderError('');
    setLibraryOpen(false);
    setBuilderName(board.name);
    setBuilderRoles(board.deck ? Object.fromEntries(currentRoles.map(role => [role, playerCounts[role]])) : { ...board.roles });
    setBuilderOpen(true);
  };
  const shuffleRoles = () => Alert.alert('随机分配身份？', '保留座位和姓名，将当前阵容中的身份随机分配到这些座位。', [
    { text: '取消', style: 'cancel' },
    { text: '确认随机', onPress: () => setPlayers(current => {
      const shuffled = current.map(player => player.role);
      for (let index = shuffled.length - 1; index > 0; index--) { const next = Math.floor(Math.random() * (index + 1)); [shuffled[index], shuffled[next]] = [shuffled[next], shuffled[index]]; }
      return current.map((player, index) => ({ ...player, role: shuffled[index] }));
    }) },
  ]);
  const swapRoles = (otherSeat: number) => {
    if (roleSeat === null || roleSeat === otherSeat) return;
    setPlayers(current => current.map((player, index) => index === roleSeat
      ? { ...player, role: current[otherSeat].role }
      : index === otherSeat ? { ...player, role: current[roleSeat].role } : player));
    setRoleSeat(null);
  };

  const start = () => {
    try {
      setError('');
      if (players.some(player => !isIdentityCard(player.role))) throw new Error('旧方案把幸运儿当成了独立身份。请返回板子页编辑阵容，移除幸运儿并补回玩家原身份。');
      const privateNotes = deal && deal.boardId === board.id ? [treasureReserveLog({ reserve: deal.reserve, treasureCamp: deal.camp })] : [];
      const treasure = deal && deal.boardId === board.id ? { reserve: deal.reserve, camp: deal.camp } : undefined;
      const rulesToUse = normalizedRules();
      const setup = makeSetupMemory({
        mode,
        boardId: board.sourceBoardId ?? (board.tag !== 'custom' ? board.id : undefined),
        boardName: board.name,
        roles: players.map(player => player.role),
        rules: rulesToUse,
        playerNames: players.map(player => player.name.trim()),
        gameName: name.trim() || '周末局',
      });
      onStart(createGame(name, board.name, players.map((p, index) => ({ name: p.name || `${index + 1}号玩家`, role: p.role })), rulesToUse, { privateNotes, ...(treasure ? { treasure } : {}) }), setup);
    } catch (e) {
      setError(e instanceof Error ? e.message : '请检查开局配置');
    }
  };

  const resetToDefaults = () => Alert.alert('从头设置？', '会清空上次带入的板子、桌规和姓名；已保存的方案不受影响。', [
    { text: '取消', style: 'cancel' },
    { text: '从头设置', style: 'destructive', onPress: () => {
      const startBoard = BOARD_LIBRARY[0];
      const dealt = dealBoard(startBoard);
      setBoard(startBoard);
      setDeal(dealt.deal);
      setPlayers(dealt.seats.map(role => ({ name: '', role })));
      setName('周末局');
      const defaults = rulesForHostingMode(mode);
      setBaseRules(defaults);
      setAppliedRules(rulesForBoard(defaults, startBoard));
      hostRuleOverrides.current = {};
      setUsingLastSetup(false);
      setDetailsOpen(false);
      setError('');
      setNameError('');
    } },
  ]);

  const validateProfileName = () => {
    const trimmed = name.trim();
    if (trimmed && trimmed.length <= 24) { setNameError(''); return true; }
    setNameError(trimmed ? '方案名称最多 24 个字' : '请填写方案名称');
    contentScroll.current?.scrollTo({ y: Math.max(0, profileNameY.current - spacing.md), animated: false });
    profileNameInput.current?.focus();
    return false;
  };

  const next = () => {
    if (profileSavePending.current) return;
    setError('');
    if (editingProfile && !validateProfileName()) return;
    if (step === 0) { setError(''); Keyboard.dismiss(); setStepDirection(1); setStep(1); return; }
    if (onSaveProfile) {
      if (profileSaving) return;
      if (players.some(player => !isIdentityCard(player.role))) { setError('旧方案把幸运儿当成了独立身份。请返回阵容页编辑，移除幸运儿并补回玩家原身份。'); return; }
      try {
        validateCounts(playerCounts, normalizedRules());
      } catch (e) { setError(e instanceof Error ? e.message : '请检查阵容'); return; }
      setError('');
      Keyboard.dismiss();
      profileSavePending.current = true;
      setProfileSaving(true);
      const sourceBoardId = board.deck ? undefined : board.sourceBoardId ?? (board.tag !== 'custom' ? board.id : undefined);
      const draft = { name: name.trim(), boardName: board.name, roles: players.map(player => player.role), rules: normalizedRules(), ...(sourceBoardId ? { sourceBoardId } : {}) };
      void (async () => {
        try { await onSaveProfile(draft); }
        catch {
          profileSavePending.current = false;
          setError('方案保存失败，请检查存储空间后重试。你的修改仍保留在这里。');
          setProfileSaving(false);
        }
      })();
      return;
    }
    if (step === 1) { Keyboard.dismiss(); setStepDirection(1); setStep(2); return; }
    start();
  };

  return (
    <View style={styles.root}>
      <TopBar title={editingProfile ? initialProfile ? '编辑自定义方案' : '新建自定义方案' : '新建对局'} subtitle={`第 ${step + 1} 步 / ${editingProfile ? 2 : 3}`} onBack={requestBack} />
      <ScrollView ref={contentScroll} pointerEvents={profileSaving ? 'none' : 'auto'} contentContainerStyle={[styles.content, { paddingHorizontal: responsive.gutter, width: '100%', maxWidth: Math.min(responsive.maxContentWidth, 960), alignSelf: 'center' }]} keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag" showsVerticalScrollIndicator={false}>
        <View style={styles.steps}>
          {(editingProfile ? ['名称与阵容', '桌规'] : ['板子', '桌规', '座位']).map((label, index) => (
            <View key={label} style={styles.stepItem} accessibilityLabel={`第${index + 1}步 ${label}${index === step ? '，当前步骤' : index < step ? '，已完成' : ''}`}>
              <View style={[styles.stepBar, index <= step && styles.stepBarActive]} />
              <View style={styles.stepCaption}><Text style={[styles.stepNumber, index === step && styles.stepLabelActive]}>{String(index + 1).padStart(2, '0')}</Text><Text style={[styles.stepLabel, index === step && styles.stepLabelActive]}>{label}</Text></View>
            </View>
          ))}
        </View>

        {usingLastSetup && !editingProfile ? <View style={styles.memoryNotice}>
          <View style={styles.rowBetween}>
            <View style={styles.memoryHead}><Icon name="history" size={17} color={colors.textSecondary} /><Text style={styles.memoryTitle}>已带入上次开局设置</Text></View>
            <Button title="从头设置" variant="ghost" small onPress={resetToDefaults} />
          </View>
          <Text style={type.footnote}>{board.deck ? '板子、桌规和已填姓名已保留；牌池型板子会重新洗牌后再入座。' : '板子、桌规、身份顺序和已填姓名都已保留。'}可以直接开始，也可以继续修改。</Text>
          <Button title="直接开始" onPress={start} />
        </View> : null}

        {editingProfile ? <View style={styles.profileIdentity} onLayout={event => { profileNameY.current = event.nativeEvent.layout.y; }}>
          <View style={styles.rowBetween}><Text style={styles.nameLabel}>方案名称</Text><Text style={type.caption}>必填 · {name.length} / 24</Text></View>
          <TextInput
            ref={profileNameInput}
            value={name}
            onChangeText={value => { setName(value); if (value.trim() && value.trim().length <= 24) setNameError(''); }}
            editable={!profileSaving}
            accessibilityLabel="方案名称"
            accessibilityHint={nameError || '必填，最多 24 个字，为这套阵容和桌规命名'}
            placeholder="例如：周五朋友局"
            placeholderTextColor={colors.textTertiary}
            style={[styles.input, styles.profileNameInput, !!nameError && styles.inputError]}
            maxLength={24}
            returnKeyType="done"
            onSubmitEditing={Keyboard.dismiss}
          />
          {nameError ? <Text accessibilityRole="alert" accessibilityLiveRegion="polite" style={styles.nameError}>{nameError}</Text> : <Text style={type.footnote}>这是整套阵容和桌规的名字，与板子名称分开保存。</Text>}
        </View> : <View style={styles.modeCard}>
          <View style={styles.rowBetween}>
            <Text style={type.caption}>主持方式</Text>
            <Text style={styles.modeName}>{initialProfile ? initialProfile.name : hostingModeLabel(mode)}</Text>
          </View>
          {initialProfile ? <Text style={type.footnote}>已套用你的阵容和桌规。本局可以继续调整，已保存的方案保持原样。</Text> : null}
        </View>}

        <Animated.View style={[styles.stepContent, stepMotion]}>
          {step === 0 ? <BoardStep
            editingProfile={editingProfile}
            board={board}
            total={total}
            name={name}
            players={players}
            error={error}
            onNameChange={setName}
            onOpenLibrary={() => { setLibraryPreview(null); setLibraryOpen(true); }}
            onPreviewBoard={() => previewBoard(board)}
            onEditLineup={editLineup}
          /> : null}

          {step === 1 ? <RulesStep
            editingProfile={editingProfile}
            board={board}
            rules={rules}
            supportedRules={supportedRules}
            table={table}
            tableSummary={tableSummary}
            manualRoles={manualRoles}
            detailsOpen={detailsOpen}
            hasWitch={hasWitch}
            hasGuardSave={hasGuardSave}
            hasHunterPoison={hasHunterPoison}
            hasGuard={hasGuard}
            onSetRules={nextRules => setRules(nextRules)}
            onToggleDetails={() => setDetailsOpen(value => !value)}
            onOpenReference={openReference}
            onOpenFlow={() => setFlowOpen(true)}
            onOpenOpening={() => setOpeningOpen(true)}
          /> : null}

          {step === 2 ? <RosterStep
            total={total}
            wolfCount={wolfCount}
            goodCount={goodCount}
            thirdCount={thirdCount}
            board={board}
            deal={deal}
            players={players}
            tableSummary={tableSummary}
            support={support}
            supportedRules={supportedRules}
            error={error}
            seatNumberWidth={seatNumberWidth}
            onNameChange={(index, value) => setPlayers(old => old.map((p, i) => i === index ? { ...p, name: value } : p))}
            onShuffle={shuffleRoles}
            onRedeal={redeal}
            onRoleSeat={setRoleSeat}
            onOpenReference={() => openReference()}
            onOpenFlow={() => setFlowOpen(true)}
          /> : null}
        </Animated.View>
        {onOpenReference ? <View style={styles.referenceLink}><Icon name="book" size={18} color={colors.textSecondary} /><View style={styles.flex}><Button title="查看规则与角色技能" small variant="ghost" onPress={() => openReference()} /></View></View> : null}
      </ScrollView>

      <View style={styles.footer}>
        {step > 0 ? <Button title="上一步" variant="ghost" small disabled={profileSaving} onPress={() => { setError(''); setStepDirection(-1); setStep((step - 1) as Step); }} style={styles.backButton} /> : null}
        <Button title={profileSaving ? '正在保存方案…' : editingProfile && step === 1 ? '保存方案并设为默认' : step === 2 ? '开始主持' : '下一步'} disabled={profileSaving} onPress={next} style={styles.flex} />
      </View>
      {editingProfile && step === 1 && error ? <View style={styles.profileError}><InlineError>{error}</InlineError></View> : null}

      <Sheet visible={flowOpen} onClose={() => setFlowOpen(false)} title="自定义主持流程" subtitle="调整立即保留在本次设置中，保存方案后可重复使用" footer={<Button title="完成流程设置" onPress={() => setFlowOpen(false)} />}>
        {flowOpen ? <WorkflowSettings roles={players.map(player => player.role)} rules={normalizedRules()} onChange={nextRules => setRules(nextRules, normalizedRules())} /> : null}
      </Sheet>
      <Sheet visible={openingOpen} onClose={() => setOpeningOpen(false)} title="开场宣读" subtitle="按本局设置生成，可直接向全桌念出" footer={<Button title="完成宣读" onPress={() => setOpeningOpen(false)} />}>
        <Text selectable accessibilityLabel="完整开场桌规台词" style={styles.openingScript}>{openingRulesScript(supportedRules, currentRoles)}</Text>
      </Sheet>

      <BoardLibrarySheet
        visible={libraryOpen}
        board={board}
        preview={libraryPreview}
        filter={filter}
        search={boardSearch}
        boards={visibleBoards}
        isTablet={responsive.isWideTablet}
        rules={rules}
        onClose={closeLibrary}
        onClearPreview={() => setLibraryPreview(null)}
        onPreview={previewBoard}
        onChoose={chooseBoard}
        onEditLineup={editLineup}
        onOpenReference={onOpenReference}
        onFilterChange={setFilter}
        onSearchChange={setBoardSearch}
      />

      <CustomBoardSheet
        visible={builderOpen}
        name={builderName}
        roles={builderRoles}
        error={builderError}
        onClose={() => setBuilderOpen(false)}
        onApply={applyCustom}
        onNameChange={setBuilderName}
        onRoleChange={(role, count) => setBuilderRoles({ ...builderRoles, [role]: count })}
        onOpenReference={onOpenReference ? role => openReference(role) : undefined}
      />

      <RoleSwapSheet
        roleSeat={roleSeat}
        players={players}
        currentRoles={currentRoles}
        playerCounts={playerCounts}
        onClose={() => setRoleSeat(null)}
        onOpenReference={onOpenReference ? role => openReference(role) : undefined}
        onSwap={swapRoles}
      />
    </View>
  );
}

export function countsPreview(roles: Partial<Record<Role, number>>): Counts {
  return countsFromRoles(roles);
}
