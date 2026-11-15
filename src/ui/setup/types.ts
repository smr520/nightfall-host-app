import type { Role } from '../../game/types';

export type Step = 0 | 1 | 2;

export type TreasureDeal = { boardId: string; reserve: Role[]; camp: 'wolf' | 'good' };

export type SetupPlayer = { name: string; role: Role };
