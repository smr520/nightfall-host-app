import { canHandOffBadge, getStageActionLabel, isCurrentGameActive, isRulingReasonValid, isSheriffWeightSelected, requiresAbandonConfirmation, shouldHighlightCatalogBoard } from '../src/game/host-ui';
import { applyAction, createGame, nightDeaths } from '../src/game/engine';
import { DEFAULT_RULES } from '../src/game/config';
import { addHistoryGame, archiveTransition, redoSession, removeHistoryGame, undoSession } from '../src/game/session';
import { createPersistenceQueue } from '../src/storage-queue';
import packageJson from '../package.json';
import { getConfig } from '@expo/config';
import type { Game, Session } from '../src/game/types';
import { rulesForHostingMode } from '../src/ui/preferences';

function assertEqual<T>(actual: T, expected: T, message = 'Values should match.') {
  if (actual !== expected) throw new Error(`${message} Expected ${String(expected)}, got ${String(actual)}.`);
}
function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

const players = [
  ['Wolf 1', 'wolf'], ['Wolf 2', 'wolf'], ['Wolf 3', 'wolf'], ['Wolf 4', 'wolf'],
  ['Villager 1', 'villager'], ['Villager 2', 'villager'], ['Villager 3', 'villager'], ['Villager 4', 'villager'],
  ['Seer', 'seer'], ['Witch', 'witch'], ['Hunter', 'hunter'], ['Idiot', 'idiot'],
] as const;
const base = createGame('Regression', '12-player', players.map(([name, role]) => ({ name, role })), DEFAULT_RULES);

let dawnPreview = applyAction(base, { type: 'wolves', target: 5 });
dawnPreview = applyAction(dawnPreview, { type: 'seer', target: 1 });
dawnPreview = applyAction(dawnPreview, { type: 'witch', save: false, poison: null });
assertEqual(dawnPreview.stage, 'dawn');
assertEqual(nightDeaths(dawnPreview).map(item => item.seat).join(','), '5', 'Dawn preview must calculate deaths before they are applied to player status.');
const firstAnnouncement = applyAction(dawnPreview, { type: 'dawn' });
assertEqual(firstAnnouncement.stage, 'sheriff-signup');
assertEqual(firstAnnouncement.players.find(player => player.seat === 5)?.alive, true, 'A player must not be removed from election before the configured public announcement.');
assert(firstAnnouncement.players.find(player => player.seat === 5)?.alive, 'First-night deaths remain eligible until the configured public announcement.');
assert(firstAnnouncement.vote === null, 'Election setup has not started until candidates submit their list.');
assertEqual(firstAnnouncement.nightAnnouncement, '昨夜 5 号 出局');
let sheriffElection = applyAction(firstAnnouncement, { type: 'signup', seats: [2, 3] });
assertEqual(sheriffElection.stage, 'sheriff-vote');
sheriffElection.vote!.voters.forEach(voter => { sheriffElection = applyAction(sheriffElection, { type: 'ballot', voter, target: 2 }); });
sheriffElection = applyAction(sheriffElection, { type: 'count' });
assertEqual(sheriffElection.stage, 'dawn-announcement', 'On this board, the dawn announcement follows sheriff election.');
assert(sheriffElection.players.find(player => player.seat === 5)?.alive, 'The elected sheriff stage must not apply unannounced deaths early.');
const published = applyAction(sheriffElection, { type: 'announce-dawn' });
assertEqual(published.stage, 'discussion');
assertEqual(published.players.find(player => player.seat === 5)?.alive, false, 'Night deaths apply when the saved announcement is confirmed.');
assertEqual(published.events.at(-1)?.publicText, '昨夜 5 号 出局', 'Sheriff events must not overwrite the saved dawn announcement.');

