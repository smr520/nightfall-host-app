import type { Game, Session } from './types';

export function undoSession(session: Session): Session | null {
  if (!session.undo.length) return null;
  const previous = session.undo[session.undo.length - 1];
  return {
    current: previous,
    undo: session.undo.slice(0, -1),
    redo: [session.current, ...session.redo].slice(0, 50),
  };
}

export function redoSession(session: Session): Session | null {
  if (!session.redo.length) return null;
  const next = session.redo[0];
  return {
    current: next,
    undo: [...session.undo, session.current].slice(-50),
    redo: session.redo.slice(1),
  };
}

export function archiveTransition(previous: Game, next: Game): 'add' | 'remove' | null {
  if (previous.stage !== 'ended' && next.stage === 'ended') return 'add';
  if (previous.stage === 'ended' && next.stage !== 'ended') return 'remove';
  return null;
}

export function addHistoryGame(history: Game[], game: Game): Game[] {
  return [game, ...history.filter(item => item.id !== game.id)].slice(0, 30);
}

export function removeHistoryGame(history: Game[], id: string): Game[] {
  return history.filter(item => item.id !== id);
}
