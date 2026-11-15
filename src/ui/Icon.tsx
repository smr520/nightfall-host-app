import React from 'react';
import Svg, { Circle, Path, Rect } from 'react-native-svg';
import { Platform } from 'react-native';
import { colors } from '../theme';

export type IconName = 'home' | 'book' | 'sliders' | 'chevron-right' | 'arrow-left' | 'plus' | 'check'
  | 'clock' | 'history' | 'moon' | 'sun' | 'users' | 'play' | 'pause' | 'undo' | 'redo' | 'eye'
  | 'eye-off' | 'close' | 'settings' | 'copy' | 'note' | 'search' | 'shield' | 'archive' | 'more' | 'mic';

/** One quiet, consistent set of 24-point line icons; all labels live on their controls. */
export function Icon({ name, size = 22, color = colors.text, strokeWidth = 1.7 }: { name: IconName; size?: number; color?: string; strokeWidth?: number }) {
  const paths: Partial<Record<IconName, string>> = {
    home: 'M3 10.5 12 3l9 7.5M5 9v12h5v-7h4v7h5V9',
    book: 'M12 5v16M12 5C9 3 5 3 2.5 4.5v15C5 18 9 18 12 20c3-2 7-2 9.5-.5v-15C19 3 15 3 12 5Z',
    sliders: 'M4 3v7m0 5v6M12 3v12m0 5v1M20 3v2m0 5v11M1 10h6m2 5h6m2-10h6',
    'chevron-right': 'm9 5 7 7-7 7',
    'arrow-left': 'M20 12H4m7-7-7 7 7 7',
    plus: 'M12 4v16M4 12h16',
    check: 'm5 12 4.5 4.5L19 7',
    history: 'M3 4v5h5M3.6 9a9 9 0 1 1-.1 5M12 7v5l3 2',
    moon: 'M20.9 13.2A9 9 0 0 1 10.8 3.1a9 9 0 1 0 10.1 10.1Z',
    sun: 'M12 2v2m0 16v2M2 12h2m16 0h2M4.9 4.9l1.4 1.4m11.4 11.4 1.4 1.4M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4',
    users: 'M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2m20 0v-2a4 4 0 0 0-3-3.9M16 3.1a4 4 0 0 1 0 7.8',
    play: 'm8 4 12 8-12 8Z',
    pause: 'M8 5v14M16 5v14',
    undo: 'm9 4-6 6 6 6M3 10h11a7 7 0 0 1 7 7v3',
    redo: 'm15 4 6 6-6 6m6-6H10a7 7 0 0 0-7 7v3',
    eye: 'M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z',
    'eye-off': 'm3 3 18 18M9.5 5.3A12 12 0 0 1 12 5c6.5 0 10 7 10 7a19 19 0 0 1-3 3.7M6 6.1A20 20 0 0 0 2 12s3.5 7 10 7a12 12 0 0 0 5.1-1.2M10 10a2.8 2.8 0 0 0 4 4',
    close: 'm6 6 12 12M18 6 6 18',
    settings: 'M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8Zm-2-5h4l.6 3 2 .9 2.7-1.1 2 3.4-2.2 1.9v2.1l2.2 1.9-2 3.4-2.7-1.1-2 .9L14 21h-4l-.6-2.7-2-.9-2.7 1.1-2-3.4 2.2-1.9v-2.1L2.7 9.2l2-3.4L7.4 7l2-.9L10 3Z',
    copy: 'M8 7V3h13v14h-4M3 7h14v14H3Z',
    note: 'M13 3H4v18h16v-9M15 3l6 6m-9 3 9-9M8 16h8',
    search: 'm16 16 5 5',
    shield: 'M12 2 3.5 6v6c0 5 8.5 10 8.5 10s8.5-5 8.5-10V6L12 2Z',
    archive: 'M4 8v13h16V8M2 3h20v5H2Zm7 9h6',
    mic: 'M5 10v2a7 7 0 0 0 14 0v-2M12 19v3M8 22h8',
  };
  return <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" accessible={Platform.OS === 'web' ? undefined : false} aria-hidden pointerEvents="none">
    {paths[name] ? <Path d={paths[name]} /> : null}
    {name === 'clock' ? <><Circle cx="12" cy="12" r="9" /><Path d="M12 6.5V12l3.5 2" /></> : null}
    {name === 'sun' ? <Circle cx="12" cy="12" r="4" /> : null}
    {name === 'users' ? <Circle cx="9" cy="7" r="4" /> : null}
    {name === 'eye' ? <Circle cx="12" cy="12" r="3" /> : null}
    {name === 'search' ? <Circle cx="10.5" cy="10.5" r="6.5" /> : null}
    {name === 'mic' ? <Rect x="9" y="2" width="6" height="13" rx="3" /> : null}
    {name === 'more' ? <><Circle cx="5" cy="12" r="1" /><Circle cx="12" cy="12" r="1" /><Circle cx="19" cy="12" r="1" /></> : null}
  </Svg>;
}
