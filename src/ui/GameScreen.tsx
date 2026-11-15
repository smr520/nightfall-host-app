import React, { useEffect, useRef, useState } from 'react';
import { Pressable, Text, TextInput, View, type ScrollViewInstance } from 'react-native';
import { colors, type } from '../theme';
import { alive } from '../game/engine';
import { canExplode } from '../game/role-behavior';
import type { Action, Game, Stage } from '../game/types';
import { Button, Divider, InlineError, PageTransition, SeatGrid, Sheet, TabBar, TopBar } from './kit';
import { isNightStageId, stageInfo } from './labels';
import { speechSecondsForGame } from '../game/speech';
import { SeatsPage } from './game/SeatsPage';
import { LogPage } from './game/LogPage';
import { MorePage } from './game/MorePage';
import { TemporarySpeech } from './game/TemporarySpeech';
import { useSpeechClock } from '../hooks/useSpeechClock';
import { shouldSplitHost, useResponsive } from './responsive';
import { styles } from './game/styles';
import { emptyDraft, type Draft } from './game/draft';
import { HostPage } from './game/HostPage';
import { HostFooter } from './game/HostFooter';
import type { HostTextSize } from '../game/preferences';
import { hostTasks } from '../game/host-tasks';
import { HostSupportSheet } from './game/HostSupportSheet';

type Tab = 'host' | 'seats' | 'log' | 'more';

const TABS: { key: Tab; label: string }[] = [
  { key: 'host', label: '主持' },
  { key: 'seats', label: '座位' },
  { key: 'log', label: '记录' },
  { key: 'more', label: '更多' },
];

