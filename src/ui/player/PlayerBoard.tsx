import React, { useState } from 'react';
import { ScrollView, Text, TextInput, View } from 'react-native';
import { boardById, boardRoles } from '../../game/boards';
import { ROLES, isVillager } from '../../game/roles';
import { EVENT_PHASE_LABELS, notebookMarkCounts, removeEvent, removeSkillUse, removeVote, SEAT_MARK_LABELS, SEAT_MARK_SHORT, setSummary, type EventPhase, type PlayerNotebook, type SeatMark } from '../../player/notes';
import { PLAYER_ROLE_IDS } from '../../player/role-options';
import { colors, spacing } from '../../theme';
import { Button, Chip } from '../kit';
import { MotionPressable } from '../motion';
import { useResponsive } from '../responsive';
import { PlayerEventSheet } from './PlayerEventSheet';
import { PlayerProfileSheet } from './PlayerProfileSheet';
import { PlayerSeatSheet } from './PlayerSeatSheet';
import { PlayerSkillSheet } from './PlayerSkillSheet';
import { PlayerVoteSheet } from './PlayerVoteSheet';
import { styles } from './styles';

const MARK_COLORS: Record<SeatMark, string> = {
  unknown: colors.textTertiary,
  wolf: colors.wolf,
  good: colors.success,
  god: colors.clay,
  villager: colors.textSecondary,
};
const MARK_DOTS: Record<SeatMark, object> = {
  unknown: styles.markUnknown,
  wolf: styles.markWolf,
  good: styles.markGood,
  god: styles.markGod,
  villager: styles.markVillager,
};

function roundLabel(phase: EventPhase, round: number): string {
  if (phase === 'night') return `第 ${round} 夜`;
  if (phase === 'day') return `第 ${round} 天`;
  return `第 ${round} 轮`;
}

