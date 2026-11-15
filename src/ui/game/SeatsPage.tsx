import React, { useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { colors, spacing, type } from '../../theme';
import { alive } from '../../game/engine';
import { ROLES } from '../../game/roles';
import { ROLE_REFERENCE } from '../../game/role-reference';
import type { Game, Player } from '../../game/types';
import { Button, Chip, Divider, SeatGrid, Sheet, SwitchRow } from '../kit';
import { causeLabel } from '../labels';
import { useResponsive } from '../responsive';
import { Icon } from '../Icon';

export function SeatsPage({ game, showRoles, onToggleRoles }: { game: Game; showRoles: boolean; onToggleRoles: (value: boolean) => void }) {
  const [openSeat, setOpenSeat] = useState<number | null>(null);
  const player = openSeat === null ? null : game.players.find(item => item.seat === openSeat) ?? null;
  const dead = game.players.filter(item => !item.alive);
  const responsive = useResponsive();
  return (
    <ScrollView contentContainerStyle={[styles.content, { paddingHorizontal: responsive.gutter, width: '100%', maxWidth: responsive.maxContentWidth, alignSelf: 'center' }]} showsVerticalScrollIndicator={false}>
      <View style={styles.head}>
        <Text style={type.title}>座位</Text>
        <Text style={type.footnote}>{game.players.length} 个座位 · 点选查看本局状态</Text>
      </View>

      <View style={styles.summary}>
        <View style={styles.summaryRow}>
          <Stat label="在场" value={`${alive(game).length}`} />
          <Stat label="出局" value={`${dead.length}`} tone="danger" />
          <Stat label="警长" value={game.sheriff ? `${game.sheriff} 号` : '未定'} tone="gold" />
          <Stat label="翻牌" value={`${game.players.filter(item => item.exposed).length}`} />
        </View>
      </View>

      <View style={styles.visibility}>
        <SwitchRow label="显示身份" hint={showRoles ? '座位上直接标出身份' : '默认隐藏，点座位单独查看'} value={showRoles} onChange={onToggleRoles} />
      </View>

      <View style={styles.seats}>
        <SeatGrid game={game} selected={openSeat} onSelect={seat => setOpenSeat(seat)} showRoles={showRoles} tapDead />
        <View style={styles.privateHint}><Icon name="shield" size={15} color={colors.textTertiary} /><Text style={styles.hint}>点座位查看身份与出局原因，仅主持人可见。</Text></View>
      </View>

      <View style={styles.legendRow}>
        <Text style={styles.legendText}>警 · 警长</Text>
        <Text style={styles.legendText}>痴 · 翻牌白痴</Text>
        <Text style={styles.legendText}>划线 · 已出局</Text>
      </View>

      <Sheet visible={!!player} onClose={() => setOpenSeat(null)} title={player ? `${player.seat} 号座位` : ''} subtitle="仅主持人可见" footer={<Button title="关闭" variant="secondary" onPress={() => setOpenSeat(null)} />}>
        {player ? <PlayerDetail game={game} player={player} /> : null}
      </Sheet>
    </ScrollView>
  );
}

function PlayerDetail({ game, player }: { game: Game; player: Player }) {
  const role = ROLES[player.role];
  const camp = ROLE_REFERENCE[player.role].camp ?? role.camp;
  return (
    <>
      <View style={styles.detailHead}>
        <View style={styles.flex}>
          <Text style={type.title2}>{player.name === '未命名玩家' ? `${player.seat} 号玩家` : player.name}</Text>
          <Text style={type.footnote}>{player.alive ? '存活' : `第 ${player.death?.day ?? game.day} 天出局 · ${causeLabel(player.death?.cause)}`}</Text>
        </View>
        <Chip tone={camp === 'wolf' ? 'wolf' : camp === 'third' ? 'neutral' : 'success'}>{camp === 'wolf' ? '狼人阵营' : camp === 'third' ? '第三方阵营' : '好人阵营'}</Chip>
      </View>
      <Divider />
      <View style={styles.detailRow}><Text style={type.caption}>身份</Text><Text style={styles.detailValue}>{role.name}</Text></View>
      <Text style={type.footnote}>{role.tagline}</Text>
      {role.night ? <Text style={type.footnote}>夜间行动：{role.night.targetLabel}</Text> : <Text style={type.footnote}>没有夜间行动。</Text>}
      <View style={styles.detailRow}><Text style={type.caption}>状态</Text><Text style={styles.detailValue}>{player.alive ? '在场' : '已出局'}{player.exposed ? ' · 已翻牌' : ''}{game.sheriff === player.seat ? ' · 警长' : ''}</Text></View>
    </>
  );
}

function Stat({ label, value, tone }: { label: string; value: string; tone?: 'danger' | 'gold' }) {
  return (
    <View style={styles.stat}>
      <Text style={[styles.statValue, tone === 'danger' && styles.statDanger, tone === 'gold' && styles.statGold]}>{value}</Text>
      <Text style={type.caption}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: spacing.xl, paddingTop: spacing.xl, paddingBottom: spacing.huge, gap: spacing.xl },
  head: { gap: spacing.sm },
  flex: { flex: 1, minWidth: 0 },
  summary: { paddingVertical: spacing.lg, borderTopWidth: StyleSheet.hairlineWidth, borderBottomWidth: StyleSheet.hairlineWidth, borderColor: colors.line },
  summaryRow: { flexDirection: 'row', flexWrap: 'wrap', rowGap: spacing.md },
  stat: { flexGrow: 1, flexBasis: '25%', minWidth: 64, alignItems: 'flex-start', gap: spacing.sm },
  statValue: { ...type.numeric, fontSize: 26, lineHeight: 34, fontWeight: '500' },
  statDanger: { color: colors.danger },
  statGold: { color: colors.gold },
  visibility: { paddingBottom: spacing.xs },
  seats: { gap: spacing.md },
  privateHint: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm },
  hint: { ...type.footnote, fontSize: 12, flex: 1 },
  legendRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.lg, paddingTop: spacing.md, borderTopWidth: StyleSheet.hairlineWidth, borderColor: colors.lineSoft },
  legendText: { ...type.caption, fontWeight: '400', fontSize: 11 },
  detailHead: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'flex-start', gap: spacing.md },
  detailRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: spacing.md },
  detailValue: { ...type.body, flexShrink: 1, fontWeight: '600' },
});
