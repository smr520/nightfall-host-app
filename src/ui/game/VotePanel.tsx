import React from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { tally } from '../../game/engine';
import type { Action, Game } from '../../game/types';
import type { SpeechClock } from '../../hooks/useSpeechClock';
import { colors, radius, spacing, type } from '../../theme';
import { Button, Card, Chip, Divider, SeatGrid, Segmented } from '../kit';
import { SpeechTimer } from './SpeechTimer';

export type VoteEntryDraft = {
  voteMode: 'individual' | 'group';
  batchVoters: number[];
  pkSpeaking: boolean;
};

type Props = {
  game: Game;
  draft: VoteEntryDraft & { voter: number | null; selected: number | null };
  activeVoter: number | null;
  showRoles: boolean;
  speechClock: SpeechClock;
  patch: (next: Partial<VoteEntryDraft & { voter: number | null; selected: number | null }>) => void;
  doAction: (action: Action) => void;
};

export function VotePanel({ game, draft, activeVoter, showRoles, speechClock, patch, doAction }: Props) {
  const vote = game.vote;
  if (!vote) return null;
  const unrecorded = vote.voters.filter(seat => vote.ballots[seat] === undefined);
  const selectedVoter = draft.voter !== null && vote.voters.includes(draft.voter) ? draft.voter : null;
  const editing = selectedVoter !== null && vote.ballots[selectedVoter] !== undefined;
  const remainingAbstain = () => Alert.alert('其余玩家全部弃票？', `将 ${unrecorded.map(seat => `${seat} 号`).join('、')} 记录为弃票。已经录入的票保持原结果。`, [
    { text: '继续录票', style: 'cancel' },
    { text: '确认其余弃票', onPress: () => doAction({ type: 'ballots', voters: unrecorded, target: null }) },
  ]);
  return <Card style={styles.panel}>
    <View style={styles.heading}><Text style={type.headline}>{vote.kind === 'sheriff' ? '警长投票' : '放逐投票'} · 第 {vote.round} 轮</Text><Text style={type.caption}>{vote.voters.length} 人投票</Text></View>
    {draft.pkSpeaking ? <>
      <Text style={type.footnote}>先请平票候选人发言，再使用底部按钮开始 PK 投票。发言顺序按本桌约定选择。</Text>
      <SpeechTimer game={game} clock={speechClock} eligibleSeats={vote.candidates} label="PK 发言" />
    </> : <>
      {vote.round > 1 ? <Button title="PK 发言计时" variant="ghost" small onPress={() => patch({ pkSpeaking: true })} /> : null}
      <Segmented options={[{ label: '逐人录票', value: 'individual' }, { label: '按得票人录票', value: 'group' }]} value={draft.voteMode} onChange={voteMode => patch({ voteMode, selected: null, voter: null, batchVoters: [] })} />
      {draft.voteMode === 'individual' ? <>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.voters}>
          {vote.voters.map(seat => {
            const recorded = vote.ballots[seat] !== undefined;
            return <Pressable key={seat} accessibilityRole="button" accessibilityLabel={recorded ? `修改 ${seat} 号投票` : `待录 ${seat} 号`} accessibilityState={{ selected: activeVoter === seat }} onPress={() => patch({ voter: seat, selected: vote.ballots[seat] ?? null })} style={[styles.voter, activeVoter === seat && styles.active, recorded && activeVoter !== seat && styles.recorded]}>
              <Text style={[type.callout, activeVoter === seat && styles.activeText]}>{seat}号</Text>
              <Text style={[type.caption, activeVoter === seat && styles.activeText]}>{recorded ? vote.ballots[seat] === null ? '弃票 · 可改' : `→${vote.ballots[seat]} · 可改` : '待录'}</Text>
            </Pressable>;
          })}
        </ScrollView>
        <Text style={type.footnote}>{editing ? `正在修改 ${selectedVoter} 号投票，确认后覆盖原票。` : activeVoter !== null ? `请选择 ${activeVoter} 号投给谁。已录的票也可以点开修改。` : '全部录齐；计票前仍可点选投票人改票。'}</Text>
        <SeatGrid game={game} selected={draft.selected} onSelect={seat => patch({ selected: draft.selected === seat ? null : seat })} showRoles={showRoles} filter={player => vote.candidates.includes(player.seat)} />
        {editing ? <Button title="取消改票" small variant="ghost" onPress={() => patch({ voter: null, selected: null })} /> : null}
      </> : <>
        <Text style={type.callout}>1. 选择得票人</Text>
        <SeatGrid game={game} selected={draft.selected} onSelect={seat => patch({ selected: draft.selected === seat ? null : seat })} showRoles={showRoles} filter={player => vote.candidates.includes(player.seat)} />
        <Divider />
        <Text style={type.callout}>2. 选择投给他的玩家 · 已选 {draft.batchVoters.length} 人</Text>
        <View testID="batch-voter-grid"><SeatGrid game={game} selected={null} multi={draft.batchVoters} onSelect={seat => patch({ batchVoters: draft.batchVoters.includes(seat) ? draft.batchVoters.filter(item => item !== seat) : [...draft.batchVoters, seat].sort((a, b) => a - b) })} showRoles={showRoles} filter={player => vote.voters.includes(player.seat)} /></View>
        <Text style={type.footnote}>按现场举手情况多选，再一次确认。已录玩家可重新选择，更新其原票；警长票权自动计算。</Text>
      </>}
      {unrecorded.length ? <Button title={`其余 ${unrecorded.length} 人全部弃票`} small variant="ghost" onPress={remainingAbstain} /> : null}
    </>}
    <View style={styles.totals}>{tally(game).map(item => <Chip key={item.seat} tone={item.votes > 0 ? 'accent' : 'neutral'}>{item.seat} 号 {item.votes} 票</Chip>)}</View>
    <Text style={type.footnote}>待录 {unrecorded.length} 人{unrecorded.length ? '' : ' · 已全部记录'}</Text>
  </Card>;
}

const styles = StyleSheet.create({ panel: { gap: spacing.md }, heading: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: spacing.sm }, voters: { gap: spacing.sm }, voter: { minWidth: 64, minHeight: 60, borderRadius: radius.sm, backgroundColor: colors.surfaceAlt, paddingHorizontal: spacing.sm, paddingVertical: spacing.sm, alignItems: 'center', justifyContent: 'center', gap: 2 }, active: { backgroundColor: colors.accent }, activeText: { color: colors.onAccent }, recorded: { borderWidth: StyleSheet.hairlineWidth, borderColor: colors.line }, totals: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm } });
