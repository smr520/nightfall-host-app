import React, { useMemo } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { colors, spacing, type } from '../../theme';
import { ROLES } from '../../game/roles';
import type { Game } from '../../game/types';
import { Chip } from '../kit';
import { eventPeriodLabel, stageInfo } from '../labels';
import { useResponsive } from '../responsive';

export function LogPage({ game }: { game: Game }) {
  const responsive = useResponsive();
  const groups = useMemo(() => {
    const map = new Map<string, { day: number; label: string; events: Game['events'] }>();
    for (const event of game.events) {
      const label = eventPeriodLabel(event.day, event.stage);
      const group = map.get(label) ?? { day: event.day, label, events: [] };
      group.events.push(event);
      map.set(label, group);
    }
    return [...map.values()].sort((a, b) => b.day - a.day || (a.label.endsWith('夜') ? 1 : -1)).map(group => ({ ...group, events: [...group.events] }));
  }, [game.events]);

  const actions = [
    game.night.guard !== null ? { label: '守卫', value: game.night.guard } : null,
    game.night.knife !== null ? { label: '刀口', value: game.night.knife } : null,
    game.night.inspect !== null ? { label: '查验', value: game.night.inspect } : null,
    game.night.save ? { label: '解药', value: null } : null,
    game.night.poison !== null ? { label: '毒药', value: game.night.poison } : null,
    ...Object.entries(game.night.targets).map(([call, seat]) => ({ label: ROLES[call as keyof typeof ROLES]?.short ?? call, value: seat })),
  ].filter((item): item is { label: string; value: number | null } => !!item);

  return (
    <ScrollView contentContainerStyle={[styles.content, { paddingHorizontal: responsive.gutter, width: '100%', maxWidth: responsive.maxContentWidth, alignSelf: 'center' }]} showsVerticalScrollIndicator={false}>
      <View style={styles.head}>
        <Text style={type.title}>记录</Text>
        <Text style={type.footnote}>带“公开”标记的内容可播报给玩家</Text>
      </View>

      <View style={styles.panel}>
        <View style={styles.rowBetween}>
          <Text style={type.headline}>第 {game.day} 夜 · 行动汇总</Text>
          <Chip tone={actions.length ? 'accent' : 'neutral'}>{actions.length ? `${actions.length} 项` : '暂无'}</Chip>
        </View>
        {actions.length ? (
          <View style={styles.actionRow}>
            {actions.map(item => <Chip key={item.label} tone={item.value === null ? 'success' : 'accent'}>{item.label}{item.value === null ? ' 已使用' : ` ${item.value} 号`}</Chip>)}
          </View>
        ) : <Text style={type.footnote}>本夜还没有记录任何行动。</Text>}
      </View>

      {groups.map(group => (
        <View key={group.label} style={styles.group}>
          <Text style={styles.groupTitle}>{group.label}</Text>
          <View style={styles.eventList}>
            {group.events.map((event, index) => (
              <View key={event.id} style={[styles.event, index > 0 && styles.eventDivider]}>
                <View style={styles.eventHead}>
                  <Text style={styles.eventTime}>{new Date(event.at).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}</Text>
                  <Text style={styles.eventStage}>{stageInfo(event.stage).short}</Text>
                  {event.publicText ? <Chip tone="success">公开</Chip> : null}
                </View>
                <Text style={styles.eventText}>{event.text}</Text>
                {event.publicText && event.publicText !== event.text ? <Text style={styles.eventPublic}>播报：{event.publicText}</Text> : null}
              </View>
            ))}
          </View>
        </View>
      ))}

      {game.stage === 'ended' ? <Text style={styles.footer}>对局已结束，可以在复盘里查看完整身份表。</Text> : null}
    </ScrollView>
  );
}

export function Timeline({ game }: { game: Game }) {
  return (
    <View style={styles.timeline}>
      {game.events.map(event => (
        <View key={event.id} style={styles.timelineRow}>
          <Text style={styles.eventTime}>{new Date(event.at).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}</Text>
          <View style={styles.flex}>
            <Text style={styles.eventText}>{event.text}</Text>
            <Text style={styles.timelineMeta}>{eventPeriodLabel(event.day, event.stage)} · {stageInfo(event.stage).short}</Text>
          </View>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: spacing.lg, paddingTop: spacing.lg, paddingBottom: spacing.huge, gap: spacing.lg },
  flex: { flex: 1, minWidth: 0 },
  head: { gap: spacing.sm },
  rowBetween: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm },
  panel: { gap: spacing.md, paddingVertical: spacing.md, borderTopWidth: StyleSheet.hairlineWidth, borderBottomWidth: StyleSheet.hairlineWidth, borderColor: colors.line },
  actionRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  group: { gap: spacing.sm },
  groupTitle: { ...type.callout, fontWeight: '600', color: colors.textSecondary },
  eventList: { paddingLeft: spacing.md, borderLeftWidth: 1, borderColor: colors.line },
  event: { gap: spacing.sm, paddingVertical: spacing.md },
  eventDivider: { borderTopWidth: StyleSheet.hairlineWidth, borderColor: colors.lineSoft },
  eventHead: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: spacing.sm },
  eventTime: { ...type.caption, fontWeight: '400', color: colors.textTertiary, fontVariant: ['tabular-nums'] },
  eventStage: { ...type.caption, fontWeight: '500', color: colors.textSecondary },
  eventText: { ...type.callout, color: colors.text },
  eventPublic: { ...type.footnote, color: colors.success },
  footer: { ...type.footnote, textAlign: 'center', color: colors.textTertiary },
  timeline: { gap: spacing.md },
  timelineRow: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.md },
  timelineMeta: { ...type.caption, fontWeight: '400', color: colors.textTertiary, marginTop: spacing.xs },
});
