import { useEffect, useState } from 'react';
import { AppState } from 'react-native';

type ClockState = { scope: string; speaker: number | null; remaining: number; deadline: number | null; direction: 1 | -1 };
export type SpeechClock = { speaker: number | null; remaining: number; running: boolean; direction: 1 | -1; toggleDirection: () => void; select: (seat: number | null) => void; toggle: () => void; reset: () => void };
const initial = (scope: string, seconds: number): ClockState => ({ scope, speaker: null, remaining: seconds, deadline: null, direction: 1 });

/** Keeps timer state above tab pages; wall time prevents drift after backgrounding. */
export function useSpeechClock(scope: string, seconds: number): SpeechClock {
  const [state, setState] = useState(() => initial(scope, seconds));
  if (state.scope !== scope) setState(initial(scope, seconds));
  useEffect(() => {
    if (state.deadline === null) return;
    const deadline = state.deadline;
    const tick = () => {
      const remaining = Math.max(0, Math.ceil((deadline - Date.now()) / 1000));
      setState(current => current.deadline !== deadline || current.remaining === remaining ? current : { ...current, remaining, deadline: remaining === 0 ? null : deadline });
    };
    const interval = setInterval(tick, 250);
    const subscription = AppState.addEventListener('change', status => { if (status === 'active') tick(); });
    return () => { clearInterval(interval); subscription.remove(); };
  }, [state.deadline]);
  return {
    speaker: state.speaker, remaining: state.remaining, running: state.deadline !== null,
    direction: state.direction,
    toggleDirection: () => setState(current => ({ ...current, direction: current.direction === 1 ? -1 : 1 })),
    select: speaker => setState(current => ({ ...current, scope, speaker, remaining: seconds, deadline: null })),
    toggle: () => setState(current => {
      if (current.speaker === null) return current;
      if (current.deadline !== null) return { ...current, deadline: null, remaining: Math.max(0, Math.ceil((current.deadline - Date.now()) / 1000)) };
      const remaining = current.remaining || seconds;
      return { ...current, remaining, deadline: Date.now() + remaining * 1000 };
    }),
    reset: () => setState(current => ({ ...current, remaining: seconds, deadline: null })),
  };
}