export function GameScreen({ game, canUndo, canRedo, error, selectionRevision, hostTextSize = 'standard', onBack, onUndo, onRedo, onReset, onOpenReference, dispatch }: {
  game: Game;
  canUndo: boolean;
  canRedo: boolean;
  error: string;
  selectionRevision: number;
  hostTextSize?: HostTextSize;
  onBack: () => void;
  onUndo: () => void;
  onRedo: () => void;
  onReset: () => void;
  onOpenReference?: () => void;
  dispatch: (action: Action) => boolean;
}) {
  const scope = `${game.day}:${game.stage}:${game.vote?.round ?? 0}:${game.pending[0]?.seat ?? ''}:${selectionRevision}`;
  const speechClock = useSpeechClock(`${game.id}:${scope}`, speechSecondsForGame(game));
  const [tab, setTab] = useState<Tab>('host');
  const [showRoles, setShowRoles] = useState(false);
  const [toolsOpen, setToolsOpen] = useState(false);
  const [finishOpen, setFinishOpen] = useState(false);
  const [finishWinner, setFinishWinner] = useState<'good' | 'wolf' | 'third' | 'draw'>('good');
  const [finishReason, setFinishReason] = useState('');
  const [temporaryOpen, setTemporaryOpen] = useState(false);
  const [notesOpen, setNotesOpen] = useState(false);
  const [supportOpen, setSupportOpen] = useState(false);
  const [noteText, setNoteText] = useState('');
  const [draft, setDraft] = useState<Draft>(() => emptyDraft(scope, game));
  const [direction, setDirection] = useState(1);
  const scroll = useRef<ScrollViewInstance>(null);
  const tabIndex = useRef(0);

  if (draft.scope !== scope) {
    const pkSpeaking = game.vote?.round === 2 && draft.voteRound === 1 && game.vote.kind === draft.voteKind;
    setDraft({ ...emptyDraft(scope, game), pkSpeaking });
    setToolsOpen(false);
    setFinishOpen(false);
    setTemporaryOpen(false);
    setNotesOpen(false);
    setSupportOpen(false);
  }
  useEffect(() => { scroll.current?.scrollTo({ y: 0, animated: false }); }, [game.day, game.stage]);

  const changeTab = (next: Tab) => {
    const nextIndex = TABS.findIndex(item => item.key === next);
    setDirection(nextIndex >= tabIndex.current ? 1 : -1);
    tabIndex.current = nextIndex;
    setTab(next);
  };

  const patch = (next: Partial<Draft>) => setDraft(current => ({ ...current, ...next }));
  const stage = game.stage;
  const info = stageInfo(stage, game);
  const vote = game.vote;
  const unrecorded = vote?.voters.filter(seat => vote.ballots[seat] === undefined) ?? [];
  const activeVoter = draft.voter !== null && vote?.voters.includes(draft.voter) ? draft.voter : unrecorded[0] ?? null;
  const voteRecorded = vote ? vote.voters.every(seat => vote.ballots[seat] !== undefined) : false;

  const doAction = (action: Action) => {
    if (dispatch(action)) patch({ selected: null, identitySeats: [], dance: [], poison: null, save: false, ...(action.type === 'ballot' || action.type === 'ballots' ? { voter: null, batchVoters: [] } : {}) });
  };
  const responsive = useResponsive();
  const supportTaskCount = hostTasks(game.players.map(player => player.role)).length;
  const hostPage = (
    <HostPage
      game={game}
      stage={stage as Stage}
      draft={draft}
      patch={patch}
      doAction={doAction}
      showRoles={showRoles}
      scroll={scroll}
      error={error}
      activeVoter={activeVoter}
      speechClock={speechClock}
      hostTextSize={hostTextSize}
      supportTaskCount={supportTaskCount}
      onOpenTools={() => setToolsOpen(true)}
      onOpenSupport={() => setSupportOpen(true)}
      onGoSeats={() => changeTab('seats')}
      onGoLog={() => changeTab('log')}
      onTemporarySpeech={() => { speechClock.select(null); setTemporaryOpen(true); }}
      onNote={() => setNotesOpen(true)}
      footer={(
        <HostFooter
          game={game}
          stage={stage}
          draft={draft}
          activeVoter={activeVoter}
          voteRecorded={voteRecorded}
          canUndo={canUndo}
          doAction={doAction}
          onEndPk={() => { speechClock.select(null); patch({ pkSpeaking: false, selected: null, voter: null }); }}
          onUndo={onUndo}
          onBack={onBack}
        />
      )}
    />
  );

  return (
    <View style={styles.root}>
      <TopBar
        title={`第 ${game.day} ${isNightStageId(stage) || stage === 'dawn' || stage === 'dawn-announcement' ? '夜' : '日'} · ${info.short}`}
        subtitle={game.name}
        onBack={onBack}
        right={<View style={styles.liveCount}><Text style={styles.liveCountValue}>{alive(game).length}<Text style={styles.liveCountTotal}> / {game.players.length}</Text></Text><Text style={styles.liveCountLabel}>在场</Text></View>}
      />
      {shouldSplitHost(responsive.width, tab) ? (
        <View testID="game-split" style={styles.split}>
          <View style={styles.splitHost}>{hostPage}</View>
          <View style={styles.splitSide}>
            <View style={styles.splitSideHead}><Text style={type.caption}>座位一览 · 仅主持人可见</Text><Text style={type.caption}>{alive(game).length} / {game.players.length}</Text></View>
            <SeatsPage game={game} showRoles={showRoles} onToggleRoles={setShowRoles} />
          </View>
        </View>
      ) : (
      <PageTransition pageKey={tab} direction={direction}>
        {tab === 'host' ? hostPage : null}
        {tab === 'seats' ? <SeatsPage game={game} showRoles={showRoles} onToggleRoles={setShowRoles} /> : null}
        {tab === 'log' ? <LogPage game={game} /> : null}
        {tab === 'more' ? (
          <MorePage
            game={game}
            canUndo={canUndo}
            canRedo={canRedo}
            supportTaskCount={supportTaskCount}
            onUndo={onUndo}
            onRedo={onRedo}
            onFinish={() => setFinishOpen(true)}
            onReset={onReset}
            onOpenReference={onOpenReference}
            onOpenTools={() => setToolsOpen(true)}
            onOpenSupport={() => setSupportOpen(true)}
            onTemporarySpeech={() => { speechClock.select(null); setTemporaryOpen(true); }}
            onNote={() => setNotesOpen(true)}
          />
        ) : null}
      </PageTransition>
      )}

      <TabBar tabs={TABS.map(item => ({ ...item, hint: item.key === 'seats' ? `${alive(game).length}` : item.key === 'log' ? `${game.events.length}` : undefined }))} value={tab} onChange={changeTab} />

      <TemporarySpeech game={game} visible={temporaryOpen} onClose={() => setTemporaryOpen(false)} />
      <HostSupportSheet game={game} visible={supportOpen} onClose={() => setSupportOpen(false)} dispatch={dispatch} />
      <Sheet visible={notesOpen} onClose={() => setNotesOpen(false)} title="现场备忘" subtitle="只记在主持记录里，不推进流程、不对玩家播报" footer={<Button title="保存备忘" disabled={!noteText.trim()} onPress={() => { if (dispatch({ type: 'note', text: noteText })) { setNoteText(''); setNotesOpen(false); } }} />}>
        <Text style={type.footnote}>可记录特殊技能剩余次数、附加能力、临时约定或裁定理由。涉及玩家时请写明座位号。</Text>
        <TextInput accessibilityLabel="现场备忘内容" value={noteText} onChangeText={setNoteText} multiline maxLength={1200} placeholder="例如：7 号获得商人授予的查验能力，尚未使用" placeholderTextColor={colors.textTertiary} style={[styles.input, styles.noteInput]} />
        {error ? <InlineError>{error}</InlineError> : null}
      </Sheet>

      <Sheet visible={toolsOpen} onClose={() => setToolsOpen(false)} title="自爆与人工裁定" subtitle="仅主持人可见，用于现场特例">
        <Text style={type.caption}>狼人自爆</Text>
        <SeatGrid game={game} selected={draft.selected} onSelect={seat => patch({ selected: draft.selected === seat ? null : seat })} showRoles filter={p => canExplode(game, p.seat)} />
        {!game.players.some(p => canExplode(game, p.seat)) ? <Text style={type.footnote}>当前没有可自爆的狼人。</Text> : null}
        <Button title={draft.selected ? `确认 ${draft.selected} 号自爆` : '先选择自爆的狼人'} variant="danger" disabled={!game.players.some(p => p.seat === draft.selected && canExplode(game, p.seat))} onPress={() => { const seat = draft.selected; setToolsOpen(false); if (seat !== null) doAction({ type: 'explode', seat }); }} />
        <Divider />
        <Text style={type.caption}>人工裁定</Text>
        <Text style={type.footnote}>现场出现特殊结算时，直接调整玩家状态并留下理由。</Text>
        <SeatGrid game={game} selected={draft.ruleSeat} onSelect={seat => patch({ ruleSeat: draft.ruleSeat === seat ? null : seat })} showRoles tapDead />
        <TextInput accessibilityLabel="人工裁定原因" value={draft.ruleReason} onChangeText={value => patch({ ruleReason: value })} placeholder="裁定原因（至少 2 个字）" placeholderTextColor={colors.textTertiary} style={styles.input} />
        <Button
          title={draft.ruleSeat ? `${draft.ruleSeat} 号${game.players.find(p => p.seat === draft.ruleSeat)?.alive ? '改为出局' : '恢复存活'}` : '先选择要裁定的玩家'}
          variant="secondary"
          disabled={draft.ruleSeat === null || draft.ruleReason.trim().length < 2}
          onPress={() => { const seat = draft.ruleSeat; if (seat === null) return; const player = game.players.find(p => p.seat === seat); setToolsOpen(false); doAction({ type: 'ruling', seat, alive: !player?.alive, reason: draft.ruleReason }); }}
        />
      </Sheet>

      <Sheet visible={finishOpen} onClose={() => setFinishOpen(false)} title="裁定结束本局" subtitle="用于提前结束或规则无法继续的情况"
        footer={<Button title={game.pending.length ? `放弃 ${game.pending.length} 项待办并结束` : '确认结束'} variant="danger" disabled={finishReason.trim().length < 2} onPress={() => { if (dispatch({ type: 'finish', winner: finishWinner, reason: finishReason, discardPending: game.pending.length > 0 })) setFinishOpen(false); }} />}>
        {game.pending.length ? <InlineError>仍有 {game.pending.length} 项遗言、出局技能或警徽待处理。现在结束会明确放弃这些待办，请确认不是误触。</InlineError> : null}
        <View style={styles.choiceGroup}>
          {([['好人胜', 'good'], ['狼人胜', 'wolf'], ['第三方胜', 'third'], ['平局', 'draw']] as const).map(([label, value]) => (
            <Pressable key={value} accessibilityRole="button" accessibilityState={{ selected: finishWinner === value }} accessibilityLabel={label} onPress={() => setFinishWinner(value)} style={[styles.choice, finishWinner === value && styles.choiceActive]}>
              <Text style={[styles.choiceText, finishWinner === value && styles.choiceTextActive]}>{label}</Text>
            </Pressable>
          ))}
        </View>
        <TextInput accessibilityLabel="结束原因" value={finishReason} onChangeText={setFinishReason} placeholder="例如：现场决定重开" placeholderTextColor={colors.textTertiary} style={styles.input} />
      </Sheet>
    </View>
  );
}
