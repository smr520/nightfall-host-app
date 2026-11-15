import React, { useEffect, useRef, useState } from 'react';
import { Alert, BackHandler, ScrollView, Share, StyleSheet, Switch, Text, TextInput, View } from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system/legacy';
import { parseBackup, type BackupPayload } from '../game/backup';
import { Button, Card, Divider, InlineError, TopBar } from './kit';
import { colors, radius, spacing, type } from '../theme';
import { useResponsive } from './responsive';

const MAX_BACKUP_CHARACTERS = 5_000_000;
// A UTF-8 file cannot require more than three bytes per JavaScript UTF-16 unit.
// Reject certainly oversized files before allocating their complete contents.
const MAX_BACKUP_FILE_BYTES = MAX_BACKUP_CHARACTERS * 3;

export type BackupPreview = {
  exportedAt: number;
  hasCurrentSession: boolean;
  currentIsActive: boolean;
  historyCount: number;
  profileCount: number;
  legacy: boolean;
};

export type DataBackupScreenProps = {
  onBack: () => void;
  hasActiveSession: boolean;
  currentSessionDamaged?: boolean;
  onExportBackup: () => Promise<string>;
  onRestoreBackup: (raw: string, replaceCurrent: boolean) => Promise<void>;
  onImported?: () => void;
};

export function backupPreview(payload: BackupPayload, legacy = false): BackupPreview {
  return {
    exportedAt: payload.exportedAt,
    hasCurrentSession: !!payload.session,
    currentIsActive: !!payload.session && payload.session.current.stage !== 'ended',
    historyCount: payload.history.length,
    profileCount: payload.preferences.profiles.length,
    legacy,
  };
}

