import React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { colors, radius, spacing, type } from '../theme';
import { alive } from '../game/engine';
import { isCurrentGameActive, winnerLabel } from '../game/host-ui';
import type { Game, Session } from '../game/types';
import { Button, InlineError } from './kit';
import { Icon } from './Icon';
import { MotionPressable as Pressable } from './motion';
import { phaseLabel } from './labels';
import { hostingModeLabel, type HostingMode, type HostingProfile } from './preferences';
import { setupSummary, type SetupMemory } from '../game/setup-memory';
import { useResponsive } from './responsive';

export function HomeScreen({ session, history, hostingMode, selectedProfile, lastSetup, preferenceError, saving, saveError, lastSavedAt, onPersonalize, disabled, onNew, onRepeat, onResume, onHistory, onUndo, onSwitchRole }: {
  session: Session | null;
  history: Game[];
  hostingMode: HostingMode;
  selectedProfile?: HostingProfile;
  lastSetup?: SetupMemory;
  preferenceError?: string;
  saving?: boolean;
  saveError?: string;
  lastSavedAt?: number;
  onPersonalize: () => void;
  disabled: boolean;
  onNew: () => void;
  onRepeat?: () => void;
  onResume: () => void;
  onHistory: (gameId?: string) => void;
  onUndo: () => void;
  onSwitchRole?: () => void;
}) {
  const current = session?.current ?? null;
  const active = current ? isCurrentGameActive(current.stage) : false;
  const customProfile = hostingMode === 'custom' ? selectedProfile : undefined;
  const responsive = useResponsive();

  return <View style={styles.flex}>
    <View style={[styles.masthead, { paddingHorizontal: responsive.gutter, width: '100%', maxWidth: responsive.maxContentWidth, alignSelf: 'center' }]}>
      <View style={styles.brand}><Icon name="moon" size={22} /><Text style={styles.brandName}>夜幕</Text><View style={styles.brandRule} /><Text style={styles.brandNote}>狼人杀主持工具</Text></View>
      <View style={styles.mastheadRight}>
        <View style={styles.offline}><View style={styles.offlineDot} /><Text style={styles.offlineText}>离线</Text></View>
        {onSwitchRole ? <Pressable accessibilityRole="button" accessibilityLabel="切换到玩家模式" onPress={onSwitchRole} style={({ pressed }) => [styles.roleSwitch, pressed && styles.pressed]}><Icon name="users" size={16} color={colors.textSecondary} /><Text style={styles.roleSwitchText}>玩家模式</Text></Pressable> : null}
      </View>
    </View>
    <ScrollView style={styles.flex} contentContainerStyle={[styles.content, { paddingHorizontal: responsive.gutter, width: '100%', maxWidth: responsive.maxContentWidth, alignSelf: 'center' }]} showsVerticalScrollIndicator={false}>
      <View style={styles.heading}>
        <Text accessibilityRole="header" style={type.display}>主持台</Text>
        <Pressable accessibilityRole="button" accessibilityLabel="查看全部复盘" onPress={() => onHistory()} style={({ pressed }) => [styles.historyButton, pressed && styles.pressed]}><Icon name="history" size={20} /><Text style={styles.historyButtonText}>复盘</Text></Pressable>
      </View>

      <View testID={responsive.isWideTablet ? 'home-dashboard' : undefined} style={responsive.isWideTablet ? styles.dashboard : styles.stack}>
        <View style={responsive.isWideTablet ? styles.mainColumn : styles.stack}>
      {current ? <View style={styles.current}>
        <View style={styles.rowBetween}>
          <View style={styles.statusLine}><View style={[styles.statusDot, active && styles.statusDotActive]} /><Text style={styles.eyebrow}>{active ? '正在主持' : '最近一局'}</Text></View>
          <Text style={styles.phase}>{active ? phaseLabel(current) : '已结束'}</Text>
        </View>
        <Text style={styles.currentName}>{current.name}</Text>
        <Text style={type.footnote}>{current.board} · {current.players.length} 人</Text>
        <View style={styles.currentMetrics}>
          <View style={styles.metric}><Text style={styles.metricValue}>{alive(current).length}<Text style={styles.metricUnit}> / {current.players.length}</Text></Text><Text style={type.caption}>存活座位</Text></View>
          <View style={styles.metricRule} />
          <View style={[styles.metric, styles.flex]}><Text style={styles.metricStage}>{active ? phaseLabel(current) : winnerLabel(current.winner ?? 'draw')}</Text><Text style={type.caption}>{active ? '当前进度' : '对局结果'}</Text></View>
        </View>
        <View style={styles.resumeActions}>
          <Button title={active ? '继续主持' : '查看本局'} onPress={onResume} style={styles.flex} />
          {active ? <Button title="撤回" variant="secondary" onPress={onUndo} disabled={!session?.undo.length} style={styles.undo} /> : null}
        </View>
        <View style={styles.savedLine}>
          <Icon name={saveError ? 'close' : 'check'} size={13} color={saveError ? colors.danger : colors.textSecondary} />
          <Text style={[styles.savedNote, saveError && { color: colors.danger }]}>
            {saveError
              ? '保存失败，请先重试保存'
              : saving
                ? '正在保存，请保持应用打开'
                : lastSavedAt
                  ? `已保存 ${new Date(lastSavedAt).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}`
                  : '存档已从本机读取'}
          </Text>
        </View>
      </View> : null}

      <View style={[styles.newGame, current && styles.newGameCompact]}>
        <View style={styles.newGameHead}>
          <View style={styles.flex}><Text style={styles.eyebrow}>开局准备</Text><Text accessibilityRole="header" style={styles.newTitle}>新对局</Text><Text style={type.footnote}>{lastSetup ? '上次设置只用来预填，每次开局都要重新确认。' : '选好板子，按本桌约定开始。'}</Text></View>
          {!current ? <View style={styles.cardStack} accessible={false} pointerEvents="none"><View style={styles.cardBack} /><View style={styles.cardFront}><Icon name="moon" size={30} strokeWidth={1.2} /></View></View> : <Icon name="plus" size={24} color={colors.textTertiary} />}
        </View>
        {!current && !lastSetup ? <View style={styles.preparationLine}>{['阵容', '桌规', '座位'].map((label, index) => <View key={label} style={styles.preparationStep}><Text style={styles.stepNumber}>{String(index + 1).padStart(2, '0')}</Text><Text style={styles.stepLabel}>{label}</Text>{index < 2 ? <View style={styles.stepRule} /> : null}</View>)}</View> : null}
        {lastSetup ? <View testID="last-setup" style={styles.memory}>
          <View style={styles.memoryHead}><Icon name="history" size={18} color={colors.textSecondary} /><Text style={styles.memoryLabel}>上次开局已记住</Text></View>
          <Text style={styles.memoryTitle}>{lastSetup.boardName} · {lastSetup.roles.length} 人</Text>
          <Text style={type.footnote}>{setupSummary(lastSetup)}</Text>
          <Text style={styles.memoryHint}>会沿用板子、桌规和姓名，但仍需走完座位确认；座位身份不会沿用上一局。</Text>
        </View> : null}
        <Pressable accessibilityRole="button" accessibilityLabel="调整方案" onPress={onPersonalize} style={({ pressed }) => [styles.scheme, pressed && styles.pressed]}>
          <Icon name="sliders" size={19} color={colors.textSecondary} />
          <View style={styles.flex}><Text style={styles.schemeLabel}>默认开局方式</Text><Text style={styles.schemeValue}>{customProfile ? customProfile.name : hostingModeLabel(hostingMode)}</Text>{customProfile ? <Text style={type.footnote}>{customProfile.boardName} · {customProfile.roles.length} 人</Text> : null}</View>
          <Text style={styles.schemeEdit}>调整</Text><Icon name="chevron-right" size={16} color={colors.textSecondary} />
        </Pressable>
        {preferenceError ? <InlineError>{preferenceError}</InlineError> : null}
        <Button title="新建一场对局" onPress={onNew} disabled={disabled} variant={current && active ? 'secondary' : 'primary'} />
        {lastSetup ? <Button title="沿用上次设置，重新确认" variant="secondary" onPress={onRepeat ?? onNew} disabled={disabled} /> : null}
      </View>
        </View>

        <View testID={responsive.isWideTablet ? 'home-side-column' : undefined} style={responsive.isWideTablet ? styles.sideColumn : styles.stack}>
      <View style={styles.recentSection}>
        <View style={styles.rowBetween}><Text accessibilityRole="header" style={styles.sectionTitle}>最近复盘</Text><Text style={type.caption}>{history.length} 场</Text></View>
        {history.length ? history.slice(0, responsive.isTablet ? 6 : 3).map(game => <Pressable key={game.id} accessibilityRole="button" accessibilityLabel={`复盘 ${game.name}`} onPress={() => onHistory(game.id)} style={({ pressed }) => [styles.historyRow, pressed && styles.pressed]}>
          <View style={styles.dateBlock}><Text style={styles.dateDay}>{new Date(game.startedAt).getDate().toString().padStart(2, '0')}</Text><Text style={styles.dateMonth}>{new Date(game.startedAt).getMonth() + 1} 月</Text></View>
          <View style={styles.flex}><Text style={type.callout}>{game.name}</Text><Text style={styles.historyMeta}>{game.board} · {game.players.length} 人</Text></View>
          <Text style={[styles.result, game.winner === 'wolf' && styles.resultWolf, game.winner === 'good' && styles.resultGood]}>{winnerLabel(game.winner ?? 'draw').replace('阵营胜利', '胜')}</Text><Icon name="chevron-right" size={15} color={colors.textTertiary} />
        </Pressable>) : <View style={styles.emptyHistory}><Icon name="archive" size={23} color={colors.textTertiary} /><Text style={[type.footnote, styles.flex]}>完成的对局会自动收进复盘。</Text></View>}
      </View>
        </View>
      </View>
      <View style={styles.footer}><Icon name="shield" size={13} color={colors.textTertiary} /><Text style={styles.footerText}>本机存档 · 身份默认隐藏</Text></View>
    </ScrollView>
  </View>;
}

