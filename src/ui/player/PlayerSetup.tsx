import React, { useState } from 'react';
import { ScrollView, Text, TextInput, View } from 'react-native';
import { BOARD_LIBRARY, boardRoles, type Board } from '../../game/boards';
import { ROLES, type Role } from '../../game/roles';
import { Button, Chip, InlineError, Sheet } from '../kit';
import { MotionPressable } from '../motion';
import { useResponsive } from '../responsive';
import { colors } from '../../theme';
import { PlayerBoardPickerSheet } from './PlayerBoardPickerSheet';
import { RoleChoiceList } from './RoleChoiceList';
import { styles } from './styles';

function PlayerRolePickerSheet({ visible, board, selected, onSelect, onClose }: {
  visible: boolean;
  board: Board;
  selected: Role | null;
  onSelect: (role: Role) => void;
  onClose: () => void;
}) {
  const [query, setQuery] = useState('');
  const roles = boardRoles(board);

  return (
    <Sheet
      visible={visible}
      onClose={onClose}
      title="选择你的身份"
      subtitle={`只显示「${board.name}」中的 ${roles.length} 张身份`}
    >
      <RoleChoiceList
        roles={roles}
        selected={selected}
        onSelect={role => {
          onSelect(role);
          setQuery('');
          onClose();
        }}
        query={query}
        onQueryChange={setQuery}
        showSearch={roles.length > 10}
        searchLabel="搜索本板身份"
        accessibilityPrefix="选择身份"
      />
    </Sheet>
  );
}

export function PlayerSetup({ onCreate, onOpenReference }: {
  onCreate: (input: { boardId: string; boardName: string; gameName: string; playerCount: number; ownSeat: number; ownRole: Role }) => void;
  onOpenReference?: (context: { roles: Role[]; initialRole?: Role }) => void;
}) {
  const responsive = useResponsive();
  const [board, setBoard] = useState(BOARD_LIBRARY[0]);
  const [boardOpen, setBoardOpen] = useState(false);
  const [ownSeat, setOwnSeat] = useState<number | null>(null);
  const [ownRole, setOwnRole] = useState<Role | null>(null);
  const [gameName, setGameName] = useState('');
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerSession, setPickerSession] = useState(0);
  const [error, setError] = useState('');
  const roles = boardRoles(board);

  const chooseBoard = (next: Board) => {
    setBoard(next);
    setBoardOpen(false);
    if (ownSeat !== null && ownSeat > next.playerCount) setOwnSeat(null);
    if (ownRole !== null && !boardRoles(next).includes(ownRole)) setOwnRole(null);
  };

  const start = () => {
    if (ownSeat === null || ownRole === null) {
      setError('先选择你的座位和身份');
      return;
    }
    try {
      onCreate({
        boardId: board.id,
        boardName: board.name,
        gameName,
        playerCount: board.playerCount,
        ownSeat,
        ownRole,
      });
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : '无法创建玩家笔记');
    }
  };

  return (
    <ScrollView
      contentContainerStyle={[styles.scrollContent, {
        paddingHorizontal: responsive.gutter,
        width: '100%',
        maxWidth: responsive.maxReadingWidth,
        alignSelf: 'center',
      }]}
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
    >
      <View style={styles.hero}>
        <Text accessibilityRole="header" style={styles.title}>先选本，再记你的身份</Text>
        <Text style={styles.footnote}>只保存在本机；不会读取主持人的对局，也不会把你的身份同步给任何人。</Text>
      </View>

      <View style={styles.card}>
        <View style={styles.sectionHead}>
          <Text style={styles.sectionTitle}>本局板子</Text>
          <Chip>{board.playerCount} 人</Chip>
        </View>
        <Text style={styles.roleName}>{board.name}</Text>
        <Text style={styles.footnote}>{roles.map(role => ROLES[role].name).join(' · ')}</Text>
        <Button title={`选择板子：${board.name}`} variant="secondary" onPress={() => setBoardOpen(true)} />
        <Text style={styles.caption}>人数和可选身份跟随板子；换本后不会再显示别的板子角色。</Text>
      </View>

      <View style={styles.card}>
        <View style={styles.sectionHead}>
          <Text style={styles.sectionTitle}>你的座位</Text>
          <Text style={styles.caption}>{ownSeat === null ? '未选择' : `${ownSeat} 号`}</Text>
        </View>
        <Text style={styles.footnote}>选你实际坐的座位；只是给自己记录用。</Text>
        <View style={styles.seatGrid}>
          {Array.from({ length: board.playerCount }, (_, index) => index + 1).map(seat => (
            <MotionPressable
              key={seat}
              accessibilityRole="button"
              accessibilityLabel={`我的座位 ${seat} 号`}
              accessibilityState={{ selected: ownSeat === seat }}
              onPress={() => setOwnSeat(seat)}
              style={({ pressed }) => [styles.seatButton, ownSeat === seat && styles.seatButtonActive, pressed && { opacity: 0.65 }]}
            >
              <Text style={[styles.seatText, ownSeat === seat && styles.seatTextActive]}>{seat}</Text>
            </MotionPressable>
          ))}
        </View>
      </View>

      <View style={styles.card}>
        <View style={styles.sectionHead}>
          <Text style={styles.sectionTitle}>你的身份</Text>
          {ownRole ? <Chip>{ROLES[ownRole].name}</Chip> : null}
        </View>
        <View style={styles.roleCard}>
          {ownRole ? <>
            <Text style={styles.roleName}>{ROLES[ownRole].name}</Text>
            <Text style={styles.roleTagline}>{ROLES[ownRole].tagline}</Text>
          </> : <Text style={styles.roleEmpty}>还没选择。这里只会列出「{board.name}」里的身份。</Text>}
        </View>
        <Button
          title={ownRole ? '更换身份' : '选择身份'}
          variant="secondary"
          onPress={() => {
            setPickerSession(value => value + 1);
            setPickerOpen(true);
          }}
        />
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>对局名称（可选）</Text>
        <TextInput
          accessibilityLabel="玩家对局名称"
          value={gameName}
          onChangeText={setGameName}
          placeholder="例如：周五固定局"
          placeholderTextColor={colors.textTertiary}
          style={styles.input}
          maxLength={24}
        />
      </View>

      {error ? <InlineError>{error}</InlineError> : null}
      <Button title="开始记录" onPress={start} disabled={ownSeat === null || ownRole === null} style={styles.primary} />
      {onOpenReference ? <Button title="查看规则与角色" variant="ghost" onPress={() => onOpenReference({ roles, initialRole: ownRole ?? undefined })} /> : null}

      <PlayerRolePickerSheet
        key={`role-${board.id}-${pickerSession}`}
        visible={pickerOpen}
        board={board}
        selected={ownRole}
        onSelect={setOwnRole}
        onClose={() => setPickerOpen(false)}
      />
      <PlayerBoardPickerSheet
        visible={boardOpen}
        selectedId={board.id}
        onSelect={chooseBoard}
        onClose={() => setBoardOpen(false)}
      />
    </ScrollView>
  );
}
