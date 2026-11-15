import React from 'react';
import { Text, View } from 'react-native';
import { callActorAlive } from '../../game/engine';
import { canNightStageProceed, getStageActionLabel, isNightStage } from '../../game/host-ui';
import type { Action, Game, NightCall, Stage } from '../../game/types';
import { Button } from '../kit';
import { styles } from './styles';
import type { Draft } from './draft';
import { dawnDraftNeedsConfirmation } from './DawnReview';

export function HostFooter({ game, stage, draft, activeVoter, voteRecorded, doAction, onEndPk, onBack }: {
  game: Game;
  stage: Stage;
  draft: Draft;
  activeVoter: number | null;
  voteRecorded: boolean;
  doAction: (action: Action) => void;
  onEndPk: () => void;
  onBack: () => void;
}) {
  const night = isNightStage(stage);
  const actorAlive = night ? callActorAlive(game, stage as NightCall) : true;
  const targetRequired = night ? canNightStageProceed(stage, actorAlive) : false;
  const pending = game.pending[0];
  const voting = stage === 'sheriff-vote' || stage === 'exile-vote';
  const editingBallot = draft.voteMode === 'individual' && draft.voter !== null && game.vote?.ballots[draft.voter] !== undefined;
  const groupPending = draft.voteMode === 'group' && draft.batchVoters.length > 0;

  const recordBallot = (target: number | null) => {
    if (activeVoter === null) return;
    doAction({ type: 'ballot', voter: activeVoter, target });
  };

  const commit = () => {
    if (night && !actorAlive) { doAction({ type: 'skip-night', reason: '行动角色已出局' }); return; }
    if (stage === 'guard' || stage === 'wolves' || stage === 'seer') {
      doAction({ type: stage, target: actorAlive ? draft.selected : null } as Action);
      return;
    }
    if (stage === 'witch') {
      doAction({ type: 'witch', save: actorAlive && draft.save, poison: actorAlive ? draft.poison : null });
      return;
    }
    if (night) { doAction({ type: 'call', callId: stage, target: actorAlive ? draft.selected : null }); return; }
    if (stage === 'dawn') { if (!dawnDraftNeedsConfirmation(game, draft.dawn)) doAction({ type: 'dawn' }); return; }
    if (stage === 'dawn-announcement') { doAction({ type: 'announce-dawn' }); return; }
    if (stage === 'sheriff-signup') { doAction({ type: 'signup', seats: draft.signup }); return; }
    if (stage === 'sheriff-vote' || stage === 'exile-vote') {
      if (draft.pkSpeaking) { onEndPk(); return; }
      if (draft.voteMode === 'group') {
        if (groupPending && draft.selected !== null) doAction({ type: 'ballots', voters: draft.batchVoters, target: draft.selected });
        else if (!groupPending && voteRecorded) doAction({ type: 'count' });
        return;
      }
      if (editingBallot && activeVoter !== null && draft.selected !== null) recordBallot(draft.selected);
      else if (voteRecorded) doAction({ type: 'count' });
      else if (activeVoter !== null && draft.selected !== null) recordBallot(draft.selected);
      return;
    }
    if (stage === 'discussion') { doAction({ type: 'start-exile' }); return; }
    if (stage === 'last-words') { doAction({ type: 'last-words', speak: true }); return; }
    if (stage === 'dancer') { doAction({ type: 'dance', seats: draft.dance }); return; }
    if (stage === 'heir') { doAction({ type: 'heir', target: draft.selected }); return; }
    if (stage === 'hunter' || stage === 'shot' || stage === 'badge') { doAction({ type: stage, target: draft.selected } as Action); return; }
    if (stage === 'link') doAction({ type: 'link', target: pending?.target ?? null });
  };

  let primaryLabel = getStageActionLabel({ stage, targetRequired, selectedTarget: draft.selected, selectedVoter: activeVoter, voteRecorded });
  let primaryDisabled = targetRequired && draft.selected === null;
  if (stage === 'dancer') { primaryLabel = draft.dance.length === 3 ? `确认舞池：${draft.dance.map(seat => `${seat} 号`).join('、')}` : `再选 ${3 - draft.dance.length} 名舞池玩家`; primaryDisabled = draft.dance.length !== 3; }
  if (stage === 'nine-tails') { primaryLabel = draft.selected === null ? '选择要标记的玩家' : `标记 ${draft.selected} 号`; primaryDisabled = draft.selected === null; }
  if (stage === 'baize') { primaryLabel = draft.selected === null ? '选择要清除标记的玩家（可空过）' : `清除 ${draft.selected} 号的标记`; }
  if (stage === 'mech-wolf') { primaryLabel = game.special?.mechLearned ? '机械狼已学习，跳过并继续' : draft.selected === null ? '选择学习目标（可空过）' : `学习 ${draft.selected} 号`; }
  if (stage === 'treasure-master' && game.special?.treasure?.borrowed == null) { primaryLabel = '先选择今晚借用的底牌'; primaryDisabled = true; }
  if (stage === 'heir') { primaryLabel = draft.selected === null ? '选择白泽的继承人' : `确认 ${draft.selected} 号为继承人`; primaryDisabled = draft.selected === null; }
  if (stage === 'sheriff-vote' || stage === 'exile-vote') primaryDisabled = !voteRecorded && (activeVoter === null || draft.selected === null);
  if (voting && draft.voteMode === 'group') {
    primaryLabel = groupPending ? draft.selected === null ? '先选择得票人' : `记录 ${draft.batchVoters.length} 人投给 ${draft.selected} 号` : voteRecorded ? '完成计票' : '选择得票人和投票人';
    primaryDisabled = groupPending ? draft.selected === null : !voteRecorded;
  }
  if (voting && editingBallot) {
    primaryLabel = draft.selected === null ? `选择 ${activeVoter} 号的新投票` : `更新 ${activeVoter} 号投给 ${draft.selected} 号`;
    primaryDisabled = draft.selected === null;
  }
  if (voting && draft.pkSpeaking) { primaryLabel = '发言结束，开始 PK 投票'; primaryDisabled = false; }
  if (stage === 'discussion') primaryLabel = '开始放逐投票';
  if (stage === 'ended') { primaryLabel = '返回首页'; primaryDisabled = false; }
  if (stage === 'last-words') {
    primaryLabel = pending?.kind === 'last-words' ? `确认 ${pending.seat} 号遗言结束` : '确认遗言结束';
    primaryDisabled = pending?.kind !== 'last-words';
  }
  if (stage === 'link') { primaryLabel = '确认殉情出局'; primaryDisabled = false; }
  if (stage === 'hunter' || stage === 'shot') {
    primaryLabel = draft.selected === null ? (stage === 'hunter' ? '选择开枪目标' : '选择带人目标') : stage === 'hunter' ? `确认开枪带走 ${draft.selected} 号` : `确认带走 ${draft.selected} 号`;
    primaryDisabled = draft.selected === null;
  }
  if (stage === 'badge') {
    primaryLabel = draft.selected === null ? '选择警徽继承人' : `移交 ${draft.selected} 号`;
    primaryDisabled = draft.selected === null;
  }
  if (stage === 'witch') primaryDisabled = false;
  if (stage === 'dawn' && game.rules.flow?.manualDawn && !game.night.manualDeaths) { primaryDisabled = true; primaryLabel = '先确认昨夜出局名单'; }
  if (stage === 'dawn' && dawnDraftNeedsConfirmation(game, draft.dawn)) primaryDisabled = true;

  const secondary = (() => {
    if (stage === 'sheriff-vote' || stage === 'exile-vote') {
      if (draft.pkSpeaking) return null;
      if (draft.voteMode === 'group') return groupPending ? { label: `所选 ${draft.batchVoters.length} 人弃票`, run: () => doAction({ type: 'ballots', voters: draft.batchVoters, target: null }) } : null;
      return activeVoter !== null && (!voteRecorded || editingBallot) ? { label: editingBallot ? `改为 ${activeVoter} 号弃票` : `记录 ${activeVoter} 号弃票`, run: () => recordBallot(null) } : null;
    }
    if (stage === 'hunter' || stage === 'shot') return { label: stage === 'hunter' ? '不开枪' : '放弃带人', run: () => doAction({ type: stage, target: null } as Action) };
    if (stage === 'badge') return { label: '撕毁警徽', run: () => doAction({ type: 'badge', target: null }) };
    if (stage === 'last-words') return { label: '放弃遗言', run: () => doAction({ type: 'last-words', speak: false }) };
    if (stage === 'discussion') return { label: '不放逐，进入下一夜', run: () => doAction({ type: 'next-night' }) };
    if (night && actorAlive) {
      if (stage === 'nine-tails' || stage === 'dancer') return null;
      const label = stage === 'guard' ? '空守（今晚不守人）' : stage === 'wolves' ? '空刀（今晚不杀人）' : stage === 'seer' ? '空过（今晚不查验）' : '跳过本夜行动，继续';
      const run = () => doAction({ type: 'skip-night', reason: '主持人确认本夜不行动' });
      return { label, run };
    }
    return null;
  })();

  const hint = (() => {
    if (stage === 'dawn' && game.night.manualDeaths && dawnDraftNeedsConfirmation(game, draft.dawn)) return '名单或原因有未确认的修改，请先更新昨夜出局名单';
    if (voting && draft.pkSpeaking) return '当前为 PK 发言，结束发言后再录入本轮投票';
    if (voting && editingBallot) return `正在修改 ${activeVoter} 号，更新或取消后再计票`;
    if (stage === 'sheriff-vote' || stage === 'exile-vote') return voteRecorded ? '所有玩家已记录，可以计票' : `还需记录 ${game.vote ? game.vote.voters.filter(seat => game.vote!.ballots[seat] === undefined).length : 0} 人`;
    if (stage === 'last-words') return pending?.kind === 'last-words' ? `当前轮到 ${pending.seat} 号；未发言可点“放弃遗言”` : '当前没有待处理的遗言';
    if (night && !actorAlive) return '该角色已出局，本夜无需选择目标';
    if (stage === 'dancer') return draft.dance.length === 3 ? '舞池已选满三人' : `还需选择 ${3 - draft.dance.length} 人进入舞池`;
    if (stage === 'nine-tails') return draft.selected === null ? '九尾每夜必须标记一名玩家' : `将标记 ${draft.selected} 号`;
    if (night) return draft.selected === null ? '请选择目标；不发动可使用下方按钮继续' : `已选择 ${draft.selected} 号`;
    if (stage === 'sheriff-signup') return draft.signup.length ? `已选 ${draft.signup.length} 人上警` : '无人上警也可以继续';
    return '';
  })();

  const primary = () => {
    if (stage === 'ended') { onBack(); return; }
    commit();
  };

  return (
    <View style={styles.footer}>
      {hint ? <Text style={styles.hint}>{hint}</Text> : null}
      <View style={styles.footerRow}>
        <Button title={primaryLabel || '继续'} onPress={primary} disabled={primaryDisabled} style={styles.flex} />
        {secondary ? <Button title={secondary.label} variant="ghost" small onPress={secondary.run} style={styles.secondary} /> : null}
      </View>
    </View>
  );
}
