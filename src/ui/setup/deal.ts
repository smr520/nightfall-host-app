import { boardSeats, type Board } from '../../game/boards';
import { drawJingchengTreasure } from '../../game/jingcheng-draw';
import type { Role } from '../../game/types';
import type { TreasureDeal } from './types';

/** 固定板子按阵容入座；牌池型板子先洗牌扣底，再入座。 */
export function dealBoard(board: Board): { seats: Role[]; deal?: TreasureDeal } {
  if (board.deck !== 'jingcheng-treasure') return { seats: boardSeats(board) };
  const draw = drawJingchengTreasure();
  return { seats: draw.roles, deal: { boardId: board.id, reserve: draw.reserve, camp: draw.treasureCamp } };
}
