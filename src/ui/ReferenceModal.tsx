import React, { memo, useCallback, useMemo, useState } from 'react';
import { FlatList, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { BASIC_RULES, HOSTING_STEPS } from '../game/hosting-reference';
import { ruleSummary } from '../game/config';
import { ROLE_REFERENCE, REFERENCE_SOURCES } from '../game/role-reference';
import { ROLES, ROLE_IDS, type Camp, type Role } from '../game/roles';
import type { Game, Rules } from '../game/types';
import { colors, radius, spacing, type } from '../theme';
import { Button, Card, Chip, EmptyState, TopBar } from './kit';
import { CAMP_NAMES, SUPPORT_NAMES, RoleDetail, ReferenceSources as Sources } from './reference/RoleDetail';
import { useResponsive } from './responsive';

type Section = 'process' | 'rules' | 'roles';
type CampFilter = 'all' | Camp;

type Props = {
  visible: boolean;
  onClose: () => void;
  game?: Game;
  initialRole?: Role;
  rules?: Rules;
  roles?: Role[];
};

const SECTIONS: { label: string; value: Section }[] = [
  { label: '流程指南', value: 'process' },
  { label: '基础规则', value: 'rules' },
  { label: '角色图鉴', value: 'roles' },
];
const CAMPS: { label: string; value: CampFilter }[] = [
  { label: '全部', value: 'all' },
  { label: '好人', value: 'good' },
  { label: '狼人', value: 'wolf' },
  { label: '第三方', value: 'third' },
];
const roleKey = (role: Role) => role;

/** Opens above the caller, so looking up a rule never discards setup or an unconfirmed action. */
export function ReferenceModal({ visible, onClose, game, initialRole, rules, roles }: Props) {
  return visible ? <ReferenceContent key={initialRole ?? 'overview'} onClose={onClose} game={game} initialRole={initialRole} rules={rules} roles={roles} /> : null;
}

function ReferenceContent({ onClose, game, initialRole, rules, roles }: Omit<Props, 'visible'>) {
  const responsive = useResponsive();
  const [section, setSection] = useState<Section>(initialRole ? 'roles' : roles !== undefined || game !== undefined ? 'rules' : 'process');
  const [selectedRole, setSelectedRole] = useState<Role | null>(initialRole ?? null);
  const [query, setQuery] = useState('');
  const [camp, setCamp] = useState<CampFilter>('all');
  const [currentOnly, setCurrentOnly] = useState(roles !== undefined || game !== undefined);

  const contextRules = rules ?? game?.rules;
  const contextRoles = useMemo(() => new Set(roles ?? game?.players.map(player => player.role) ?? []), [game?.players, roles]);
  const hasContext = roles !== undefined || game !== undefined;
  const filteredRoles = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase();
    return ROLE_IDS.filter(role => {
      const meta = ROLES[role];
      if (camp !== 'all' && (ROLE_REFERENCE[role].camp ?? meta.camp) !== camp) return false;
      if (currentOnly && !contextRoles.has(role)) return false;
      if (!needle) return true;
      const reference = ROLE_REFERENCE[role];
      return [meta.name, meta.short, meta.tagline, reference.overview, ...reference.skills].join(' ').toLocaleLowerCase().includes(needle);
    });
  }, [camp, contextRoles, currentOnly, query]);
  const openRole = useCallback((role: Role) => setSelectedRole(role), []);
  const renderRole = useCallback(({ item }: { item: Role }) => <RoleRow role={item} onOpen={openRole} />, [openRole]);
  const goBack = () => { if (selectedRole) setSelectedRole(null); else onClose(); };
  const changeSection = (next: Section) => { setSelectedRole(null); setSection(next); };

  return (
    <Modal visible animationType="slide" presentationStyle="fullScreen" onRequestClose={goBack}>
      <SafeAreaView style={styles.root} edges={['top', 'bottom']}>
        <TopBar
          title={selectedRole ? ROLES[selectedRole].name : '规则与角色图鉴'}
          subtitle={selectedRole ? '角色说明' : hasContext && currentOnly ? '本局阵容与桌规' : '离线可查'}
          onBack={goBack}
          right={<Pressable accessibilityRole="button" accessibilityLabel="关闭规则图鉴" onPress={onClose} style={styles.closeButton}><Text style={styles.closeText}>关闭</Text></Pressable>}
        />
        {selectedRole ? <RoleDetail key={selectedRole} role={selectedRole} /> : (
          <>
            <View style={[styles.segments, { width: '100%', maxWidth: responsive.maxContentWidth, alignSelf: 'center', paddingHorizontal: responsive.gutter }]}><ReferenceSegments options={SECTIONS} value={section} onChange={changeSection} /></View>
            {section === 'process' ? (
              <ScrollView contentContainerStyle={[styles.content, { width: '100%', maxWidth: responsive.maxReadingWidth, alignSelf: 'center', paddingHorizontal: responsive.gutter }]} showsVerticalScrollIndicator={false}>
                <Text style={type.footnote}>先确认本桌口径，再按夜间行动、天亮公布、发言投票和出局技能依次处理。首日顺序以开局桌规为准。</Text>
                {HOSTING_STEPS.map((step, index) => (
                  <View key={step.id} style={styles.processStep}>
                    <Text style={styles.stepNumber}>{String(index + 1).padStart(2, '0')}</Text>
                    <View style={styles.stepBody}>
                      <Text accessibilityRole="header" style={type.headline}>{step.title}</Text>
                      <Text style={type.body}>{step.description}</Text>
                      <TextItems items={step.checks} />
                    </View>
                  </View>
                ))}
              </ScrollView>
            ) : null}
            {section === 'rules' ? (
              <ScrollView contentContainerStyle={[styles.content, { width: '100%', maxWidth: responsive.maxReadingWidth, alignSelf: 'center', paddingHorizontal: responsive.gutter }]} showsVerticalScrollIndicator={false}>
                {contextRules ? (
                  <View style={styles.currentRules}>
                    <Text accessibilityRole="header" style={type.title2}>本局采用的桌规</Text>
                    <TextItems items={ruleSummary(contextRules, hasContext ? [...contextRoles] : undefined)} />
                    <Text style={type.footnote}>这里显示当前设置；查阅不会修改桌规。</Text>
                  </View>
                ) : null}
                <Text style={type.footnote}>{hasContext && currentOnly ? '这里只显示本局设置。通用规则说明还涵盖其他阵容，可以按需展开；开局前约定的本桌规则优先。' : '以下用于理解流程。角色版本、技能冲突和遗言等有分歧时，开局前约定的本桌规则优先。'}</Text>
                {hasContext ? <Button title={currentOnly ? '查看全部通用规则' : '只看本局规则'} variant="secondary" onPress={() => setCurrentOnly(value => !value)} /> : null}
                {!hasContext || !currentOnly ? BASIC_RULES.map(rule => (
                  <View key={rule.id} style={styles.guideSection}>
                    <Text accessibilityRole="header" style={type.headline}>{rule.title}</Text>
                    {rule.paragraphs.map((paragraph, index) => <Text key={`${rule.id}-${index}`} style={type.body}>{paragraph}</Text>)}
                  </View>
                )) : null}
                <Sources sourceIds={REFERENCE_SOURCES.map(source => source.id)} />
              </ScrollView>
            ) : null}
            {section === 'roles' ? (
              <>
                <View style={[styles.searchArea, { width: '100%', maxWidth: responsive.maxContentWidth, alignSelf: 'center', paddingHorizontal: responsive.gutter }]}>
                  <View style={styles.searchRow}>
                    <TextInput accessibilityLabel="搜索角色" placeholder="搜索角色名称或技能" placeholderTextColor={colors.textTertiary} value={query} onChangeText={setQuery} style={styles.searchInput} maxLength={60} returnKeyType="search" autoCorrect={false} />
                    {query ? <Button title="清空" small variant="ghost" onPress={() => setQuery('')} /> : null}
                  </View>
                  <View style={styles.filterRow}>
                    <View style={styles.flex}><ReferenceSegments options={CAMPS} value={camp} onChange={setCamp} /></View>
                    {hasContext ? <>
                      <Pressable accessibilityRole="button" accessibilityLabel="只看本局角色" accessibilityState={{ selected: currentOnly }} onPress={() => setCurrentOnly(true)} style={[styles.currentFilter, currentOnly && styles.currentFilterActive]}><Text style={[styles.filterText, currentOnly && styles.filterTextActive]}>本局角色</Text></Pressable>
                      <Pressable accessibilityRole="button" accessibilityLabel="查看全部角色" accessibilityState={{ selected: !currentOnly }} onPress={() => setCurrentOnly(false)} style={[styles.currentFilter, !currentOnly && styles.currentFilterActive]}><Text style={[styles.filterText, !currentOnly && styles.filterTextActive]}>全部角色</Text></Pressable>
                    </> : null}
                  </View>
                  <Text style={type.caption}>{currentOnly ? `本局 ${contextRoles.size}` : `全部 ${ROLE_IDS.length}`} 种 · 当前显示 {filteredRoles.length} 种</Text>
                </View>
                <FlatList
                  data={filteredRoles}
                  keyExtractor={roleKey}
                  renderItem={renderRole}
                  contentContainerStyle={[styles.roleList, { width: '100%', maxWidth: responsive.maxContentWidth, alignSelf: 'center', paddingHorizontal: responsive.gutter }]}
                  keyboardShouldPersistTaps="handled"
                  showsVerticalScrollIndicator={false}
                  initialNumToRender={10}
                  ListEmptyComponent={<Card><EmptyState title="没有找到角色" description="试试角色全名、简称，或清空搜索并切回“全部”。" /></Card>}
                />
              </>
            ) : null}
          </>
        )}
      </SafeAreaView>
    </Modal>
  );
}

