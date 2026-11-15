import { DEFAULT_RULES } from '../src/game/config';
import { applyAction, createGame } from '../src/game/engine';
import { hostNarration, latestPublicOutcome } from '../src/game/narration';
import { NIGHT_ROLE_ORDER, ROLES } from '../src/game/roles';
import type { Game, Role, Rules, Stage, Vote } from '../src/game/types';

const roles: Role[] = ['wolf', 'wolf', 'wolf', 'villager', 'seer', 'witch', 'guard', 'villager', 'villager', 'villager', 'hunter', 'villager'];
const fixture = (rules: Partial<Rules> = {}) => createGame('完整主持口播', '十二人测试', roles.map(role => ({ name: role, role })), { ...DEFAULT_RULES, sheriff: false, win: 'all', ...rules });

function atDawn(rules: Partial<Rules> = {}, knife: number | null = 5, poison: number | null = 8): Game {
  let game = fixture(rules);
  for (const stage of game.nightCalls) {
    if (stage === 'guard') game = applyAction(game, { type: 'guard', target: null });
    else if (stage === 'wolves') game = applyAction(game, { type: 'wolves', target: knife });
    else if (stage === 'seer') game = applyAction(game, { type: 'seer', target: 1 });
    else if (stage === 'witch') game = applyAction(game, { type: 'witch', save: false, poison });
  }
  expect(game.stage).toBe('dawn');
  return game;
}

const withVote = (vote: Vote): Game => ({ ...fixture(), stage: vote.kind === 'sheriff' ? 'sheriff-vote' : 'exile-vote', vote });
const baseVote = (kind: Vote['kind'] = 'exile'): Vote => ({ kind, round: 1, candidates: [2, 7], voters: [1, 3], ballots: {} });

