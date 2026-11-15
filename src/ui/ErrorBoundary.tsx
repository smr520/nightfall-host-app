import React, { type ErrorInfo, type ReactNode } from 'react';
import { AccessibilityInfo, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { colors, radius, spacing, type } from '../theme';

type Props = {
  children: ReactNode;
  onReload?: () => void;
  onExportRawData?: () => Promise<void> | void;
};

type State = {
  failed: boolean;
  attempt: number;
  exportState: 'idle' | 'working' | 'done' | 'failed';
};

/**
 * Presents a stable recovery path for a render failure. Raw error details stay
 * out of the interface because they can contain player names or role data.
 */
export class ErrorBoundary extends React.Component<Props, State> {
  state: State = {
    failed: false,
    attempt: 0,
    exportState: 'idle',
  };

  static getDerivedStateFromError(): Partial<State> {
    return { failed: true };
  }

  componentDidCatch(_error: Error, _info: ErrorInfo) {
    AccessibilityInfo.announceForAccessibility('界面遇到错误，已保留本机存档。');
  }

  reload = () => {
    this.props.onReload?.();
    this.setState(current => ({
      failed: false,
      attempt: current.attempt + 1,
      exportState: 'idle',
    }));
  };

  exportRawData = async () => {
    if (!this.props.onExportRawData || this.state.exportState === 'working') {
      return;
    }

    this.setState({ exportState: 'working' });
    try {
      await this.props.onExportRawData();
      this.setState({ exportState: 'done' });
    } catch {
      this.setState({ exportState: 'failed' });
    }
  };

  render() {
    if (!this.state.failed) {
      return <React.Fragment key={this.state.attempt}>{this.props.children}</React.Fragment>;
    }

    return (
      <View testID="error-boundary" style={styles.root}>
        <ScrollView contentContainerStyle={styles.content}>
          <View style={styles.mark} accessible={false}>
            <View style={styles.markLine} />
            <View style={styles.markLine} />
          </View>
          <Text accessibilityRole="alert" style={styles.title}>界面暂时无法显示</Text>
          <Text style={styles.body}>
            对局数据没有因为这次界面错误被删除。先重新加载界面；如果仍然失败，请导出原始存档并保留应用，不要直接卸载。
          </Text>
          {this.state.exportState === 'done' ? (
            <Text accessibilityLiveRegion="polite" style={styles.success}>原始存档已交给系统导出面板。</Text>
          ) : null}
          {this.state.exportState === 'failed' ? (
            <Text accessibilityRole="alert" style={styles.error}>原始存档导出失败。请检查存储空间后重试。</Text>
          ) : null}
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="重新加载界面"
            onPress={this.reload}
            style={({ pressed }) => [styles.primaryButton, pressed && styles.pressed]}
          >
            <Text style={styles.primaryText}>重新加载界面</Text>
          </Pressable>
          {this.props.onExportRawData ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="导出原始存档"
              accessibilityState={{ disabled: this.state.exportState === 'working' }}
              disabled={this.state.exportState === 'working'}
              onPress={() => { void this.exportRawData(); }}
              style={({ pressed }) => [
                styles.secondaryButton,
                pressed && styles.pressed,
                this.state.exportState === 'working' && styles.disabled,
              ]}
            >
              <Text style={styles.secondaryText}>
                {this.state.exportState === 'working' ? '正在准备导出…' : '导出原始存档'}
              </Text>
            </Pressable>
          ) : null}
          <Text style={styles.note}>原始存档包含全部身份和夜间记录，只应发送给你信任的人。</Text>
        </ScrollView>
      </View>
    );
  }
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  content: {
    flexGrow: 1,
    width: '100%',
    maxWidth: 560,
    alignSelf: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.xxl,
    gap: spacing.lg,
  },
  mark: {
    width: 48,
    height: 48,
    borderRadius: radius.full,
    backgroundColor: colors.surfaceAlt,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
  },
  markLine: { width: 18, height: 2, borderRadius: 1, backgroundColor: colors.textSecondary },
  title: { ...type.title2, fontSize: 24, lineHeight: 32 },
  body: { ...type.body, color: colors.textSecondary },
  note: { ...type.footnote, color: colors.textTertiary },
  success: { ...type.footnote, color: colors.success },
  error: { ...type.footnote, color: colors.danger },
  primaryButton: {
    minHeight: 52,
    borderRadius: radius.md,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
  },
  primaryText: { ...type.headline, color: colors.onAccent, textAlign: 'center' },
  secondaryButton: {
    minHeight: 52,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceAlt,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
  },
  secondaryText: { ...type.callout, fontWeight: '600', textAlign: 'center' },
  pressed: { opacity: 0.72 },
  disabled: { opacity: 0.45 },
});
