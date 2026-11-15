import React from 'react';
import { Text, View } from 'react-native';
import { MotionPressable } from '../motion';
import { styles } from './styles';

export function RoundStepper({ value, onChange }: { value: number; onChange: (value: number) => void }) {
  return (
    <View style={styles.roundRow}>
      <MotionPressable accessibilityRole="button" accessibilityLabel="减少轮次" onPress={() => onChange(Math.max(1, value - 1))} style={({ pressed }) => [styles.stepButton, pressed && { opacity: 0.65 }]}><Text style={styles.stepGlyph}>−</Text></MotionPressable>
      <View style={styles.roundValue}><Text style={styles.caption}>第几轮</Text><Text style={styles.countValue}>{value}</Text></View>
      <MotionPressable accessibilityRole="button" accessibilityLabel="增加轮次" onPress={() => onChange(Math.min(20, value + 1))} style={({ pressed }) => [styles.stepButton, pressed && { opacity: 0.65 }]}><Text style={styles.stepGlyph}>＋</Text></MotionPressable>
    </View>
  );
}

export function SeatPicker({ count, value, onChange, prefix, emptyLabel }: {
  count: number;
  value: number | null | undefined;
  onChange: (value: number | null) => void;
  prefix: string;
  emptyLabel?: string;
}) {
  return (
    <View style={styles.pickerGrid}>
      {Array.from({ length: count }, (_, index) => index + 1).map(seat => (
        <MotionPressable key={seat} accessibilityRole="button" accessibilityLabel={`${prefix} ${seat} 号`} accessibilityState={{ selected: value === seat }} onPress={() => onChange(seat)} style={({ pressed }) => [styles.pickerSeat, value === seat && styles.pickerSeatActive, pressed && { opacity: 0.65 }]}>
          <Text style={[styles.pickerSeatText, value === seat && styles.pickerSeatTextActive]}>{seat}</Text>
        </MotionPressable>
      ))}
      {emptyLabel ? (
        <MotionPressable accessibilityRole="button" accessibilityLabel={emptyLabel} accessibilityState={{ selected: value === null }} onPress={() => onChange(null)} style={({ pressed }) => [styles.pickerSeat, value === null && styles.pickerSeatActive, pressed && { opacity: 0.65 }]}>
          <Text style={[styles.pickerSeatText, value === null && styles.pickerSeatTextActive]}>{emptyLabel}</Text>
        </MotionPressable>
      ) : null}
    </View>
  );
}
