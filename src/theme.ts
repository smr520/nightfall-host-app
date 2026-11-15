// 夜幕 · 白纸、墨字。颜色留给需要主持人辨认的现场状态。

export const colors = {
  bg: '#FFFFFF',
  bgSoft: '#FFFFFF',
  surface: '#FFFFFF',
  surfaceAlt: '#F5F5F3',
  surfaceHigh: '#E9EAE6',
  line: '#DDDFD9',
  lineSoft: '#EEEFEA',
  text: '#242522',
  textSecondary: '#666963',
  textTertiary: '#777B73',
  accent: '#292B28',
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
  clay: '#A9593F',
  clayDim: '#F8EEE9',
  overlay: 'rgba(25,28,24,0.28)',
} as const;

export const spacing = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32, huge: 44 } as const;
export const radius = { sm: 8, md: 12, lg: 16, xl: 24, full: 999 } as const;

export const type = {
  display: { fontSize: 36, lineHeight: 44, fontWeight: '700' as const, letterSpacing: -0.8, color: colors.text },
  title: { fontSize: 30, lineHeight: 40, fontWeight: '700' as const, letterSpacing: -0.5, color: colors.text },
  title2: { fontSize: 20, lineHeight: 28, fontWeight: '600' as const, letterSpacing: -0.1, color: colors.text },
  headline: { fontSize: 17, lineHeight: 23, fontWeight: '600' as const, color: colors.text },
  body: { fontSize: 16, lineHeight: 23, fontWeight: '400' as const, color: colors.text },
  callout: { fontSize: 15, lineHeight: 21, fontWeight: '500' as const, color: colors.text },
  footnote: { fontSize: 13, lineHeight: 19, fontWeight: '400' as const, color: colors.textSecondary },
  caption: { fontSize: 12, lineHeight: 18, fontWeight: '600' as const, letterSpacing: 0.2, color: colors.textTertiary },
  numeric: { fontSize: 20, lineHeight: 24, fontWeight: '700' as const, fontVariant: ['tabular-nums'] as const, color: colors.text },
} as const;

export const hitSlop = { top: 10, bottom: 10, left: 10, right: 10 } as const;
