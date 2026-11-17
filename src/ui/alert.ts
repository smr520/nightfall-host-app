import { Alert as NativeAlert, Platform } from 'react-native';

export type AlertButton = {
  text?: string;
  style?: 'default' | 'cancel' | 'destructive';
  onPress?: () => void;
};

type AlertOptions = {
  cancelable?: boolean;
  onDismiss?: () => void;
};

type DesktopDialog = {
  show?: (input: {
    title: string;
    message: string;
    confirmLabel: string;
    cancelLabel?: string;
    destructive?: boolean;
  }) => Promise<boolean>;
};

function desktopDialog(): DesktopDialog | undefined {
  return (globalThis as typeof globalThis & { nightfallDesktop?: DesktopDialog }).nightfallDesktop;
}

function webDialog(
  title: string,
  message: string | undefined,
  buttons: AlertButton[],
  options?: AlertOptions,
) {
  const cancel = buttons.find(button => button.style === 'cancel');
  const action = [...buttons].reverse().find(button => button.style !== 'cancel');
  const confirmLabel = action?.text ?? '确定';
  const cancelLabel = cancel?.text;
  const destructive = action?.style === 'destructive';
  const body = [title, message].filter(Boolean).join('\n\n');
  const bridge = desktopDialog();

  if (bridge?.show) {
    void bridge.show({
      title,
      message: message ?? '',
      confirmLabel,
      ...(cancelLabel ? { cancelLabel } : {}),
      destructive,
    }).then(confirmed => {
      if (confirmed) action?.onPress?.();
      else {
        cancel?.onPress?.();
        options?.onDismiss?.();
      }
    }).catch(() => options?.onDismiss?.());
    return;
  }

  const confirmed = cancelLabel ? globalThis.confirm(body) : (globalThis.alert(body), true);
  if (confirmed) action?.onPress?.();
  else {
    cancel?.onPress?.();
    options?.onDismiss?.();
  }
}

export const Alert = {
  alert(title: string, message?: string, buttons?: AlertButton[], options?: AlertOptions) {
    if (Platform.OS !== 'web') {
      if (options) NativeAlert.alert(title, message, buttons, options);
      else if (buttons) NativeAlert.alert(title, message, buttons);
      else NativeAlert.alert(title, message);
      return;
    }
    webDialog(title, message, buttons?.length ? buttons : [{ text: '确定', style: 'default' }], options);
  },
};
