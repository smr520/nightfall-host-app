import React, { memo, useCallback, useEffect, useMemo, useState } from 'react';
import { BackHandler, FlatList, StyleSheet, Text, TextInput, View } from 'react-native';
import { ROLE_REFERENCE } from '../game/role-reference';
import { ROLES, ROLE_IDS, type Camp, type Role } from '../game/roles';
import { CARD_TYPE_LABEL, ROLE_CATALOG, type CardType, cardTypeLabel } from '../game/role-catalog';
import { colors, radius, spacing, type } from '../theme';
import { Button, EmptyState, Sheet, TopBar } from './kit';
import { Icon } from './Icon';
import { MotionPressable as Pressable } from './motion';
import { CAMP_NAMES, RoleDetail } from './reference/RoleDetail';
import { useResponsive } from './responsive';

type CampFilter = 'all' | Camp;
type CardTypeFilter = 'all' | CardType;
const camps: { value: CampFilter; label: string }[] = [{ value: 'all', label: '全部' }, { value: 'good', label: '好人' }, { value: 'wolf', label: '狼人' }, { value: 'third', label: '第三方' }];
const cardTypes: CardType[] = ['base', 'special', 'awakened', 'status'];
const roleKey = (role: Role) => role;

export function SkillTableScreen({ onOpenGuide }: { onOpenGuide: () => void }) {
  const [query, setQuery] = useState('');
  const [camp, setCamp] = useState<CampFilter>('all');
  const [cardType, setCardType] = useState<CardTypeFilter>('all');
  const [typeSheetOpen, setTypeSheetOpen] = useState(false);
  const [selectedRole, setSelectedRole] = useState<Role | null>(null);
  const responsive = useResponsive();
  useEffect(() => {
    if (!selectedRole) return;
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => { setSelectedRole(null); return true; });
    return () => subscription.remove();
  }, [selectedRole]);

  const filteredRoles = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase();
    return ROLE_IDS.filter(role => {
      const meta = ROLES[role];
      const reference = ROLE_REFERENCE[role];
      return (camp === 'all' || (reference.camp ?? meta.camp) === camp)
        && (cardType === 'all' || ROLE_CATALOG[role].type === cardType)
        && (!needle || [meta.name, meta.short, reference.overview, reference.timing, ...reference.skills, ...reference.cautions].join(' ').toLocaleLowerCase().includes(needle));
    });
  }, [camp, cardType, query]);
  const openRole = useCallback((role: Role) => setSelectedRole(role), []);
  const renderRole = useCallback(({ item }: { item: Role }) => <SkillRow role={item} onOpen={openRole} />, [openRole]);

  if (selectedRole) return <View style={styles.root}>
    <TopBar title={ROLES[selectedRole].name} subtitle="卡牌技能" onBack={() => setSelectedRole(null)} />
    <RoleDetail key={selectedRole} role={selectedRole} initialExpanded={false} />
  </View>;

  return <View style={styles.root}>
    <TopBar title="技能表" large="卡牌技能" right={<Button title="规则与流程" small variant="ghost" onPress={onOpenGuide} />} />
    <View style={styles.controls}>
      <View style={[styles.controlsInner, { maxWidth: responsive.maxContentWidth, alignSelf: 'center', paddingHorizontal: responsive.gutter }]}>
      <View style={styles.searchRow}>
        <Icon name="search" size={18} color={colors.textTertiary} />
        <TextInput accessibilityLabel="搜索卡牌技能" value={query} onChangeText={setQuery} placeholder="搜索角色、技能或限制" placeholderTextColor={colors.textTertiary} maxLength={60} autoCorrect={false} returnKeyType="search" style={styles.searchInput} />
        {query ? <Button title="清空搜索" small variant="ghost" onPress={() => setQuery('')} /> : null}
      </View>
      <View style={styles.filters}>{camps.map(item => <Pressable key={item.value} accessibilityRole="button" accessibilityLabel={`技能阵营：${item.label}`} accessibilityState={{ selected: camp === item.value }} onPress={() => setCamp(item.value)} style={[styles.filter, camp === item.value && styles.filterActive]}><Text style={[styles.filterText, camp === item.value && styles.filterTextActive]}>{item.label}</Text></Pressable>)}</View>
      <View style={styles.typeFilterRow}>
        <View style={styles.flex}><Text style={type.footnote}>{cardType === 'all' ? '全部卡牌类型' : `已筛选：${cardTypeLabel(cardType)}`}</Text><Text style={type.caption}>共 {ROLE_IDS.length} 种 · 显示 {filteredRoles.length} 种</Text></View>
        <Button title="筛选卡牌类型" small variant="ghost" onPress={() => setTypeSheetOpen(true)} />
      </View>
      </View>
    </View>
    <FlatList key={responsive.listColumns === 2 ? 'two' : 'one'} numColumns={responsive.listColumns} columnWrapperStyle={responsive.listColumns === 2 ? styles.columns : undefined} data={filteredRoles} keyExtractor={roleKey} renderItem={renderRole} contentContainerStyle={[styles.list, { paddingHorizontal: responsive.gutter, width: '100%', maxWidth: responsive.maxContentWidth, alignSelf: 'center' }]} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false} initialNumToRender={10} ListEmptyComponent={<EmptyState title="没有找到卡牌" description="试试“查验”“开枪”等技能，或清空搜索并切回全部。" />} ListFooterComponent={<Text style={styles.footer}>角色规则可能随版本变化，开局前按本桌约定确认。</Text>} />
    <Sheet visible={typeSheetOpen} onClose={() => setTypeSheetOpen(false)} title="筛选卡牌类型" subtitle="类型只用于整理卡牌，不代表软件已自动实现全部技能" footer={<Button title="完成筛选" onPress={() => setTypeSheetOpen(false)} />}>
      <Pressable accessibilityRole="button" accessibilityLabel="技能类型：全部" accessibilityState={{ selected: cardType === 'all' }} onPress={() => setCardType('all')} style={[styles.typeOption, cardType === 'all' && styles.typeOptionActive]}><Text style={styles.typeOptionText}>全部卡牌</Text></Pressable>
      {cardTypes.map(value => <Pressable key={value} accessibilityRole="button" accessibilityLabel={`技能类型：${CARD_TYPE_LABEL[value]}`} accessibilityState={{ selected: cardType === value }} onPress={() => setCardType(value)} style={[styles.typeOption, cardType === value && styles.typeOptionActive]}><Text style={styles.typeOptionText}>{CARD_TYPE_LABEL[value]}</Text></Pressable>)}
    </Sheet>
  </View>;
}

