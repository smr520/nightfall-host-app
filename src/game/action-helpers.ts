import type { Game } from './types';

export function addCheckDeath(g: Game, seat: number) {
  g.night.checkDeaths = [...new Set([...(g.night.checkDeaths ?? []), seat])];
}

export function isNightmareFeared(g: Game, seat: number) {
  return g.night.targets['nightmare'] === seat;
}
