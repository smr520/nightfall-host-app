import React, { useState } from 'react';
import {
  Animated, KeyboardAvoidingView, Modal, Platform, Pressable as NativePressable, ScrollView, StyleSheet, Switch, Text, View, useWindowDimensions, type StyleProp, type ViewStyle,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, hitSlop, radius, spacing, type } from '../theme';
import { ROLES, isWolf } from '../game/roles';
import type { Game, Player } from '../game/types';
import { MotionPressable as Pressable, useAnimatedScalar, usePageEnter, useSheetMotion } from './motion';
import { Icon, type IconName } from './Icon';
import { clampFontScale, useResponsive } from './responsive';

export function Screen({ children, style }: { children: React.ReactNode; style?: StyleProp<ViewStyle> }) {
  return <View style={[kit.screen, style]}>{children}</View>;
}

export function TopBar({ title, subtitle, onBack, right, large }: { title: string; subtitle?: string; onBack?: () => void; right?: React.ReactNode; large?: string }) {
  const responsive = useResponsive();
  return (
    <View style={[kit.topBar, { paddingHorizontal: responsive.gutter }]}>
      <View style={[kit.topBarInner, { maxWidth: responsive.maxContentWidth }]}>
        <View style={kit.topRow}>
          {onBack ? (
            <Pressable accessibilityRole="button" accessibilityLabel="返回" hitSlop={hitSlop} onPress={onBack} style={kit.backButton}>
              <Icon name="arrow-left" size={21} />
            </Pressable>
          ) : null}
          <View style={kit.topCenter}>
            <Text style={[kit.topTitle, large && kit.topEyebrow]} numberOfLines={1}>{title}</Text>
            {subtitle && !large ? <Text style={kit.topSubtitle} numberOfLines={1}>{subtitle}</Text> : null}
          </View>
          <View style={kit.topRight}>{right}</View>
        </View>
        {large ? <View style={kit.largeHeader}><Text accessibilityRole="header" style={kit.largeTitle}>{large}</Text>{subtitle ? <Text style={kit.largeSubtitle}>{subtitle}</Text> : null}</View> : null}
      </View>
    </View>
  );
}

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';
export function Button({ title, onPress, variant = 'primary', disabled, selected, small, style }: { title: string; onPress: () => void; variant?: ButtonVariant; disabled?: boolean; selected?: boolean; small?: boolean; style?: StyleProp<ViewStyle> }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={title}
      accessibilityState={{ disabled: !!disabled, selected: !!selected }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [kit.button, small && kit.buttonSmall, kit[`button_${variant}`], disabled && kit.buttonDisabled, pressed && !disabled && kit.pressed, style]}
    >
      <Text style={[kit.buttonText, variant === 'primary' && kit.buttonTextPrimary, variant === 'ghost' && kit.buttonTextGhost, variant === 'danger' && kit.buttonTextDanger]}>{title}</Text>
    </Pressable>
  );
}

export function Card({ children, style }: { children: React.ReactNode; style?: StyleProp<ViewStyle> }) {
  return <View style={[kit.card, style]}>{children}</View>;
}

export function SectionLabel({ children, right }: { children: React.ReactNode; right?: React.ReactNode }) {
  return <View style={kit.sectionLabel}><Text style={type.caption}>{children}</Text>{right}</View>;
}

export function Divider({ inset = 0 }: { inset?: number }) {
  return <View style={[kit.divider, { marginLeft: inset }]} />;
}

export function Chip({ children, tone = 'neutral' }: { children: React.ReactNode; tone?: 'neutral' | 'accent' | 'wolf' | 'success' | 'danger' }) {
  return <View style={[kit.chip, kit[`chip_${tone}`]]}><Text style={[kit.chipText, kit[`chipText_${tone}`]]}>{children}</Text></View>;
}

