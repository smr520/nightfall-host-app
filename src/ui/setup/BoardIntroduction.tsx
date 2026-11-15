import React from 'react';
import { Linking, StyleSheet, Text, View } from 'react-native';
import { boardIntroduction } from '../../game/board-reference';
import { boardSupport, type BoardSupportLevel } from '../../game/board-support';
import type { Board } from '../../game/boards';
import { ROLE_REFERENCE } from '../../game/role-reference';
import { ROLES, ROLE_IDS } from '../../game/roles';
import { colors, radius, spacing, type } from '../../theme';
import { boardRoleList } from '../labels';
import { Button } from '../kit';
import { Chip } from '../kit';
import { Icon } from '../Icon';

const SUPPORT_TONE: Record<BoardSupportLevel, 'success' | 'wolf' | 'danger'> = {
  verified: 'success',
  guided: 'wolf',
  experimental: 'danger',
};

export function BoardSupportBadge({ board, withSummary = false }: { board: Board; withSummary?: boolean }) {
  const support = boardSupport(board);
  return (
    <View accessibilityLabel={`板子支持等级：${support.label}`} style={styles.supportBadge}>
      <View style={styles.supportBadgeLine}>
        <Chip tone={SUPPORT_TONE[support.level]}>{support.label}</Chip>
        {withSummary ? <Text style={[type.footnote, styles.flex]}>{support.summary}</Text> : null}
      </View>
      {withSummary ? <Text style={type.caption}>{support.reasons.join('；')}</Text> : null}
    </View>
  );
}

export function BoardIntroduction({ board, onOpenRoles }: { board: Board; onOpenRoles?: () => void }) {
  const introduction = boardIntroduction(board);
  const support = boardSupport(board);
  const needsHost = ROLE_IDS.filter(role => (board.roles[role] ?? 0) > 0 && ROLE_REFERENCE[role].automation !== 'automatic');
  const checks = Array.from(new Set([...introduction.hostChecks, ...(board.unresolved ?? [])]));
  return <View style={styles.root}>
    <View style={styles.introduction}>
      <View style={styles.boardHeading}>
        <View style={styles.flex}><Text style={styles.eyebrow}>板子说明</Text><Text accessibilityRole="header" style={styles.boardName}>{board.name}</Text><BoardSupportBadge board={board} withSummary /></View>
        <View style={styles.playerCount}><Text style={styles.playerCountNumber}>{board.playerCount}</Text><Text style={type.caption}>人局</Text></View>
      </View>
      <Text accessibilityLabel="板子玩法简介" style={styles.overview}>{introduction.overview}</Text>
    </View>
    <View style={styles.section}>
      <SectionHeading number="01" title={`${board.playerCount} 人角色配置`} />
      <View style={styles.roster}>{boardRoleList(board.roles).map(item => <View key={item.name} style={styles.roleRow}><Text style={[styles.roleName, item.wolf && styles.wolf]}>{item.name}</Text><Text style={styles.roleCount}>×{item.count}</Text></View>)}</View>
    </View>
    <View style={styles.section}>
      <SectionHeading number="02" title="玩法特点" />
      {introduction.highlights.map((item, index) => <View key={item} style={styles.point}><Text style={styles.pointNumber}>{index + 1}.</Text><Text style={[type.body, styles.flex]}>{item}</Text></View>)}
    </View>
    <View style={styles.section}>
      <SectionHeading number="03" title="开局前确认" />
      {checks.map((item, index) => <View key={item} style={styles.point}><Text style={styles.pointNumber}>{index + 1}.</Text><Text style={[type.body, styles.flex]}>{item}</Text></View>)}
    </View>
    {board.catalog ? <View style={styles.section}>
      <SectionHeading number="04" title="版本与来源" />
      <View style={styles.sourceMeta}>
        <Text style={type.body}>来源：{board.catalog.origins.map(origin => ({ netease: '网易官方', jingcheng: '京城大师赛', community: '社区参考' }[origin])).join('、')}</Text>
        <Text style={type.footnote}>版本：{board.catalog.edition} · {board.catalog.verification === 'official' ? '官方配置' : '参考配置，需主持人核对'}</Text>
      </View>
      {board.catalog.sources.map(source => <Button key={`${source.url}-${source.scope}`} title={`打开来源：${source.title}`} variant="ghost" small onPress={() => { void Linking.openURL(source.url); }} />)}
    </View> : null}
    <View style={styles.support}>
      <View style={styles.supportHeading}><Icon name="note" size={18} color={colors.textSecondary} /><Text accessibilityRole="header" style={type.headline}>软件处理范围</Text></View>
      <BoardSupportBadge board={board} withSummary />
      <Text style={type.footnote}>{support.level === 'verified' ? '这是已验证阵容，仍请按本桌约定确认女巫、猎人和警长规则。' : '开局前先确认下列主持处理项，必要时把本桌约定写入补充约定。'}</Text>
      <Text style={type.footnote}>{needsHost.length ? `${needsHost.map(role => ROLES[role].name).join('、')}包含需主持人核对或现场处理的技能；查看角色说明后再决定是否采用。` : '当前阵容的基础行动、投票与胜负按本局桌规处理。'}</Text>
      {onOpenRoles ? <Button title="查看本板角色技能" variant="secondary" onPress={onOpenRoles} /> : null}
      <Text style={type.footnote}>选择板子只确定阵容，具体桌规仍在开局前确认。</Text>
      {board.source ? <Text style={styles.source}>阵容来源：{board.source}</Text> : null}
    </View>
  </View>;
}

