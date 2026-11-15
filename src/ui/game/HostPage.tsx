import React from 'react';
import { Pressable, ScrollView, Text, View, type ScrollViewInstance } from 'react-native';
import { callActorStatus, callIdentitySeats, getNightAnnouncement, nightCallIdentityConfirmed, nightIdentitySeats } from '../../game/engine';
import { isNightStage } from '../../game/host-ui';
import { hostingProgress } from '../../game/hosting-reference';
import { hostNarration, latestPublicOutcome } from '../../game/narration';
import { ROLES } from '../../game/roles';
import type { Action, Game, NightCall, Stage } from '../../game/types';
import { Button, Card, InlineError, SeatGrid } from '../kit';
import { stageInfo } from '../labels';
import { SpeechTimer } from './SpeechTimer';
import { DawnReview, dawnDraftNeedsConfirmation } from './DawnReview';
import type { SpeechClock } from '../../hooks/useSpeechClock';
import { VotePanel } from './VotePanel';
import { Icon } from '../Icon';
import { useResponsive } from '../responsive';
import { colors, type } from '../../theme';
import { styles } from './styles';
import type { Draft } from './draft';
import { EndedPanel, HuntButton, NineTailsMarks, NightRecords, PendingPanel, WitchPanel } from './HostPanels';
import type { HostTextSize } from '../../game/preferences';
import { hostTextMetrics } from '../host-text';