const RoleRow = memo(function RoleRow({ role, onOpen }: { role: Role; onOpen: (role: Role) => void }) {
  const meta = ROLES[role];
  const reference = ROLE_REFERENCE[role];
  const camp = reference.camp ?? meta.camp;
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={`查看角色：${meta.name}`} onPress={() => onOpen(role)} style={({ pressed }) => [styles.roleRow, pressed && styles.pressed]}>
      <View style={styles.rowHead}>
        <Text style={[type.headline, styles.flex]}>{meta.name}</Text>
        <Chip tone={camp === 'wolf' ? 'wolf' : camp === 'good' ? 'success' : 'accent'}>{CAMP_NAMES[camp]}</Chip>
        <Text style={styles.chevron}>›</Text>
      </View>
      <Text style={type.footnote}>{reference.overview}</Text>
      <Text style={styles.supportLabel}>{SUPPORT_NAMES[reference.automation]}{reference.needsTableAgreement ? ' · 先确认版本' : ''}</Text>
    </Pressable>
  );
});

function TextItems({ items }: { items: string[] }) {
  return <View style={styles.textItems}>{items.map((item, index) => <View key={`${index}-${item}`} style={styles.textItem}><Text style={styles.dot}>·</Text><Text style={[type.body, styles.flex]}>{item}</Text></View>)}</View>;
}