const SkillRow = memo(function SkillRow({ role, onOpen }: { role: Role; onOpen: (role: Role) => void }) {
  const meta = ROLES[role];
  const reference = ROLE_REFERENCE[role];
  const camp = reference.camp ?? meta.camp;
  return <Pressable accessibilityRole="button" accessibilityLabel={`查看技能：${meta.name}`} onPress={() => onOpen(role)} style={({ pressed }) => [styles.row, pressed && styles.pressed]}>
    <View accessible={false} style={[styles.cardMark, camp === 'wolf' && styles.cardMarkWolf]}><Text style={[styles.cardMarkText, camp === 'wolf' && styles.wolf]}>{meta.short}</Text><View style={styles.cardMarkLine} /></View>
    <View style={styles.rowBody}>
      <View style={styles.rowHead}><Text style={[type.headline, styles.flex]}>{meta.name}</Text><Text style={[styles.camp, camp === 'wolf' && styles.wolf]}>{CAMP_NAMES[camp].replace('阵营', '')}</Text><Icon name="chevron-right" size={16} color={colors.textTertiary} /></View>
      <View style={styles.metaRow}><Text style={styles.typeLabel}>{cardTypeLabel(ROLE_CATALOG[role].type)}</Text>{ROLE_CATALOG[role].variant ? <Text style={styles.variant}>{ROLE_CATALOG[role].variant}</Text> : null}</View>
      <Text style={styles.skill} numberOfLines={2}>{reference.skills[0]}</Text>
      <Text style={styles.timing} numberOfLines={1}>时机 · {reference.timing}</Text>
    </View>
  </Pressable>;
});

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.surface },
  flex: { flex: 1, minWidth: 0 },
  controls: { paddingTop: spacing.md, paddingBottom: spacing.md },
  controlsInner: { width: '100%', gap: spacing.md },
  searchRow: { flexDirection: 'row', alignItems: 'center', paddingLeft: spacing.lg, borderRadius: radius.md, backgroundColor: colors.surfaceAlt },
  searchInput: { flex: 1, minWidth: 0, minHeight: 50, paddingHorizontal: spacing.sm, fontSize: 15, color: colors.text },
  filters: { flexDirection: 'row', borderBottomWidth: StyleSheet.hairlineWidth, borderColor: colors.line },
  typeFilterRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm, paddingTop: spacing.sm },
  filter: { flex: 1, minHeight: 48, alignItems: 'center', justifyContent: 'center', borderBottomWidth: 2, borderBottomColor: 'transparent' },
  filterActive: { borderBottomColor: colors.text },
  filterText: { ...type.callout, color: colors.textSecondary },
  filterTextActive: { color: colors.text, fontWeight: '700' },
  list: { paddingBottom: spacing.huge },
  columns: { gap: spacing.xl },
  row: { flex: 1, minWidth: 0, flexDirection: 'row', minHeight: 140, paddingVertical: spacing.lg, gap: spacing.lg, borderTopWidth: StyleSheet.hairlineWidth, borderColor: colors.lineSoft },
  cardMark: { width: 42, height: 56, marginTop: 3, borderWidth: 1, borderColor: colors.line, borderRadius: 5, alignItems: 'center', justifyContent: 'center', gap: 7, backgroundColor: colors.surfaceAlt },
  cardMarkWolf: { backgroundColor: colors.wolfDim, borderColor: colors.wolfDim },
  cardMarkText: { fontSize: 18, lineHeight: 23, fontWeight: '600', color: colors.text },
  cardMarkLine: { height: 1, width: 12, backgroundColor: colors.line },
  rowBody: { flex: 1, minWidth: 0, gap: 4 },
  rowHead: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  camp: { ...type.caption, color: colors.textSecondary },
  wolf: { color: colors.wolf },
  skill: { ...type.callout, fontWeight: '400', color: colors.textSecondary, marginTop: 3 },
  timing: { ...type.footnote, color: colors.textTertiary },
  metaRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: spacing.sm },
  typeLabel: { ...type.caption, fontWeight: '400', color: colors.textTertiary },
  variant: { ...type.caption, color: colors.wolf },
  typeOption: { minHeight: 52, justifyContent: 'center', paddingHorizontal: spacing.md, borderRadius: radius.sm, backgroundColor: colors.surfaceAlt },
  typeOptionActive: { backgroundColor: colors.accentDim, borderWidth: 1, borderColor: colors.accent },
  typeOptionText: { ...type.body, color: colors.text },
  pressed: { opacity: 0.65 },
  footer: { ...type.footnote, paddingVertical: spacing.lg, borderTopWidth: StyleSheet.hairlineWidth, borderColor: colors.line },
});
