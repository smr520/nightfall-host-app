import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';
import { BOARD_LIBRARY, boardSeats } from '../src/game/boards';
import { DEFAULT_RULES } from '../src/game/config';
import { createGame } from '../src/game/engine';
import { hostNarration } from '../src/game/narration';
import { useSpeechClock, type SpeechClock } from '../src/hooks/useSpeechClock';
import { stageInfo } from '../src/ui/labels';

const fixture = () => createGame('口播测试', '标准', boardSeats(BOARD_LIBRARY[0]).map(role => ({ name: role, role })), DEFAULT_RULES);

describe('numbered hosting narration', () => {
  it('falls back to standard speech when a custom field is cleared', () => {
    const game = fixture(); game.stage = 'wolves'; game.rules.flow = { scripts: { wolves: '   ' } };
    expect(stageInfo('wolves', game).script).toContain('狼人请睁眼');
    game.stage = 'dawn'; game.rules.flow.scripts = { dawn: '' };
    expect(stageInfo('dawn', game).script).toContain('天亮了');
  });
  it('states candidate and voter seats directly without exposing roles', () => {
    const game = fixture(); game.stage = 'exile-vote';
    game.vote = { kind: 'exile', round: 1, candidates: [2, 7], voters: [1, 3], ballots: {} };
    const text = hostNarration(game, '旧口播', { selected: 7, activeVoter: 3 }).spoken;
    expect(text).toContain('2 号、7 号'); expect(text).toContain('请 3 号投票'); expect(text).toContain('投给 7 号');
    expect(text).not.toMatch(/狼人|女巫|预言家/);
  });
  it('keeps night actor seats out of spoken text and in a private note', () => {
    const game = fixture(); game.stage = 'witch'; game.night.knife = 5;
    const result = hostNarration(game, '女巫请睁眼。', { selected: 6 });
    const witch = game.players.find(player => player.role === 'witch')!;
    expect(result.spoken).toContain('女巫请睁眼。');
    expect(result.spoken).toContain('女巫请闭眼。');
    expect(result.spoken).not.toMatch(/\d+\s*号/);
    expect(result.privateNote).toContain(`${witch.seat} 号`); expect(result.privateNote).toContain('刀口：5 号');
    expect(result.privateNote).toContain('仅主持人');
  });
  it('renders saved script placeholders and withholds unannounced deaths in election scripts', () => {
    const game = fixture(); game.stage = 'discussion';
    game.rules.flow = { scripts: { discussion: '请 {发言人} 开始发言。', 'sheriff-vote': '{昨夜结果}，候选人 {候选人}。' } };
    expect(hostNarration(game, '默认', { speaker: 5 }).spoken).toBe('请 5 号 开始发言。');
    game.stage = 'sheriff-vote'; game.announcementReady = true; game.night.knife = 8;
    game.vote = { kind: 'sheriff', round: 1, candidates: [2, 3], voters: [1], ballots: {} };
    const text = hostNarration(game, '').spoken;
    expect(text).toContain('将在竞选后公布'); expect(text).not.toContain('8 号');
  });
});

describe('speech clock', () => {
  let clock!: SpeechClock;
  let renderer!: TestRenderer.ReactTestRenderer;
  function Probe({ scope = 'day-1' }: { scope?: string }) { clock = useSpeechClock(scope, 90); return null; }
  beforeEach(() => { jest.useFakeTimers(); jest.setSystemTime(10000); act(() => { renderer = TestRenderer.create(<Probe />); }); });
  afterEach(() => { act(() => renderer.unmount()); jest.useRealTimers(); });
  it('requires a speaker and supports pause, resume, expiry and reset', () => {
    act(() => clock.toggle()); expect(clock.running).toBe(false);
    act(() => clock.select(5)); act(() => clock.toggle());
    act(() => jest.advanceTimersByTime(3000)); expect(clock.remaining).toBe(87);
    act(() => clock.toggle()); act(() => jest.advanceTimersByTime(10000)); expect(clock.remaining).toBe(87);
    act(() => clock.toggle()); act(() => jest.advanceTimersByTime(87000)); expect(clock.remaining).toBe(0); expect(clock.running).toBe(false);
    act(() => clock.reset()); expect(clock.remaining).toBe(90);
  });
  it('uses wall time after background delay and resets for the next phase', () => {
    act(() => clock.select(5)); act(() => clock.toggle());
    act(() => { jest.setSystemTime(60000); jest.advanceTimersByTime(250); });
    expect(clock.remaining).toBe(40);
    act(() => renderer.update(<Probe scope="day-2" />));
    expect(clock.speaker).toBeNull(); expect(clock.remaining).toBe(90); expect(clock.running).toBe(false);
  });
});