function ReferenceSegments<T extends string>({ options, value, onChange }: { options: { label: string; value: T }[]; value: T; onChange: (value: T) => void }) {
  return <View style={styles.segmentTrack}>{options.map(option => <Pressable key={option.value} accessibilityRole="button" accessibilityLabel={option.label} accessibilityState={{ selected: value === option.value }} onPress={() => onChange(option.value)} style={({ pressed }) => [styles.segmentButton, value === option.value && styles.segmentSelected, pressed && styles.pressed]}><Text style={[styles.segmentLabel, value === option.value && styles.segmentLabelSelected]}>{option.label}</Text></Pressable>)}</View>;
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.surface },
  flex: { flex: 1, minWidth: 0 },
  closeButton: { minHeight: 48, minWidth: 48, justifyContent: 'center', alignItems: 'flex-end' },
  closeText: { ...type.callout, color: colors.accent, fontWeight: '600' },
  segments: { paddingHorizontal: spacing.lg, paddingTop: spacing.md, paddingBottom: spacing.sm },
  segmentTrack: { flexDirection: 'row', padding: spacing.xs, gap: spacing.xs, backgroundColor: colors.surfaceAlt, borderRadius: radius.md },
  segmentButton: { flex: 1, minHeight: 48, paddingHorizontal: spacing.xs, alignItems: 'center', justifyContent: 'center', borderRadius: radius.sm },
  segmentSelected: { backgroundColor: colors.surface },
  segmentLabel: { ...type.callout, fontSize: 13, textAlign: 'center', color: colors.textSecondary },
  segmentLabelSelected: { color: colors.accent, fontWeight: '600' },
  content: { padding: spacing.lg, paddingBottom: spacing.huge, gap: spacing.xl },
  guideSection: { gap: spacing.md, paddingTop: spacing.lg, borderTopWidth: StyleSheet.hairlineWidth, borderColor: colors.line },
  currentRules: { gap: spacing.md, padding: spacing.lg, backgroundColor: colors.surfaceAlt, borderRadius: radius.sm },
  processStep: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.md, paddingTop: spacing.lg, borderTopWidth: StyleSheet.hairlineWidth, borderColor: colors.line },
  stepNumber: { ...type.numeric, minWidth: 28, fontSize: 16, color: colors.textTertiary },
  stepBody: { flex: 1, minWidth: 0, gap: spacing.md },
  textItems: { gap: spacing.sm },
  textItem: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm },
  dot: { ...type.body, color: colors.textTertiary },
  searchArea: { paddingHorizontal: spacing.lg, paddingTop: spacing.sm, paddingBottom: spacing.md, gap: spacing.md },
  searchRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  searchInput: { flex: 1, minHeight: 48, paddingHorizontal: spacing.md, borderRadius: radius.md, backgroundColor: colors.surface, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.line, color: colors.text, fontSize: 16 },
  filterRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: spacing.sm },
  currentFilter: { minHeight: 48, paddingHorizontal: spacing.md, borderRadius: radius.sm, backgroundColor: colors.surface, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.line, alignItems: 'center', justifyContent: 'center' },
  currentFilterActive: { backgroundColor: colors.accentDim, borderColor: colors.accent },
  filterText: { ...type.callout, fontSize: 13, color: colors.textSecondary },
  filterTextActive: { color: colors.accent },
  roleList: { paddingHorizontal: spacing.lg, paddingBottom: spacing.huge },
  roleRow: { paddingVertical: spacing.lg, minHeight: 100, borderTopWidth: StyleSheet.hairlineWidth, borderColor: colors.line, gap: spacing.sm },
  rowHead: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  chevron: { fontSize: 24, color: colors.textTertiary },
  supportLabel: { ...type.caption, color: colors.textSecondary },
  pressed: { opacity: 0.65 },
});