function SectionHeading({ number, title }: { number: string; title: string }) {
  return <View style={styles.sectionHeading}><Text style={styles.sectionNumber}>{number}</Text><Text accessibilityRole="header" style={[type.headline, styles.flex]}>{title}</Text></View>;
}

const styles = StyleSheet.create({
  root: { gap: spacing.xl, paddingTop: spacing.sm },
  flex: { flex: 1, minWidth: 0 },
  introduction: { gap: spacing.lg },
  boardHeading: { flexDirection: 'row', alignItems: 'center', gap: spacing.lg },
  eyebrow: { ...type.caption, fontWeight: '400', marginBottom: spacing.sm },
  boardName: { ...type.title, fontSize: 28, lineHeight: 38 },
  playerCount: { alignItems: 'center', minWidth: 50 },
  playerCountNumber: { ...type.numeric, fontSize: 38, lineHeight: 46, fontWeight: '500' },
  overview: { ...type.body, lineHeight: 27, color: colors.textSecondary },
  section: { gap: spacing.lg, borderTopWidth: StyleSheet.hairlineWidth, borderColor: colors.line, paddingTop: spacing.xl },
  sectionHeading: { flexDirection: 'row', alignItems: 'baseline', gap: spacing.md },
  sectionNumber: { ...type.caption, fontVariant: ['tabular-nums'], fontWeight: '500', minWidth: 24 },
  roster: { flexDirection: 'row', flexWrap: 'wrap', columnGap: spacing.xl, rowGap: spacing.sm },
  roleRow: { flexBasis: '42%', flexGrow: 1, flexDirection: 'row', justifyContent: 'space-between', gap: spacing.sm, paddingVertical: spacing.sm, borderBottomWidth: StyleSheet.hairlineWidth, borderColor: colors.lineSoft },
  roleName: { ...type.body, flexShrink: 1 },
  wolf: { color: colors.wolf },
  roleCount: { ...type.callout, fontVariant: ['tabular-nums'], fontWeight: '600' },
  point: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.md },
  pointNumber: { ...type.footnote, fontVariant: ['tabular-nums'], width: 20, paddingTop: 2 },
  support: { backgroundColor: colors.surfaceAlt, borderRadius: radius.sm, padding: spacing.lg, gap: spacing.md },
  supportHeading: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  supportBadge: { gap: spacing.xs, marginTop: spacing.sm },
  supportBadgeLine: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'flex-start', gap: spacing.sm },
  source: { ...type.caption, fontWeight: '400', color: colors.textSecondary, marginTop: spacing.xs },
  sourceMeta: { gap: spacing.xs },
});