const styles = StyleSheet.create({
  flex: { flex: 1, minWidth: 0 },
  masthead: { paddingHorizontal: spacing.xl, minHeight: 64, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  mastheadRight: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, flexShrink: 0 },
  brand: { flexDirection: 'row', alignItems: 'center', gap: 8, flexShrink: 1 },
  brandName: { fontSize: 16, fontWeight: '700', color: colors.text, letterSpacing: 1 },
  brandRule: { width: 1, height: 12, backgroundColor: colors.line, marginHorizontal: 3 },
  brandNote: { fontSize: 11, color: colors.textSecondary, flexShrink: 1 },
  offline: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  offlineDot: { width: 5, height: 5, borderRadius: 3, backgroundColor: colors.success },
  offlineText: { ...type.caption, fontSize: 10, fontWeight: '400' },
  roleSwitch: { flexDirection: 'row', alignItems: 'center', gap: 4, minHeight: 48, paddingLeft: spacing.sm },
  roleSwitchText: { ...type.caption, color: colors.textSecondary, fontWeight: '500' },
  content: { paddingHorizontal: spacing.xl, paddingTop: spacing.md, paddingBottom: spacing.xl, gap: 28 },
  stack: { gap: 28 },
  dashboard: { flexDirection: 'row', alignItems: 'flex-start', gap: 32 },
  mainColumn: { flex: 1.45, minWidth: 0, gap: 28 },
  sideColumn: { flex: 1, minWidth: 280, maxWidth: 460, gap: 28 },
  heading: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  historyButton: { flexDirection: 'row', alignItems: 'center', gap: 7, minHeight: 48, paddingHorizontal: 12, borderRadius: radius.full, backgroundColor: colors.surfaceAlt },
  historyButtonText: { ...type.footnote, color: colors.text },
  rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.md },
  current: { padding: 20, gap: 8, backgroundColor: colors.surface, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.line },
  statusLine: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  statusDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.textTertiary },
  statusDotActive: { backgroundColor: colors.clay },
  eyebrow: { ...type.caption, color: colors.textSecondary, fontWeight: '500' },
  phase: { ...type.caption, color: colors.clay, flexShrink: 1, textAlign: 'right' },
  currentName: { ...type.title2, marginTop: 8 },
  currentMetrics: { flexDirection: 'row', alignItems: 'center', gap: 22, paddingVertical: 16 },
  metric: { gap: 5 },
  metricValue: { fontSize: 32, lineHeight: 40, color: colors.text, fontWeight: '500', fontVariant: ['tabular-nums'] },
  metricUnit: { fontSize: 16, color: colors.textTertiary },
  metricRule: { height: 38, width: StyleSheet.hairlineWidth, backgroundColor: colors.line },
  metricStage: { ...type.headline, fontSize: 20 },
  resumeActions: { flexDirection: 'row', gap: spacing.sm },
  undo: { minWidth: 72 },
  savedLine: { flexDirection: 'row', gap: 4, justifyContent: 'center', alignItems: 'center', marginTop: 5 },
  savedNote: { ...type.caption, fontSize: 11, fontWeight: '400' },
  newGame: { padding: 20, borderRadius: radius.lg, backgroundColor: colors.surfaceAlt, gap: 20 },
  newGameCompact: { backgroundColor: colors.surface, padding: 0 },
  newGameHead: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  memory: { gap: 6, padding: spacing.lg, backgroundColor: colors.surface, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.line, borderRadius: radius.md },
  memoryHead: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  memoryLabel: { ...type.caption, color: colors.textSecondary },
  memoryTitle: { ...type.headline, marginTop: 2 },
  memoryHint: { ...type.caption, color: colors.textTertiary, marginTop: 2 },
  newTitle: { ...type.title, fontSize: 28, lineHeight: 38, marginTop: 6, marginBottom: 5 },
  cardStack: { width: 76, height: 90, alignItems: 'center', justifyContent: 'center', marginRight: 7 },
  cardBack: { position: 'absolute', width: 54, height: 74, borderRadius: 7, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.surfaceAlt, transform: [{ rotate: '-12deg' }, { translateX: -8 }] },
  cardFront: { width: 54, height: 74, borderRadius: 7, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center', transform: [{ rotate: '6deg' }] },
  preparationLine: { flexDirection: 'row', alignItems: 'center', paddingVertical: 6 },
  preparationStep: { flex: 1, flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 5 },
  stepNumber: { fontSize: 12, fontWeight: '500', color: colors.clay, fontVariant: ['tabular-nums'] },
  stepLabel: { fontSize: 12, lineHeight: 18, color: colors.textSecondary },
  stepRule: { height: StyleSheet.hairlineWidth, minWidth: 5, flex: 1, backgroundColor: colors.line, marginHorizontal: 7 },
  scheme: { minHeight: 72, flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 12, borderTopWidth: StyleSheet.hairlineWidth, borderBottomWidth: StyleSheet.hairlineWidth, borderColor: colors.line },
  schemeLabel: { ...type.caption, fontSize: 11, fontWeight: '400' },
  schemeValue: { ...type.callout, marginTop: 3 },
  schemeEdit: { ...type.footnote, fontSize: 12 },
  recentSection: { gap: 12 },
  sectionTitle: { ...type.headline, fontSize: 16 },
  historyRow: { flexDirection: 'row', alignItems: 'center', gap: 11, paddingVertical: 14, borderBottomWidth: StyleSheet.hairlineWidth, borderColor: colors.lineSoft },
  dateBlock: { width: 36, alignItems: 'center', gap: 2 },
  dateDay: { fontSize: 21, lineHeight: 26, fontWeight: '500', color: colors.textSecondary, fontVariant: ['tabular-nums'] },
  dateMonth: { fontSize: 10, lineHeight: 15, color: colors.textTertiary },
  historyMeta: { ...type.caption, fontSize: 11, fontWeight: '400', marginTop: 3 },
  result: { ...type.caption, fontSize: 11, color: colors.textSecondary, maxWidth: '25%' },
  resultWolf: { color: colors.wolf },
  resultGood: { color: colors.success },
  emptyHistory: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 24, borderTopWidth: StyleSheet.hairlineWidth, borderBottomWidth: StyleSheet.hairlineWidth, borderColor: colors.lineSoft },
  pressed: { opacity: 0.72 },
  footer: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 5, paddingTop: 2 },
  footerText: { ...type.caption, fontSize: 10, fontWeight: '400' },
});
