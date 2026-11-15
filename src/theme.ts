// 夜幕 · 白纸、墨字。颜色留给需要主持人辨认的现场状态。

export const colors = {
  bg: '#FFFFFF',
  bgSoft: '#FFFFFF',
  surface: '#FFFFFF',
  surfaceAlt: '#F6F6F3',
  surfaceHigh: '#E7E8E3',
  line: '#DCDED8',
  lineSoft: '#EFF0EB',
  text: '#242522',
  textSecondary: '#5D605A',
  textTertiary: '#6B6F67',
  accent: '#20221F',
  accentStrong: '#151714',
  accentDim: '#EEEFEA',
  onAccent: '#FFFFFF',
  danger: '#B13831',
  dangerDim: '#FBEDEA',
  success: '#287046',
  successDim: '#EAF3E9',
  wolf: '#8B661B',
  wolfDim: '#F8F1DE',
  gold: '#8B661B',
  clay: '#9D533D',
  clayDim: '#F8EEE9',
  overlay: 'rgba(25,28,24,0.28)',
} as const;

export const spacing = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32, huge: 48 } as const;
export const radius = { sm: 6, md: 10, lg: 14, xl: 20, full: 999 } as const;
export const motionTokens = { press: 110, release: 150, fast: 140, base: 190, slow: 240, exit: 160 } as const;

export const type = {
  display: { fontSize: 34, lineHeight: 42, fontWeight: '700' as const, letterSpacing: -0.8, color: colors.text },
  title: { fontSize: 28, lineHeight: 36, fontWeight: '700' as const, letterSpacing: -0.4, color: colors.text },
  title2: { fontSize: 20, lineHeight: 28, fontWeight: '600' as const, letterSpacing: -0.1, color: colors.text },
  headline: { fontSize: 17, lineHeight: 23, fontWeight: '600' as const, color: colors.text },
  body: { fontSize: 16, lineHeight: 23, fontWeight: '400' as const, color: colors.text },
  callout: { fontSize: 15, lineHeight: 21, fontWeight: '500' as const, color: colors.text },
  footnote: { fontSize: 13, lineHeight: 19, fontWeight: '400' as const, color: colors.textSecondary },
  caption: { fontSize: 12, lineHeight: 18, fontWeight: '500' as const, letterSpacing: 0.15, color: colors.textTertiary },
  numeric: { fontSize: 20, lineHeight: 24, fontWeight: '700' as const, fontVariant: ['tabular-nums'] as const, color: colors.text },
} as const;

export const hitSlop = { top: 10, bottom: 10, left: 10, right: 10 } as const;
