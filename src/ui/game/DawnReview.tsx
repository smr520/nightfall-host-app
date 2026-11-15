import React from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { getNightAnnouncement, nightDeaths, seatName } from '../../game/engine';
import { DAWN_CAUSES } from '../../game/flow';
import { isWolf } from '../../game/roles';
import type { Action, Cause, Game } from '../../game/types';
import { colors, radius, spacing, type } from '../../theme';
import { Button, Card, Divider, SeatGrid } from '../kit';
import { causeLabel } from '../labels';

export type DawnReviewDraft = { selectedDeaths: number[]; causes: Record<number, Cause>; reason: string };

export function createDawnReviewDraft(game: Game): DawnReviewDraft {
  const deaths = nightDeaths(game);
  const automatic = nightDeaths({ ...game, night: { ...game.night, manualDeaths: undefined } });
  return { selectedDeaths: deaths.map(death => death.seat), causes: Object.fromEntries([...automatic, ...deaths].map(death => [death.seat, death.cause])), reason: game.night.manualReason ?? '' };
}

export function dawnDraftDeaths(draft: DawnReviewDraft): { seat: number; cause: Cause }[] {
  return [...draft.selectedDeaths].sort((a, b) => a - b).map(seat => ({ seat, cause: draft.causes[seat] ?? 'ruling' }));
}

export function dawnDraftNeedsConfirmation(game: Game, draft: DawnReviewDraft): boolean {
  if (game.stage !== 'dawn' || !game.rules.flow?.manualDawn) return false;
  if (!game.night.manualDeaths) return true;
  const confirmed = [...game.night.manualDeaths].sort((a, b) => a.seat - b.seat);
  return JSON.stringify(dawnDraftDeaths(draft)) !== JSON.stringify(confirmed)
    || (draft.reason.trim() || '已按赛前桌规核对') !== game.night.manualReason;
}

export function DawnReview({ game, draft, onChange, doAction }: { game: Game; draft: DawnReviewDraft; onChange: (next: Partial<DawnReviewDraft>) => void; doAction: (action: Action) => void }) {
  const { selectedDeaths, causes, reason } = draft;
  const reviewing = game.stage === 'dawn' && game.rules.flow?.manualDawn;
  const deaths = reviewing ? dawnDraftDeaths(draft) : nightDeaths(game);
  const preview = reviewing ? { ...game, night: { ...game.night, manualDeaths: deaths } } : game;
  const inspected = game.players.find(player => player.seat === game.night.inspect);
  return <Card style={styles.panel}>
    <Text style={styles.label}>私密结算 · 不要直接念出原因</Text>
    <Text style={type.title2}>{getNightAnnouncement(preview)}</Text>
    <Text style={type.footnote}>{deaths.length ? deaths.map(death => `${death.seat} 号 · ${causeLabel(death.cause)}`).join('　') : '昨夜无人出局。'}</Text>
    {inspected ? <Text style={type.footnote}>预言家查验：{seatName(game, inspected.seat)} → {isWolf(inspected.role) ? '狼人' : '好人'}</Text> : null}
    {game.stage === 'dawn' && game.rules.flow?.manualDawn ? <>
      <Divider /><Text style={type.headline}>主持人确认昨夜名单</Text>
      <Text style={type.footnote}>点选应当出局的座位，并核对出局原因。全部取消表示平安夜。原因会影响猎人等出局技能。</Text>
      <SeatGrid game={game} selected={null} multi={selectedDeaths} onSelect={seat => onChange({ selectedDeaths: selectedDeaths.includes(seat) ? selectedDeaths.filter(item => item !== seat) : [...selectedDeaths, seat].sort((a, b) => a - b) })} showRoles filter={player => player.alive} />
      {selectedDeaths.map(seat => <View key={seat} style={styles.causeRow}><Text style={type.callout}>{seat} 号出局原因</Text><View style={styles.causes}>{DAWN_CAUSES.map(cause => <Pressable key={cause} accessibilityRole="button" accessibilityLabel={`${seat}号出局原因 ${causeLabel(cause)}`} accessibilityState={{ selected: (causes[seat] ?? 'ruling') === cause }} onPress={() => onChange({ causes: { ...causes, [seat]: cause } })} style={[styles.cause, (causes[seat] ?? 'ruling') === cause && styles.active]}><Text style={[type.footnote, (causes[seat] ?? 'ruling') === cause && styles.activeText]}>{causeLabel(cause)}</Text></Pressable>)}</View></View>)}
      <TextInput accessibilityLabel="天亮复核原因" value={reason} onChangeText={value => onChange({ reason: value })} placeholder="补充说明（可不填）" placeholderTextColor={colors.textTertiary} style={styles.input} />
      <Button title={game.night.manualDeaths ? '更新昨夜出局名单' : '确认昨夜出局名单'} variant="secondary" disabled={!!reason.trim() && reason.trim().length < 2} onPress={() => doAction({ type: 'set-dawn-deaths', deaths: dawnDraftDeaths(draft), reason: reason.trim() || '已按赛前桌规核对' })} />
      {game.night.manualDeaths ? <Text style={type.footnote}>{dawnDraftNeedsConfirmation(game, draft) ? '名单或原因已修改，请先更新确认，再继续结算。' : `已复核：${game.night.manualReason}`}</Text> : null}
    </> : null}
  </Card>;
}
const styles = StyleSheet.create({ panel: { gap: spacing.md }, label: { ...type.caption, color: colors.gold }, note: { borderTopWidth: StyleSheet.hairlineWidth, borderColor: colors.line, paddingTop: spacing.md, gap: spacing.sm }, causeRow: { gap: spacing.sm }, causes: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }, cause: { minHeight: 48, borderRadius: radius.sm, paddingHorizontal: spacing.md, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surfaceAlt }, active: { backgroundColor: colors.accent }, activeText: { color: colors.onAccent }, input: { minHeight: 48, borderRadius: radius.sm, paddingHorizontal: spacing.md, color: colors.text, fontSize: 16, backgroundColor: colors.surfaceAlt } });
