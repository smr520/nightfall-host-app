import React, { useState } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';
import type { Game } from '../../game/types';
import { speechSecondsForRules } from '../../game/speech';
import { useSpeechClock } from '../../hooks/useSpeechClock';
import { colors, radius, spacing, type } from '../../theme';
import { Button, InlineError, Segmented, Sheet } from '../kit';
import { SpeechTimer } from './SpeechTimer';

export function TemporarySpeech({ game, visible, onClose }: { game: Game; visible: boolean; onClose: () => void }) {
  const [kind, setKind] = useState<'last-words' | 'speech'>('last-words');
  const defaultSeconds = (nextKind: 'last-words' | 'speech') => speechSecondsForRules(game.rules, nextKind === 'last-words' ? 'lastWords' : 'discussion');
  const [duration, setDuration] = useState(() => String(defaultSeconds('last-words')));
  const seconds = Number(duration);
  const valid = /^\d+$/.test(duration) && seconds >= 15 && seconds <= 1800;
  const clock = useSpeechClock(`${game.id}:${game.day}:${game.stage}:${visible}:${kind}:${valid ? seconds : 'invalid'}`, valid ? seconds : defaultSeconds(kind));
  const seats = game.players.filter(player => kind === 'last-words' || player.alive).map(player => player.seat);
  const label = kind === 'last-words' ? '遗言' : '临时发言';
  const close = () => { clock.select(null); onClose(); };
  return <Sheet visible={visible} onClose={close} title="临时发言 / 遗言" subtitle="由主持人按赛前约定决定发言资格，不改变对局状态" footer={<Button title="结束临时发言，返回主持" variant="secondary" onPress={close} />}>
    <Segmented options={[{ label: '遗言', value: 'last-words' }, { label: '临时发言', value: 'speech' }]} value={kind} onChange={next => { setKind(next); setDuration(String(defaultSeconds(next))); }} />
    <Text accessibilityRole="header" style={type.title2}>{clock.speaker !== null ? `请 ${clock.speaker} 号玩家${kind === 'last-words' ? '发表遗言' : '发言'}` : '请选择发言人'}</Text>
    <Text accessibilityLabel="临时发言完整主持台词" selectable style={type.body}>{clock.speaker !== null ? `请 ${clock.speaker} 号玩家${kind === 'last-words' ? '发表遗言' : '发言'}，其他玩家请保持安静。发言结束后，请等待主持人继续安排。` : '请各位玩家保持安静，等待主持人指定发言人。'}</Text>
    <Text style={type.footnote}>{kind === 'last-words' ? '可选已出局座位。是否有遗言、可说多久，均以赛前约定为准。' : '用于补充发言、规则说明等现场安排。'}</Text>
    <View style={styles.presets}>{[30, 60, 90, 120].map(value => <Button key={value} title={`${value} 秒`} small variant={seconds === value ? 'secondary' : 'ghost'} selected={seconds === value} disabled={clock.running} onPress={() => setDuration(String(value))} />)}</View>
    <TextInput accessibilityLabel="本次发言时长（秒）" value={duration} editable={!clock.running} onChangeText={setDuration} keyboardType="number-pad" maxLength={4} style={styles.input} placeholder="15–1800 秒" placeholderTextColor={colors.textTertiary} />
    {valid ? <SpeechTimer game={game} clock={clock} eligibleSeats={seats} label={label} /> : <InlineError>本次时长请输入 15–1800 秒的整数。</InlineError>}
  </Sheet>;
}

const styles = StyleSheet.create({ presets: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }, input: { minHeight: 48, paddingHorizontal: spacing.md, borderRadius: radius.sm, backgroundColor: colors.surfaceAlt, color: colors.text, fontSize: 16 } });
