import type { RoleMeta } from './roles';

/** Source-backed identities added after the original registry; complex effects remain manual. */
export const EXTRA_ROLES = {
  'moon-seer': {
    name: '月神预言家', short: '月神', camp: 'good',
    tagline: '狼王计划彩蛋牌，拥有幻境查验能力；不是普通预言家。',
    night: { order: 50, script: '月神预言家请睁眼。请给出本夜幻境查验的选择，确认反馈后请闭眼。', help: '公告已确认幻境查验；完整目标数量、次数和反馈格式须先核对牌面，由主持人处理。', canSkip: true, targetLabel: '记录幻境查验的主要目标' },
  },
  'venom-witch': {
    name: '毒印女巫', short: '毒印', camp: 'good',
    tagline: '狼王计划彩蛋牌，拥有毒印连锁引爆能力。',
    night: { order: 60, script: '毒印女巫请睁眼。请给出本夜毒印的选择。确认后请闭眼。', help: '毒印关系与连锁由主持人记录，不能用普通女巫的一瓶毒药结算替代。', canSkip: true, targetLabel: '记录毒印的主要目标' },
  },
  'marksman-hunter': {
    name: '百步猎人', short: '百步', camp: 'good',
    tagline: '狼王计划彩蛋牌，具有针对狼人的狙击能力。',
    deathNote: '百步猎人的狙击窗口、资格与结算需要主持人按已核对牌面处理。',
  },
  'assassin-white-wolf-king': {
    name: '刺客白狼王', short: '刺客', camp: 'wolf', wolfTeam: true, canSelfExplode: false,
    tagline: '狼王计划彩蛋牌，具有精准刺杀能力。',
    deathNote: '刺客白狼王技能需主持人处理；普通白狼王自爆带人按钮不代表此牌规则。',
  },
  'vortex-villager': {
    name: '漩涡平民', short: '漩涡', camp: 'good', category: 'villager',
    tagline: '带有操控投票能力的平民变体，屠边计入平民。',
  },
  'awakened-guard': {
    name: '觉醒守卫', short: '醒守', camp: 'good',
    tagline: '觉醒版本的保护角色，不能直接套普通守卫的结算。',
    night: { order: 10, script: '觉醒守卫请睁眼。请给出今晚守护的选择。确认后请闭眼。', help: '使用觉醒牌面核对保护次数、保护范围和目标限制；软件只记录主要目标。', canSkip: true, targetLabel: '记录觉醒守护的主要目标' },
  },
  'awakened-knight': {
    name: '觉醒骑士', short: '醒骑', camp: 'good',
    tagline: '白天可连续决斗狼人，决斗好人时双方出局。',
    deathNote: '决斗好人后双方出局并继续原白天发言；需主持人记录。',
  },
  'awakened-wolf-beauty': {
    name: '觉醒狼美人', short: '醒美', camp: 'wolf', wolfTeam: true, canSelfExplode: false,
    tagline: '觉醒版本可使目标替代出局，区别于普通狼美人跟随。',
    night: { order: 35, script: '觉醒狼美人请睁眼。请确认本夜技能选择。确认后请闭眼。', help: '记录替代出局关系；触发窗口、目标范围及次数由主持人核对觉醒牌面。', canSkip: true, targetLabel: '记录替代出局的相关目标' },
  },
  'awakened-seer': {
    name: '觉醒预言家', short: '醒预', camp: 'good',
    tagline: '觉醒信息角色；沙龙之夜中查验咒狐可令其出局。',
    night: { order: 50, script: '觉醒预言家请睁眼。请给出本夜查验的选择，确认反馈后请闭眼。', help: '完整查验形式须核对觉醒牌面。沙龙之夜中查验咒狐涉及致死和封锁反弹，需人工结算。', canSkip: true, targetLabel: '记录觉醒查验的主要目标' },
  },
  fox: {
    name: '咒狐', short: '咒狐', camp: 'third',
    tagline: '第三方身份，免疫狼刀；被特定查验发现会出局。',
  },
} satisfies Record<string, RoleMeta>;

export type ExtraRole = keyof typeof EXTRA_ROLES;
