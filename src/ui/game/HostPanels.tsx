import React from 'react';
import { Pressable, Text, View } from 'react-native';
import { Alert } from '../alert';
import { alive, seatName, type NightCallActorStatus } from '../../game/engine';
import { canHandOffBadge, winnerLabel } from '../../game/host-ui';
import { ROLES, isWolf } from '../../game/roles';
import type { Action, Game, Stage } from '../../game/types';
import { Button, Card, Chip, Divider, SeatGrid } from '../kit';
import { causeLabel } from '../labels';
import { type } from '../../theme';
import { styles } from './styles';
import type { Draft } from './draft';

export function markCount(game: Game, seat: number) {
  return game.special?.marks?.[seat] ?? 0;
}

export function NineTailsMarks({ game, title = '九尾标记' }: { game: Game; title?: string }) {
  const marked = game.players.filter(player => markCount(game, player.seat) > 0);
  return (
    <View style={styles.records}>
      <Text style={type.caption}>{title}</Text>
      {marked.length ? marked.map(player => <Chip key={player.seat} tone={player.alive ? 'accent' : 'neutral'}>{player.seat} 号 ×{markCount(game, player.seat)}</Chip>) : <Text style={type.footnote}>暂无标记</Text>}
    </View>
  );
}

export function HuntButton({ game, doAction }: { game: Game; doAction: (action: Action) => void }) {
  const marked = alive(game).filter(player => markCount(game, player.seat) > 0);
  const a = 1 + marked.length;
  const b = alive(game).length - a;
  const success = a > b;
  return (
    <Button
      title={success ? `九尾猎杀时刻：A=${a} > B=${b}，可清场` : `九尾猎杀时刻：A=${a} / B=${b}，未达成`}
      variant={success ? 'danger' : 'secondary'}
      small
      onPress={() => Alert.alert(
        '发动九尾猎杀时刻？',
        success
          ? `A（九尾与标记存活者）= ${a}，B（其余存活者）= ${b}。B 方 ${b} 人将全部出局且不能发动技能，随后进入夜晚。`
          : `A（九尾与标记存活者）= ${a}，B（其余存活者）= ${b}。A 不大于 B，技能不会生效。`,
        [
          { text: '取消', style: 'cancel' },
          { text: '确认发动', style: success ? 'destructive' : 'default', onPress: () => doAction({ type: 'hunt' }) },
        ],
      )}
    />
  );
}

export function NightRecords({ game, stage }: { game: Game; stage: Stage }) {
  const rows = [
    stage === 'guard' || game.night.guard !== null ? { label: '守卫', value: game.night.guard } : null,
    stage === 'wolves' || game.night.knife !== null ? { label: '刀口', value: game.night.knife } : null,
    game.night.inspect !== null ? { label: '查验', value: game.night.inspect } : null,
    ...Object.entries(game.night.targets).map(([call, seat]) => ({ label: ROLES[call as keyof typeof ROLES]?.short ?? call, value: seat })),
  ].filter((row): row is { label: string; value: number | null } => !!row);
  if (!rows.length) return null;
  return (
    <View style={styles.records}>
      {rows.map(row => <Chip key={row.label} tone={row.value === null ? 'neutral' : 'accent'}>{row.label} {row.value === null ? '空过' : `${row.value} 号`}</Chip>)}
    </View>
  );
}

