import React, { useState } from 'react';
import { ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { Alert } from './alert';
import { colors, radius, spacing, type } from '../theme';
import { ROLES } from '../game/roles';
import { tableRules } from '../game/table-rules';
import { shouldKeepDeadCalls } from '../game/flow';
import { Button, Chip, Divider, InlineError, Sheet, TopBar } from './kit';
import { Icon } from './Icon';
import { MotionPressable as Pressable } from './motion';
import { HOSTING_MODES, HOST_TEXT_SIZES, type HostingMode, type HostingProfile, type HostTextSize } from './preferences';
import { useResponsive } from './responsive';
import { isValidHostPin, MAX_HOST_PIN_LENGTH, MIN_HOST_PIN_LENGTH } from '../game/host-pin';

type Props = {
  profiles: HostingProfile[];
  selectedProfileId?: string;
  hostingMode: HostingMode;
  textSize?: HostTextSize;
  disabled?: boolean;
  error?: string;
  onHostingModeChange: (mode: HostingMode) => void;
  onTextSizeChange?: (size: HostTextSize) => void;
  onCreate: () => void;
  onEdit: (profile: HostingProfile) => void;
  onDuplicate?: (profile: HostingProfile) => void;
  onSelect: (id: string) => void;
  onDelete: (id: string) => void;
  onRetry?: () => void;
  onBackup?: () => void;
  hostPinEnabled?: boolean;
  onSetHostPin?: (pin: string) => Promise<void>;
  onClearHostPin?: () => Promise<void>;
  onLockHost?: () => void;
};

export function PersonalizationScreen({ profiles, selectedProfileId, hostingMode, textSize = 'standard', disabled, error, onHostingModeChange, onTextSizeChange, onCreate, onEdit, onDuplicate, onSelect, onDelete, onRetry, onBackup, hostPinEnabled, onSetHostPin, onClearHostPin, onLockHost }: Props) {
  const atLimit = profiles.length >= 20;
  const responsive = useResponsive();
  const selectedProfile = profiles.find(profile => profile.id === selectedProfileId);
  const [pinOpen, setPinOpen] = useState(false);
  const [pin, setPin] = useState('');
  const [pinConfirm, setPinConfirm] = useState('');
  const [pinError, setPinError] = useState('');
  const [pinBusy, setPinBusy] = useState(false);
  const confirmDelete = (profile: HostingProfile) => {
    Alert.alert(`删除“${profile.name}”？`, '删除后无法恢复这份方案，正在主持的对局不受影响。', [
      { text: '取消', style: 'cancel' },
      { text: '删除方案', style: 'destructive', onPress: () => onDelete(profile.id) },
    ]);
  };
  const savePin = async () => {
    if (!onSetHostPin || pinBusy) return;
    if (!isValidHostPin(pin)) {
      setPinError(`PIN 必须是 ${MIN_HOST_PIN_LENGTH}–${MAX_HOST_PIN_LENGTH} 位数字`);
      return;
    }
    if (pin !== pinConfirm) {
      setPinError('两次输入的 PIN 不一致');
      return;
    }
    setPinBusy(true);
    setPinError('');
    try {
      await onSetHostPin(pin);
      setPin('');
      setPinConfirm('');
      setPinOpen(false);
      Alert.alert('主持端锁已开启', '下次进入主持端时需要输入 PIN。请牢记，忘记后无法从界面绕过。');
    } catch {
      setPinError('无法保存主持 PIN，请检查存储空间后重试。');
    } finally {
      setPinBusy(false);
    }
  };
  const clearPin = () => {
    setPinOpen(false);
    Alert.alert('关闭主持端锁？', '关闭后，任何拿到这台手机的人都可以直接进入主持数据。', [
      { text: '取消', style: 'cancel' },
      {
        text: '关闭锁',
        style: 'destructive',
        onPress: () => { void onClearHostPin?.().catch(() => Alert.alert('关闭失败', '主持端锁未被移除，请检查存储空间后重试。')); },
      },
    ]);
  };

  return (
    <View style={styles.root}>
      <TopBar title="个性化设置" large="我的桌规" />
      <ScrollView style={styles.flex} contentContainerStyle={[styles.content, { paddingHorizontal: responsive.gutter, width: '100%', maxWidth: responsive.maxContentWidth, alignSelf: 'center' }]} showsVerticalScrollIndicator={false}>
      {error ? <InlineError>{error}</InlineError> : null}
      {error && onRetry ? <Button title="重试读取偏好" variant="secondary" onPress={onRetry} /> : null}

      <View style={styles.section}>
        <Text accessibilityRole="header" style={styles.sectionLabel}>默认开局方式</Text>
        <View style={styles.modeGroup}>
          {HOSTING_MODES.map((mode, index) => {
            const selected = mode.key === hostingMode;
            return <View key={mode.key}>
              {index > 0 ? <Divider /> : null}
              <Pressable accessibilityRole="button" accessibilityLabel={mode.title} accessibilityState={{ selected, disabled: !!disabled }} disabled={disabled} onPress={() => onHostingModeChange(mode.key)} style={({ pressed }) => [styles.modeRow, disabled && styles.disabled, pressed && styles.pressed]}>
                <View style={styles.flex}>
                  <Text style={type.callout}>{mode.title}</Text>
                  <Text style={type.footnote}>{mode.key === 'custom' && selectedProfile ? selectedProfile.name : mode.note}</Text>
                </View>
                <View style={[styles.radio, selected && styles.radioSelected]}>{selected ? <View style={styles.radioDot} /> : null}</View>
              </Pressable>
            </View>;
          })}
        </View>
        <Text style={styles.groupHint}>新局自动带入所选方式。阵容、技能限制、夜间顺序和主持词都可以保存为方案。</Text>
      </View>
      <View style={styles.sectionHead}>
        <View style={styles.flex}>
          <Text accessibilityRole="header" style={type.title2}>我的主持方案</Text>
          <Text style={styles.intro}>常用的阵容、流程和口播，存好就能用。</Text>
        </View>
        <Text style={styles.count}>{profiles.length} / 20</Text>
      </View>

      <Button title="新建自定义方案" variant="secondary" onPress={onCreate} disabled={disabled || atLimit} />
      {atLimit ? <Text style={type.footnote}>已保存 20 份方案。删除不用的方案后可以继续新建。</Text> : null}

      {profiles.length === 0 ? (
        <View style={styles.empty}>
          <View accessible={false} style={styles.emptyPage}><View style={styles.emptyPageLine} /><View style={styles.emptyPageLine} /><View style={[styles.emptyPageLine, styles.emptyPageLineShort]} /></View>
          <Text style={type.headline}>还没有保存的方案</Text>
          <Text style={styles.emptyDescription}>从常玩的板子开始，配好人数、角色和桌规，再设为默认开局方案。</Text>
        </View>
      ) : <View style={[styles.profileList, responsive.isExpanded && styles.profileListWide]}>{profiles.map(profile => {
        const selected = hostingMode === 'custom' && profile.id === selectedProfileId;
        const sheriff = profile.rules.sheriff
          ? profile.rules.sheriffTiming === 'after-announcement' ? '先公布死亡，再竞选' : '先竞选，再公布死亡'
          : '无警长竞选';
        const nightOrder = profile.rules.flow?.nightOrder;
        const table = tableRules(profile.rules);
        const progressiveIdentity = profile.rules.flow?.identityCheck === 'during-night';
        const legacyIdentity = profile.rules.flow?.identityCheck === 'at-nightfall';
        return (
          <View key={profile.id} style={[styles.profile, responsive.isExpanded && styles.profileWide, selected && styles.profileSelected]}>
            <View style={styles.profileHead}>
              <Text style={[type.headline, styles.flex]}>{profile.name}</Text>
              {selected ? <Chip tone="accent">默认开局</Chip> : null}
            </View>
            <Text style={styles.boardName}>{profile.boardName} · {profile.roles.length} 人</Text>
            <Text style={type.footnote}>{sheriff} · {profile.rules.win === 'all' ? '屠城' : '屠边'}</Text>
            <Text style={type.footnote}>
              {table.exileRecord === 'quick' ? '快速放逐记录' : `逐人计票 · 平票${table.exileTie === 'pk' ? ' PK 一轮' : '无人出局'}`}
              {shouldKeepDeadCalls(profile.rules) ? ' · 默认保留出局角色夜间口播' : ' · 跳过出局角色夜间口播'}
              {progressiveIdentity ? ' · 夜间行动流程：确认即行动' : legacyIdentity ? ' · 旧版逐座身份核对' : ''}
              {table.notes ? ' · 有本桌补充约定' : ''}
            </Text>
            {profile.rules.flow ? <View style={styles.flowSummary}>
              <Text style={styles.flowLabel}>自定义主持流程{profile.rules.flow.manualDawn ? ' · 手动确认天亮出局' : ''}{profile.rules.flow.manualVictory ? ' · 主持人判定结束' : ''}</Text>
              {nightOrder?.length ? <Text style={type.footnote}>{nightOrder.map(call => call === 'wolves' ? '狼人' : ROLES[call].name).join(' → ')}</Text> : null}
            </View> : null}
            <View style={styles.actions}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`使用方案：${profile.name}`}
                accessibilityState={{ disabled: !!disabled || selected, selected }}
                disabled={disabled || selected}
                onPress={() => onSelect(profile.id)}
                style={({ pressed }) => [styles.useButton, selected && styles.currentButton, disabled && styles.disabled, pressed && styles.pressed]}
              >
                <Text style={[styles.useText, selected && styles.currentText]}>{selected ? '已设为默认' : '使用此方案'}</Text>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`编辑方案：${profile.name}`}
                accessibilityState={{ disabled: !!disabled }}
                disabled={disabled}
                onPress={() => onEdit(profile)}
                style={({ pressed }) => [styles.action, disabled && styles.disabled, pressed && styles.pressed]}
              >
                <Text style={styles.editText}>编辑</Text>
              </Pressable>
              {onDuplicate ? <Pressable
                accessibilityRole="button"
                accessibilityLabel={`复制方案：${profile.name}`}
                accessibilityState={{ disabled: !!disabled || atLimit }}
                disabled={disabled || atLimit}
                onPress={() => onDuplicate(profile)}
                style={({ pressed }) => [styles.action, (disabled || atLimit) && styles.disabled, pressed && styles.pressed]}
              ><Text style={styles.editText}>复制</Text></Pressable> : null}
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`删除方案：${profile.name}`}
                accessibilityState={{ disabled: !!disabled }}
                disabled={disabled}
                onPress={() => confirmDelete(profile)}
                style={({ pressed }) => [styles.action, disabled && styles.disabled, pressed && styles.pressed]}
              >
                <Text style={styles.deleteText}>删除</Text>
              </Pressable>
            </View>
          </View>
        );
      })}</View>}

      <View style={styles.note}>
        <Text style={styles.sectionLabel}>默认方案</Text>
        <Text style={type.footnote}>新建对局时带入默认方案。每局仍可单独调整，修改方案也不会改变正在主持的对局。</Text>
      </View>
      <View style={styles.deviceSection}>
        <Text style={styles.sectionLabel}>本机设置</Text>
        <View style={styles.deviceGroup}>
          {onBackup ? <Pressable accessibilityRole="button" accessibilityLabel="本机数据：备份与恢复" onPress={onBackup} style={({ pressed }) => [styles.backupRow, pressed && styles.pressed]}><Icon name="archive" size={20} color={colors.textSecondary} /><View style={styles.flex}><Text style={type.callout}>备份与恢复</Text><Text style={type.footnote}>导出方案、对局和复盘</Text></View><Icon name="chevron-right" size={18} color={colors.textTertiary} /></Pressable> : null}
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={hostPinEnabled ? '主持端锁：已开启' : '主持端锁：未开启'}
            onPress={() => setPinOpen(true)}
            style={({ pressed }) => [styles.backupRow, styles.lockRow, pressed && styles.pressed]}
          >
            <Icon name="shield" size={20} color={colors.textSecondary} />
            <View style={styles.flex}>
              <Text style={type.callout}>主持端锁</Text>
              <Text style={type.footnote}>{hostPinEnabled ? '已开启 · 进入主持端需要 PIN' : '可选 · 防止玩家进入身份数据'}</Text>
            </View>
            <Text style={styles.rowAction}>{hostPinEnabled ? '管理' : '设置'}</Text>
          </Pressable>
          <View style={styles.appearanceRow}><Text style={type.callout}>界面外观</Text><Text style={type.footnote}>白色</Text></View>
          <View style={styles.readingSection}>
            <View style={styles.readingHead}>
              <Text style={type.callout}>主持提词字号</Text>
              <Text style={type.footnote}>只放大主持台词、结果和关键提示</Text>
            </View>
            <View style={styles.readingOptions}>
              {HOST_TEXT_SIZES.map(option => {
                const selected = option.key === textSize;
                return (
                  <Pressable
                    key={option.key}
                    accessibilityRole="button"
                    accessibilityLabel={option.accessibilityLabel}
                    accessibilityState={{ selected, disabled: !!disabled || !onTextSizeChange }}
                    disabled={!!disabled || !onTextSizeChange}
                    onPress={() => onTextSizeChange?.(option.key)}
                    style={({ pressed }) => [styles.readingOption, selected && styles.readingOptionActive, (disabled || !onTextSizeChange) && styles.disabled, pressed && styles.pressed]}
                  >
                    <Text style={[styles.readingOptionTitle, selected && styles.readingOptionTitleActive]}>{option.title}</Text>
                    <Text style={styles.readingOptionNote}>{option.note}</Text>
                  </Pressable>
                );
              })}
            </View>
          </View>
        </View>
      </View>
      </ScrollView>
      <Sheet visible={pinOpen} onClose={() => { if (!pinBusy) setPinOpen(false); }} title="主持端锁" subtitle="PIN 只以加盐哈希保存在本机">
        {hostPinEnabled ? (
          <View style={styles.pinEnabled}>
            <Text style={type.body}>主持端锁已开启。切换到玩家模式不需要 PIN；切回主持或重新打开应用时会被拦截。</Text>
            <Button title="立即锁定主持端" variant="secondary" onPress={() => { setPinOpen(false); onLockHost?.(); }} />
            <Button title="关闭主持端锁" variant="danger" onPress={clearPin} />
          </View>
        ) : (
          <>
            <Text style={type.footnote}>设置后，主持人、身份、夜间目标和本机对局会受 PIN 保护。玩家模式不会读取这些数据。</Text>
            <TextInput
              accessibilityLabel="设置主持 PIN"
              value={pin}
              onChangeText={value => setPin(value.replace(/\D/g, '').slice(0, MAX_HOST_PIN_LENGTH))}
              keyboardType="number-pad"
              secureTextEntry
              maxLength={MAX_HOST_PIN_LENGTH}
              placeholder={`输入 ${MIN_HOST_PIN_LENGTH}–${MAX_HOST_PIN_LENGTH} 位数字`}
              placeholderTextColor={colors.textTertiary}
              style={styles.pinInput}
            />
            <TextInput
              accessibilityLabel="再次输入主持 PIN"
              value={pinConfirm}
              onChangeText={value => setPinConfirm(value.replace(/\D/g, '').slice(0, MAX_HOST_PIN_LENGTH))}
              keyboardType="number-pad"
              secureTextEntry
              maxLength={MAX_HOST_PIN_LENGTH}
              placeholder="再次输入"
              placeholderTextColor={colors.textTertiary}
              style={styles.pinInput}
            />
            {pinError ? <InlineError>{pinError}</InlineError> : null}
            <Button title={pinBusy ? '正在保存…' : '开启主持端锁'} onPress={() => { void savePin(); }} disabled={pinBusy || !onSetHostPin} />
            <Text style={styles.pinWarning}>忘记 PIN 后无法从界面绕过。设备上的对局仍会保留，但可能需要清除应用数据才能重新进入主持端。</Text>
          </>
        )}
      </Sheet>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.surface },
  content: { paddingHorizontal: spacing.xl, paddingTop: spacing.lg, paddingBottom: spacing.huge, gap: spacing.lg },
  flex: { flex: 1, minWidth: 0 },
  section: { gap: spacing.md },
  sectionLabel: { ...type.caption, fontWeight: '500', color: colors.textSecondary },
  groupHint: { ...type.footnote, paddingHorizontal: 2, color: colors.textTertiary },
  modeGroup: { paddingHorizontal: spacing.lg, borderRadius: radius.md, backgroundColor: colors.surfaceAlt },
  modeRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingVertical: spacing.md, minHeight: 76 },
  radio: { width: 20, height: 20, borderRadius: 10, borderWidth: 1.5, borderColor: colors.line, alignItems: 'center', justifyContent: 'center' },
  radioSelected: { borderColor: colors.accent },
  radioDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: colors.accent },
  sectionHead: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.md, marginTop: spacing.xl },
  intro: { ...type.footnote, marginTop: spacing.xs },
  count: { ...type.caption, paddingTop: spacing.xs },
  empty: { alignItems: 'center', gap: spacing.sm, paddingHorizontal: spacing.lg, paddingVertical: spacing.xl, borderBottomWidth: StyleSheet.hairlineWidth, borderColor: colors.lineSoft },
  emptyPage: { width: 40, height: 48, paddingHorizontal: 9, paddingTop: 15, gap: 5, marginBottom: spacing.sm, borderWidth: 1, borderColor: colors.line, borderRadius: 4 },
  emptyPageLine: { height: 1, backgroundColor: colors.line },
  emptyPageLineShort: { width: 13 },
  emptyDescription: { ...type.footnote, textAlign: 'center', maxWidth: 280 },
  profileList: { gap: spacing.lg },
  profileListWide: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'flex-start' },
  profile: { paddingVertical: spacing.lg, gap: spacing.xs, borderTopWidth: StyleSheet.hairlineWidth, borderColor: colors.line },
  profileWide: { width: '48.5%', paddingRight: spacing.lg },
  profileSelected: { borderTopColor: colors.text },
  profileHead: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm },
  boardName: { ...type.callout, color: colors.textSecondary },
  flowSummary: { gap: spacing.xs, marginTop: spacing.sm, paddingLeft: spacing.sm, borderLeftWidth: 2, borderColor: colors.line },
  flowLabel: { ...type.caption, color: colors.textSecondary, fontWeight: '500' },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs, marginTop: spacing.md },
  useButton: { flexGrow: 1, minWidth: 108, minHeight: 48, borderRadius: radius.sm, backgroundColor: colors.surfaceAlt, alignItems: 'center', justifyContent: 'center', paddingHorizontal: spacing.md, paddingVertical: spacing.sm },
  useText: { ...type.callout, color: colors.text, fontWeight: '600' },
  currentButton: { backgroundColor: colors.surface },
  currentText: { color: colors.textSecondary },
  action: { minWidth: 48, minHeight: 48, borderRadius: radius.sm, alignItems: 'center', justifyContent: 'center', paddingHorizontal: spacing.sm, paddingVertical: spacing.sm },
  editText: { ...type.callout, color: colors.text, fontWeight: '600' },
  deleteText: { ...type.callout, color: colors.danger, fontWeight: '500' },
  note: { gap: spacing.xs, paddingTop: spacing.sm },
  deviceSection: { gap: spacing.md, marginTop: spacing.lg },
  deviceGroup: { backgroundColor: colors.surfaceAlt, borderRadius: radius.md, paddingHorizontal: spacing.lg },
  backupRow: { flexDirection: 'row', alignItems: 'center', minHeight: 78, gap: spacing.md, paddingVertical: spacing.md },
  lockRow: { borderTopWidth: StyleSheet.hairlineWidth, borderColor: colors.line },
  appearanceRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', minHeight: 58, paddingVertical: spacing.md, borderTopWidth: StyleSheet.hairlineWidth, borderColor: colors.line },
  readingSection: { gap: spacing.md, paddingVertical: spacing.md, borderTopWidth: StyleSheet.hairlineWidth, borderColor: colors.line },
  readingHead: { gap: spacing.xs },
  readingOptions: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  readingOption: { flexGrow: 1, flexBasis: 120, minHeight: 72, justifyContent: 'center', gap: spacing.xs, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderRadius: radius.sm, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line },
  readingOptionActive: { borderColor: colors.accent, backgroundColor: colors.accentDim },
  readingOptionTitle: { ...type.callout, fontWeight: '600' },
  readingOptionTitleActive: { color: colors.accentStrong },
  readingOptionNote: { ...type.caption, fontWeight: '400', lineHeight: 17 },
  rowAction: { ...type.callout, color: colors.accent, fontWeight: '600' },
  pinEnabled: { gap: spacing.md },
  pinInput: { minHeight: 56, borderRadius: radius.sm, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.surface, color: colors.text, paddingHorizontal: spacing.md, fontSize: 20, letterSpacing: 4, textAlign: 'center' },
  pinWarning: { ...type.footnote, color: colors.textTertiary },
  disabled: { opacity: 0.45 },
  pressed: { opacity: 0.7 },
});