export function DataBackupScreen({ onBack, hasActiveSession, currentSessionDamaged = false, onExportBackup, onRestoreBackup, onImported }: DataBackupScreenProps) {
  const responsive = useResponsive();
  const [input, setInput] = useState('');
  const [preview, setPreview] = useState<BackupPreview | null>(null);
  const [replaceCurrent, setReplaceCurrent] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const operationPending = useRef(false);
  const confirmationPending = useRef<object | null>(null);
  const beginOperation = () => {
    if (operationPending.current || confirmationPending.current) return false;
    operationPending.current = true;
    setError(''); setMessage(''); setBusy(true);
    return true;
  };
  const finishOperation = () => { operationPending.current = false; setBusy(false); };
  useEffect(() => {
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      if (!operationPending.current && !confirmationPending.current) onBack();
      return true;
    });
    return () => subscription.remove();
  }, [onBack]);

  const pickFile = async () => {
    if (!beginOperation()) return;
    try {
      const result = await DocumentPicker.getDocumentAsync({ type: 'application/json', copyToCacheDirectory: true, multiple: false });
      if (result.canceled) return;
      const asset = result.assets[0];
      if (!asset) return;
      if (typeof asset.size === 'number' && asset.size > MAX_BACKUP_FILE_BYTES) throw new Error('备份文件过大，未修改本机数据');
      const file = await FileSystem.getInfoAsync(asset.uri);
      if (!file.exists || file.isDirectory) throw new Error('备份文件已不存在或不可读取，请重新选择');
      if (file.size > MAX_BACKUP_FILE_BYTES) throw new Error('备份文件过大，未修改本机数据');
      const raw = await FileSystem.readAsStringAsync(asset.uri);
      if (raw.length > MAX_BACKUP_CHARACTERS) throw new Error('备份文件过大，未修改本机数据');
      setInput(raw); setPreview(null); setReplaceCurrent(false);
      setMessage(`已读取文件：${asset.name}。请先检查备份摘要。`);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : '读取备份文件失败，未修改本机数据');
    } finally { finishOperation(); }
  };

  const saveFile = async () => {
    if (!beginOperation()) return;
    try {
      const raw = await onExportBackup();
      const permission = await FileSystem.StorageAccessFramework.requestDirectoryPermissionsAsync();
      if (!permission.granted) { setMessage('未授予文件夹权限，备份文件未写入。'); return; }
      const filename = `nightfall-backup-${new Date().toISOString().slice(0, 10)}`;
      const uri = await FileSystem.StorageAccessFramework.createFileAsync(permission.directoryUri, filename, 'application/json');
      await FileSystem.StorageAccessFramework.writeAsStringAsync(uri, raw);
      setMessage('备份文件已保存到你选择的文件夹。');
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : '保存备份文件失败，数据未修改');
    } finally { finishOperation(); }
  };

  const inspect = () => {
    if (operationPending.current || confirmationPending.current) return;
    setError(''); setMessage(''); setPreview(null); setReplaceCurrent(false);
    try {
      const parsed = parseBackup(input.trim());
      setPreview(backupPreview(parsed.backup, parsed.legacy));
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : '备份无法读取');
    }
  };

  const share = async () => {
    if (!beginOperation()) return;
    try {
      const raw = await onExportBackup();
      await Share.share({ title: '夜幕本机备份', message: raw });
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : '备份分享失败，数据未修改');
    } finally { finishOperation(); }
  };

  const confirmRestore = () => {
    if (!preview || operationPending.current || confirmationPending.current) return;
    if (currentSessionDamaged && !replaceCurrent) {
      setError('本机对局无法读取。请先确认用备份中的对局恢复，或确认清除无法读取的本机对局。');
      return;
    }
    const currentChoice = currentSessionDamaged
      ? preview.hasCurrentSession ? '将用备份对局恢复。' : '将清除无法读取的本机对局。'
      : hasActiveSession && preview.hasCurrentSession
        ? replaceCurrent ? '备份中的对局将替换本机对局。' : '本机对局会保留，备份中的对局不会成为当前局。'
        : hasActiveSession ? '本机进行中的对局会保留。' : '备份中的对局会恢复为当前局（若存在）。';
    const confirmation = {};
    confirmationPending.current = confirmation;
    const dismissConfirmation = () => { if (confirmationPending.current === confirmation) confirmationPending.current = null; };
    try {
      Alert.alert('确认导入本机数据？', `历史记录和方案将按编号合并。${currentChoice}导入前会把本机原始数据保存到恢复备份。`, [
        { text: '取消', style: 'cancel', onPress: dismissConfirmation },
        { text: '确认导入', onPress: () => {
          if (confirmationPending.current !== confirmation) return;
          confirmationPending.current = null;
          void restore();
        } },
      ], { cancelable: true, onDismiss: dismissConfirmation });
    } catch (reason) {
      dismissConfirmation();
      setError(reason instanceof Error ? reason.message : '无法打开导入确认，请重试');
    }
  };

  const restore = async () => {
    if (!beginOperation()) return;
    try {
      await onRestoreBackup(input.trim(), replaceCurrent);
      setMessage('导入完成。本机对局、复盘和方案已更新。');
      onImported?.();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : '导入失败，本机数据未修改');
    } finally { finishOperation(); }
  };

  return <View style={styles.root}>
    <TopBar title="本机数据" subtitle="备份、迁移与恢复" onBack={() => { if (!operationPending.current && !confirmationPending.current) onBack(); }} />
    <ScrollView contentContainerStyle={[styles.content, { paddingHorizontal: responsive.gutter, width: '100%', maxWidth: responsive.maxReadingWidth, alignSelf: 'center' }]} keyboardShouldPersistTaps="handled">
      <Card style={styles.panel}>
        <Text style={type.headline}>导出备份</Text>
        <Text style={type.footnote}>包含进行中对局、复盘和个性化方案。备份含身份信息，请只分享给可信的人。</Text>
        <View style={styles.actions}>
          <Button title="保存备份文件" onPress={() => { void saveFile(); }} disabled={busy} style={styles.flex} />
          <Button title="分享备份文本" variant="secondary" onPress={() => { void share(); }} disabled={busy} style={styles.flex} />
        </View>
      </Card>
      <Card style={styles.panel}>
        <Text style={type.headline}>导入备份</Text>
        <Text style={type.footnote}>把备份文本粘贴到下面，先检查摘要，再确认导入。</Text>
        <Button title="选择备份文件" variant="secondary" onPress={() => { void pickFile(); }} disabled={busy} />
        <TextInput accessibilityLabel="备份文本" multiline editable={!busy} maxLength={MAX_BACKUP_CHARACTERS} value={input} onChangeText={value => { if (operationPending.current || confirmationPending.current) return; setInput(value); setPreview(null); setReplaceCurrent(false); setError(''); }} placeholder="粘贴备份 JSON 文本" placeholderTextColor={colors.textTertiary} style={styles.input} textAlignVertical="top" />
        <Button title="检查备份" variant="secondary" onPress={inspect} disabled={!input.trim() || busy} />
        {preview ? <View style={styles.preview}>
          <Text style={type.callout}>备份摘要</Text>
          <Text style={type.footnote}>{preview.legacy ? '旧版原始导出' : new Date(preview.exportedAt).toLocaleString('zh-CN')}</Text>
          <Text style={type.footnote}>进行中对局：{preview.hasCurrentSession ? preview.currentIsActive ? '有' : '已结束' : '无'} · 复盘：{preview.historyCount} 场 · 方案：{preview.profileCount} 个</Text>
          {((hasActiveSession && preview.hasCurrentSession) || currentSessionDamaged) ? <View style={styles.replaceChoice}><View style={styles.replaceRow}><Text style={[type.footnote, styles.replaceLabel]}>{currentSessionDamaged ? preview.hasCurrentSession ? '用备份恢复无法读取的本机对局' : '确认清除无法读取的本机对局' : '用备份替换本机进行中对局'}</Text><Switch value={replaceCurrent} disabled={busy} onValueChange={value => { if (!operationPending.current && !confirmationPending.current) setReplaceCurrent(value); }} trackColor={{ false: colors.surfaceHigh, true: colors.accentDim }} thumbColor={replaceCurrent ? colors.accent : colors.textTertiary} /></View><Text style={type.caption}>{replaceCurrent ? preview.hasCurrentSession ? '将使用备份中的对局继续主持。' : '将清除损坏记录并保留备份中的历史和方案。' : '将保留本机对局，只合并历史记录和方案。'}</Text></View> : null}
          <Button title="确认导入" onPress={confirmRestore} disabled={busy} />
        </View> : null}
        {message ? <Text accessibilityRole="alert" style={styles.success}>{message}</Text> : null}
        {error ? <InlineError>{error}</InlineError> : null}
      </Card>
      <Divider />
      <Text style={type.caption}>导入只接受完整且可验证的备份；缺字段、损坏数据或不支持的版本不会覆盖本机内容。</Text>
    </ScrollView>
  </View>;
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  content: { padding: spacing.lg, paddingBottom: spacing.huge, gap: spacing.lg },
  panel: { gap: spacing.md },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  flex: { flex: 1, minWidth: 140 },
  input: { minHeight: 150, borderRadius: radius.sm, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.surfaceAlt, color: colors.text, padding: spacing.md, fontSize: 14, lineHeight: 20 },
  preview: { gap: spacing.sm, paddingTop: spacing.md, borderTopWidth: StyleSheet.hairlineWidth, borderColor: colors.line },
  replaceChoice: { gap: spacing.xs },
  replaceRow: { minHeight: 48, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.md },
  replaceLabel: { flex: 1 },
  success: { color: colors.success, fontSize: 14, lineHeight: 20 },
});
