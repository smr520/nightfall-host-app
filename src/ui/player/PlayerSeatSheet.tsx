import React, { useState } from 'react';
import { Text, TextInput, View } from 'react-native';
import { boardById, boardRoles } from '../../game/boards';
import { ROLES, isVillager, type Role } from '../../game/roles';
import { SEAT_MARKS, SEAT_MARK_LABELS, setSeatEliminated, setSeatMark, setSeatNote, setSeatRoleGuess, type PlayerNotebook, type SeatMark } from '../../player/notes';
import { PLAYER_ROLE_IDS } from '../../player/role-options';
import { Button, Chip, Sheet } from '../kit';
import { MotionPressable } from '../motion';
import { colors } from '../../theme';
import { RoleChoiceList } from './RoleChoiceList';
import { styles } from './styles';

export function PlayerSeatSheet({ notebook, seat, onChange, onClose }: {
  notebook: PlayerNotebook;
  seat: number | null;
  onChange: (next: PlayerNotebook) => void;
  onClose: () => void;
}) {
  const [rolePickerOpen, setRolePickerOpen] = useState(false);
  const [query, setQuery] = useState('');
  const note = seat === null ? null : notebook.seatNotes[seat];
  const isOwn = seat === notebook.ownSeat;
  const board = boardById(notebook.boardId);
  const roles = board ? boardRoles(board) : PLAYER_ROLE_IDS;
  const hasVillager = roles.some(isVillager);
  const marks = SEAT_MARKS.filter(mark => mark !== 'villager' || hasVillager);
  const selectRole = (role: Role) => {
    if (seat === null) return;
    onChange(setSeatRoleGuess(notebook, seat, role));
    setRolePickerOpen(false);
    setQuery('');
  };

  return (
    <Sheet visible={seat !== null} onClose={onClose} title={seat === null ? '' : isOwn ? '你的座位' : `${seat} 号座位`} subtitle="只给自己看；不会同步到主持台" footer={<Button title="完成" onPress={onClose} />}>
      {seat === null || !note ? null : <>
        <View style={styles.seatStatusBox}>
          <View style={styles.sectionHead}>
            <Text style={styles.sectionTitle}>座位状态</Text>
            <Chip tone={note.eliminated ? 'danger' : 'success'}>{note.eliminated ? '已出局' : '在场'}</Chip>
          </View>
          <Text style={styles.footnote}>{note.eliminated ? '座位已划掉；身份判断和备注仍会保留。' : '观看或复盘时，可在这里直接把这个座位标记为出局。'}</Text>
          <Button
            title={note.eliminated ? `恢复 ${seat} 号为在场` : `标记 ${seat} 号出局`}
            variant={note.eliminated ? 'secondary' : 'danger'}
            onPress={() => onChange(setSeatEliminated(notebook, seat, !note.eliminated))}
          />
        </View>
        {isOwn ? <Text style={styles.footnote}>这是你的座位，身份是 {ROLES[notebook.ownRole].name}。可以写下自己的思路和发言计划。</Text> : <>
          <Text style={styles.footnote}>先记判断，再写理由。比如“3 号像狼，因为他保了 7 号”。</Text>
          <View style={styles.chipRow}>
            {marks.map(mark => (
              <MotionPressable
                key={mark}
                accessibilityRole="button"
                accessibilityLabel={`标记为${SEAT_MARK_LABELS[mark]}`}
                accessibilityState={{ selected: note.mark === mark }}
                onPress={() => onChange(setSeatMark(notebook, seat, mark as SeatMark))}
                style={({ pressed }) => [styles.markChoice, note.mark === mark && styles.markChoiceActive, pressed && { opacity: 0.65 }]}
              >
                <Text style={[styles.markChoiceText, note.mark === mark && styles.markChoiceTextActive]}>{SEAT_MARK_LABELS[mark]}</Text>
              </MotionPressable>
            ))}
          </View>

          <View style={styles.sectionHead}>
            <Text style={styles.sectionTitle}>这个座位的身份</Text>
            {note.roleGuess ? <Chip>{ROLES[note.roleGuess].name}</Chip> : null}
          </View>
          <Text style={styles.footnote}>选了具体角色会自动更新上面的粗判断；再改粗判断会清空具体角色。</Text>
          <Button title={rolePickerOpen ? '收起身份列表' : note.roleGuess ? '更换这个座位的身份' : '编辑这个座位的身份'} variant="secondary" onPress={() => setRolePickerOpen(value => !value)} />
          {note.roleGuess ? <Button title="清除具体身份" variant="ghost" small onPress={() => onChange(setSeatRoleGuess(notebook, seat, null))} /> : null}
          {rolePickerOpen ? <RoleChoiceList roles={roles} selected={note.roleGuess} onSelect={selectRole} query={query} onQueryChange={setQuery} showSearch={roles.length > 10} searchLabel="搜索本板身份" /> : null}
        </>}
        <Text style={styles.sectionTitle}>{isOwn ? '我的记录' : `${seat} 号备注`}</Text>
        <TextInput
          accessibilityLabel={`${seat} 号备注`}
          value={note.note}
          onChangeText={text => onChange(setSeatNote(notebook, seat, text))}
          placeholder={isOwn ? '例如：今晚先听 4 号和 9 号，别暴露身份' : '例如：发言在保 7 号，像狼；下一轮想听他解释'}
          placeholderTextColor={colors.textTertiary}
          style={[styles.input, styles.summaryInput]}
          multiline
          maxLength={500}
        />
        <Text style={styles.caption}>{note.note.length} / 500</Text>
      </>}
    </Sheet>
  );
}