const afterAnnouncementRules = { ...DEFAULT_RULES, sheriffTiming: 'after-announcement' as const };
let afterAnnouncement = createGame('After announcement', '12-player', players.map(([name, role]) => ({ name, role })), afterAnnouncementRules);
afterAnnouncement = applyAction(afterAnnouncement, { type: 'wolves', target: 5 });
afterAnnouncement = applyAction(afterAnnouncement, { type: 'seer', target: 1 });
afterAnnouncement = applyAction(afterAnnouncement, { type: 'witch', save: false, poison: null });
afterAnnouncement = applyAction(afterAnnouncement, { type: 'dawn' });
assertEqual(afterAnnouncement.stage, 'sheriff-signup', 'The alternate first-day order must enter election after announcing deaths.');
assertEqual(afterAnnouncement.players.find(player => player.seat === 5)?.alive, false, 'The alternate order applies night deaths before election.');
let afterElection = applyAction(afterAnnouncement, { type: 'signup', seats: [2, 3] });
afterElection.vote!.voters.forEach(voter => { afterElection = applyAction(afterElection, { type: 'ballot', voter, target: 2 }); });
afterElection = applyAction(afterElection, { type: 'count' });
assertEqual(afterElection.stage, 'discussion', 'After-announcement election must continue into daytime.');
assertEqual(rulesForHostingMode('quick').sheriff, false, 'Quick hosting mode must disable the sheriff by default.');

const deadHunterPlayers = players.map(([name, role]) => ({ name, role }));
let deadHunter = createGame('Dead Hunter', '12-player', deadHunterPlayers, DEFAULT_RULES);
deadHunter = { ...deadHunter, day: 2, stage: 'dawn', sheriff: null, sheriffDone: true, night: { ...deadHunter.night, knife: 11 } };
const hunterKilledAtDawn = applyAction(deadHunter, { type: 'dawn' });
assertEqual(hunterKilledAtDawn.stage, 'hunter', 'Death triggers resolve after a non-election dawn settlement.');
assert(hunterKilledAtDawn.pending.some(item => item.kind === 'hunter'), 'Night death must queue the hunter action.');

let deadNightRoles = createGame('Dead night actors', '12-player', players.map(([name, role]) => ({ name, role })), DEFAULT_RULES);
deadNightRoles = { ...deadNightRoles, stage: 'wolves', players: deadNightRoles.players.map(player => ({ ...player, alive: !['seer', 'witch'].includes(player.role) })) };
deadNightRoles = applyAction(deadNightRoles, { type: 'wolves', target: null });
assertEqual(deadNightRoles.stage, 'seer', 'Dead-role night calls must be retained by default.');
deadNightRoles = applyAction(deadNightRoles, { type: 'skip-night', reason: 'Action role eliminated' });
assertEqual(deadNightRoles.stage, 'witch', 'The retained empty seer call must continue to the next role.');
let skippedDeadRoles = createGame('Skipped dead night actors', '12-player', players.map(([name, role]) => ({ name, role })), { ...DEFAULT_RULES, flow: { keepDeadCalls: false } });
skippedDeadRoles = { ...skippedDeadRoles, stage: 'wolves', players: skippedDeadRoles.players.map(player => ({ ...player, alive: !['seer', 'witch'].includes(player.role) })) };
skippedDeadRoles = applyAction(skippedDeadRoles, { type: 'wolves', target: null });
assertEqual(skippedDeadRoles.stage, 'dawn', 'Explicitly disabled dead-role calls must skip eliminated roles.');

const nightConfirmation = getStageActionLabel({ stage: 'wolves', targetRequired: true, selectedTarget: 5, selectedVoter: null, voteRecorded: false });
assertEqual(nightConfirmation, '确认刀口：5 号', 'Selecting a night target must leave a visible confirm action.');
assert(nightConfirmation !== '', 'An actionable stage must never render an empty footer label.');

