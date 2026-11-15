import React from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';
import { BOARD_LIBRARY, boardSeats, type Board } from '../../game/boards';
import { compareBoardSupport } from '../../game/board-support';
import { boardIntroduction } from '../../game/board-reference';
import { isIdentityCard } from '../../game/role-catalog';
import { ROLE_REFERENCE } from '../../game/role-reference';
import { ROLES, ROLE_IDS, isWolf } from '../../game/roles';
import type { Counts, Role, Rules } from '../../game/types';
import { Button, Chip, InlineError, Segmented, Sheet } from '../kit';
import { boardLine } from '../labels';
import { Icon } from '../Icon';
import { MotionPressable } from '../motion';
import { colors, type } from '../../theme';
import { BoardIntroduction, BoardSupportBadge } from './BoardIntroduction';
import { RoleStepper } from './Controls';
import { FILTERS, type Filter } from './board-filter';
import { styles } from './styles';
import type { SetupPlayer } from './types';

export function BoardLibrarySheet({ visible, board, preview, filter, search, boards, isTablet, rules, onClose, onClearPreview, onPreview, onChoose, onEditLineup, onOpenReference, onFilterChange, onSearchChange }: {
  visible: boolean;
  board: Board;
  preview: Board | null;
  filter: Filter;
  search: string;
  boards: Board[];
  isTablet: boolean;
  rules: Rules;
  onClose: () => void;
  onClearPreview: () => void;
  onPreview: (board: Board) => void;
  onChoose: (board: Board) => void;
  onEditLineup: () => void;
  onOpenReference?: (context: { roles: Role[]; rules: Rules; initialRole?: Role }) => void;
  onFilterChange: (filter: Filter) => void;
  onSearchChange: (search: string) => void;
}) {
  return (
    <Sheet
      visible={visible}
      onClose={onClose}
      onRequestClose={() => { if (preview) onClearPreview(); else onClose(); }}
      contentKey={preview ? `introduction-${preview.id}` : `library-${filter}-${search}`}
      title={preview ? '板子介绍' : '板子库'}
      subtitle={preview ? '先了解玩法、支持范围，再确认选择' : `${BOARD_LIBRARY.length} 个完整板子 · 已验证阵容优先`}
      footer={preview ? <>
        <Button title="返回板子库" variant="ghost" onPress={onClearPreview} />
        <Button title={preview === board ? '继续使用当前板子' : '用这个板子'} onPress={() => onChoose(preview)} />
      </> : undefined}
    >
      {preview ? <BoardIntroduction key={preview.id} board={preview} onOpenRoles={onOpenReference ? () => onOpenReference({ roles: boardSeats(preview), rules: { ...rules } }) : undefined} /> : <>
        <Segmented options={FILTERS} value={filter} onChange={onFilterChange} />
        <TextInput
          accessibilityLabel="搜索板子或角色"
          value={search}
          onChangeText={onSearchChange}
          placeholder="搜索板名、角色或玩法关键词"
          placeholderTextColor={colors.textTertiary}
          style={styles.input}
          returnKeyType="search"
          maxLength={40}
        />
        {!boards.length ? <Text style={type.footnote}>没有符合条件的板子。可以清空搜索，或切换到“全部”。</Text> : null}
        <View style={[styles.libraryGrid, isTablet && styles.libraryGridWide]}>
          {[...boards].sort(compareBoardSupport).map(item => (
            <View key={item.id} style={[styles.libraryRow, isTablet && styles.libraryRowWide, item.id === board.id && styles.libraryRowActive]}>
              <MotionPressable
                accessibilityRole="button"
                accessibilityLabel={`选择板子：${item.name}`}
                onPress={() => onChoose(item)}
                style={({ pressed }) => [styles.librarySelect, pressed && styles.pressed]}
              >
                <View style={styles.libraryCount}><Text style={styles.libraryCountValue}>{String(item.playerCount).padStart(2, '0')}</Text><Text style={styles.libraryCountLabel}>人局</Text></View>
                <View style={styles.flex}>
                  <View style={styles.rowBetween}>
                    <Text style={[type.headline, styles.flex]}>{item.name}</Text>
                    {item.id === board.id ? <Icon name="check" size={18} color={colors.accent} /> : null}
                  </View>
                  <BoardSupportBadge board={item} />
                  <Text style={type.footnote}>{boardLine(item.roles)}{item.catalog ? ` · ${item.catalog.edition}` : ''}</Text>
                  <Text style={styles.libraryOverview} numberOfLines={2}>{boardIntroduction(item).overview}</Text>
                </View>
              </MotionPressable>
              <View style={styles.libraryIntroduction}><Button title={`查看介绍：${item.name}`} variant="ghost" small onPress={() => onPreview(item)} /></View>
            </View>
          ))}
        </View>
        <Button title="自己配一套阵容" variant="secondary" onPress={onEditLineup} />
      </>}
    </Sheet>
  );
}

