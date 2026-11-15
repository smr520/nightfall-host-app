import { BREAKPOINTS, clampFontScale, layoutClassFor, shouldSplitHost } from '../src/ui/responsive';

describe('responsive layout classes', () => {
  it('classifies phones, tablets and large tablets/landscape', () => {
    expect(layoutClassFor(320)).toBe('compact');
    expect(layoutClassFor(BREAKPOINTS.medium - 1)).toBe('compact');
    expect(layoutClassFor(BREAKPOINTS.medium)).toBe('medium');
    expect(layoutClassFor(BREAKPOINTS.expanded - 1)).toBe('medium');
    expect(layoutClassFor(BREAKPOINTS.expanded)).toBe('expanded');
    expect(layoutClassFor(1600)).toBe('expanded');
  });

  it('splits the host screen only on wide screens', () => {
    expect(shouldSplitHost(BREAKPOINTS.expanded, 'host')).toBe(true);
    expect(shouldSplitHost(BREAKPOINTS.expanded - 1, 'host')).toBe(false);
    expect(shouldSplitHost(BREAKPOINTS.expanded, 'seats')).toBe(false);
  });

  it('clamps system font scaling so seat grids and buttons stay usable', () => {
    expect(clampFontScale(0)).toBe(1);
    expect(clampFontScale(Number.NaN)).toBe(1);
    expect(clampFontScale(0.5)).toBe(0.9);
    expect(clampFontScale(1)).toBe(1);
    expect(clampFontScale(1.2)).toBe(1.2);
    expect(clampFontScale(3)).toBe(1.35);
  });
});
