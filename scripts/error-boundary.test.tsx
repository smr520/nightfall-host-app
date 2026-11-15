import React, { useState } from 'react';
import { Text } from 'react-native';
import TestRenderer, { act } from 'react-test-renderer';
import { ErrorBoundary } from '../src/ui/ErrorBoundary';

function Throwing({ shouldThrow }: { shouldThrow: boolean }) {
  if (shouldThrow) {
    throw new Error('private player name must not be shown');
  }

  return null;
}

function RecoverableHarness({ onReload }: { onReload: () => void }) {
  const [shouldThrow, setShouldThrow] = useState(true);

  return (
    <ErrorBoundary onReload={() => {
      onReload();
      setShouldThrow(false);
    }}>
      {shouldThrow ? <Throwing shouldThrow /> : <Text>正常界面</Text>}
    </ErrorBoundary>
  );
}

describe('render failure recovery', () => {
  let renderer: TestRenderer.ReactTestRenderer | undefined;
  const root = () => {
    if (!renderer) {
      throw new Error('renderer is not mounted');
    }
    return renderer.root;
  };

  beforeEach(() => {
    jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    if (renderer) {
      act(() => renderer?.unmount());
    }
    renderer = undefined;
    jest.restoreAllMocks();
  });

  it('shows a private-data-safe fallback and remounts the interface', () => {
    const onReload = jest.fn();
    act(() => {
      renderer = TestRenderer.create(<RecoverableHarness onReload={onReload} />);
    });

    expect(root().findByProps({ testID: 'error-boundary' })).toBeDefined();
    const renderedText = root().findAllByType(Text).map(node => String(node.props.children)).join('\n');
    expect(renderedText).toContain('界面暂时无法显示');
    expect(renderedText).not.toContain('private player name');

    const reload = root().findAll(node => (
      node.props.accessibilityLabel === '重新加载界面'
      && typeof node.props.onPress === 'function'
    ))[0];
    act(() => reload.props.onPress());

    expect(onReload).toHaveBeenCalledTimes(1);
    expect(root().findAllByProps({ testID: 'error-boundary' })).toHaveLength(0);
    expect(root().findAllByType(Text).map(node => String(node.props.children)).join('\n')).toContain('正常界面');
  });

  it('reports export completion and failure without exposing raw error details', async () => {
    const onExportRawData = jest.fn()
      .mockResolvedValueOnce(undefined)
      .mockRejectedValueOnce(new Error('disk full with private path'));

    act(() => {
      renderer = TestRenderer.create(
        <ErrorBoundary onExportRawData={onExportRawData}>
          <Throwing shouldThrow />
        </ErrorBoundary>,
      );
    });

    const exportButton = () => root().findAll(node => (
      node.props.accessibilityLabel === '导出原始存档'
      && typeof node.props.onPress === 'function'
    ))[0];

    await act(async () => exportButton().props.onPress());
    expect(root().findAllByType(Text).map(node => String(node.props.children)).join('\n')).toContain('原始存档已交给系统导出面板');

    await act(async () => exportButton().props.onPress());
    const text = root().findAllByType(Text).map(node => String(node.props.children)).join('\n');
    expect(text).toContain('原始存档导出失败');
    expect(text).not.toContain('private path');
  });
});