describe('complete host scripts', () => {
  it('opens the night only for its first active call, respecting custom order and dead actors', () => {
    let game = fixture();
    expect(game.stage).toBe('guard');
    expect(hostNarration(game, '').spoken).toMatch(/^天黑了，请所有玩家闭眼。守卫请睁眼/);
    game = applyAction(game, { type: 'guard', target: null });
    expect(hostNarration(game, '').spoken).not.toContain('天黑了');
    const custom = fixture({ flow: { nightOrder: ['seer', 'wolves', 'witch', 'guard'] } });
    expect(hostNarration(custom, '').spoken).toMatch(/^天黑了，请所有玩家闭眼。预言家请睁眼/);
    custom.players[4].alive = false; custom.stage = 'wolves';
    custom.rules.flow = { ...custom.rules.flow, keepDeadCalls: false };
    expect(hostNarration(custom, '').spoken).toMatch(/^天黑了，请所有玩家闭眼。狼人请睁眼/);
    expect(hostNarration(custom, '').spoken).not.toContain('预言家已出局');
  });

  it.each(['wolves', ...NIGHT_ROLE_ORDER] as Stage[])('gives %s a complete role-only night call', stage => {
    const callRoles = [...roles];
    if (stage !== 'wolves' && !callRoles.includes(stage as Role)) callRoles[11] = stage as Role;
    const game = createGame('角色口播', '本局角色', callRoles.map(role => ({ name: role, role })), { ...DEFAULT_RULES, sheriff: false, flow: { manualVictory: true } });
    game.stage = stage;
    const name = stage === 'wolves' ? '狼人' : ROLES[stage as Role].name;
    const result = hostNarration(game, '旧提示……', { selected: 8 });
    expect(result.headline).toBe(`${name}行动`);
    expect(result.spoken).toContain(`${name}请睁眼`);
    expect(result.spoken).toContain(`${name}请闭眼`);
    expect(result.spoken).not.toMatch(/\d+\s*号|……|核对后公布/);
    expect(result.privateNote).toContain('已选目标：8 号');
  });

  it('keeps the witch knife, actor seat and medicine state in the private note', () => {
    const game = fixture(); game.stage = 'witch'; game.night.knife = 5; game.medicine.save = false;
    const result = hostNarration(game, '旧提示', { selected: 8 });
    expect(result.spoken).toContain('请看手势');
    expect(result.spoken).toContain('是否使用解药');
    expect(result.spoken).toContain('是否使用毒药');
    expect(result.spoken).not.toMatch(/5 号|6 号|8 号|解药已使用/);
    expect(result.privateNote).toContain('本步行动座位：6 号');
    expect(result.privateNote).toContain('刀口：5 号');
    expect(result.privateNote).toContain('解药已使用');
  });

  it('keeps a seer result private', () => {
    const game = fixture(); game.stage = 'seer';
    const result = hostNarration(game, '', { selected: 1 });
    expect(result.spoken).not.toContain('狼人');
    expect(result.privateNote).toContain('查验反馈：狼人');
    expect(result.privateNote).toContain('本步行动座位：5 号');
  });

  it('announces final death numbers directly after review without reading the cause', () => {
    const result = hostNarration(atDawn(), '请核对后公布名单。');
    expect(result.headline).toBe('昨夜 5 号、8 号出局');
    expect(result.spoken).toContain('昨夜 5 号、8 号出局。');
    expect(result.spoken.match(/昨夜 5 号、8 号出局/g)).toHaveLength(1);
    expect(result.spoken).not.toMatch(/中毒|刀伤|核对|……/);
  });

  it('withholds the first night deaths until after the election', () => {
    const dawn = atDawn({ sheriff: true, sheriffTiming: 'before-announcement' });
    const before = hostNarration(dawn, '泄露的旧提示：5 号、8 号');
    expect(before.spoken).toContain('竞选结束后公布');
    expect(before.spoken).not.toMatch(/5 号|8 号/);
    expect(before.privateNote).toContain('昨夜 5 号、8 号出局');
    const signup = applyAction(dawn, { type: 'dawn' });
    const election = hostNarration(signup, '', { signup: [1, 4] });
    expect(election.spoken).toContain('昨夜结果将在竞选后公布');
    expect(election.spoken).toContain('1 号、4 号');
    expect(election.spoken).not.toMatch(/5 号|8 号/);
    const announcement = applyAction(signup, { type: 'signup', seats: [1] });
    expect(announcement.stage).toBe('dawn-announcement');
    expect(hostNarration(announcement, '').spoken).toContain('昨夜 5 号、8 号出局');
  });

  it('announces deaths before the first election when that timing is configured', () => {
    const dawn = atDawn({ sheriff: true, sheriffTiming: 'after-announcement' });
    expect(hostNarration(dawn, '').spoken).toContain('昨夜 5 号、8 号出局');
    const signup = applyAction(dawn, { type: 'dawn' });
    const result = hostNarration(signup, '旧的先竞选提示');
    expect(result.spoken).toContain('昨夜结果已公布');
    expect(result.spoken).not.toContain('将在竞选后公布');
  });

  it('waits for the manual death review and then reads only the reviewed list', () => {
    const game = atDawn({ sheriff: true, sheriffTiming: 'after-announcement', flow: { manualDawn: true } });
    const pending = hostNarration(game, '昨夜 5 号、8 号出局');
    expect(pending.headline).toContain('请等待');
    expect(pending.spoken).not.toMatch(/5 号|8 号/);
    expect(pending.privateNote).toContain('尚未复核');
    const reviewed = applyAction(game, { type: 'set-dawn-deaths', deaths: [{ seat: 4, cause: 'ruling' }], reason: '技能复核' });
    expect(hostNarration(reviewed, '').spoken).toContain('昨夜 4 号出局');
    expect(hostNarration(reviewed, '').spoken).not.toMatch(/5 号|8 号/);
  });

  it('handles a reviewed peaceful night without inventing an outgoing player', () => {
    let game = atDawn({ flow: { manualDawn: true } });
    game = applyAction(game, { type: 'set-dawn-deaths', deaths: [], reason: '全部获救' });
    const result = hostNarration(game, '');
    expect(result.headline).toBe('昨夜平安夜');
    expect(result.spoken).not.toContain('请出局玩家');
  });

  it('calls the selected speaker and the public sheriff by seat', () => {
    const game = fixture(); game.stage = 'discussion'; game.sheriff = 2;
    expect(hostNarration(game, '').headline).toBe('请 2 号警长指定发言顺序');
    const selected = hostNarration(game, '', { speaker: 5 });
    expect(selected.headline).toBe('请 5 号玩家发言');
    expect(selected.spoken).toBe('请 5 号玩家发言。其他玩家请保持安静。');
    expect(selected.spoken).not.toContain('预言家');
  });

  it('directly names a dead hunter and selected living skill target', () => {
    const game = fixture(); game.stage = 'hunter'; game.players[10].alive = false; game.pending = [{ kind: 'hunter', seat: 11 }];
    const result = hostNarration(game, '', { selected: 2 });
    expect(result.headline).toBe('请 11 号猎人决定是否开枪');
    expect(result.spoken).toContain('目标是 2 号');
    expect(result.spoken).toContain('如果不开枪');
  });

  it('gives a numbered death-skill call and rejects a dead draft target', () => {
    const game = fixture(); game.stage = 'shot'; game.pending = [{ kind: 'shot', seat: 3, role: 'white-wolf-king' }]; game.players[7].alive = false;
    const result = hostNarration(game, '', { selected: 8 });
    expect(result.headline).toContain('3 号白狼王');
    expect(result.spoken).toContain('请指认一名存活玩家');
    expect(result.spoken).not.toContain('8 号');
  });

  it('asks the outgoing sheriff who receives the badge and offers destruction', () => {
    const game = fixture(); game.stage = 'badge'; game.pending = [{ kind: 'badge', seat: 5 }];
    const result = hostNarration(game, '', { selected: 8 });
    expect(result.headline).toBe('5 号玩家，警徽移交给谁');
    expect(result.spoken).toContain('警徽移交给 8 号');
    expect(result.spoken).toContain('撕毁警徽');
  });

  it('uses the recorded charm target and never announces a repeated death', () => {
    const game = fixture(); game.stage = 'link'; game.pending = [{ kind: 'link', seat: 3, role: 'wolf-beauty', target: 8 }];
    expect(hostNarration(game, '', { selected: 2 }).headline).toBe('8 号因殉情出局');
    game.players[7].alive = false;
    const result = hostNarration(game, '', { selected: 2 });
    expect(result.headline).toBe('8 号已出局，无需重复殉情');
    expect(result.spoken).not.toContain('2 号');
  });
});