const voteConfirmation = getStageActionLabel({ stage: 'exile-vote', targetRequired: false, selectedTarget: 2, selectedVoter: 7, voteRecorded: false });
assertEqual(voteConfirmation, '记录 7 号投给 2 号', 'Vote confirmation must state both the voter and the target.');
assertEqual(getStageActionLabel({ stage: 'exile-vote', targetRequired: false, selectedTarget: null, selectedVoter: 7, voteRecorded: false }), '选择 7 号投给谁');
assertEqual(getStageActionLabel({ stage: 'exile-vote', targetRequired: false, selectedTarget: null, selectedVoter: null, voteRecorded: false }), '选择待录投票人');

const ended: Game = { ...base, stage: 'ended', winner: 'good', endReason: 'Test', endedAt: Date.now() };
assertEqual(isCurrentGameActive(base.stage), true);
assertEqual(isCurrentGameActive(ended.stage), false, 'Ended games must not be labelled as in progress.');
assertEqual(requiresAbandonConfirmation(true, 'discussion'), true);
assertEqual(requiresAbandonConfirmation(true, 'ended'), false);
assertEqual(shouldHighlightCatalogBoard('standard-12', 'standard-12'), true);
assertEqual(shouldHighlightCatalogBoard('12-idiot', 'standard-12'), false);
assertEqual(isSheriffWeightSelected(1.5, 1), false);
assertEqual(isSheriffWeightSelected(1.5, 1.5), true);
assertEqual(canHandOffBadge({ seat: 4, alive: true, exposed: true }, 2), false);
assertEqual(isRulingReasonValid('x'), false);
assertEqual(isRulingReasonValid('ok'), true);
assert(packageJson.dependencies.expo.startsWith('~58.'), 'Expo must stay pinned to the SDK 58 patch line.');
assert(packageJson.dependencies['expo-sqlite'].startsWith('~58.'), 'Expo SQLite must stay on the SDK 58 patch line.');
const prebuildConfig = getConfig(process.cwd(), { skipSDKVersionRequirement: true }).exp;
assert(Array.isArray(prebuildConfig.plugins), 'Prebuild plugins must resolve to an explicit list.');
assert(prebuildConfig.plugins.some(plugin => (typeof plugin === 'string' ? plugin : plugin[0]) === 'expo-sqlite'), 'SQLite config plugin must be enabled for prebuild.');
assert(prebuildConfig.plugins.some(plugin => (typeof plugin === 'string' ? plugin : plugin[0]) === 'expo-system-ui'), 'System UI config plugin must be enabled for native appearance settings.');
assertEqual(archiveTransition(base, ended), 'add');
assertEqual(archiveTransition(ended, base), 'remove');

const history = addHistoryGame([], ended);
assertEqual(history.length, 1);
assertEqual(removeHistoryGame(history, ended.id).length, 0, 'Undoing an end must remove its history entry.');

const session: Session = { current: ended, undo: [base], redo: [] };
const undone = undoSession(session);
assert(undone, 'Undo must produce a previous session.');
assertEqual(undone.current.stage, base.stage);
assertEqual(archiveTransition(session.current, undone.current), 'remove');
const redone = redoSession(undone);
assert(redone, 'Redo must produce the ended session.');
assertEqual(redone.current.stage, 'ended');
assertEqual(archiveTransition(undone.current, redone.current), 'add');

console.log('regression tests passed: dawn preview/announcement, default and explicit dead-role night calls, night/vote confirmation, and end/undo/redo history');

async function verifyPersistenceLatestWins() {
  const queue = createPersistenceQueue();
  const writes: number[] = [];
  let releaseFirst!: () => void;
  const first = new Promise<void>(resolve => { releaseFirst = resolve; });
  const oldWrite = queue.run('session', async () => { await first; writes.push(1); });
  const newerWrite = queue.run('session', async () => { writes.push(2); });
  releaseFirst();
  await Promise.all([oldWrite, newerWrite]);
  assertEqual(writes.join(','), '2', 'A queued stale snapshot must not overwrite a more recent session version.');
  console.log('persistence queue regression passed: latest session snapshot wins');
}

verifyPersistenceLatestWins().catch(error => { console.error(error); process.exitCode = 1; });
