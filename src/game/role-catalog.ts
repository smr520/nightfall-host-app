import type { Role } from './roles';

export type CardType = 'base' | 'special' | 'awakened' | 'status';

export const CARD_TYPE_LABEL: Record<CardType, string> = {
  base: '基础身份',
  special: '特殊身份',
  awakened: '觉醒身份',
  status: '附加状态',
};

export type RoleCatalog = {
  type: CardType;
  /** Used when a role has a named variant that should not be confused with another card. */
  variant?: string;
};

/** Classification only. It does not claim that a role's full effect is automated. */
export const ROLE_CATALOG: Record<Role, RoleCatalog> = {
  wolf: { type: 'base', variant: '基础狼人' },
  villager: { type: 'base' },
  seer: { type: 'base' },
  witch: { type: 'base' },
  hunter: { type: 'base' },
  idiot: { type: 'base' },
  guard: { type: 'base' },
  'wolf-beauty': { type: 'special' },
  knight: { type: 'special' },
  'wolf-king': { type: 'special', variant: '狼王牌' },
  'white-wolf-king': { type: 'special', variant: '白狼王牌' },
  gargoyle: { type: 'special' },
  gravekeeper: { type: 'special' },
  dreamer: { type: 'special' },
  'red-moon-apostle': { type: 'special' },
  'hunter-demon': { type: 'special' },
  'pure-white': { type: 'special' },
  'wolf-shaman': { type: 'special' },
  nightmare: { type: 'special' },
  'time-wolf-consort': { type: 'special' },
  'sequence-prince': { type: 'special' },
  'magic-mirror': { type: 'special' },
  'awakened-hidden-wolf': { type: 'awakened', variant: '觉醒隐狼牌' },
  'miracle-merchant': { type: 'special' },
  'lucky-one': { type: 'status', variant: '商人赠予状态，不单独占座' },
  'evil-knight': { type: 'special' },
  'lone-girl': { type: 'special' },
  'sun-eater': { type: 'special' },
  'light-earl': { type: 'special' },
  'fragrance-shadow': { type: 'special' },
  'awakened-wolf-king': { type: 'awakened', variant: '觉醒狼王牌' },
  'moon-seer': { type: 'special', variant: '狼王计划 · 彩蛋预言家' },
  'venom-witch': { type: 'special', variant: '狼王计划 · 彩蛋女巫' },
  'marksman-hunter': { type: 'special', variant: '狼王计划 · 彩蛋猎人' },
  'assassin-white-wolf-king': { type: 'special', variant: '狼王计划 · 彩蛋白狼王' },
  'vortex-villager': { type: 'special', variant: '狼王计划 · 平民变体' },
  'awakened-guard': { type: 'awakened', variant: '觉醒守卫牌' },
  'awakened-knight': { type: 'awakened', variant: '觉醒骑士牌' },
  'awakened-wolf-beauty': { type: 'awakened', variant: '觉醒狼美人牌' },
  'awakened-seer': { type: 'awakened', variant: '觉醒预言家牌' },
  fox: { type: 'special', variant: '第三方 · 咒狐牌' },
  medium: { type: 'special', variant: '京城 · 通灵师' },
  poisoner: { type: 'special', variant: '京城 · 毒师' },
  raven: { type: 'special', variant: '京城 · 乌鸦' },
  'treasure-master': { type: 'special', variant: '京城 S15 · 可变阵营' },
  'nine-tails': { type: 'special', variant: '京城 · 青丘夜影' },
  baize: { type: 'special', variant: '京城 · 青丘夜影' },
  dancer: { type: 'special', variant: '京城 · 假面舞会' },
  masked: { type: 'special', variant: '京城 · 假面舞会' },
  'mech-wolf': { type: 'special', variant: '京城 · 机械狼通灵师' },
};

export const cardTypeLabel = (type: CardType) => CARD_TYPE_LABEL[type];

/** Lucky One is granted by the merchant and is not dealt as a separate seat card. */
export const isIdentityCard = (role: Role) => ROLE_CATALOG[role].type !== 'status';
