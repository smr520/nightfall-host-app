import React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import type { AppRole } from '../storage-store';
import { colors, radius, spacing, type } from '../theme';
import { Icon, type IconName } from './Icon';
import { MotionPressable } from './motion';
import { useResponsive } from './responsive';

const OPTIONS: { role: AppRole; icon: IconName; title: string; description: string; hint: string }[] = [
  {
    role: 'host',
    icon: 'mic',
    title: '我是主持人',
    description: '开一局、走夜间流程、投票和结算。',
    hint: '对局记录只留在主持端',
  },
  {
    role: 'player',
    icon: 'users',
    title: '我是玩家',
    description: '记身份判断、票型、事件和自己的技能。',
    hint: '笔记只给自己看，不读取主持对局',
  },
];

export function RoleGate({ onSelect, error }: { onSelect: (role: AppRole) => void; error?: string }) {
  const responsive = useResponsive();
  return (
    <ScrollView
      contentContainerStyle={[styles.content, { paddingHorizontal: responsive.gutter, maxWidth: responsive.maxReadingWidth + responsive.gutter * 2, width: '100%', alignSelf: 'center' }]}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.brand}>
        <Icon name="moon" size={24} strokeWidth={1.4} />
        <Text style={styles.brandName}>夜幕</Text>
      </View>

      <View style={styles.hero}>
        <Text style={styles.eyebrow}>第一次使用</Text>
        <Text accessibilityRole="header" style={styles.title}>你是主持人，还是玩家？</Text>
        <Text style={styles.subtitle}>两边的界面和数据分开保存，不会互相覆盖；之后可以随时切换。</Text>
      </View>

      <View testID={responsive.isWideTablet ? 'role-options-wide' : undefined} style={[styles.options, responsive.isWideTablet && styles.optionsWide]}>
        {OPTIONS.map(option => (
          <MotionPressable
            key={option.role}
            accessibilityRole="button"
            accessibilityLabel={option.title}
            onPress={() => onSelect(option.role)}
            style={({ pressed }) => [styles.option, responsive.isWideTablet && styles.optionWide, pressed && styles.pressed]}
          >
            <View style={styles.optionIcon}><Icon name={option.icon} size={26} strokeWidth={1.5} /></View>
            <View style={styles.flex}>
              <Text style={styles.optionTitle}>{option.title}</Text>
              <Text style={styles.optionDescription}>{option.description}</Text>
              <Text style={styles.optionHint}>{option.hint}</Text>
            </View>
            <Icon name="chevron-right" size={20} color={colors.textTertiary} />
          </MotionPressable>
        ))}
      </View>

      {error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}
      <Text style={styles.footer}>不需要联网 · 数据只保存在本机</Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { flexGrow: 1, justifyContent: 'center', paddingVertical: spacing.xxl, gap: spacing.xxl },
  brand: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  brandName: { ...type.headline, letterSpacing: 1 },
  hero: { gap: spacing.sm },
  eyebrow: { ...type.caption, color: colors.textSecondary },
  title: { ...type.title, fontSize: 34, lineHeight: 44, letterSpacing: -0.6 },
  subtitle: { ...type.body, color: colors.textSecondary, maxWidth: 520 },
  options: { gap: spacing.md },
  optionsWide: { flexDirection: 'row', alignItems: 'stretch' },
  option: { minHeight: 132, flexDirection: 'row', alignItems: 'center', gap: spacing.lg, padding: spacing.lg, borderRadius: radius.lg, backgroundColor: colors.surfaceAlt, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.line },
  optionWide: { flex: 1 },
  optionIcon: { width: 52, height: 52, borderRadius: radius.full, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surface },
  optionTitle: { ...type.title2, fontSize: 21 },
  optionDescription: { ...type.body, marginTop: 3 },
  optionHint: { ...type.footnote, fontSize: 12, marginTop: 4 },
  pressed: { opacity: 0.72 },
  flex: { flex: 1, minWidth: 0 },
  error: { ...type.footnote, color: colors.danger },
  footer: { ...type.caption, textAlign: 'center', fontWeight: '400' },
});
