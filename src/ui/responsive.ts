import { useWindowDimensions } from 'react-native';
import { spacing } from '../theme';

/** 手机 < 600；平板 600–839；大平板 / 横屏 ≥ 840；宽屏 ≥ 1200。 */
export const BREAKPOINTS = { medium: 600, tabletWide: 720, expanded: 840, wide: 1200 } as const;

export type LayoutClass = 'compact' | 'medium' | 'expanded';

export function layoutClassFor(width: number): LayoutClass {
  if (width >= BREAKPOINTS.expanded) return 'expanded';
  if (width >= BREAKPOINTS.medium) return 'medium';
  return 'compact';
}

/** 主持页只在大屏且停留在主持页时左右分栏。 */
export function shouldSplitHost(width: number, tab: string): boolean {
  return width >= BREAKPOINTS.expanded && tab === 'host';
}

/** 系统字体放大时限制上限，避免座位格和按钮被撑破。 */
export function clampFontScale(value: number): number {
  if (!Number.isFinite(value) || value <= 0) return 1;
  return Math.min(1.35, Math.max(0.9, value));
}

export type Responsive = {
  width: number;
  height: number;
  fontScale: number;
  layoutClass: LayoutClass;
  isCompact: boolean;
  isTablet: boolean;
  /** 平板竖屏也适合双栏的宽度。 */
  isWideTablet: boolean;
  isExpanded: boolean;
  isLandscape: boolean;
  /** 页面左右留白 */
  gutter: number;
  /** 页面内容最大宽度 */
  maxContentWidth: number;
  /** 长文阅读最大宽度 */
  maxReadingWidth: number;
  /** 座位格最多列数 */
  maxSeatColumns: number;
  /** 列表/板子库在多宽时使用双列 */
  listColumns: 1 | 2;
};

export function useResponsive(): Responsive {
  const { width, height, fontScale } = useWindowDimensions();
  const layoutClass = layoutClassFor(width);
  const isTablet = width >= BREAKPOINTS.medium;
  const isWideTablet = width >= BREAKPOINTS.tabletWide;
  const isExpanded = width >= BREAKPOINTS.expanded;
  return {
    width,
    height,
    fontScale: clampFontScale(fontScale),
    layoutClass,
    isCompact: layoutClass === 'compact',
    isTablet,
    isWideTablet,
    isExpanded,
    isLandscape: width > height,
    gutter: width >= BREAKPOINTS.wide ? spacing.xxl : spacing.xl,
    maxContentWidth: 1180,
    maxReadingWidth: 760,
    maxSeatColumns: isExpanded ? 8 : isTablet ? 6 : 4,
    listColumns: isExpanded && width >= 1000 ? 2 : 1,
  };
}

/** ScrollView / FlatList 内容容器的通用宽度约束。 */
export function contentStyle(responsive: Responsive, extraGap = 0) {
  return {
    width: '100%' as const,
    maxWidth: responsive.maxContentWidth,
    alignSelf: 'center' as const,
    paddingHorizontal: responsive.gutter,
    ...(extraGap ? { gap: extraGap } : {}),
  };
}
