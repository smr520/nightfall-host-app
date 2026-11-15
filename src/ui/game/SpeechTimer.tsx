import React, { useEffect } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { Game } from '../../game/types';
import { colors, radius, spacing, type } from '../../theme';
import { Button } from '../kit';
import { Icon } from '../Icon';
import { MotionPressable } from '../motion';
import type { SpeechClock } from '../../hooks/useSpeechClock';

export function SpeechTimer({ game, clock, eligibleSeats, label, autoSelectSingle = false }: { game: Game; clock: SpeechClock; eligibleSeats?: readonly number[]; label?: string; autoSelectSingle?: boolean }) {
  const { speaker, remaining, running, select, direction } = clock;
  const players = game.players.filter(player => eligibleSeats ? eligibleSeats.includes(player.seat) : player.alive);
  const seats = players.map(player => player.seat).sort((a, b) => (a - b) * direction);
  const eligible = speaker !== null && seats.includes(speaker);
  const singleSeat = seats.length === 1 ? seats[0] : null;
  useEffect(() => {
    if (speaker !== null && !eligible) select(null);
  }, [speaker, eligible, select]);
  useEffect(() => {
    if (autoSelectSingle && speaker === null && singleSeat !== null) select(singleSeat);
  }, [autoSelectSingle, singleSeat, select, speaker]);
  const title = eligible ? label ? `${speaker} 号 · ${label}` : `${speaker} 号发言` : label ?? '发言计时';
  const timeLabel = running ? '计时中' : remaining === 0 ? '时间到' : eligible ? '已暂停' : '请先点选发言人';
  return <View style={styles.root}>
    <View style={styles.head}><Text style={[type.headline, styles.flex]}>{title}</Text><Icon name="clock" size={18} color={colors.textTertiary} /></View>
    <View style={styles.clockFace}>
      <Text accessibilityLabel="发言剩余时间" maxFontSizeMultiplier={1.5} style={[styles.time, remaining === 0 && styles.expired]}>{Math.floor(remaining / 60)}:{String(remaining % 60).padStart(2, '0')}</Text>
      <View style={styles.clockStatus}><View style={[styles.statusDot, running && styles.statusDotRunning, remaining === 0 && styles.statusDotExpired]} /><Text style={[styles.statusText, remaining === 0 && styles.expired]}>{timeLabel}</Text></View>
    </View>
    <View style={styles.seatHead}><Text style={styles.seatLabel}>发言座位</Text><Pressable accessibilityRole="button" accessibilityLabel={direction === 1 ? '发言方向：顺号' : '发言方向：逆号'} onPress={clock.toggleDirection} style={styles.directionButton}><Text style={styles.directionText}>{direction === 1 ? '发言方向：顺号' : '发言方向：逆号'}</Text><Icon name="redo" size={14} color={colors.textSecondary} /></Pressable></View>
    <View style={styles.seats}>{players.map(player => <MotionPressable key={player.seat} accessibilityRole="button" accessibilityLabel={`发言人 ${player.seat} 号`} accessibilityState={{ selected: speaker === player.seat }} onPress={() => select(player.seat)} style={[styles.seat, speaker === player.seat && styles.selected]}><Text style={[styles.seatNumber, speaker === player.seat && styles.selectedText]}>{String(player.seat).padStart(2, '0')}</Text></MotionPressable>)}</View>
    <View style={styles.actions}>
      <Button title={running ? '暂停计时' : remaining === 0 ? '重新计时' : '开始计时'} small disabled={!eligible} onPress={clock.toggle} style={styles.flex} />
      <Button title="下一位发言" small variant="secondary" disabled={!eligible || seats.length < 2} onPress={() => select(seats[(seats.indexOf(speaker!) + 1) % seats.length])} style={styles.flex} />
      <MotionPressable accessibilityRole="button" accessibilityLabel="重置计时" onPress={clock.reset} style={styles.resetButton}><Icon name="undo" size={20} color={colors.textSecondary} /></MotionPressable>
    </View>
  </View>;
}
const styles = StyleSheet.create({
  root: { gap: spacing.md },
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm },
  clockFace: { alignItems: 'center', justifyContent: 'center', gap: spacing.xs, paddingVertical: spacing.lg, backgroundColor: colors.surfaceAlt, borderRadius: radius.sm },
  time: { ...type.numeric, fontSize: 52, lineHeight: 64, fontWeight: '500', letterSpacing: -1.5 },
  clockStatus: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  statusDot: { width: 5, height: 5, borderRadius: 3, backgroundColor: colors.textTertiary },
  statusDotRunning: { backgroundColor: colors.success },
  statusDotExpired: { backgroundColor: colors.danger },
  statusText: { ...type.caption, fontWeight: '400' },
  expired: { color: colors.danger },
  seatHead: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm },
  seatLabel: { ...type.caption, color: colors.textSecondary },
  directionButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: 6, minHeight: 48 },
  directionText: { ...type.footnote, fontSize: 12 },
  seats: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  seat: { minWidth: 48, minHeight: 48, paddingHorizontal: spacing.sm, borderRadius: radius.sm, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.line, justifyContent: 'center', alignItems: 'center' },
  seatNumber: { ...type.numeric, fontSize: 16, fontWeight: '500' },
  selected: { backgroundColor: colors.accent, borderColor: colors.accent },
  selectedText: { color: colors.onAccent },
  actions: { flexDirection: 'row', gap: spacing.sm, flexWrap: 'wrap' },
  resetButton: { minWidth: 48, minHeight: 48, alignItems: 'center', justifyContent: 'center' },
  flex: { flex: 1, minWidth: 0 },
});