export function Segmented<T extends string>({ options, value, onChange }: { options: { label: string; value: T }[]; value: T; onChange: (value: T) => void }) {
  const [width, setWidth] = useState(0);
  const activeIndex = Math.max(0, options.findIndex(option => option.value === value));
  const itemWidth = options.length ? Math.max(0, width - 6) / options.length : 0;
  const x = useAnimatedScalar(activeIndex * itemWidth);
  return (
    <View style={kit.segmented} onLayout={event => setWidth(event.nativeEvent.layout.width)}>
      {width > 0 ? <Animated.View pointerEvents="none" style={[kit.segmentIndicator, { width: itemWidth, transform: [{ translateX: x }] }]} /> : null}
      {options.map(option => {
        const active = option.value === value;
        return (
          <Pressable key={option.value} accessibilityRole="button" accessibilityState={{ selected: active }} accessibilityLabel={option.label} onPress={() => onChange(option.value)} style={[kit.segment, active && width === 0 && kit.segmentActive]}>
            <Text style={[kit.segmentText, active && kit.segmentTextActive]}>{option.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export function Sheet({ visible, onClose, onRequestClose, contentKey, title, subtitle, children, footer }: { visible: boolean; onClose: () => void; onRequestClose?: () => void; contentKey?: string; title: string; subtitle?: string; children: React.ReactNode; footer?: React.ReactNode }) {
  const motion = useSheetMotion(visible);
  const responsive = useResponsive();
  return (
    <Modal visible={motion.present} transparent animationType="none" onRequestClose={onRequestClose ?? onClose}>
      <KeyboardAvoidingView style={[kit.sheetRoot, responsive.isTablet && kit.sheetRootTablet]} behavior={Platform.OS === 'android' ? 'height' : 'padding'}>
        <Animated.View style={[kit.sheetBackdrop, motion.backdropStyle]}><Pressable style={StyleSheet.absoluteFill} disabled={!visible} onPress={onClose} accessibilityRole="button" accessibilityLabel="关闭弹层" /></Animated.View>
        <Animated.View style={[kit.sheet, responsive.isTablet && kit.sheetTablet, motion.panelStyle]} pointerEvents={visible ? 'auto' : 'none'} accessibilityViewIsModal accessibilityElementsHidden={!visible} importantForAccessibility={visible ? 'auto' : 'no-hide-descendants'}>
          <SafeAreaView edges={responsive.isTablet ? [] : ['bottom']} style={kit.sheetSafeArea}>
          <View style={kit.sheetHandle} />
          <View style={[kit.sheetHead, { paddingHorizontal: responsive.gutter }]}>
            <View style={kit.flex}>
              <Text style={type.title2}>{title}</Text>
              {subtitle ? <Text style={[type.footnote, kit.sheetSubtitle]}>{subtitle}</Text> : null}
            </View>
            <Pressable accessibilityRole="button" accessibilityLabel="关闭" onPress={onClose} hitSlop={hitSlop} style={kit.sheetCloseButton}><Icon name="close" size={20} /></Pressable>
          </View>
          <ScrollView key={contentKey} contentContainerStyle={[kit.sheetBody, { paddingHorizontal: responsive.gutter, maxWidth: responsive.maxReadingWidth + responsive.gutter * 2, width: '100%', alignSelf: 'center' }]} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag">{children}</ScrollView>
          {footer ? <View style={[kit.sheetFooter, { paddingHorizontal: responsive.gutter }]}>{footer}</View> : null}
          </SafeAreaView>
        </Animated.View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

export function SeatGrid({ game, selected, onSelect, showRoles, filter, multi = [], disabled = false, tapDead = false }: {
  game: Game;
  selected: number | null;
  onSelect: (seat: number) => void;
  showRoles: boolean;
  filter?: (player: Player) => boolean;
  multi?: number[];
  disabled?: boolean;
  tapDead?: boolean;
}) {
  const players = game.players.filter(filter ?? (() => true));
  const [gridWidth, setGridWidth] = useState(0);
  const { fontScale } = useWindowDimensions();
  const supportedFontScale = clampFontScale(fontScale);
  const minSeatWidth = Math.max(66, Math.ceil(66 * supportedFontScale));
  const seatMinHeight = Math.round(92 + Math.max(0, supportedFontScale - 1) * 22);
  const maxColumns = gridWidth >= 900 ? 8 : gridWidth >= 600 ? 6 : 4;
  const columns = gridWidth ? Math.max(1, Math.min(maxColumns, Math.floor((gridWidth + spacing.sm) / (minSeatWidth + spacing.sm)))) : 4;
  const seatWidth = gridWidth ? (gridWidth - spacing.sm * (columns - 1)) / columns : undefined;
  return (
    <View style={kit.seatGrid} onLayout={event => setGridWidth(event.nativeEvent.layout.width)}>
      {players.map(p => {
        const isSelected = selected === p.seat || multi.includes(p.seat);
        const dead = !p.alive;
        const seatDisabled = disabled || (dead && !tapDead);
        return (
          <NativePressable
            key={p.seat}
            accessibilityRole="button"
            accessibilityLabel={`${p.seat}号 ${p.alive ? '存活' : '出局'}`}
            accessibilityState={{ selected: isSelected, disabled: seatDisabled }}
            disabled={seatDisabled}
            onPress={() => onSelect(p.seat)}
            style={({ pressed }) => [kit.seat, { minHeight: seatMinHeight }, seatWidth ? { width: seatWidth } : kit.seatInitial, dead && kit.seatDead, isSelected && kit.seatSelected, pressed && !seatDisabled && kit.pressed]}
          >
            {p.seat === game.sheriff ? <Text style={[kit.badgeSheriff, isSelected && kit.seatSelectedText]}>警</Text> : null}
            {p.exposed ? <Text style={[kit.badgeExposed, isSelected && kit.seatSelectedText]}>痴</Text> : null}
            <Text style={[kit.seatNumber, dead && kit.seatNumberDead, isSelected && kit.seatSelectedText]}>{String(p.seat).padStart(2, '0')}</Text>
            <Text style={[kit.seatName, isSelected && kit.seatSelectedText]} numberOfLines={1}>{p.name === '未命名玩家' ? '未命名' : p.name}</Text>
            {showRoles ? <Text style={[kit.seatRole, isWolf(p.role) && kit.seatRoleWolf, isSelected && kit.seatSelectedText]} numberOfLines={1}>{ROLES[p.role].short}</Text> : <Text style={[kit.seatState, dead && kit.seatStateDead, isSelected && kit.seatSelectedText]}>{dead ? '出局' : '存活'}</Text>}
          </NativePressable>
        );
      })}
    </View>
  );
}

export function EmptyState({ title, description }: { title: string; description: string }) {
  return <View style={kit.empty}><Text style={type.headline}>{title}</Text><Text style={[type.footnote, kit.emptyText]}>{description}</Text></View>;
}

export function PageTransition({ pageKey, direction = 1, children }: { pageKey: string; direction?: number; children: React.ReactNode }) {
  const style = usePageEnter(pageKey, direction);
  return <Animated.View style={[kit.flex, style]}>{children}</Animated.View>;
}

export type TabItem<T extends string> = { key: T; label: string; hint?: string; icon?: IconName };
const tabIcons: Record<string, IconName> = { home: 'home', player: 'users', skills: 'book', personalization: 'sliders', host: 'mic', seats: 'users', log: 'note', more: 'more' };

export function TabBar<T extends string>({ tabs, value, onChange, disabled = false }: { tabs: TabItem<T>[]; value: T; onChange: (key: T) => void; disabled?: boolean }) {
  const [width, setWidth] = useState(0);
  const responsive = useResponsive();
  const itemWidth = tabs.length ? Math.max(0, width - spacing.sm * 2) / tabs.length : 0;
  const activeIndex = Math.max(0, tabs.findIndex(tab => tab.key === value));
  const x = useAnimatedScalar(spacing.sm + itemWidth * (activeIndex + 0.5) - 10);
  return (
    <View style={[kit.tabBarWrap, { maxWidth: responsive.isTablet ? 620 : undefined }]}>
      <View style={kit.tabBar} onLayout={event => setWidth(event.nativeEvent.layout.width)}>
        {width > 0 ? <Animated.View pointerEvents="none" style={[kit.tabIndicator, { transform: [{ translateX: x }] }]} /> : null}
        {tabs.map(tab => {
          const active = tab.key === value;
          return (
            <Pressable key={tab.key} accessibilityRole="tab" accessibilityState={{ selected: active, disabled }} accessibilityLabel={tab.label} disabled={disabled} onPress={() => onChange(tab.key)} style={[kit.tabItem, disabled && kit.rowDisabled]}>
              <Icon name={tab.icon ?? tabIcons[tab.key] ?? 'more'} size={22} color={active ? colors.text : colors.textTertiary} strokeWidth={active ? 2 : 1.6} />
              <Text style={[kit.tabLabel, active && kit.tabLabelActive]}>{tab.label}</Text>
              {tab.hint ? <Text style={kit.tabHint}>{tab.hint}</Text> : null}
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

export function ListRow({ label, hint, onPress, disabled, tone, value }: { label: string; hint?: string; onPress: () => void; disabled?: boolean; tone?: 'danger'; value?: string }) {
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={label} accessibilityState={{ disabled: !!disabled }} disabled={disabled} onPress={onPress} style={({ pressed }) => [kit.listRow, pressed && !disabled && kit.pressed, disabled && kit.rowDisabled]}>
      <View style={kit.flex}>
        <Text style={[type.body, tone === 'danger' && kit.dangerText]}>{label}</Text>
        {hint ? <Text style={type.footnote}>{hint}</Text> : null}
      </View>
      {value ? <Text style={kit.rowValue}>{value}</Text> : null}
      <Icon name="chevron-right" size={17} color={colors.textTertiary} />
    </Pressable>
  );
}

export function SwitchRow({ label, hint, value, onChange }: { label: string; hint?: string; value: boolean; onChange: (value: boolean) => void }) {
  return (
    <View style={kit.switchRow}>
      <View style={kit.flex}>
        <Text style={type.body}>{label}</Text>
        {hint ? <Text style={type.footnote}>{hint}</Text> : null}
      </View>
      <Switch value={value} onValueChange={onChange} accessibilityLabel={label} trackColor={{ false: colors.surfaceHigh, true: colors.accentDim }} thumbColor={value ? colors.accent : colors.textTertiary} />
    </View>
  );
}

export function InlineError({ children }: { children: React.ReactNode }) {
  return <View accessibilityRole="alert" style={kit.inlineError}><Text style={kit.inlineErrorText}>{children}</Text></View>;
}

export const kit = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  flex: { flex: 1 },
  topBar: { paddingHorizontal: spacing.xl, paddingTop: spacing.sm, paddingBottom: spacing.sm, backgroundColor: colors.bg },
  topBarInner: { width: '100%', alignSelf: 'center' },
  topRow: { minHeight: 52, flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  backButton: { width: 48, minHeight: 48, alignItems: 'center', justifyContent: 'center', borderRadius: radius.full, backgroundColor: colors.surfaceAlt, marginLeft: -8, marginRight: 4 },
  topCenter: { flex: 1, minWidth: 0, alignItems: 'flex-start' },
  topTitle: { ...type.headline, fontSize: 18 },
  topSubtitle: { ...type.footnote, fontSize: 12, marginTop: 1 },
  topRight: { minWidth: 0, maxWidth: '48%', flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: spacing.sm, flexShrink: 1 },
  topEyebrow: { ...type.caption, color: colors.textSecondary },
  largeHeader: { paddingTop: spacing.lg, paddingBottom: spacing.sm, gap: 6 },
  largeTitle: { ...type.title },
  largeSubtitle: { ...type.footnote },

  button: { minHeight: 54, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center', paddingHorizontal: spacing.lg, paddingVertical: 14 },
  buttonSmall: { minHeight: 48, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderRadius: radius.sm },
  button_primary: { backgroundColor: colors.accent },
  button_secondary: { backgroundColor: colors.surfaceAlt },
  button_ghost: { backgroundColor: 'transparent' },
  button_danger: { backgroundColor: colors.dangerDim },
  buttonDisabled: { opacity: 0.34 },
  buttonText: { ...type.headline, fontSize: 15, textAlign: 'center', flexShrink: 1 },
  buttonTextPrimary: { color: colors.onAccent, fontWeight: '700' },
  buttonTextGhost: { color: colors.accent },
  buttonTextDanger: { color: colors.danger },
  pressed: { opacity: 0.72 },

  card: { backgroundColor: colors.surfaceAlt, borderRadius: radius.lg, padding: spacing.lg },
  sectionLabel: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.xs, marginTop: spacing.sm },
  divider: { height: StyleSheet.hairlineWidth, backgroundColor: colors.line, marginVertical: spacing.sm },

  chip: { borderRadius: 5, paddingHorizontal: 7, paddingVertical: 3, alignSelf: 'flex-start', maxWidth: '100%', backgroundColor: colors.surfaceAlt },
  chipText: { fontSize: 12, lineHeight: 18, fontWeight: '600', color: colors.textSecondary },
  chip_neutral: { backgroundColor: colors.surfaceAlt },
  chip_accent: { backgroundColor: colors.accentDim },
  chip_wolf: { backgroundColor: colors.wolfDim },
  chip_success: { backgroundColor: colors.successDim },
  chip_danger: { backgroundColor: colors.dangerDim },
  chipText_neutral: { color: colors.textSecondary },
  chipText_accent: { color: colors.accent },
  chipText_wolf: { color: colors.wolf },
  chipText_success: { color: colors.success },
  chipText_danger: { color: colors.danger },

  segmented: { flexDirection: 'row', backgroundColor: colors.surfaceAlt, borderRadius: radius.md, padding: 3 },
  segmentIndicator: { position: 'absolute', left: 3, top: 3, bottom: 3, backgroundColor: colors.surface, borderRadius: 9, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.line },
  segment: { flex: 1, minHeight: 48, paddingHorizontal: spacing.xs, paddingVertical: spacing.sm, alignItems: 'center', justifyContent: 'center', borderRadius: 6 },
  segmentActive: { backgroundColor: colors.surface },
  segmentText: { fontSize: 14, lineHeight: 20, textAlign: 'center', fontWeight: '600', color: colors.textSecondary },
  segmentTextActive: { color: colors.text },

  sheetRoot: { flex: 1, justifyContent: 'flex-end' },
  sheetRootTablet: { justifyContent: 'center', padding: spacing.xl },
  sheetBackdrop: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: colors.overlay },
  sheet: { maxHeight: '88%', backgroundColor: colors.bgSoft, borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl, borderTopWidth: StyleSheet.hairlineWidth, borderColor: colors.line },
  sheetTablet: { width: '92%', maxWidth: 760, borderRadius: radius.xl, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.line },
  sheetSafeArea: { flexShrink: 1 },
  sheetHandle: { width: 36, height: 4, borderRadius: 2, backgroundColor: colors.surfaceHigh, alignSelf: 'center', marginTop: spacing.sm },
  sheetHead: { flexDirection: 'row', alignItems: 'flex-start', paddingHorizontal: spacing.lg, paddingTop: spacing.lg, paddingBottom: spacing.md, gap: spacing.md },
  sheetSubtitle: { marginTop: 2 },
  sheetCloseButton: { minHeight: 48, minWidth: 48, alignItems: 'center', justifyContent: 'center', marginTop: -spacing.sm, borderRadius: radius.full, backgroundColor: colors.surfaceAlt },
  sheetClose: { color: colors.accent, fontSize: 15, fontWeight: '600' },
  sheetBody: { paddingHorizontal: spacing.lg, paddingBottom: spacing.xl, gap: spacing.md },
  sheetFooter: { padding: spacing.lg, paddingTop: spacing.md, borderTopWidth: StyleSheet.hairlineWidth, borderColor: colors.line, gap: spacing.sm },

  seatGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  seat: { minHeight: 92, paddingHorizontal: 3, paddingTop: 12, paddingBottom: spacing.sm, borderRadius: radius.md, backgroundColor: colors.surfaceAlt, borderWidth: 1, borderColor: colors.surfaceAlt, alignItems: 'center', justifyContent: 'center', gap: 2 },
  seatInitial: { width: '22%' },
  seatSelected: { backgroundColor: colors.accent, borderColor: colors.accent },
  seatDead: { backgroundColor: colors.surface, borderStyle: 'dashed', borderColor: colors.line },
  seatNumber: { ...type.numeric, fontSize: 26, lineHeight: 32 },
  seatNumberDead: { textDecorationLine: 'line-through', color: colors.textTertiary },
  seatName: { fontSize: 12, lineHeight: 18, color: colors.textSecondary, maxWidth: '95%' },
  seatState: { fontSize: 11, lineHeight: 16, color: colors.textTertiary, fontWeight: '500' },
  seatStateDead: { color: colors.danger },
  seatRole: { fontSize: 12, lineHeight: 18, color: colors.success, fontWeight: '600' },
  seatRoleWolf: { color: colors.wolf },
  seatSelectedText: { color: colors.onAccent },
  badgeSheriff: { position: 'absolute', top: 4, left: 5, fontSize: 11, fontWeight: '700', color: colors.gold },
  badgeExposed: { position: 'absolute', top: 4, right: 5, fontSize: 11, fontWeight: '700', color: colors.danger },

  empty: { alignItems: 'flex-start', gap: spacing.sm, paddingVertical: spacing.xl },
  emptyText: { maxWidth: 360 },
  inlineError: { backgroundColor: colors.dangerDim, borderRadius: radius.md, padding: spacing.md },
  inlineErrorText: { color: colors.danger, fontSize: 13, lineHeight: 19 },

  tabBarWrap: { width: '100%', alignSelf: 'center', borderTopWidth: StyleSheet.hairlineWidth, borderColor: colors.lineSoft, backgroundColor: colors.bgSoft },
  tabBar: { flexDirection: 'row', backgroundColor: colors.bgSoft, paddingHorizontal: spacing.sm, paddingBottom: spacing.xs },
  tabItem: { flex: 1, minHeight: 68, alignItems: 'center', justifyContent: 'center', gap: 4, paddingHorizontal: 2, paddingVertical: spacing.sm },
  tabIndicator: { position: 'absolute', top: 0, left: 0, width: 20, height: 2, borderBottomLeftRadius: 2, borderBottomRightRadius: 2, backgroundColor: colors.accent },
  tabLabel: { fontSize: 11, lineHeight: 17, textAlign: 'center', fontWeight: '500', color: colors.textTertiary },
  tabLabelActive: { color: colors.accent },
  tabHint: { fontSize: 11, textAlign: 'center', color: colors.textTertiary },
  listRow: { flexDirection: 'row', alignItems: 'center', minHeight: 64, paddingVertical: spacing.md, gap: spacing.md, borderBottomWidth: StyleSheet.hairlineWidth, borderColor: colors.lineSoft },
  rowDisabled: { opacity: 0.4 },
  rowValue: { ...type.footnote, fontSize: 13, maxWidth: '36%', textAlign: 'right', color: colors.textTertiary },
  dangerText: { color: colors.danger },
  chevron: { color: colors.textTertiary, fontSize: 20 },
  switchRow: { flexDirection: 'row', alignItems: 'center', minHeight: 56, paddingVertical: spacing.sm, gap: spacing.md },
});
