import { applyAction, createGame } from '../src/game/engine';
import { DEFAULT_RULES } from '../src/game/config';
import type { Action, Game } from '../src/game/types';

const expectStage = (actual: Game['stage'], expected: Game['stage'], message: string) => {
  if (actual !== expected) throw new Error(`${message}: expected ${expected}, got ${actual}`);
};

const players = [
  ['狼1', 'wolf'], ['狼2', 'wolf'], ['狼3', 'wolf'], ['狼4', 'wolf'],
  ['民1', 'villager'], ['民2', 'villager'], ['民3', 'villager'], ['民4', 'villager'],
  ['预言家', 'seer'], ['女巫', 'witch'], ['猎人', 'hunter'], ['白痴', 'idiot'],
] as const;

let game: Game = createGame('引擎烟测', '预女猎白', players.map(([name, role]) => ({ name, role })), DEFAULT_RULES);
const run = (action: Action) => { game = applyAction(game, action); };
expectStage(game.stage, 'wolves', 'Initial stage');
run({ type: 'wolves', target: 5 });
run({ type: 'seer', target: 1 });
run({ type: 'witch', save: true, poison: null });
run({ type: 'dawn' });
expectStage(game.stage, 'sheriff-signup', 'After first-night settlement');
run({ type: 'signup', seats: [1, 2] });
expectStage(game.stage, 'sheriff-vote', 'After sheriff signup');
for (const voter of game.vote?.voters ?? []) run({ type: 'ballot', voter, target: 2 });
run({ type: 'count' });
expectStage(game.stage, 'dawn-announcement', 'After sheriff election');
run({ type: 'announce-dawn' });
expectStage(game.stage, 'discussion', 'After dawn announcement');
run({ type: 'start-exile' });
for (const voter of game.vote?.voters ?? []) run({ type: 'ballot', voter, target: 1 });
run({ type: 'count' });
if (game.day !== 2 || game.stage !== 'wolves') throw new Error(`Expected next night, got day ${game.day} ${game.stage}`);

const beforeUndo = JSON.stringify(game);
game = applyAction(game, { type: 'wolves', target: 6 });
if (JSON.stringify(game) === beforeUndo) throw new Error('Action did not change state');
console.log(`engine smoke passed: day=${game.day}, stage=${game.stage}, events=${game.events.length}`);
