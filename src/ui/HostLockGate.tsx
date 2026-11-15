import React, { useState } from 'react';
import { ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { colors, radius, spacing, type } from '../theme';
import { MAX_HOST_PIN_LENGTH, MIN_HOST_PIN_LENGTH } from '../game/host-pin';
import { Button, InlineError } from './kit';
import { Icon } from './Icon';
import { useResponsive } from './responsive';

export function HostLockGate({
  onUnlock,
  onSwitchRole,
}: {
  onUnlock: (pin: string) => Promise<boolean>;
  onSwitchRole?: () => void;
}) {
  const responsive = useResponsive();
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [attempts, setAttempts] = useState(0);
  const locked = attempts >= 5;

  const submit = async () => {
    if (locked || busy) return;
    setBusy(true);
    setError('');
    try {
      const valid = await onUnlock(pin);
      if (valid) {
        setPin('');
        return;
      }
      setPin('');
      setAttempts(value => value + 1);
      setError('主持 PIN 不正确。连续输错 5 次后，本次打开期间会暂停解锁。');
    } catch {
      setError('暂时无法验证主持 PIN，请保持应用打开后重试。');
    } finally {
      setBusy(false);
    }
  };

  return (
    <ScrollView
      style={styles.root}
      contentContainerStyle={[styles.content, { paddingHorizontal: responsive.gutter }]}
      keyboardShouldPersistTaps="handled"
    >
      <View accessible={false} style={styles.mark}><Icon name="shield" size={30} color={colors.textSecondary} /></View>
      <Text accessibilityRole="header" style={styles.title}>主持端已锁定</Text>
      <Text style={styles.body}>输入主持人设置的 PIN，解锁身份、夜间目标和本机对局。玩家模式仍可单独使用。</Text>
      <View style={styles.form}>
        <TextInput
          accessibilityLabel="主持 PIN"
          accessibilityHint={`${MIN_HOST_PIN_LENGTH} 到 ${MAX_HOST_PIN_LENGTH} 位数字`}
          value={pin}
          onChangeText={value => setPin(value.replace(/\D/g, '').slice(0, MAX_HOST_PIN_LENGTH))}
          onSubmitEditing={() => { void submit(); }}
          keyboardType="number-pad"
          secureTextEntry
          maxLength={MAX_HOST_PIN_LENGTH}
          editable={!busy && !locked}
          placeholder="输入 PIN"
          placeholderTextColor={colors.textTertiary}
          returnKeyType="done"
          style={styles.input}
        />
        {error ? <InlineError>{error}</InlineError> : null}
        {locked ? <Text accessibilityRole="alert" style={styles.lockedText}>本次打开期间已暂停主持端解锁。关闭并重新打开应用后可再次尝试。</Text> : (
          <Button
            title={busy ? '正在验证…' : '解锁主持端'}
            onPress={() => { void submit(); }}
            disabled={busy || pin.length < MIN_HOST_PIN_LENGTH}
          />
        )}
      </View>
      {onSwitchRole ? <Button title="切换到玩家模式" variant="secondary" onPress={onSwitchRole} /> : null}
      <Text style={styles.note}>PIN 只保存加盐哈希。忘记后无法从界面绕过；清除应用数据会删除本机对局与笔记，请只在个人设备上启用。</Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  content: {
    flexGrow: 1,
    width: '100%',
    maxWidth: 520,
    alignSelf: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.huge,
    gap: spacing.lg,
  },
  mark: {
    width: 64,
    height: 64,
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surfaceAlt,
  },
  title: { ...type.title, fontSize: 30 },
  body: { ...type.body, color: colors.textSecondary },
  form: { gap: spacing.md, paddingVertical: spacing.lg },
  input: {
    minHeight: 60,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.lg,
    color: colors.text,
    fontSize: 24,
    letterSpacing: 6,
    textAlign: 'center',
  },
  lockedText: { ...type.footnote, color: colors.danger },
  note: { ...type.footnote, color: colors.textTertiary },
});
