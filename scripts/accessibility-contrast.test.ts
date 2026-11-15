import { colors } from '../src/theme';

function luminance(hex: string): number {
  const channels = hex
    .replace('#', '')
    .match(/.{2}/g)!
    .map(channel => Number.parseInt(channel, 16) / 255)
    .map(channel => channel <= 0.03928 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4);
  return channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722;
}

function contrast(foreground: string, background: string): number {
  const lighter = Math.max(luminance(foreground), luminance(background));
  const darker = Math.min(luminance(foreground), luminance(background));
  return (lighter + 0.05) / (darker + 0.05);
}

describe('light theme text contrast', () => {
  it('keeps tertiary captions readable on white and grouped surfaces', () => {
    expect(contrast(colors.textTertiary, colors.bg)).toBeGreaterThanOrEqual(4.5);
    expect(contrast(colors.textTertiary, colors.surfaceAlt)).toBeGreaterThanOrEqual(4.5);
  });

  it('keeps secondary and body text above the normal-text threshold', () => {
    expect(contrast(colors.textSecondary, colors.bg)).toBeGreaterThanOrEqual(4.5);
    expect(contrast(colors.textSecondary, colors.surfaceAlt)).toBeGreaterThanOrEqual(4.5);
    expect(contrast(colors.text, colors.bg)).toBeGreaterThanOrEqual(7);
  });
});