describe('just completed public outcomes', () => {
  function afterExile(): Game {
    let game = applyAction(atDawn({ flow: { nightOrder: ['wolves', 'seer', 'witch', 'guard'] } }, null, null), { type: 'dawn' });
    game = applyAction(game, { type: 'start-exile' });
    for (const voter of game.vote!.voters) game = applyAction(game, { type: 'ballot', voter, target: 5 });
    return applyAction(game, { type: 'count' });
  }

  it('preserves the actual exile after the next night opens, then clears after its first action', () => {
    const exiled = afterExile();
    expect(exiled.stage).toBe('wolves');
    expect(exiled.day).toBe(2);
    const event = exiled.events[exiled.events.length - 2];
    expect(latestPublicOutcome(exiled)).toEqual({ headline: '5 号被放逐', spoken: '5 号被放逐', eventId: event.id });
    const nextAction = applyAction(exiled, { type: 'wolves', target: 4 });
    expect(latestPublicOutcome(nextAction)).toBeNull();
  });

  it('shows announced dawn deaths while the dead hunter decides whether to shoot', () => {
    const game = applyAction(atDawn({}, 11, null), { type: 'dawn' });
    expect(game.stage).toBe('hunter');
    const event = game.events[game.events.length - 1];
    expect(latestPublicOutcome(game)).toEqual({ headline: '昨夜 11 号 出局', spoken: '昨夜 11 号 出局', eventId: event.id });
    expect(latestPublicOutcome(game)?.spoken).not.toMatch(/刀伤|中毒/);
  });

  it('shows the most recent shot in a real chained death skill sequence', () => {
    const dawn = atDawn({}, 11, null); dawn.players[0].role = 'wolf-king';
    const hunter = applyAction(dawn, { type: 'dawn' });
    const wolfKing = applyAction(hunter, { type: 'hunter', target: 1 });
    expect(wolfKing.stage).toBe('shot');
    expect(latestPublicOutcome(wolfKing)?.spoken).toBe('11 号猎人开枪带走 1 号');
    const resolved = applyAction(wolfKing, { type: 'shot', target: 4 });
    expect(latestPublicOutcome(resolved)?.spoken).toBe('1 号狼王带走 4 号');
  });

  it('withholds an unannounced death during the first election', () => {
    const dawn = atDawn({ sheriff: true }, 11, null);
    expect(latestPublicOutcome(dawn)).toBeNull();
    const signup = applyAction(dawn, { type: 'dawn' });
    expect(signup.announcementReady).toBe(true);
    expect(latestPublicOutcome(signup)).toBeNull();
    const elected = applyAction(signup, { type: 'signup', seats: [1] });
    expect(latestPublicOutcome(elected)?.spoken).toBe('1 号当选警长');
    expect(latestPublicOutcome(elected)?.spoken).not.toContain('11 号');
  });

  it('replaces a death with badge transfer and clears the outcome when voting begins', () => {
    const dawn = atDawn({}, 4, null); dawn.sheriff = 4;
    const badge = applyAction(dawn, { type: 'dawn' });
    expect(badge.stage).toBe('badge');
    expect(latestPublicOutcome(badge)?.spoken).toBe('昨夜 4 号 出局');
    const transferred = applyAction(badge, { type: 'badge', target: 8 });
    expect(latestPublicOutcome(transferred)?.spoken).toBe('8 号接任警长');
    expect(latestPublicOutcome(applyAction(transferred, { type: 'start-exile' }))).toBeNull();
  });

  it('does not scan beyond a later ballot or a private night log', () => {
    const exiled = afterExile();
    const latest = exiled.events[exiled.events.length - 1];
    exiled.events.push({ id: latest.id + 1, at: latest.at, day: 2, stage: 'seer', text: '预言家查验 2 号：狼人' });
    expect(latestPublicOutcome(exiled)).toBeNull();
    const discussion = applyAction(atDawn({}, 4, null), { type: 'dawn' });
    let vote = applyAction(discussion, { type: 'start-exile' });
    vote = applyAction(vote, { type: 'ballot', voter: 1, target: 5 });
    expect(latestPublicOutcome(vote)).toBeNull();
  });
});