export function HostPage({ game, stage, draft, patch, doAction, showRoles, scroll, error, activeVoter, speechClock, hostTextSize = 'standard', supportTaskCount = 0, onOpenTools, onOpenSupport = () => {}, onGoSeats, onGoLog, onTemporarySpeech, onNote, footer }: {
  game: Game;
  stage: Stage;
  draft: Draft;
  patch: (next: Partial<Draft>) => void;
  doAction: (action: Action) => void;
  showRoles: boolean;
  scroll: React.RefObject<ScrollViewInstance | null>;
  error: string;
  activeVoter: number | null;
  speechClock: SpeechClock;
  hostTextSize?: HostTextSize;
  supportTaskCount?: number;
  onOpenTools: () => void;
  onOpenSupport?: () => void;
  onGoSeats: () => void;
  onGoLog: () => void;
  onTemporarySpeech: () => void;
  onNote: () => void;
  footer: React.ReactNode;
}) {
  const info = stageInfo(stage, game);
  const responsive = useResponsive();
  const hostText = hostTextMetrics(hostTextSize);
  const headlineTextStyle = { fontSize: hostText.headlineSize, lineHeight: hostText.headlineLineHeight };
  const scriptTextStyle = { fontSize: hostText.scriptSize, lineHeight: hostText.scriptLineHeight };
  const privateTextStyle = { fontSize: hostText.privateSize, lineHeight: hostText.privateLineHeight };
  const ruleTextStyle = { fontSize: Math.max(15, hostText.privateSize), lineHeight: Math.max(23, hostText.privateLineHeight) };
  const narrationGame = dawnDraftNeedsConfirmation(game, draft.dawn) ? { ...game, night: { ...game.night, manualDeaths: undefined } } : game;
  const narration = hostNarration(narrationGame, info.script, { selected: draft.selected, activeVoter, speaker: speechClock.speaker, signup: draft.signup, pkSpeaking: draft.pkSpeaking, voteMode: draft.voteMode, batchVoters: draft.batchVoters, editingVoter: draft.voter });
  const recentOutcome = draft.selected === null && draft.poison === null && !draft.save && speechClock.speaker === null ? latestPublicOutcome(game) : null;
  const night = isNightStage(stage);
  const meta = night && stage !== 'wolves' ? ROLES[stage as keyof typeof ROLES] : null;
  const progress = hostingProgress(game);
  const actorStatus = night ? callActorStatus(game, stage as NightCall) : { hasActor: true, canAct: true, blockedByFear: false };
  const vote = game.vote;
  const pending = game.pending[0];
  const identityConfirmed = game.identityConfirmed ?? [];
  const identityMode = game.rules.flow?.identityCheck;
  const progressiveIdentity = night
    && stage !== 'identity-check'
    && (identityMode === 'during-night' || identityMode === 'at-nightfall' && identityConfirmed.length >= game.players.length);
  const expectedIdentitySeats = progressiveIdentity ? callIdentitySeats(game, stage as NightCall) : [];
  const identityRequired = progressiveIdentity
    && identityMode === 'during-night'
    && !nightCallIdentityConfirmed(game, stage as NightCall);
  const identitySeats = expectedIdentitySeats.filter(seat => identityConfirmed.includes(seat));
  const identityTotal = progressiveIdentity
    ? identityMode === 'at-nightfall' ? game.players.length : nightIdentitySeats(game).length
    : 0;
  const identityUnit = identityMode === 'at-nightfall' ? '个已确认座位' : '个夜间行动座位';
  const identityLabel = stage === 'wolves' ? '狼人阵营' : ROLES[stage as keyof typeof ROLES]?.name ?? '当前角色';
  const identityHint = identityRequired
    ? `请按本局实际身份牌，选出本步应睁眼的 ${expectedIdentitySeats.length} 个座位。`
    : actorStatus.blockedByFear
    ? '角色仍存活，但本夜被恐惧，不能行动；本步仍保留身份核对。'
    : !actorStatus.hasActor
      ? '角色已出局，按赛前设置保留空唤醒，不录入行动。'
      : '本步身份已确认，立即完成本步技能。';

  return (
    <View style={styles.flex}>
      <ScrollView ref={scroll} contentContainerStyle={[styles.content, { paddingHorizontal: responsive.gutter, width: '100%', maxWidth: responsive.maxContentWidth, alignSelf: 'center' }]} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        {recentOutcome ? <View style={styles.publicOutcome}>
          <View style={styles.scriptEyebrow}><Icon name="check" size={16} color={colors.danger} /><Text style={styles.outcomeLabel}>刚刚公布的结果</Text></View>
          <Text accessibilityRole="header" accessibilityLabel="刚刚公布的大字结果" style={[styles.speechHeadline, headlineTextStyle, styles.outcomeHeadline]}>{recentOutcome.headline}</Text>
          <Text accessibilityLabel="刚刚公布的台词" selectable style={[styles.script, scriptTextStyle]}>{recentOutcome.spoken}</Text>
        </View> : null}
        <View style={styles.stageHead}>
          <View style={styles.rowBetween}>
            <View style={styles.scriptEyebrow}><Icon name={night ? 'moon' : 'mic'} size={18} color={colors.clay} /><Text style={styles.scriptLabel}>主持人口播 · {info.title}</Text></View>
            <Text style={styles.scriptPage}>{String(game.day).padStart(2, '0')}</Text>
          </View>
          <Text accessibilityRole="header" accessibilityLabel="本环节大字提示" style={[styles.speechHeadline, headlineTextStyle, (stage === 'dawn' || stage === 'dawn-announcement' || stage === 'hunter' || stage === 'shot' || stage === 'link') && styles.outcomeHeadline]}>{narration.headline}</Text>
          <View style={styles.scriptTextWrap}><Text accessibilityLabel="完整主持台词" selectable style={[styles.script, scriptTextStyle]}>{narration.spoken}</Text></View>
        </View>

        <View style={styles.stepGuide}>
          <View style={styles.stepGuideHead}>
            <Icon name="check" size={17} color={colors.text} />
            <Text accessibilityRole="header" style={styles.stepGuideTitle}>本步必须完成</Text>
          </View>
          <Text accessibilityLabel="本步必须完成内容" selectable style={[styles.stepGuideText, ruleTextStyle]}>{progress.check}</Text>
          {info.help ? <View style={styles.stepRule}>
            <Text accessibilityRole="header" style={styles.stepRuleTitle}>规则提醒</Text>
            <Text accessibilityLabel="本步规则提醒" selectable style={[styles.stepGuideText, ruleTextStyle]}>{info.help}</Text>
          </View> : null}
          {narration.privateNote ? <Text style={type.footnote}>私密刀口、身份和技能目标只显示在下方“仅主持人看”区域。</Text> : null}
        </View>

        {stage !== 'ended' ? <View style={styles.operationHead}><View style={styles.scriptEyebrow}><Icon name="shield" size={16} color={colors.textTertiary} /><Text style={[styles.operationLabel, { fontSize: hostText.operationSize }]}>主持人操作</Text></View><Text style={styles.operationHint}>以下内容不用念</Text></View> : null}
        {supportTaskCount > 0 && stage !== 'ended' ? (
          <View style={styles.supportBanner}>
            <View style={styles.supportBannerText}>
              <Text style={type.callout}>本局有 {supportTaskCount} 项特殊技能需要核对</Text>
              <Text style={type.footnote}>打开清单，写明本次座位、目标、次数或裁定结果。</Text>
            </View>
            <Button title="打开技能清单" variant="secondary" small onPress={onOpenSupport} />
          </View>
        ) : null}
        {narration.privateNote ? <View style={styles.privatePrompt}><Text style={styles.privateLabel}>仅主持人看</Text><Text style={[styles.privateText, privateTextStyle]}>{narration.privateNote}</Text></View> : null}

        {progressiveIdentity ? (
          <Card style={styles.panel}>
            <View style={styles.rowBetween}>
              <View style={styles.identityHead}>
                <Icon name="eye" size={18} color={colors.textSecondary} />
                <Text style={type.headline}>{identityRequired ? '确认本步身份/阵营' : '本步身份/阵营'}</Text>
              </View>
              <Text accessibilityLabel={`身份记录 ${identityConfirmed.length} / ${identityTotal} ${identityUnit}`} style={type.caption}>已记 {identityConfirmed.length} / {identityTotal} {identityUnit}</Text>
            </View>
            {identityRequired ? <>
              <Text accessibilityLabel="本步身份选择说明" style={type.footnote}>请点选本步实际睁眼的座位。选定 {expectedIdentitySeats.length} 个座位后才能进行本步行动；身份不会在赛前预设。</Text>
              <SeatGrid
                game={game}
                selected={null}
                multi={draft.identitySeats}
                onSelect={seat => patch({
                  identitySeats: draft.identitySeats.includes(seat)
                    ? draft.identitySeats.filter(item => item !== seat)
                    : draft.identitySeats.length >= expectedIdentitySeats.length
                      ? draft.identitySeats
                      : [...draft.identitySeats, seat],
                })}
                showRoles={false}
                tapDead
              />
              <Text accessibilityLabel="本步身份选择进度" style={styles.pickedLine}>
                已选：{draft.identitySeats.length ? draft.identitySeats.map(seat => `${seat}号`).join('、') : '尚未选择'}
              </Text>
            </> : <>
              <Text accessibilityLabel="本步身份座位" selectable style={styles.identitySeats}>{identitySeats.length ? identitySeats.map(seat => `${seat}号`).join('、') : '暂无可显示座位'}</Text>
            </>}
            <Text style={type.footnote}>{identityLabel}。{identityHint}{identityRequired ? '' : '公开台词仍只念角色名，不念座位号。'}</Text>
          </Card>
        ) : null}

        {stage === 'identity-check' ? (
          <Card style={styles.panel}>
            <View style={styles.rowBetween}>
              <Text style={type.headline}>旧版逐座身份核对</Text>
              <Text style={type.caption}>已确认 {identityConfirmed.length} / {game.players.length}</Text>
            </View>
            <Text style={type.footnote}>请玩家闭眼。主持人按座位逐人核对，公开只读座位号；具体身份留在上方“仅主持人看”区域。也可以点选其他未确认座位调整顺序。</Text>
            <SeatGrid
              game={game}
              selected={draft.selected}
              onSelect={seat => patch({ selected: draft.selected === seat ? null : seat })}
              showRoles={showRoles}
              filter={player => !identityConfirmed.includes(player.seat)}
            />
            <Text style={type.footnote}>全部 {game.players.length} 个座位确认完成后，才会进入第一个夜间角色行动。</Text>
          </Card>
        ) : null}

        {stage === 'last-words' && pending?.kind === 'last-words' ? (
          <Card style={styles.panel}>
            <View style={styles.rowBetween}>
              <Text style={type.headline}>当前遗言</Text>
              <Text style={type.caption}>{game.pending.filter(item => item.kind === 'last-words').length} 人待处理</Text>
            </View>
            <Text style={type.body}>{pending.seat} 号玩家按赛前约定进入遗言队列。可先计时，再确认发言结束或放弃遗言。</Text>
            <SpeechTimer
              game={game}
              clock={speechClock}
              eligibleSeats={[pending.seat]}
              label="遗言"
              autoSelectSingle
            />
          </Card>
        ) : null}

        {(stage === 'dawn' || stage === 'dawn-announcement') ? <DawnReview game={game} draft={draft.dawn} onChange={next => patch({ dawn: { ...draft.dawn, ...next } })} doAction={doAction} /> : null}

        {game.day === 1 && game.rules.sheriffTiming === 'after-announcement' && (stage === 'sheriff-signup' || stage === 'sheriff-vote') ? (
          <Card style={styles.panel}>
            <Text style={type.caption}>已公布的昨夜结果</Text>
            <Text style={type.headline}>{game.nightAnnouncement ?? getNightAnnouncement(game)}</Text>
            <Text style={type.footnote}>已出局玩家不再参与本次竞选或投票。</Text>
          </Card>
        ) : null}

        {night && stage !== 'witch' && !identityRequired ? (
          <Card style={styles.panel}>
            <View style={styles.rowBetween}>
              <Text style={type.headline}>{meta?.night?.targetLabel ?? '记录狼队刀口'}</Text>
              <Text style={type.caption}>{stage === 'dancer' ? `已选 ${draft.dance.length} / 3` : draft.selected === null ? '未选择' : `${draft.selected} 号`}</Text>
            </View>
            {!actorStatus.canAct ? <Text style={styles.inactiveNote}>{actorStatus.blockedByFear ? '这个角色仍然存活，但本夜被恐惧，不能行动。点击下方“跳过并继续”即可。' : '这个角色已经出局，本夜无需行动。点击下方“跳过并继续”即可。'}</Text> : null}
            {actorStatus.canAct ? (
              stage === 'dancer' ? (
                <SeatGrid
                  game={game}
                  selected={null}
                  multi={draft.dance}
                  onSelect={seat => patch({ dance: draft.dance.includes(seat) ? draft.dance.filter(item => item !== seat) : draft.dance.length >= 3 ? draft.dance : [...draft.dance, seat] })}
                  showRoles={showRoles}
                  filter={p => p.alive && !(game.special?.danceVisited ?? []).includes(p.seat)}
                />
              ) : (
                <SeatGrid
                  game={game}
                  selected={draft.selected}
                  onSelect={seat => patch({ selected: draft.selected === seat ? null : seat })}
                  showRoles={showRoles}
                  filter={p => p.alive && !(stage === 'seer' && p.role === 'seer')}
                />
              )
            ) : null}
            {stage === 'dancer' ? <Text style={styles.pickedLine}>舞池：{draft.dance.length ? draft.dance.map(seat => `${seat} 号`).join('、') : '尚未选择'}（整局只能进一次舞池）</Text> : null}
            {stage === 'nine-tails' ? <NineTailsMarks game={game} /> : null}
            {stage === 'baize' ? <NineTailsMarks game={game} title="当前标记" /> : null}
            {stage === 'mech-wolf' ? <Text style={type.footnote}>{game.special?.mechLearned ? `已学习：${ROLES[game.special.mechLearned].name}（整局只能学习一次）` : '整局只能学习一次；学习后不会立即获得技能。'}</Text> : null}
            {stage === 'treasure-master' && game.special?.treasure ? (
              <View style={styles.borrowPanel}>
                <Text style={type.caption}>今晚借用哪张底牌？</Text>
                <View style={styles.toolRow}>
                  {[...new Set(game.special.treasure.reserve)].map(card => (
                    <Button
                      key={card}
                      title={game.special?.treasure?.borrowed === card ? `已借：${ROLES[card].name}` : `借用：${ROLES[card].name}`}
                      variant={game.special?.treasure?.borrowed === card ? 'primary' : 'secondary'}
                      small
                      disabled={game.special?.treasure?.lastBorrowed === card}
                      onPress={() => doAction({ type: 'borrow', card })}
                    />
                  ))}
                </View>
                <Text style={type.footnote}>连续两夜不能借用同一张。借用摄梦人、毒师、通灵师时天亮结果自动结算；借到猎人或狼王时出局技能按牌面处理。</Text>
              </View>
            ) : null}
            <NightRecords game={game} stage={stage} />
          </Card>
        ) : null}

        {stage === 'witch' && !identityRequired ? <WitchPanel game={game} showRoles={showRoles} draft={draft} patch={patch} actorStatus={actorStatus} /> : null}

        {stage === 'sheriff-signup' ? (
          <Card style={styles.panel}>
            <View style={styles.rowBetween}>
              <Text style={type.headline}>上警名单</Text>
              <Text style={type.caption}>{draft.signup.length} 人</Text>
            </View>
            <Text style={type.footnote}>点亮上警玩家并依次发言；退水时再次点选取消，最后确认留在警上的名单。</Text>
            <SeatGrid game={game} selected={null} multi={draft.signup} onSelect={seat => patch({ signup: draft.signup.includes(seat) ? draft.signup.filter(n => n !== seat) : [...draft.signup, seat] })} showRoles={showRoles} filter={p => p.alive && !p.exposed} />
            <Text style={styles.pickedLine}>当前上警：{draft.signup.length ? draft.signup.map(n => `${n}号`).join('、') : '无人'}</Text>
            {draft.signup.length ? <SpeechTimer game={game} clock={speechClock} eligibleSeats={draft.signup} label="警上发言" /> : null}
          </Card>
        ) : null}

        {(stage === 'sheriff-vote' || stage === 'exile-vote') && vote ? <VotePanel game={game} draft={draft} patch={patch} doAction={doAction} activeVoter={activeVoter} showRoles={showRoles} speechClock={speechClock} /> : null}

        {stage === 'discussion' ? (
          <Card style={styles.panel}>
            <SpeechTimer game={game} clock={speechClock} />
            <View style={styles.dayTools}>
            <Text style={styles.toolsLabel}>白天工具</Text>
            <View style={styles.toolRow}>
              <Button title="自爆 / 人工裁定" variant="secondary" small onPress={onOpenTools} style={styles.flex} />
              <Button title="查看座位" variant="secondary" small onPress={onGoSeats} style={styles.flex} />
            </View>
            {game.players.some(p => p.alive && p.role === 'nine-tails') ? <HuntButton game={game} doAction={doAction} /> : null}
            </View>
          </Card>
        ) : null}

        {(stage === 'hunter' || stage === 'shot' || stage === 'badge' || stage === 'heir') && pending ? <PendingPanel game={game} pending={pending} selected={draft.selected} onSelect={seat => patch({ selected: draft.selected === seat ? null : seat })} showRoles={showRoles} /> : null}

        {stage === 'link' && pending ? (
          <Card style={styles.panel}>
            <Text style={type.headline}>狼美人出局</Text>
            <Text style={type.body}>{pending.target ? `${pending.target} 号被魅惑，随之出局。` : '没有可带走的魅惑目标。'}</Text>
          </Card>
        ) : null}

        {stage === 'ended' ? <EndedPanel game={game} /> : null}

        {error ? <InlineError>{error}</InlineError> : null}

        {stage !== 'ended' ? <View style={styles.toolRow}>
          <Button title="临时发言 / 遗言" variant="ghost" small onPress={onTemporarySpeech} style={styles.flex} />
          <Button title="现场备忘" variant="ghost" small onPress={onNote} style={styles.flex} />
        </View> : null}
        {game.rules.flow?.manualVictory && stage !== 'ended' ? <Text style={type.footnote}>本局胜负由主持人确认；满足本桌胜利条件后，到“更多”结束并选择获胜阵营。</Text> : null}

        <View style={styles.nextStep}><Icon name="chevron-right" size={16} color={colors.textTertiary} /><Text style={[styles.nextStepText, hostTextSize !== 'standard' && { fontSize: hostText.operationSize + 2, lineHeight: hostText.operationSize + 7 }]}>下一环节：{progress.next}</Text></View>

        <View style={styles.bottomMeta}>
          <Pressable accessibilityRole="button" accessibilityLabel="查看主持记录" onPress={onGoLog} style={styles.logLink}><Icon name="history" size={16} color={colors.textSecondary} /><Text style={styles.linkText}>主持记录 · {game.events.length} 条</Text></Pressable>
          <Text style={type.footnote}>{game.sheriff ? `警长 ${game.sheriff} 号` : '暂无警长'}</Text>
        </View>
      </ScrollView>
      {footer}
    </View>
  );
}
