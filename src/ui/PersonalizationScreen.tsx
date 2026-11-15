import React from 'react';
import { Alert, ScrollView, StyleSheet, Text, View } from 'react-native';
import { colors, radius, spacing, type } from '../theme';
import { ROLES } from '../game/roles';
import { tableRules } from '../game/table-rules';
import { Button, Chip, Divider, InlineError, TopBar } from './kit';
import { Icon } from './Icon';
import { MotionPressable as Pressable } from './motion';
import { HOSTING_MODES, type HostingMode, type HostingProfile } from './preferences';
import { useResponsive } from './responsive';

type Props = {
  profiles: HostingProfile[];
  selectedProfileId?: string;
  hostingMode: HostingMode;
  disabled?: boolean;
  error?: string;
  onHostingModeChange: (mode: HostingMode) => void;
  onCreate: () => void;
  onEdit: (profile: HostingProfile) => void;
  onDuplicate?: (profile: HostingProfile) => void;
  onSelect: (id: string) => void;
  onDelete: (id: string) => void;
  onRetry?: () => void;
  onBackup?: () => void;
};

export function PersonalizationScreen({ profiles, selectedProfileId, hostingMode, disabled, error, onHostingModeChange, onCreate, onEdit, onDuplicate, onSelect, onDelete, onRetry, onBackup }: Props) {
  const atLimit = profiles.length >= 20;
  const responsive = useResponsive();
  const selectedProfile = profiles.find(profile => profile.id === selectedProfileId);
  const confirmDelete = (profile: HostingProfile) => {
    Alert.alert(`删除“${profile.name}”？`, '删除后无法恢复这份方案，正在主持的对局不受影响。', [
      { text: '取消', style: 'cancel' },
      { text: '删除方案', style: 'destructive', onPress: () => onDelete(profile.id) },
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
        return (
          <View key={profile.id} style={[styles.profile, responsive.isExpanded && styles.profileWide, selected && styles.profileSelected]}>
            <View style={styles.profileHead}>
              <Text style={[type.headline, styles.flex]}>{profile.name}</Text>
              {selected ? <Chip tone="accent">默认开局</Chip> : null}
            </View>
            <Text style={styles.boardName}>{profile.boardName} · {profile.roles.length} 人</Text>
            <Text style={type.footnote}>{sheriff} · {profile.rules.win === 'all' ? '屠城' : '屠边'}</Text>
            <Text style={type.footnote}>放逐平票{table.exileTie === 'pk' ? ' PK 一轮' : '无人出局'}{profile.rules.flow?.keepDeadCalls ? ' · 保留出局角色夜间口播' : ''}{table.notes ? ' · 有本桌补充约定' : ''}</Text>
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
          <View style={styles.appearanceRow}><Text style={type.callout}>界面外观</Text><Text style={type.footnote}>白色</Text></View>
        </View>
      </View>
      </ScrollView>
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
  appearanceRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', minHeight: 58, paddingVertical: spacing.md, borderTopWidth: StyleSheet.hairlineWidth, borderColor: colors.line },
  disabled: { opacity: 0.45 },
  pressed: { opacity: 0.7 },
});