describe('vote scripts follow the current ballots', () => {
  it('names candidates, voter and selected target without private roles', () => {
    const result = hostNarration(withVote(baseVote()), '', { activeVoter: 3, selected: 7 });
    expect(result.headline).toBe('请 3 号玩家投票');
    expect(result.spoken).toContain('2 号、7 号');
    expect(result.spoken).toContain('请 3 号投票，确认投给 7 号');
    expect(result.spoken).not.toMatch(/狼人|守卫/);
  });

  it('falls back to the next unrecorded voter and does not endorse an invalid target', () => {
    const vote = baseVote(); vote.ballots = { 1: 2 };
    const result = hostNarration(withVote(vote), '', { activeVoter: 99, selected: 8 });
    expect(result.headline).toBe('请 3 号玩家投票');
    expect(result.spoken).toContain('弃票');
    expect(result.spoken).not.toMatch(/99 号|投给 8 号/);
  });

  it.each(['sheriff', 'exile'] as const)('handles a completed all-abstain %s vote', kind => {
    const vote = baseVote(kind); vote.ballots = { 1: null, 3: null };
    const result = hostNarration(withVote(vote), '', { activeVoter: 3 });
    expect(result.spoken).toContain('本轮投票已结束');
    expect(result.spoken).toContain('所有玩家均弃票');
    expect(result.spoken).toContain(kind === 'sheriff' ? '警徽流失' : '无人被放逐');
    expect(result.spoken).not.toContain('请 3 号投票');
  });

  it('handles a vote with no eligible voters', () => {
    const vote = baseVote('sheriff'); vote.voters = [];
    expect(hostNarration(withVote(vote), '').spoken).toContain('本轮没有有投票资格的玩家');
  });

  it('announces a first tie, a repeated tie, and a weighted winner accurately', () => {
    const vote = baseVote('exile'); vote.ballots = { 1: 2, 3: 7 };
    const game = withVote(vote);
    expect(hostNarration(game, '').headline).toBe('2 号、7 号平票，进入 PK');
    game.vote!.round = 2;
    expect(hostNarration(game, '').headline).toBe('再次平票，无人被放逐');
    game.sheriff = 1;
    expect(hostNarration(game, '').headline).toBe('2 号被放逐');
    expect(hostNarration(game, '').spoken).toContain('2 号 1.5 票');
  });

  it('describes an unexposed idiot as immune to the first exile', () => {
    const vote = baseVote(); vote.ballots = { 1: 2, 3: 2 };
    const game = withVote(vote); game.players[1].role = 'idiot';
    expect(hostNarration(game, '').headline).toBe('2 号白痴翻牌免死');
    game.players[1].exposed = true;
    expect(hostNarration(game, '').headline).toBe('2 号被放逐');
  });
});

