import React, { useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { REFERENCE_SOURCES, ROLE_REFERENCE } from '../../game/role-reference';
import { ROLES, type Camp, type Role } from '../../game/roles';
import { ROLE_CATALOG, cardTypeLabel } from '../../game/role-catalog';
import { colors, spacing, type } from '../../theme';
import { Icon } from '../Icon';
import { MotionPressable as Pressable } from '../motion';
import { useResponsive } from '../responsive';

export const CAMP_NAMES: Record<Camp, string> = { good: '好人阵营', wolf: '狼人阵营', third: '第三方阵营' };
export const SUPPORT_NAMES = { automatic: '自动处理', partial: '部分处理', manual: '主持人处理' } as const;

/** The skill table and in-game lookup use the same versioned role reference. */
export function RoleDetail({ role, initialExpanded = false }: { role: Role; initialExpanded?: boolean }) {
  const [expanded, setExpanded] = useState(initialExpanded);
  const responsive = useResponsive();
  const meta = ROLES[role];
  const reference = ROLE_REFERENCE[role];
  const camp = reference.camp ?? meta.camp;
  return <ScrollView contentContainerStyle={[styles.content, { paddingHorizontal: responsive.gutter, width: '100%', maxWidth: responsive.maxReadingWidth, alignSelf: 'center' }]} showsVerticalScrollIndicator={false}>
    <View style={styles.hero}>
      <View style={styles.badges}>
        <Text style={[styles.camp, camp === 'wolf' && styles.wolf]}>{CAMP_NAMES[camp]}</Text>
        <View style={styles.metaDivider} />
        <Text style={styles.cardType}>{cardTypeLabel(ROLE_CATALOG[role].type)}</Text>
      </View>
      {ROLE_CATALOG[role].variant ? <Text style={type.footnote}>{ROLE_CATALOG[role].variant}</Text> : null}
      <Text style={styles.overview}>{reference.overview}</Text>
      {reference.automation !== 'automatic' ? <View style={styles.handlingNote}><Icon name="note" size={16} color={colors.textSecondary} /><Text style={[type.footnote, styles.flex]}>软件{SUPPORT_NAMES[reference.automation]}，具体范围可展开下方说明。</Text></View> : null}
    </View>
    <View style={styles.section}><Text accessibilityRole="header" style={styles.sectionTitle}>发动时机</Text><Text style={type.body}>{reference.timing}</Text></View>
    <View style={styles.section}><Text accessibilityRole="header" style={styles.sectionTitle}>技能介绍</Text><TextItems items={reference.skills} /></View>
    <View style={styles.section}><Text accessibilityRole="header" style={styles.sectionTitle}>限制与争议点</Text><TextItems items={reference.cautions} /></View>
    <Pressable accessibilityRole="button" accessibilityLabel={expanded ? '收起主持说明与来源' : '展开主持说明与来源'} accessibilityState={{ expanded }} onPress={() => setExpanded(value => !value)} style={({ pressed }) => [styles.disclosure, pressed && styles.pressed]}>
      <Text style={type.callout}>{expanded ? '收起' : '展开'}主持说明与来源</Text>
      <View style={{ transform: [{ rotate: expanded ? '-90deg' : '90deg' }] }}><Icon name="chevron-right" size={18} color={colors.textSecondary} /></View>
    </Pressable>
    {expanded ? <>
      <View style={styles.section}><Text accessibilityRole="header" style={styles.sectionTitle}>主持提醒</Text><TextItems items={reference.hostNotes} /></View>
      {meta.night?.script ? <View style={styles.section}><Text accessibilityRole="header" style={styles.sectionTitle}>夜间参考口播</Text><Text style={styles.script}>{meta.night.script}</Text><Text style={type.footnote}>按当前板子和桌规调整；不要把私密结果读给所有玩家。</Text></View> : null}
      <View style={styles.section}>
        <Text accessibilityRole="header" style={styles.sectionTitle}>软件如何处理</Text>
        <Text style={styles.support}>{SUPPORT_NAMES[reference.automation]}</Text>
        <Text style={type.body}>{reference.automationNote}</Text>
        {reference.needsTableAgreement ? <Text style={styles.agreement}>需先确认本桌采用的角色版本与结算口径，再开始主持。</Text> : null}
      </View>
      <ReferenceSources sourceIds={reference.sourceIds} />
    </> : null}
  </ScrollView>;
}

function TextItems({ items }: { items: string[] }) {
  return <View style={styles.items}>{items.map((item, index) => <View key={`${index}-${item}`} style={styles.item}><Text style={styles.dot}>·</Text><Text style={[type.body, styles.flex]}>{item}</Text></View>)}</View>;
}

export function ReferenceSources({ sourceIds }: { sourceIds: string[] }) {
  const sources = REFERENCE_SOURCES.filter(source => sourceIds.includes(source.id));
  if (!sources.length) return null;
  return <View style={styles.section}>
    <Text accessibilityRole="header" style={styles.sectionTitle}>参考资料</Text>
    {sources.map(source => <View key={source.id} style={styles.source}><Text style={type.callout}>{source.title}</Text><Text selectable style={styles.sourceUrl}>{source.url}</Text></View>)}
    <Text style={type.footnote}>不同板子和赛事版本可能不同，介绍不替代开局前的桌规确认。</Text>
  </View>;
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: spacing.xl, paddingTop: spacing.xl, paddingBottom: spacing.huge, gap: spacing.xl },
  flex: { flex: 1, minWidth: 0 },
  hero: { gap: spacing.md, paddingBottom: spacing.sm },
  badges: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: spacing.sm },
  camp: { ...type.caption, color: colors.textSecondary },
  wolf: { color: colors.wolf },
  metaDivider: { width: 1, height: 10, backgroundColor: colors.line },
  cardType: { ...type.caption, fontWeight: '400' },
  overview: { ...type.title2, fontSize: 22, lineHeight: 33, fontWeight: '500' },
  handlingNote: { flexDirection: 'row', gap: spacing.sm, alignItems: 'flex-start', paddingTop: spacing.xs },
  section: { gap: spacing.md, paddingTop: spacing.xl, borderTopWidth: StyleSheet.hairlineWidth, borderColor: colors.lineSoft },
  sectionTitle: { ...type.caption, color: colors.textSecondary, fontWeight: '600' },
  disclosure: { minHeight: 58, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.md, paddingVertical: spacing.md, borderTopWidth: StyleSheet.hairlineWidth, borderBottomWidth: StyleSheet.hairlineWidth, borderColor: colors.line },
  script: { ...type.headline, fontSize: 20, lineHeight: 32, fontWeight: '500' },
  pressed: { opacity: 0.65 },
  items: { gap: spacing.sm },
  item: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm },
  dot: { ...type.body, color: colors.textTertiary },
  support: { ...type.caption, color: colors.textSecondary },
  agreement: { ...type.footnote, color: colors.gold },
  source: { gap: spacing.xs },
  sourceUrl: { ...type.footnote, color: colors.accent },
});
