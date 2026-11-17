import React, { useEffect, useRef, useState } from 'react';
import { Text, View } from 'react-native';
import { Alert } from '../alert';
import { boardById, boardRoles } from '../../game/boards';
import type { Role } from '../../game/roles';
import { createPlayerNotebook, type PlayerNotebook } from '../../player/notes';
import { PLAYER_ROLE_IDS } from '../../player/role-options';
import type { PlayerNotebookStorage } from '../../player/storage';
import { Button, InlineError, TopBar } from '../kit';
import { PlayerBoard } from './PlayerBoard';
import { PlayerSetup } from './PlayerSetup';
import { styles } from './styles';

export function PlayerScreen({ storage, onOpenReference, onSwitchRole }: {
  storage: PlayerNotebookStorage;
  onOpenReference?: (context: { roles: Role[]; initialRole?: Role }) => void;
  onSwitchRole?: () => void;
}) {
  const [notebook, setNotebook] = useState<PlayerNotebook | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadAttempt, setLoadAttempt] = useState(0);
  const [error, setError] = useState('');
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const lastPersisted = useRef<string | null>(null);
  const persistQueue = useRef<Promise<void>>(Promise.resolve());
  const notebookRef = useRef<PlayerNotebook | null>(null);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const clearingRef = useRef(false);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);

  useEffect(() => {
    let cancelled = false;
    storage.read().then(value => {
      if (cancelled) return;
      notebookRef.current = value;
      setNotebook(value);
      lastPersisted.current = value ? JSON.stringify(value) : null;
      setError('');
      setSaveState('idle');
    }).catch((reason: unknown) => {
      if (!cancelled) setError(reason instanceof Error ? reason.message : '读取玩家笔记失败');
    }).finally(() => {
      if (!cancelled) setLoading(false);
    });
    return () => { cancelled = true; };
  }, [loadAttempt, storage]);

  const queuePersist = (value: PlayerNotebook, serialized = JSON.stringify(value)) => {
    if (clearingRef.current) return;
    persistQueue.current = persistQueue.current.catch(() => undefined).then(() => storage.persist(value)).then(() => {
      lastPersisted.current = serialized;
      if (mounted.current) setSaveState('saved');
    }).catch(() => {
      if (mounted.current) setSaveState('error');
    });
  };

  useEffect(() => {
    if (!notebook || clearingRef.current) return;
    const serialized = JSON.stringify(notebook);
    if (serialized === lastPersisted.current) return;
    const timer = setTimeout(() => {
      saveTimer.current = null;
      if (!clearingRef.current) queuePersist(notebook, serialized);
    }, 200);
    saveTimer.current = timer;
    return () => {
      clearTimeout(timer);
      if (saveTimer.current === timer) saveTimer.current = null;
    };
    // queuePersist 只依赖 storage 和稳定 ref；notebook 变化时重新排一次保存。
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [notebook, storage]);

  const retrySave = () => {
    if (!notebook || clearingRef.current) return;
    setSaveState('saving');
    queuePersist(notebook);
  };

  const clearStored = () => {
    clearingRef.current = true;
    if (saveTimer.current) {
      clearTimeout(saveTimer.current);
      saveTimer.current = null;
    }
    persistQueue.current = persistQueue.current.catch(() => undefined).then(() => storage.clear()).then(() => {
      notebookRef.current = null;
      lastPersisted.current = null;
      if (!mounted.current) return;
      setNotebook(null);
      setSaveState('idle');
      setError('');
    }).catch(() => {
      if (mounted.current) setSaveState('error');
    }).finally(() => {
      clearingRef.current = false;
    });
  };

  const reset = () => Alert.alert('清除本局笔记？', '人数、身份、座位标记、事件、技能和票型都会删除；主持人的对局不受影响。', [
    { text: '取消', style: 'cancel' },
    { text: '清除', style: 'destructive', onPress: clearStored },
  ]);

  const retryLoad = () => { setLoading(true); setError(''); setLoadAttempt(value => value + 1); };

  const clearDamaged = () => Alert.alert('清除损坏的玩家笔记？', '原始内容将不再保留；主持人的对局不受影响。', [
    { text: '取消', style: 'cancel' },
    { text: '清除', style: 'destructive', onPress: clearStored },
  ]);

  const update = (next: PlayerNotebook) => {
    clearingRef.current = false;
    notebookRef.current = next;
    setSaveState('saving');
    setNotebook(next);
  };

  const create = (input: { boardId: string; boardName: string; gameName: string; playerCount: number; ownSeat: number; ownRole: Role }) => {
    const next = createPlayerNotebook(input);
    clearingRef.current = false;
    notebookRef.current = next;
    lastPersisted.current = null;
    setSaveState('saving');
    setNotebook(next);
    setError('');
  };

  const switchRole = () => {
    const value = notebookRef.current;
    if (!clearingRef.current && value && JSON.stringify(value) !== lastPersisted.current) {
      persistQueue.current = persistQueue.current.catch(() => undefined).then(() => storage.persist(value)).catch(() => undefined);
    }
    onSwitchRole?.();
  };

  const board = notebook ? boardById(notebook.boardId) : undefined;
  const referenceRoles = board ? boardRoles(board) : PLAYER_ROLE_IDS;

  return (
    <View style={styles.root}>
      <TopBar
        title="玩家笔记"
        subtitle={notebook ? `${notebook.boardName} · 我是 ${notebook.ownSeat} 号` : '个人记录 · 不与主持对局同步'}
        right={onSwitchRole || onOpenReference ? <>
          {onSwitchRole ? <Button title="主持" variant="ghost" small onPress={switchRole} /> : null}
          {onOpenReference ? <Button title="规则" variant="ghost" small onPress={() => onOpenReference({ roles: referenceRoles, initialRole: notebook?.ownRole })} /> : null}
        </> : undefined}
      />
      {loading ? <View style={styles.center}><Text style={styles.centerText}>正在读取玩家笔记…</Text></View> : null}
      {!loading && error && !notebook ? (
        <View style={styles.center}>
          <InlineError>{error}</InlineError>
          <Button title="重试读取" variant="secondary" onPress={retryLoad} />
          <Button title="清除损坏记录" variant="ghost" onPress={clearDamaged} />
        </View>
      ) : null}
      {!loading && !error && !notebook ? <PlayerSetup onCreate={create} onOpenReference={onOpenReference} /> : null}
      {!loading && notebook ? <PlayerBoard notebook={notebook} onChange={update} onReset={reset} /> : null}
      {!loading && notebook ? (
        <View style={styles.saveLine}>
          <Text style={styles.saveText}>
            {saveState === 'saving' ? '正在保存…' : saveState === 'error' ? '保存失败，修改仍在本页' : saveState === 'saved' ? '已保存到本机' : '只保存在本机'}
          </Text>
          {saveState === 'error' ? <Button title="重试保存" variant="ghost" small onPress={retrySave} /> : null}
        </View>
      ) : null}
    </View>
  );
}