export function WitchPanel({ game, showRoles, draft, patch, actorStatus }: { game: Game; showRoles: boolean; draft: Draft; patch: (next: Partial<Draft>) => void; actorStatus: NightCallActorStatus }) {
  const witch = game.players.find(player => player.alive && player.role === 'witch');
  const selfTarget = game.night.knife !== null && game.night.knife === witch?.seat;
  const selfSaveAllowed = !selfTarget || game.rules.selfSave === 'always' || game.rules.selfSave === 'first' && game.day === 1;
  const canSave = game.medicine.save && game.night.knife !== null && selfSaveAllowed;
  const choosePoison = (poison: number | null) => patch({ poison, selected: poison, ...(poison !== null && !game.rules.doubleMedicine ? { save: false } : {}) });
  if (!actorStatus.hasActor) return <Card style={styles.panel}><Text style={type.footnote}>女巫已出局，本夜保留空唤醒口播但不录入用药。</Text></Card>;
  if (actorStatus.blockedByFear) return <Card style={styles.panel}><Text style={type.footnote}>女巫仍存活，但本夜被恐惧，不能使用药品。请照常念完主持台词后继续。</Text></Card>;
  return (
    <Card style={styles.panel}>
      <View style={styles.rowBetween}>
        <Text style={type.headline}>女巫用药</Text>
        <Text style={type.caption}>解药 {game.medicine.save ? '可用' : '已用'} · 毒药 {game.medicine.poison ? '可用' : '已用'}</Text>
      </View>
      <Text style={type.footnote}>今晚刀口：{seatName(game, game.night.knife)}。女巫在 {game.players.filter(p => p.alive && p.role === 'witch').map(p => `${p.seat} 号`).join('、')}。可以只救、只毒，或都不用药。</Text>
      <View style={styles.medRow}>
        <Pressable accessibilityRole="checkbox" accessibilityLabel="使用解药" accessibilityState={{ checked: draft.save, disabled: !canSave }} disabled={!canSave} onPress={() => patch({ save: !draft.save, ...(!draft.save && !game.rules.doubleMedicine ? { poison: null, selected: null } : {}) })} style={[styles.medCard, draft.save && styles.medCardActive, !canSave && styles.disabled]}>
          <Text style={styles.medTitle}>解药 {draft.save ? '✓' : ''}</Text>
          <Text style={type.footnote}>{!game.medicine.save ? '已用完' : game.night.knife === null ? '空刀不可用' : !selfSaveAllowed ? '本局不允许此时自救' : '救活今晚的刀口'}</Text>
        </Pressable>
        <Pressable accessibilityRole="checkbox" accessibilityLabel="使用毒药" accessibilityState={{ checked: draft.poison !== null, disabled: !game.medicine.poison }} disabled={!game.medicine.poison} onPress={() => choosePoison(draft.poison === null ? draft.selected : null)} style={[styles.medCard, draft.poison !== null && styles.medCardActive, !game.medicine.poison && styles.disabled]}>
          <Text style={styles.medTitle}>毒药 {draft.poison !== null ? '✓' : ''}</Text>
          <Text style={type.footnote}>{!game.medicine.poison ? '已用完' : draft.poison === null ? '在下方选择目标' : `毒 ${draft.poison} 号`}</Text>
        </Pressable>
      </View>
      {!game.rules.doubleMedicine ? <Text style={type.footnote}>本局一夜只能用一瓶药，选择另一种药会取消前一种。</Text> : null}
      {game.medicine.poison ? <SeatGrid game={game} selected={draft.poison} onSelect={seat => choosePoison(draft.poison === seat ? null : seat)} showRoles={showRoles} filter={p => p.alive} /> : null}
    </Card>
  );
}

export function PendingPanel({ game, pending, selected, onSelect, showRoles }: { game: Game; pending: NonNullable<Game['pending'][0]>; selected: number | null; onSelect: (seat: number) => void; showRoles: boolean }) {
  const isBadge = pending.kind === 'badge';
  const isHeir = pending.kind === 'heir';
  const roleName = pending.role ? ROLES[pending.role].name : '猎人';
  return (
    <Card style={styles.panel}>
      <View style={styles.rowBetween}>
        <Text style={type.headline}>{isBadge ? '警徽处理' : isHeir ? '白泽传承' : `${pending.seat} 号${roleName}`}</Text>
        <Chip tone={isBadge ? 'accent' : isHeir ? 'success' : 'danger'}>{isBadge ? '移交' : isHeir ? '传承' : '带人'}</Chip>
      </View>
      <Text style={type.footnote}>{isBadge ? '选择接任警长的玩家，翻牌白痴不可接任；也可以撕毁警徽。' : isHeir ? '选择一名存活玩家为继承人。平民变为神民双阵营；神职夜间出局会延迟到投票结束；狼人或九尾不受影响。' : '选择被带走的玩家，或放弃这次技能。'}</Text>
      <SeatGrid game={game} selected={selected} onSelect={onSelect} showRoles={showRoles} filter={p => p.alive && p.seat !== pending.seat && (!isBadge || canHandOffBadge(p, pending.seat))} />
    </Card>
  );
}

export function EndedPanel({ game }: { game: Game }) {
  return (
    <Card style={styles.panel}>
      <Text style={type.caption}>结果</Text>
      <Text style={styles.resultTitle}>{game.winner ? winnerLabel(game.winner) : '主持结束本局'}</Text>
      <Text style={type.footnote}>{game.endReason}</Text>
      <Divider />
      <Text style={type.caption}>身份公开</Text>
      {game.players.map(player => (
        <View key={player.seat} style={styles.rosterRow}>
          <Text style={styles.rosterSeat}>{player.seat}</Text>
          <Text style={[styles.flex, type.body]} numberOfLines={1}>{player.name}</Text>
          <Text style={[styles.rosterRole, isWolf(player.role) && styles.rosterRoleWolf]}>{ROLES[player.role].name}</Text>
          <Text style={styles.rosterDeath}>{player.alive ? '存活' : causeLabel(player.death?.cause)}</Text>
        </View>
      ))}
    </Card>
  );
}
