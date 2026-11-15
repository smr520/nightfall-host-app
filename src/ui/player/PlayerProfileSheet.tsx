import React, { useState } from 'react';
import { Text, TextInput, View } from 'react-native';
import { boardById, boardRoles } from '../../game/boards';
import { ROLES, type Role } from '../../game/roles';
import { updatePlayerBasics, type PlayerNotebook } from '../../player/notes';
import { PLAYER_ROLE_IDS } from '../../player/role-options';
import { colors } from '../../theme';
import { Button, Chip, InlineError, Sheet } from '../kit';
import { MotionPressable } from '../motion';
import { RoleChoiceList } from './RoleChoiceList';
import { styles } from './styles';

export function PlayerProfileSheet({ notebook, visible, onChange, onClose }: {
  notebook: PlayerNotebook;
  visible: boolean;
  onChange: (next: PlayerNotebook) => void;
  onClose: () => void;
}) {
  const [gameName, setGameName] = useState(notebook.gameName);
  const [ownSeat, setOwnSeat] = useState(notebook.ownSeat);
  const [ownRole, setOwnRole] = useState<Role>(notebook.ownRole);
  const [rolePickerOpen, setRolePickerOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [error, setError] = useState('');
  const board = boardById(notebook.boardId);
  const roles = board ? boardRoles(board) : PLAYER_ROLE_IDS;

  const save = () => {
    try {
      onChange(updatePlayerBasics(notebook, { gameName, ownSeat, ownRole }));
      onClose();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : '无法保存基本信息');
    }
  };

  return (
    <Sheet visible={visible} onClose={onClose} title="编辑基本信息" subtitle="不会删除座位标记、事件和票型" footer={<Button title="保存基本信息" onPress={save} />}>
      <View style={styles.sectionHead}>
        <Text style={styles.sectionTitle}>本局板子</Text>
        <Chip>{notebook.boardName}</Chip>
      </View>
      <Text style={styles.footnote}>身份列表只显示这套板子。要换板请先清除本局笔记，避免座位、票型和判断串到另一套玩法。</Text>

      <Text style={styles.sectionTitle}>对局名称（可选）</Text>
      <TextInput
        accessibilityLabel="对局名称"
        value={gameName}
        onChangeText={setGameName}
        placeholder="例如：周五固定局"
        placeholderTextColor={colors.textTertiary}
        style={styles.input}
        maxLength={24}
      />

      <Text style={styles.footnote}>人数创建后固定，避免已有座位记录和票型错位；要改人数请先清除本局笔记。</Text>
      <Text style={styles.sectionTitle}>我的座位</Text>
      <View style={styles.seatGrid}>
        {Array.from({ length: notebook.playerCount }, (_, index) => index + 1).map(seat => (
          <MotionPressable key={seat} accessibilityRole="button" accessibilityLabel={`我的座位 ${seat} 号`} accessibilityState={{ selected: ownSeat === seat }} onPress={() => setOwnSeat(seat)} style={({ pressed }) => [styles.seatButton, ownSeat === seat && styles.seatButtonActive, pressed && { opacity: 0.65 }]}>
            <Text style={[styles.seatText, ownSeat === seat && styles.seatTextActive]}>{seat}</Text>
          </MotionPressable>
        ))}
      </View>

      <View style={styles.sectionHead}><Text style={styles.sectionTitle}>我的身份</Text><Chip>{ROLES[ownRole].name}</Chip></View>
      <Button title={rolePickerOpen ? '收起身份列表' : '更换身份'} variant="secondary" onPress={() => { if (rolePickerOpen) setQuery(''); setRolePickerOpen(value => !value); }} />
      {rolePickerOpen ? (
        <RoleChoiceList
          roles={roles}
          selected={ownRole}
          onSelect={role => { setOwnRole(role); setRolePickerOpen(false); setQuery(''); }}
          query={query}
          onQueryChange={setQuery}
          showSearch={roles.length > 10}
          searchLabel="搜索身份"
          accessibilityPrefix="选择身份"
        />
      ) : null}

      {error ? <InlineError>{error}</InlineError> : null}
    </Sheet>
  );
}
