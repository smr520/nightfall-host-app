import { Alert } from '../src/ui/alert';

jest.mock('react-native/Libraries/Utilities/Platform', () => {
  const platform = {
    OS: 'web',
    select: (spec: { web?: unknown; native?: unknown; default?: unknown }) => spec.web ?? spec.native ?? spec.default,
  };
  return { __esModule: true, default: platform, ...platform };
});

describe('cross-platform alert', () => {
  afterEach(() => {
    delete (globalThis as typeof globalThis & { nightfallDesktop?: unknown }).nightfallDesktop;
    Reflect.deleteProperty(globalThis, 'confirm');
    Reflect.deleteProperty(globalThis, 'alert');
    jest.restoreAllMocks();
  });

  it('runs only the selected callback for a two-action browser confirmation', () => {
    const confirm = jest.fn(() => true);
    Object.defineProperty(globalThis, 'confirm', { value: confirm, configurable: true });
    const cancel = jest.fn();
    const remove = jest.fn();

    Alert.alert('移除当前对局？', '此操作不可撤销。', [
      { text: '取消', style: 'cancel', onPress: cancel },
      { text: '移除', style: 'destructive', onPress: remove },
    ]);

    expect(confirm).toHaveBeenCalledWith('移除当前对局？\n\n此操作不可撤销。');
    expect(remove).toHaveBeenCalledTimes(1);
    expect(cancel).not.toHaveBeenCalled();
  });

  it('uses the native browser alert for informational messages', () => {
    const alert = jest.fn();
    Object.defineProperty(globalThis, 'alert', { value: alert, configurable: true });
    const acknowledge = jest.fn();

    Alert.alert('主持端锁已开启', '请牢记 PIN。', [{ text: '知道了', onPress: acknowledge }]);

    expect(alert).toHaveBeenCalledWith('主持端锁已开启\n\n请牢记 PIN。');
    expect(acknowledge).toHaveBeenCalledTimes(1);
  });
});
