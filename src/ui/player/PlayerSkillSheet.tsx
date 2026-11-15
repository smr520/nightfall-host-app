import React, { useState } from 'react';
import { Text, TextInput, View } from 'react-native';
import { ROLE_REFERENCE } from '../../game/role-reference';
import { addSkillUse, MAX_SKILL_NAME, MAX_SKILL_RESULT, type PlayerNotebook } from '../../player/notes';
import { colors } from '../../theme';
import { Button, InlineError, Sheet } from '../kit';
import { MotionPressable } from '../motion';
import { RoundStepper, SeatPicker } from './controls';
import { styles } from './styles';

const SKILL_RULES: { label: string; terms: string[] }[] = [
  { label: '查验', terms: ['查验', '查身份'] },
  { label: '解药', terms: ['解药'] },
  { label: '毒药', terms: ['毒药', '毒杀'] },
  { label: '守护', terms: ['守护', '保护', '庇护'] },
  { label: '刀人', terms: ['袭击', '击杀', '刀人'] },
  { label: '开枪', terms: ['开枪', '猎捕', '狙击'] },
  { label: '魅惑', terms: ['魅惑'] },
  { label: '决斗', terms: ['决斗'] },
  { label: '吞噬', terms: ['吞噬'] },
  { label: '缠绕', terms: ['缠绕'] },
  { label: '标记', terms: ['标记'] },
];

export function PlayerSkillSheet({ notebook, visible, onChange, onClose }: {
  notebook: PlayerNotebook;
  visible: boolean;
  onChange: (next: PlayerNotebook) => void;
  onClose: () => void;
}) {
  const [round, setRound] = useState(1);
  const [skill, setSkill] = useState('');
  const [target, setTarget] = useState<number | null>(null);
  const [result, setResult] = useState('');
  const [error, setError] = useState('');
  const reference = ROLE_REFERENCE[notebook.ownRole];
  const roleText = [reference.overview, ...reference.skills].join(' ');
  const suggestions = SKILL_RULES
    .filter(rule => rule.terms.some(term => roleText.includes(term)))
    .map(rule => rule.label)
    .slice(0, 4);

  const save = () => {
    try {
      onChange(addSkillUse(notebook, { round, skill, target, result }));
      onClose();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : '无法保存技能记录');
    }
  };

  return (
    <Sheet
      visible={visible}
      onClose={onClose}
      title="记一次技能"
      subtitle="只记录自己用过的技能，不代替主持结算"
      footer={<Button title="保存技能记录" onPress={save} disabled={!skill.trim()} />}
    >
      <RoundStepper value={round} onChange={setRound} />
      <Text style={styles.sectionTitle}>用了什么技能</Text>
      <TextInput
        accessibilityLabel="技能名称"
        value={skill}
        onChangeText={value => { setSkill(value); setError(''); }}
        placeholder="例如：查验 / 解药 / 守护"
        placeholderTextColor={colors.textTertiary}
        style={styles.input}
        maxLength={MAX_SKILL_NAME}
      />
      {suggestions.length ? <View style={styles.chipRow}>
        {suggestions.map(item => (
          <MotionPressable
            key={item}
            accessibilityRole="button"
            accessibilityLabel={`技能 ${item}`}
            accessibilityState={{ selected: skill === item }}
            onPress={() => { setSkill(item); setError(''); }}
            style={({ pressed }) => [styles.quickChip, skill === item && styles.quickChipActive, pressed && { opacity: 0.65 }]}
          >
            <Text style={[styles.quickChipText, skill === item && styles.quickChipTextActive]}>{item}</Text>
          </MotionPressable>
        ))}
      </View> : null}
      <Text style={styles.sectionTitle}>目标（可选）</Text>
      <SeatPicker count={notebook.playerCount} value={target} onChange={setTarget} prefix="技能目标" emptyLabel="无目标" />
      <Text style={styles.sectionTitle}>结果或备注（可选）</Text>
      <TextInput
        accessibilityLabel="技能结果"
        value={result}
        onChangeText={setResult}
        placeholder="例如：验出好人；救回 4 号；毒中 8 号"
        placeholderTextColor={colors.textTertiary}
        style={[styles.input, styles.summaryInput]}
        multiline
        maxLength={MAX_SKILL_RESULT}
      />
      <Text style={styles.caption}>{result.length} / {MAX_SKILL_RESULT}</Text>
      {error ? <InlineError>{error}</InlineError> : null}
    </Sheet>
  );
}
