import React, { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Alert } from './alert';
import { backupFilename, shareBackupText } from './backup-file';
import { colors, spacing, type } from '../theme';
import { winnerLabel } from '../game/host-ui';
import { ROLES, isWolf } from '../game/roles';
import type { Game } from '../game/types';
import { Button, Card, Chip, Divider, EmptyState, InlineError, Sheet, TopBar } from './kit';
import { Timeline } from './game/LogPage';
import { causeLabel } from './labels';
import { formatRecap } from '../game/recap';
import { useResponsive } from './responsive';

export function HistoryScreen({ games, initialOpenId, onBack }: { games: Game[]; initialOpenId?: string; onBack: () => void }) {
  const requestedOpenId = initialOpenId && games.some(game => game.id === initialOpenId) ? initialOpenId : null;
  const [selection, setSelection] = useState<{ source?: string; openId: string | null }>(() => ({ source: initialOpenId, openId: requestedOpenId }));
  if (selection.source !== initialOpenId) {
    setSelection({ source: initialOpenId, openId: requestedOpenId });
  }
  const openId = selection.openId;
  const setOpenId = (gameId: string | null) => setSelection(current => ({ ...current, openId: gameId }));
  const [shareError, setShareError] = useState('');
  const responsive = useResponsive();
  const open = games.find(game => game.id === openId) ?? null;
  const shareOpen = () => {
    if (!open) return;
    setShareError('');
    Alert.alert('分享完整复盘？', '内容包含身份、出局原因和主持记录，请确认所有玩家已结束游戏。', [
      { text: '取消', style: 'cancel' },
      { text: '继续分享', onPress: () => { void shareBackupText(`复盘 · ${open.name}`, formatRecap(open), `${backupFilename()}-${open.name}`).catch(() => setShareError('无法打开分享面板。复盘仍保存在本机，请重试。')); } },
    ]);
  };
  return (
    <View style={styles.root}>
      <ScrollView contentContainerStyle={[styles.content, { paddingHorizontal: responsive.gutter, width: '100%', maxWidth: responsive.maxContentWidth, alignSelf: 'center' }]} showsVerticalScrollIndicator={false}>
        <TopBar title="复盘" subtitle={`${games.length} 场已完成`} onBack={onBack} />
        {games.length === 0 ? <Card><EmptyState title="还没有完成的对局" description="主持完一局并结束游戏后，会自动出现在这里。" /></Card> : null}
        {games.length > 0 ? <View style={[styles.historyList, responsive.isExpanded && styles.historyListWide]}>{games.map(game => (
          <Pressable key={game.id} accessibilityRole="button" accessibilityLabel={`复盘 ${game.name}`} onPress={() => setOpenId(game.id)} style={({ pressed }) => [styles.historyRow, responsive.isExpanded && styles.historyRowWide, pressed && styles.pressed]}>
            <Text style={styles.date}>{new Date(game.startedAt).toLocaleDateString('zh-CN')}</Text>
            <View style={styles.rowBetween}>
              <View style={styles.flex}>
                <Text style={type.headline}>{game.name}</Text>
                <Text style={type.footnote}>{game.board} · {game.players.length} 人</Text>
              </View>
              <Chip tone={game.winner === 'wolf' ? 'wolf' : game.winner === 'good' ? 'success' : 'neutral'}>{winnerLabel(game.winner ?? 'draw').replace('阵营胜利', '胜')}</Chip>
              <Text style={styles.chevron}>›</Text>
            </View>
          </Pressable>
        ))}</View> : null}
      </ScrollView>

      <Sheet visible={!!open} onClose={() => setOpenId(null)} title={open?.name ?? ''} subtitle={open ? `${open.board} · ${open.endReason ?? ''}` : ''} footer={open ? <View style={styles.sheetActions}><Button title="分享复盘" onPress={shareOpen} /><Button title="关闭" variant="secondary" onPress={() => setOpenId(null)} /></View> : null}>
        {open ? (
          <>
            <Text style={type.footnote}>分享内容包含玩家身份和完整主持记录。</Text>
            {shareError ? <InlineError>{shareError}</InlineError> : null}
            <View style={styles.resultRow}>
              <Text style={type.title2}>{winnerLabel(open.winner ?? 'draw')}</Text>
              <Chip>{open.players.length} 人</Chip>
            </View>
            <Divider />
            <Text style={type.caption}>身份表</Text>
            {open.players.map(player => (
              <View key={player.seat} style={styles.rosterRow}>
                <Text style={styles.rosterSeat}>{player.seat}</Text>
                <View style={styles.flex}>
                  <Text style={type.body}>{player.name}</Text>
                  <Text style={[styles.rosterRole, isWolf(player.role) && styles.rosterRoleWolf]}>{ROLES[player.role].name}</Text>
                </View>
                <Text style={styles.rosterDeath}>{player.alive ? '存活' : causeLabel(player.death?.cause)}</Text>
              </View>
            ))}
            <Divider />
            <Text style={type.caption}>时间线</Text>
            <Timeline game={open} />
          </>
        ) : null}
      </Sheet>
    </View>
  );
}

export function gameSummary(game: Game) {
  return `${game.board} · ${game.players.length} 人`;
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  flex: { flex: 1, minWidth: 0 },
  content: { paddingHorizontal: spacing.lg, paddingBottom: spacing.huge, gap: spacing.md },
  historyList: { borderTopWidth: StyleSheet.hairlineWidth, borderColor: colors.line },
  historyListWide: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' },
  historyRow: { gap: spacing.sm, paddingVertical: spacing.lg, borderBottomWidth: StyleSheet.hairlineWidth, borderColor: colors.line },
  historyRowWide: { width: '48.5%' },
  date: { ...type.caption, fontWeight: '400' },
  rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm },
  chevron: { fontSize: 26, color: colors.textTertiary },
  pressed: { opacity: 0.7 },
  resultRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm },
  rosterRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, minHeight: 58, borderBottomWidth: StyleSheet.hairlineWidth, borderColor: colors.lineSoft, paddingVertical: spacing.sm },
  rosterSeat: { ...type.numeric, minWidth: 26, fontSize: 16, color: colors.textSecondary },
  rosterRole: { ...type.footnote, fontWeight: '600', color: colors.success },
  rosterRoleWolf: { color: colors.wolf },
  rosterDeath: { ...type.footnote, flexShrink: 1, color: colors.textTertiary, textAlign: 'right' },
  sheetActions: { gap: spacing.sm },
});
