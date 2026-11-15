import { boardOrigins, type Board, type BoardTag } from '../../game/boards';

export type Filter = 'all' | 'netease' | 'jingcheng' | 'classic';

export const FILTERS: { label: string; value: Filter }[] = [
  { label: '全部', value: 'all' },
  { label: '网易官方', value: 'netease' },
  { label: '京城大师赛', value: 'jingcheng' },
  { label: '常规', value: 'classic' },
];

export function matchesFilter(board: Board, filter: Filter) {
  if (filter === 'all') return true;
  if (filter === 'classic') return board.tag === 'classic';
  return boardOrigins(board).includes(filter);
}

export function boardTagLabel(tag: BoardTag) {
  return { official: '网易官方', tournament: '京城大师赛', classic: '常规', custom: '自定义' }[tag];
}
