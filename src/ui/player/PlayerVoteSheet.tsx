import React, { useState } from 'react';
import { Text } from 'react-native';
import { addVote, type PlayerNotebook } from '../../player/notes';
import { Button, InlineError, Sheet } from '../kit';
import { RoundStepper, SeatPicker } from './controls';
import { styles } from './styles';

export function PlayerVoteSheet({ notebook, visible, onChange, onClose }: {
  notebook: PlayerNotebook;
  visible: boolean;
  onChange: (next: PlayerNotebook) => void;
  onClose: () => void;
}) {
  const [round, setRound] = useState(1);
  const [voter, setVoter] = useState<number | null>(null);
  const [target, setTarget] = useState<number | null | undefined>(undefined);
  const [error, setError] = useState('');

  const save = () => {
    if (voter === null) { setError('先选择投票人'); return; }
    if (target === undefined) { setError('选择得票人，或明确选择弃票'); return; }
    onChange(addVote(notebook, { round, voter, target }));
    onClose();
  };

  return (
    <Sheet visible={visible} onClose={onClose} title="记录一票" subtitle="只记给自己看，可随时删除" footer={<Button title="保存这一票" onPress={save} disabled={voter === null || target === undefined} />}>
      <RoundStepper value={round} onChange={setRound} />
      <Text style={styles.sectionTitle}>谁投的</Text>
      <SeatPicker count={notebook.playerCount} value={voter ?? undefined} onChange={value => { if (value !== null) setVoter(value); }} prefix="投票人" />
      <Text style={styles.sectionTitle}>投给谁</Text>
      <SeatPicker count={notebook.playerCount} value={target} onChange={value => setTarget(value)} prefix="得票人" emptyLabel="弃票" />
      {error ? <InlineError>{error}</InlineError> : null}
    </Sheet>
  );
}