describe('custom script substitutions', () => {
  it('trims an override and renders all public seat placeholders', () => {
    const game = withVote(baseVote('sheriff'));
    game.rules.flow = { scripts: { 'sheriff-vote': '  {投票人}，请在 {候选人} 中选择；你选择 {目标}。现在请 {发言人} 发言。  ' } };
    expect(hostNarration(game, '', { activeVoter: 3, selected: 7, speaker: 5 }).spoken).toBe('3 号，请在 2 号、7 号 中选择；你选择 7 号。现在请 5 号 发言。');
  });

  it('falls back to a complete standard call when a custom field is cleared', () => {
    const game = fixture(); game.stage = 'witch'; game.rules.flow = { scripts: { witch: '  ' } };
    expect(hostNarration(game, '女巫请睁眼。').spoken).toContain('女巫请闭眼');
  });

  it('redacts all seat placeholders and the night result from night speech', () => {
    const game = fixture(); game.stage = 'witch'; game.night.knife = 5;
    game.rules.flow = { scripts: { witch: '{目标}；{候选人}；{投票人}；{发言人}；{昨夜结果}。' } };
    const result = hostNarration(game, '', { selected: 8, activeVoter: 1, speaker: 3, signup: [2, 7] });
    expect(result.spoken).not.toMatch(/\d+\s*号|出局/);
    expect(result.spoken).toContain('天亮后公布');
    expect(result.privateNote).toContain('刀口：5 号');
    expect(result.privateNote).toContain('已选目标：8 号');
  });

  it('does not reveal a pending result through custom first-election scripts', () => {
    const dawn = atDawn({ sheriff: true });
    const signup = applyAction(dawn, { type: 'dawn' });
    signup.rules.flow = { scripts: { 'sheriff-signup': '{昨夜结果}。' } };
    expect(hostNarration(signup, '').spoken).toBe('昨夜结果将在竞选后公布。');
  });

  it('uses a recorded charm target instead of an unrelated draft in a custom script', () => {
    const game = fixture(); game.stage = 'link'; game.pending = [{ kind: 'link', seat: 3, target: 8 }];
    game.rules.flow = { scripts: { link: '请 {目标} 玩家等待结算。' } };
    expect(hostNarration(game, '', { selected: 2 }).spoken).toBe('请 8 号 玩家等待结算。');
  });

  it('withholds an unreviewed dawn placeholder and permits it after explicit review', () => {
    const game = atDawn({ flow: { manualDawn: true, scripts: { dawn: '天亮了。{昨夜结果}。' } } });
    expect(hostNarration(game, '').spoken).not.toMatch(/5 号|8 号/);
    const reviewed = applyAction(game, { type: 'set-dawn-deaths', deaths: [{ seat: 4, cause: 'ruling' }], reason: '人工复核' });
    expect(hostNarration(reviewed, '').spoken).toBe('天亮了。昨夜 4 号出局。');
  });

  it('permits a result after its public announcement but not from a stored private string', () => {
    const game = fixture(); game.stage = 'discussion'; game.night.knife = 5; game.nightAnnouncement = '昨夜 5 号 出局';
    game.rules.flow = { scripts: { discussion: '{昨夜结果}。' } };
    expect(hostNarration(game, '').spoken).not.toContain('5 号');
    const announced = applyAction(atDawn(), { type: 'dawn' });
    announced.rules.flow = game.rules.flow;
    expect(hostNarration(announced, '').spoken).toBe('昨夜 5 号、8 号出局。');
  });
});
