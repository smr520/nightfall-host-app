import React from 'react';
import { Switch, Text, View } from 'react-native';
import { ROLE_REFERENCE } from '../../game/role-reference';
import { ROLES } from '../../game/roles';
import type { Role } from '../../game/types';
import { colors, type } from '../../theme';
import { MotionPressable } from '../motion';
import { styles } from './styles';

export function RoleStepper({ role, value, onChange, onInfo, canIncrease = true }: { role: Role; value: number; onChange: (n: number) => void; onInfo?: () => void; canIncrease?: boolean }) {
  return (
    <View style={styles.stepperRow}>
      <View style={styles.flex}>
        {onInfo ? <MotionPressable accessibilityRole="button" accessibilityLabel={`查看技能：${ROLES[role].name}`} onPress={onInfo} style={styles.roleInfo}><Text style={type.body}>{ROLES[role].name}</Text><Text style={styles.changeHint}>查看技能</Text></MotionPressable> : <Text style={type.body}>{ROLES[role].name}</Text>}
        <Text style={type.footnote} numberOfLines={1}>{ROLE_REFERENCE[role].overview}</Text>
      </View>
      <View style={styles.stepper}>
        <MotionPressable accessibilityRole="button" accessibilityLabel={`减少${ROLES[role].name}`} onPress={() => onChange(Math.max(0, value - 1))} style={styles.stepperButton}><Text style={styles.stepperGlyph}>−</Text></MotionPressable>
        <Text style={styles.stepperValue}>{value}</Text>
        {canIncrease ? <MotionPressable accessibilityRole="button" accessibilityLabel={`增加${ROLES[role].name}`} onPress={() => onChange(Math.min(9, value + 1))} style={styles.stepperButton}><Text style={styles.stepperGlyph}>＋</Text></MotionPressable> : null}
      </View>
    </View>
  );
}

export function ToggleRow({ label, value, onChange }: { label: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <View style={styles.toggleRow}>
      <Text style={[type.body, styles.flex]}>{label}</Text>
      <Switch accessibilityLabel={label} value={value} onValueChange={onChange} trackColor={{ false: colors.surfaceHigh, true: colors.accentDim }} thumbColor={value ? colors.accent : colors.textTertiary} />
    </View>
  );
}

export function ChoiceRow({ label, value, options, onChange }: { label: string; value: string; options: { label: string; value: string }[]; onChange: (v: string) => void }) {
  return (
    <View style={styles.choiceRow}>
      <Text style={type.body}>{label}</Text>
      <View style={styles.choiceGroup}>
        {options.map(option => (
          <MotionPressable key={option.value} accessibilityRole="button" accessibilityState={{ selected: value === option.value }} accessibilityLabel={`${label} ${option.label}`} onPress={() => onChange(option.value)} style={[styles.choice, value === option.value && styles.choiceActive]}>
            <Text style={[styles.choiceText, value === option.value && styles.choiceTextActive]}>{option.label}</Text>
          </MotionPressable>
        ))}
      </View>
    </View>
  );
}