export function CustomBoardSheet({ visible, name, roles, error, onClose, onApply, onNameChange, onRoleChange, onOpenReference }: {
  visible: boolean;
  name: string;
  roles: Partial<Record<Role, number>>;
  error: string;
  onClose: () => void;
  onApply: () => void;
  onNameChange: (name: string) => void;
  onRoleChange: (role: Role, count: number) => void;
  onOpenReference?: (role: Role) => void;
}) {
  const godRoles = ROLE_IDS.filter(role => (ROLE_REFERENCE[role].camp ?? ROLES[role].camp) === 'good' && role !== 'villager' && isIdentityCard(role));
  const thirdRoles = ROLE_IDS.filter(role => (ROLE_REFERENCE[role].camp ?? ROLES[role].camp) === 'third' && isIdentityCard(role));
  return (
    <Sheet visible={visible} onClose={onClose} title="自定义板子" subtitle="至少 1 狼、1 民、1 神，总人数 6–16" footer={<>{error ? <InlineError>{error}</InlineError> : null}<Button title="用这套阵容" onPress={onApply} /></>}>
      <TextInput value={name} onChangeText={onNameChange} placeholder="板子名称" placeholderTextColor={colors.textTertiary} accessibilityLabel="板子名称" style={styles.input} maxLength={16} />
      <Text style={type.caption}>狼人阵营</Text>
      {ROLE_IDS.filter(role => (ROLE_REFERENCE[role].camp ?? ROLES[role].camp) === 'wolf').map(role => <RoleStepper key={role} role={role} value={roles[role] ?? 0} onInfo={onOpenReference ? () => onOpenReference(role) : undefined} onChange={n => onRoleChange(role, n)} />)}
      <Text style={type.caption}>神职</Text>
      {godRoles.map(role => <RoleStepper key={role} role={role} value={roles[role] ?? 0} onInfo={onOpenReference ? () => onOpenReference(role) : undefined} onChange={n => onRoleChange(role, n)} />)}
      <RoleStepper role="villager" value={roles.villager ?? 0} onInfo={onOpenReference ? () => onOpenReference('villager') : undefined} onChange={n => onRoleChange('villager', n)} />
      <Text style={type.caption}>第三方</Text>
      <Text style={type.footnote}>胜负由主持人按本桌约定另行确认，不按普通神职理解。</Text>
      {thirdRoles.map(role => <RoleStepper key={role} role={role} value={roles[role] ?? 0} onInfo={onOpenReference ? () => onOpenReference(role) : undefined} onChange={n => onRoleChange(role, n)} />)}
      {(roles['lucky-one'] ?? 0) > 0 ? <>
        <Text style={type.footnote}>旧方案中的幸运儿是附加状态。请减至 0，再为该座位补回原身份；已存对局不会被改写。</Text>
        <RoleStepper role="lucky-one" value={roles['lucky-one'] ?? 0} canIncrease={false} onInfo={onOpenReference ? () => onOpenReference('lucky-one') : undefined} onChange={n => onRoleChange('lucky-one', n)} />
      </> : null}
      <Text style={styles.builderTotal}>{Object.values(roles).reduce<number>((a, b) => a + (b ?? 0), 0)} 人</Text>
    </Sheet>
  );
}

export function RoleSwapSheet({ roleSeat, players, currentRoles, playerCounts, onClose, onOpenReference, onSwap }: {
  roleSeat: number | null;
  players: SetupPlayer[];
  currentRoles: Role[];
  playerCounts: Counts;
  onClose: () => void;
  onOpenReference?: (role: Role) => void;
  onSwap: (seat: number) => void;
}) {
  return (
    <Sheet visible={roleSeat !== null} onClose={onClose} title={roleSeat === null ? '' : `${roleSeat + 1} 号互换身份`} subtitle="选择另一座位交换身份；姓名、阵容和角色数量不变">
      {onOpenReference && roleSeat !== null ? <Button title="查看当前角色技能" variant="secondary" onPress={() => onOpenReference(players[roleSeat].role)} /> : null}
      <View style={styles.chips}>{currentRoles.map(role => <Chip key={role} tone={isWolf(role) ? 'wolf' : 'neutral'}>{ROLES[role].name} ×{playerCounts[role]}</Chip>)}</View>
      {roleSeat !== null ? <Text style={type.footnote}>当前：{roleSeat + 1} 号 · {ROLES[players[roleSeat].role].name}。选择要互换的座位：</Text> : null}
      <View style={styles.roleGrid}>
        {roleSeat !== null ? players.map((player, index) => index !== roleSeat && player.role !== players[roleSeat].role ? (
          <Pressable
            key={index}
            accessibilityRole="button"
            accessibilityLabel={`与${index + 1}号互换身份（${ROLES[player.role].name}）`}
            onPress={() => onSwap(index)}
            style={({ pressed }) => [styles.roleOption, pressed && styles.pressed]}
          >
            <Text style={[styles.roleOptionText, isWolf(player.role) && styles.roleOptionWolf]}>{index + 1} 号 · {ROLES[player.role].name}</Text>
            <Text style={styles.roleOptionMeta} numberOfLines={1}>{player.name || `${index + 1} 号玩家`}</Text>
          </Pressable>
        ) : null) : null}
      </View>
    </Sheet>
  );
}
