import React, { useState } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';
import { hostTaskLogText, hostTasks, type HostTask } from '../../game/host-tasks';
import type { Action, Game } from '../../game/types';
import { colors, radius, spacing, type } from '../../theme';
import { Button, Card, InlineError, Sheet } from '../kit';

export function HostSupportSheet({
  game,
  visible,
  onClose,
  dispatch,
}: {
  game: Game;
  visible: boolean;
  onClose: () => void;
  dispatch: (action: Action) => boolean;
}) {
  const tasks = hostTasks(game.players.map(player => player.role));
  const [details, setDetails] = useState<Partial<Record<HostTask['role'], string>>>({});
  const [feedback, setFeedback] = useState('');
  const [error, setError] = useState('');

  const record = (task: HostTask) => {
    const detail = details[task.role]?.trim() ?? '';
    if (detail.length < 2) {
      setError('请写明涉及的座位、目标、剩余次数或实际裁定，至少 2 个字。');
      return;
    }
    if (!dispatch({ type: 'note', text: hostTaskLogText(task, detail) })) return;
    setDetails(current => ({ ...current, [task.role]: '' }));
    setError('');
    setFeedback(`${task.name}本次处理已写入主持记录。`);
  };

  return (
    <Sheet
      visible={visible}
      onClose={onClose}
      title="本局技能处理清单"
      subtitle="每项都写明结果后再继续；记录会随对局保存并进入复盘"
    >
      <View style={styles.intro}>
        <Text style={type.body}>这局共有 {tasks.length} 项需要主持人核对或手动处理。</Text>
        <Text style={type.footnote}>
          清单只负责提醒和留痕，不会替你假设特殊技能结果。重复技能每次处理后都可再记一条。
        </Text>
      </View>
      {feedback ? <Text accessibilityRole="alert" accessibilityLiveRegion="polite" style={styles.feedback}>{feedback}</Text> : null}
      {error ? <InlineError>{error}</InlineError> : null}
      {tasks.map(task => (
        <Card key={task.role} style={styles.card}>
          <View style={styles.head}>
            <View style={styles.flex}>
              <Text accessibilityRole="header" style={type.headline}>{task.name}</Text>
              <Text style={styles.meta}>{task.cardType} · {task.levelLabel}</Text>
            </View>
            <Text style={styles.trigger}>{task.timing}</Text>
          </View>
          <Text selectable style={type.body}>{task.note}</Text>
          <TextInput
            accessibilityLabel={`${task.name}本次处理结果`}
            value={details[task.role] ?? ''}
            onChangeText={value => setDetails(current => ({ ...current, [task.role]: value }))}
            multiline
            maxLength={280}
            placeholder="写明座位、目标、次数、死因或裁定结果"
            placeholderTextColor={colors.textTertiary}
            style={styles.input}
          />
          <Button
            title={`记录 ${task.name} 已处理`}
            variant="secondary"
            onPress={() => record(task)}
            disabled={(details[task.role]?.trim().length ?? 0) < 2}
          />
        </Card>
      ))}
      <Text style={type.footnote}>
        全部处理完后可从“主持记录”确认每一步都留有证据。涉及玩法差异的规则，以赛前桌规为准。
      </Text>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  intro: { gap: spacing.sm, paddingBottom: spacing.sm, borderBottomWidth: StyleSheet.hairlineWidth, borderColor: colors.line },
  card: { gap: spacing.md },
  head: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.md },
  flex: { flex: 1, minWidth: 0 },
  meta: { ...type.caption, marginTop: 3 },
  trigger: { ...type.footnote, maxWidth: '48%', textAlign: 'right' },
  input: {
    minHeight: 84,
    borderRadius: radius.sm,
    backgroundColor: colors.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.line,
    color: colors.text,
    fontSize: 16,
    lineHeight: 23,
    padding: spacing.md,
    textAlignVertical: 'top',
  },
  feedback: { ...type.footnote, color: colors.success },
});
