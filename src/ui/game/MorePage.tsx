import React, { useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { colors, spacing, type } from '../../theme';
import { ruleSummary } from '../../game/config';
import { alive } from '../../game/engine';
import type { Game } from '../../game/types';
import { Button, Chip, ListRow } from '../kit';
import { phaseLabel, stageInfo } from '../labels';
import { Icon } from '../Icon';
import { MotionPressable } from '../motion';
import { useResponsive } from '../responsive';

export function MorePage({ game, canUndo, canRedo, onUndo, onRedo, onFinish, onReset, onOpenReference, onOpenTools, onTemporarySpeech, onNote }: {
  game: Game;
  canUndo: boolean;
  canRedo: boolean;
  onUndo: () => void;
  onRedo: () => void;
  onFinish: () => void;
  onReset: () => void;
  onOpenReference?: () => void;
  onOpenTools?: () => void;
  onTemporarySpeech?: () => void;
  onNote?: () => void;
}) {
  const [showRules, setShowRules] = useState(false);
  const responsive = useResponsive();
  return (
    <ScrollView contentContainerStyle={[styles.content, { paddingHorizontal: responsive.gutter, width: '100%', maxWidth: responsive.maxContentWidth, alignSelf: 'center' }]} showsVerticalScrollIndicator={false}>
      <View style={styles.head}>
        <Text style={type.title}>更多</Text>
        <Text style={type.footnote}>对局信息与操作</Text>
      </View>

      <View style={styles.panel}>
        <View style={styles.infoRow}><Text style={styles.gameName}>{game.name}</Text><Chip tone="accent">{phaseLabel(game)}</Chip></View>
        <Text style={type.footnote}>{game.board} · {game.players.length} 人 · 存活 {alive(game).length}</Text>
        <Text style={type.footnote}>当前阶段：{stageInfo(game.stage).title}</Text>
        <Text style={type.footnote}>开始于 {new Date(game.startedAt).toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })}</Text>
      </View>

      <View style={styles.historyActions}>
        <MotionPressable accessibilityRole="button" accessibilityLabel="撤回上一步" accessibilityState={{ disabled: !canUndo }} disabled={!canUndo} onPress={onUndo} style={[styles.historyAction, !canUndo && styles.disabled]}><Icon name="undo" size={22} color={colors.text} /><Text style={type.callout}>撤回上一步</Text><Text style={styles.actionHint}>{canUndo ? `${game.events.length} 条记录，可回退` : '没有可撤回的操作'}</Text></MotionPressable>
        <MotionPressable accessibilityRole="button" accessibilityLabel="重做" accessibilityState={{ disabled: !canRedo }} disabled={!canRedo} onPress={onRedo} style={[styles.historyAction, !canRedo && styles.disabled]}><Icon name="redo" size={22} color={colors.text} /><Text style={type.callout}>重做</Text><Text style={styles.actionHint}>{canRedo ? '恢复上一次撤回' : '没有可重做的操作'}</Text></MotionPressable>
      </View>

      <View style={styles.list}>
        <Text style={styles.groupLabel}>现场工具</Text>
        {onOpenReference ? <ListRow label="规则与角色图鉴" hint="备用查阅，仅显示本局角色" onPress={onOpenReference} /> : null}
        {onOpenTools && game.stage !== 'ended' ? <ListRow label="自爆与人工裁定" hint={game.stage === 'discussion' ? '现场特例、特殊出局和状态修正' : '白天发言阶段可用；夜间出局请使用天亮复核'} disabled={game.stage !== 'discussion'} onPress={onOpenTools} /> : null}
        {onTemporarySpeech && game.stage !== 'ended' ? <ListRow label="临时发言 / 遗言" hint="按本桌约定选择发言人，可为已出局玩家计时" onPress={onTemporarySpeech} /> : null}
        {onNote && game.stage !== 'ended' ? <ListRow label="现场备忘" hint="记录附加技能、次数和现场约定，仅主持人可见" onPress={onNote} /> : null}
      </View>

      <View style={styles.list}>
        <Text style={styles.groupLabel}>对局管理</Text>
        {game.stage !== 'ended' ? <ListRow label="主持裁定结束本局" hint={game.rules.flow?.manualVictory ? '本局由主持人确认胜负，选择获胜阵营并写入复盘' : '提前结束并写入复盘'} onPress={onFinish} /> : null}
        <ListRow label="移除本局" hint="移除前会先备份" tone="danger" onPress={onReset} />
      </View>

      <View style={styles.ruleSection}>
        <Text accessibilityRole="header" style={type.headline}>赛前已定规则</Text>
        <Button title={showRules ? '收起本局桌规' : '查看赛前桌规'} variant="secondary" onPress={() => setShowRules(value => !value)} />
        {showRules ? ruleSummary(game.rules, game.players.map(player => player.role)).map(item => <View key={item} style={styles.ruleRow}><Text style={styles.ruleBullet}>·</Text><Text style={styles.rule}>{item}</Text></View>) : null}
        {showRules && game.rules.flow ? <Text style={type.footnote}>自定义主持流程 · {game.rules.flow.manualDawn ? '天亮手动确认出局' : '天亮自动结算'}</Text> : null}
      </View>

      <View style={styles.privacy}>
        <Text style={type.caption}>存档与隐私</Text>
        <Text style={type.footnote}>操作自动保存在本机，可离线继续。身份与夜间记录仅主持人可见，主持台禁止截屏录屏。</Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: spacing.xl, paddingTop: spacing.xl, paddingBottom: spacing.huge, gap: spacing.xl },
  head: { gap: spacing.sm },
  panel: { gap: spacing.sm, paddingVertical: spacing.lg, borderTopWidth: StyleSheet.hairlineWidth, borderBottomWidth: StyleSheet.hairlineWidth, borderColor: colors.line },
  historyActions: { flexDirection: 'row', gap: spacing.md },
  historyAction: { flex: 1, minWidth: 0, paddingVertical: spacing.lg, paddingHorizontal: spacing.md, backgroundColor: colors.surfaceAlt, gap: spacing.sm },
  actionHint: { ...type.caption, fontSize: 11, fontWeight: '400' },
  disabled: { opacity: 0.4 },
  list: { backgroundColor: colors.surface },
  groupLabel: { ...type.caption, color: colors.textSecondary, paddingBottom: spacing.xs },
  infoRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'flex-start', justifyContent: 'space-between', gap: spacing.sm },
  gameName: { ...type.headline, flex: 1, minWidth: 0 },
  ruleSection: { gap: spacing.md },
  ruleRow: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm },
  ruleBullet: { ...type.body, color: colors.textTertiary },
  rule: { ...type.callout, flex: 1, color: colors.textSecondary },
  privacy: { gap: spacing.sm, paddingTop: spacing.md, borderTopWidth: StyleSheet.hairlineWidth, borderColor: colors.line },
});
