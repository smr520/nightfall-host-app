import type { RoleMeta } from './roles';

/** Separate identities for 京城大师赛 physical-card versions, never aliases for a similar online card. */
export const JINGCHENG_ROLES = {
  medium: {
    name: '通灵师', short: '通灵', camp: 'good', tagline: '夜间查验具体身份；盗宝大师反馈其当夜借用的身份。',
    night: { order: 50, script: '通灵师请睁眼。请指认今晚要查验的玩家。请看主持人的身份反馈，确认收到后闭眼。', help: '具体身份仅私下告知；查验盗宝大师时先核对当夜借用牌。', canSkip: true, targetLabel: '选择查验目标' },
  },
  poisoner: {
    name: '毒师', short: '毒师', camp: 'good', tagline: '整局只有一瓶毒药，没有女巫解药。',
    night: { order: 60, script: '毒师请睁眼。今晚是否使用毒药？如使用，请指认目标。毒师请闭眼。', help: '在现场备忘登记药量；目标与实际出局需人工复核。被毒的猎人、狼王不能发动技能。', canSkip: true, targetLabel: '记录毒药目标' },
  },
  raven: {
    name: '乌鸦', short: '鸦', camp: 'good', tagline: '京城盗宝牌池的独立神职；投票效果须按本桌牌面确认。',
    night: { order: 80, script: '乌鸦请睁眼。请按赛前约定指认今晚的技能目标。乌鸦请闭眼。', help: '公开配置图确认乌鸦在牌池中，但未刊载完整票数细则；须先在补充约定写明效果与限制。', canSkip: true, targetLabel: '记录乌鸦目标' },
  },
  'treasure-master': {
    name: '盗宝大师', short: '盗宝', camp: 'third', lateKnife: true, tagline: '看三张底牌决定阵营，每夜借用其中一张身份的技能。',
    night: { order: 45, script: '盗宝大师请睁眼。请确认三张底牌。今晚选择哪一张身份牌？请按该身份的技能给出目标。确认后请闭眼。', help: '先在私密备忘记录借用身份，再记录目标；连续两夜不能选择同一张。阵营及继承刀权由主持人核对。', canSkip: true, targetLabel: '记录借用技能的目标' },
  },
  'nine-tails': {
    name: '九尾', short: '九尾', camp: 'wolf', wolfTeam: false, canSelfExplode: false, lateKnife: true, poisonImmune: true,
    tagline: '不与狼队见面，每夜标记玩家；白天可发动“猎杀时刻”。',
    night: { order: 40, script: '九尾请睁眼。请指认今晚要标记的玩家。九尾请闭眼。', help: '每夜必须标记一人；投票所投对象也会获得标记。其他三狼全部出局后获得刀权。', targetLabel: '记录标记目标' },
    deathNote: '九尾免疫女巫毒药；猎杀时刻由软件自动判定并结算。',
  },
  baize: {
    name: '白泽', short: '白泽', camp: 'good',
    tagline: '每夜清除一名玩家的全部标记；出局时传承给继承人。',
    night: { order: 72, script: '白泽请睁眼。请指认今晚要清除标记的玩家。白泽请闭眼。', help: '清除目标的全部标记；若目标无标记则无事发生。传承后的继承人不再拥有清除技能。', canSkip: true, targetLabel: '选择清除标记的玩家' },
    deathNote: '白泽夜间死亡或被放逐时翻牌指定继承人；作为最后一神或被猎杀时刻带走时不能传承。',
  },
  dancer: {
    name: '舞者', short: '舞者', camp: 'good', poisonImmune: true,
    tagline: '第二夜起每夜选三人共舞，舞池中人数少的阵营出局。',
    night: { order: 8, fromNight: 2, script: '舞者请睁眼。请指认今晚共舞的三名玩家。舞者请闭眼。', help: '每名玩家只能进一次舞池；舞者在舞池时当晚舞池玩家免疫狼刀。软件自动结算舞池出局。', targetLabel: '选择舞池的三名玩家' },
  },
  masked: {
    name: '假面', short: '假面', camp: 'wolf', wolfTeam: false, canSelfExplode: false, poisonImmune: true,
    tagline: '不与狼队见面；第二夜起查验舞池并可置换一名舞池玩家的身份。',
    night: { order: 55, fromNight: 2, script: '假面请睁眼。请指认要查验是否在舞池的玩家，再示意是否使用面具置换。假面请闭眼。', help: '假面免疫女巫毒药；置换后的身份由主持人私下记录。', canSkip: true, targetLabel: '记录假面查验目标' },
  },
  'mech-wolf': {
    name: '机械狼', short: '机械', camp: 'wolf', wolfTeam: false, canSelfExplode: false, lateKnife: true,
    tagline: '不与狼队见面；整局学习一次身份并获得对应技能。',
    night: { order: 3, script: '机械狼请睁眼。今晚是否学习一名玩家的身份？如学习，请指认目标。机械狼请闭眼。', help: '学习后私下告知目标身份；所得技能通常下一夜起可用。学到的技能、次数与其他狼人出局后的刀权写入现场备忘。', canSkip: true, targetLabel: '记录学习目标' },
  },
} satisfies Record<string, RoleMeta>;

export type JingchengRole = keyof typeof JINGCHENG_ROLES;
