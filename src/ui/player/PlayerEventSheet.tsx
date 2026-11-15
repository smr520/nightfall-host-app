import React, { useState } from 'react';
import { Text, TextInput, View } from 'react-native';
import { addEvent, EVENT_PHASE_LABELS, EVENT_PHASES, MAX_EVENT_TEXT, type EventPhase, type PlayerNotebook } from '../../player/notes';
import { colors } from '../../theme';
import { Button, InlineError, Sheet } from '../kit';
import { MotionPressable } from '../motion';
import { RoundStepper } from './controls';
import { styles } from './styles';

export function PlayerEventSheet({ notebook, visible, onChange, onClose }: {
  notebook: PlayerNotebook;
  visible: boolean;
  onChange: (next: PlayerNotebook) => void;
  onClose: () => void;
}) {
  const [round, setRound] = useState(1);
  const [phase, setPhase] = useState<EventPhase>('night');
  const [text, setText] = useState('');
  const [error, setError] = useState('');

  const save = () => {
    try {
      onChange(addEvent(notebook, { round, phase, text }));
      onClose();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : '无法保存事件');
    }
  };

  return (
    <Sheet
      visible={visible}
      onClose={onClose}
      title="记一条事件"
      subtitle="按轮次记一句话，之后不用翻座位备注"
      footer={<Button title="保存事件" onPress={save} disabled={!text.trim()} />}
    >
      <RoundStepper value={round} onChange={setRound} />
      <Text style={styles.sectionTitle}>类型</Text>
      <View style={styles.chipRow}>
        {EVENT_PHASES.map(item => (
          <MotionPressable
            key={item}
            accessibilityRole="button"
            accessibilityLabel={`事件类型 ${EVENT_PHASE_LABELS[item]}`}
            accessibilityState={{ selected: phase === item }}
            onPress={() => setPhase(item)}
            style={({ pressed }) => [styles.markChoice, phase === item && styles.markChoiceActive, pressed && { opacity: 0.65 }]}
          >
            <Text style={[styles.markChoiceText, phase === item && styles.markChoiceTextActive]}>{EVENT_PHASE_LABELS[item]}</Text>
          </MotionPressable>
        ))}
      </View>
      <Text style={styles.sectionTitle}>发生了什么</Text>
      <TextInput
        accessibilityLabel="事件内容"
        value={text}
        onChangeText={value => { setText(value); setError(''); }}
        placeholder="例如：3 号倒牌；5 号跳预言家，查杀 7 号"
        placeholderTextColor={colors.textTertiary}
        style={[styles.input, styles.summaryInput]}
        multiline
        maxLength={MAX_EVENT_TEXT}
      />
      <Text style={styles.caption}>{text.length} / {MAX_EVENT_TEXT}</Text>
      {error ? <InlineError>{error}</InlineError> : null}
    </Sheet>
  );
}
