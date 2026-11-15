import React, { useState } from 'react';
import { Text, TextInput, View } from 'react-native';
import { BOARD_LIBRARY, boardOrigins, boardRoles, type Board } from '../../game/boards';
import { ROLES } from '../../game/roles';
import { Button, Chip, Segmented, Sheet } from '../kit';
import { Icon } from '../Icon';
import { MotionPressable } from '../motion';
import { colors, type } from '../../theme';
import { FILTERS, matchesFilter, type Filter } from '../setup/board-filter';
import { boardLine } from '../labels';
import { styles } from './styles';

export function PlayerBoardPickerSheet({ visible, selectedId, onSelect, onClose }: {
  visible: boolean;
  selectedId: string;
  onSelect: (board: Board) => void;
  onClose: () => void;
}) {
  const [filter, setFilter] = useState<Filter>('all');
  const [query, setQuery] = useState('');
  const needle = query.trim().toLocaleLowerCase();
  const boards = BOARD_LIBRARY.filter(board => {
    const searchText = [
      board.name,
      board.subtitle,
      ...boardRoles(board).map(role => ROLES[role].name),
    ].join(' ').toLocaleLowerCase();
    return matchesFilter(board, filter) && (!needle || searchText.includes(needle));
  });

  return (
    <Sheet
      visible={visible}
      onClose={onClose}
      title="选择本局板子"
      subtitle="选定后只显示这套板子的身份，人数也随板子确定"
      footer={<Button title="关闭" variant="ghost" onPress={onClose} />}
    >
      <Segmented options={FILTERS} value={filter} onChange={setFilter} />
      <TextInput
        accessibilityLabel="搜索玩家板子"
        value={query}
        onChangeText={setQuery}
        placeholder="搜索板名、角色"
        placeholderTextColor={colors.textTertiary}
        style={styles.input}
        maxLength={40}
      />
      {!boards.length ? <Text style={styles.footnote}>没有符合条件的板子。</Text> : null}
      <View>
        {boards.map(board => {
          const selected = board.id === selectedId;
          const origins = boardOrigins(board);
          return (
            <MotionPressable
              key={board.id}
              accessibilityRole="button"
              accessibilityLabel={`使用板子：${board.name}`}
              accessibilityState={{ selected }}
              onPress={() => onSelect(board)}
              style={({ pressed }) => [styles.boardPickerRow, pressed && { opacity: 0.65 }]}
            >
              <View style={styles.flex}>
                <View style={styles.sectionHead}>
                  <Text style={[type.headline, styles.flex]}>{board.name}</Text>
                  {selected ? <Icon name="check" size={18} color={colors.accent} /> : null}
                </View>
                <View style={styles.chipRow}>
                  <Chip>{board.playerCount} 人</Chip>
                  <Chip>{origins.includes('jingcheng') ? '京城大师赛' : origins.includes('netease') ? '网易官方' : '常规'}</Chip>
                </View>
                <Text style={styles.caption} numberOfLines={2}>{boardLine(board.roles)}</Text>
              </View>
            </MotionPressable>
          );
        })}
      </View>
    </Sheet>
  );
}