export function PlayerBoard({ notebook, onChange, onReset }: {
  notebook: PlayerNotebook;
  onChange: (next: PlayerNotebook) => void;
  onReset: () => void;
}) {
  const responsive = useResponsive();
  const [seatOpen, setSeatOpen] = useState<number | null>(null);
  const [seatSession, setSeatSession] = useState(0);
  const [voteOpen, setVoteOpen] = useState(false);
  const [voteSession, setVoteSession] = useState(0);
  const [eventOpen, setEventOpen] = useState(false);
  const [eventSession, setEventSession] = useState(0);
  const [skillOpen, setSkillOpen] = useState(false);
  const [skillSession, setSkillSession] = useState(0);
  const [profileOpen, setProfileOpen] = useState(false);
  const [profileSession, setProfileSession] = useState(0);
  const [gridWidth, setGridWidth] = useState(0);
  const counts = notebookMarkCounts(notebook);
  const board = boardById(notebook.boardId);
  const roles = board ? boardRoles(board) : PLAYER_ROLE_IDS;
  const marks: SeatMark[] = ['wolf', 'good', 'god', ...(roles.some(isVillager) ? ['villager' as const] : [])];
  const aliveCount = Object.values(notebook.seatNotes).filter(note => !note.eliminated).length;
  const gap = spacing.sm;
  const columns = gridWidth ? Math.max(2, Math.min(responsive.maxSeatColumns, Math.floor((gridWidth + gap) / (84 + gap)))) : 4;
  const seatWidth = gridWidth ? (gridWidth - gap * (columns - 1)) / columns : undefined;
  const rounds = [...new Set(notebook.votes.map(vote => vote.round))].sort((a, b) => a - b);
  const events = [...notebook.events].reverse();
  const skillUses = [...notebook.skillUses].reverse();

  return (
    <>
      <ScrollView contentContainerStyle={[styles.scrollContent, { paddingHorizontal: responsive.gutter, width: '100%', maxWidth: responsive.maxContentWidth, alignSelf: 'center' }]} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        <View style={styles.boardHeader}>
          <View style={styles.sectionHead}>
            <View style={styles.flex}>
              <Text style={styles.caption}>本局记录</Text>
              <Text accessibilityRole="header" style={styles.boardTitle}>{notebook.gameName || '我的玩家笔记'}</Text>
            </View>
            <Button title="编辑" variant="ghost" small onPress={() => { setProfileSession(value => value + 1); setProfileOpen(true); }} />
          </View>
          <View style={styles.chipRow}>
            <Chip>{notebook.boardName}</Chip>
            <Chip>{notebook.playerCount} 人局</Chip>
            <Chip tone="success">{aliveCount} 人在场</Chip>
            <Chip tone="accent">我是 {notebook.ownSeat} 号</Chip>
            <Chip>{ROLES[notebook.ownRole].name}</Chip>
          </View>
          <Text style={styles.footnote}>只保存在本机，不读取主持人的对局。</Text>
        </View>

        <View style={styles.card}>
          <View style={styles.sectionHead}><Text style={styles.sectionTitle}>座位判断</Text><Text style={styles.caption}>{counts.wolf} 个狼坑</Text></View>
          <View style={styles.legend}>
            {marks.map(mark => (
              <View key={mark} style={styles.legendItem}><View style={[styles.legendDot, MARK_DOTS[mark]]} /><Text style={styles.legendText}>{SEAT_MARK_LABELS[mark]}</Text></View>
            ))}
          </View>
          <Text style={styles.footnote}>点座位可标记出局，也可以编辑这个座位的具体身份、身份判断和备注。</Text>
          <View style={styles.boardGrid} onLayout={event => setGridWidth(event.nativeEvent.layout.width)}>
            {Array.from({ length: notebook.playerCount }, (_, index) => index + 1).map(seat => {
              const note = notebook.seatNotes[seat];
              const own = seat === notebook.ownSeat;
              const guess = note.roleGuess ? ROLES[note.roleGuess].short : '';
              const shortMark = [SEAT_MARK_SHORT[note.mark], guess].filter(Boolean).join(' · ');
              return (
                <MotionPressable
                  key={seat}
                  accessibilityRole="button"
                  accessibilityLabel={`${seat}号${own ? `，我的座位，${ROLES[notebook.ownRole].name}` : `，${SEAT_MARK_LABELS[note.mark]}${note.roleGuess ? `，猜测${ROLES[note.roleGuess].name}` : ''}`}${note.note ? '，有备注' : ''}${note.eliminated ? '，已出局' : ''}`}
                  onPress={() => { setSeatSession(value => value + 1); setSeatOpen(seat); }}
                  style={({ pressed }) => [styles.seatCard, seatWidth ? { width: seatWidth } : undefined, own && styles.seatCardOwn, note.eliminated && styles.seatCardEliminated, pressed && { opacity: 0.65 }]}
                >
                  {note.eliminated ? <View pointerEvents="none" style={styles.seatCardStrike} /> : null}
                  <View style={styles.seatCardTop}>
                    <Text style={[styles.seatCardNumber, note.eliminated && styles.seatCardNumberEliminated]}>{seat}</Text>
                    {note.note ? <View style={styles.seatCardNote} /> : null}
                  </View>
                  {own ? <Text style={styles.seatCardRole}>{ROLES[notebook.ownRole].short} · 我</Text> : <Text style={[styles.seatCardMark, { color: MARK_COLORS[note.mark] }]} numberOfLines={1}>{shortMark || '—'}</Text>}
                </MotionPressable>
              );
            })}
          </View>
        </View>

        <View style={styles.card}>
          <View style={styles.sectionHead}><Text style={styles.sectionTitle}>事件速记</Text><Button title="记一条" variant="secondary" small onPress={() => { setEventSession(value => value + 1); setEventOpen(true); }} /></View>
          {events.length ? events.map(event => (
            <View key={event.id} style={styles.recordRow}>
              <View style={styles.flex}>
                <Text style={styles.recordMeta}>{roundLabel(event.phase, event.round)} · {EVENT_PHASE_LABELS[event.phase]}</Text>
                <Text style={styles.recordText}>{event.text}</Text>
              </View>
              <Button title="删除" variant="ghost" small onPress={() => onChange(removeEvent(notebook, event.id))} />
            </View>
          )) : <Text style={styles.footnote}>还没有事件。夜里记刀口和查验，白天记起跳和出局。</Text>}
        </View>

        <View style={styles.card}>
          <View style={styles.sectionHead}><Text style={styles.sectionTitle}>我的技能</Text><Button title="记一次" variant="secondary" small onPress={() => { setSkillSession(value => value + 1); setSkillOpen(true); }} /></View>
          {skillUses.length ? skillUses.map(use => (
            <View key={use.id} style={styles.recordRow}>
              <View style={styles.flex}>
                <Text style={styles.recordMeta}>第 {use.round} 轮 · {use.skill}{use.target !== null ? ` → ${use.target} 号` : ''}</Text>
                {use.result ? <Text style={styles.recordText}>{use.result}</Text> : null}
              </View>
              <Button title="删除" variant="ghost" small onPress={() => onChange(removeSkillUse(notebook, use.id))} />
            </View>
          )) : <Text style={styles.footnote}>还没有技能记录。可以记查验、用药、守护或开枪。</Text>}
        </View>

        <View style={styles.card}>
          <View style={styles.sectionHead}><Text style={styles.sectionTitle}>票型记录（可选）</Text><Button title="记一票" variant="secondary" small onPress={() => { setVoteSession(value => value + 1); setVoteOpen(true); }} /></View>
          {rounds.length ? rounds.map(round => (
            <View key={round}>
              <Text style={styles.voteRound}>第 {round} 轮</Text>
              {notebook.votes.filter(vote => vote.round === round).map(vote => (
                <View key={vote.id} style={styles.voteRow}>
                  <Text style={styles.voteText}>{vote.voter} 号 → {vote.target === null ? '弃票' : `${vote.target} 号`}</Text>
                  <Button title="删除" variant="ghost" small onPress={() => onChange(removeVote(notebook, vote.id))} />
                </View>
              ))}
            </View>
          )) : <Text style={styles.footnote}>还没有记录票型。可以只记狼坑，不记票。</Text>}
        </View>

        <View style={styles.card}>
          <View style={styles.sectionHead}><Text style={styles.sectionTitle}>个人总结</Text><Text style={styles.caption}>{notebook.summary.length} / 2000</Text></View>
          <TextInput
            accessibilityLabel="个人总结"
            value={notebook.summary}
            onChangeText={text => onChange(setSummary(notebook, text))}
            placeholder="例如：3 号发言像预，7 号一直保 4 号；下一轮想听 9 号解释。"
            placeholderTextColor={colors.textTertiary}
            style={[styles.input, styles.summaryInput]}
            multiline
            maxLength={2000}
          />
        </View>

        <Button title="清除本局笔记" variant="ghost" onPress={onReset} style={styles.reset} />
      </ScrollView>
      <PlayerSeatSheet key={`seat-${seatSession}`} notebook={notebook} seat={seatOpen} onChange={onChange} onClose={() => setSeatOpen(null)} />
      <PlayerProfileSheet key={`profile-${profileSession}`} notebook={notebook} visible={profileOpen} onChange={onChange} onClose={() => setProfileOpen(false)} />
      <PlayerVoteSheet key={`vote-${voteSession}`} notebook={notebook} visible={voteOpen} onChange={onChange} onClose={() => setVoteOpen(false)} />
      <PlayerEventSheet key={`event-${eventSession}`} notebook={notebook} visible={eventOpen} onChange={onChange} onClose={() => setEventOpen(false)} />
      <PlayerSkillSheet key={`skill-${skillSession}`} notebook={notebook} visible={skillOpen} onChange={onChange} onClose={() => setSkillOpen(false)} />
    </>
  );
}
