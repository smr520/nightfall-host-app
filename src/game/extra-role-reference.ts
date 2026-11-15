import type { RoleReference } from './role-reference';
import type { ExtraRole } from './extra-roles';

export const EXTRA_REFERENCE_SOURCES = [
  { id: 'official-wolf-plan-2026', title: '网易官方：狼王计划板子配置与玩法（2026-08-11）', url: 'https://langrensha.com/news/activity/20260811/26906_1310700.html' },
  { id: 'official-awakened-knight-2026', title: '网易官方：觉醒骑士技能与完整配置（2026-08-11）', url: 'https://langrensha.com/news/activity/20260811/26906_1310699.html' },
  { id: 'official-salon-2026', title: '网易官方：沙龙之夜配置、咒狐胜负与角色交互（2026-03-06）', url: 'https://langrensha.com/news/official/20260306/26904_1289873.html' },
  { id: 'official-league-2026', title: '网易官方：门派联赛第七赛季参赛及规范规则（2026-04-13）', url: 'https://langrensha.com/20260413/31014_1295775.html' },
];

const plan = ['official-wolf-plan-2026'];
const salon = ['official-salon-2026'];

/** Confirmed details are separate from missing card text and from actual automation. */
export const EXTRA_ROLE_REFERENCE: Record<ExtraRole, RoleReference> = {
  'moon-seer': {
    timing: '夜间幻境查验；完整轮次和目标限制须先核对彩蛋牌',
    overview: '狼王计划中的彩蛋预言家，官方公告明确其特色为幻境查验。',
    skills: ['通过幻境查验获取信息，与普通预言家直接返回好人或狼人的查验形式不同。', '作为月神预言家身份占一个神职座位，不额外叠加普通预言家座位。'],
    cautions: ['当前可读官方公告未列出幻境的目标数量、生成方式、反馈格式及次数，不据功能名补造细则。', '先核对完整彩蛋牌面；不能把普通预言家的结果当成月神查验结果。'],
    hostNotes: ['开局前写清幻境查验口径和行动次序；夜间私下记录全部选择与反馈。', '软件只保留一个主要目标，其余目标和结果需主持人写入私密记录。'],
    automation: 'manual', automationNote: '仅提供身份、资料和夜间主要目标记录；不生成幻境或查验结果，完整技能与特殊交互由主持人裁定。', sourceIds: plan, needsTableAgreement: true,
  },
  'venom-witch': {
    timing: '毒印施加与连锁引爆窗口；完整时机须先核对彩蛋牌',
    overview: '狼王计划中的彩蛋女巫，官方公告明确其特色为毒印连锁引爆。',
    skills: ['以毒印关系产生连锁引爆效果，与普通女巫单目标毒药不同。', '作为独立的毒印女巫身份占一个神职座位。'],
    cautions: ['公告没有完整披露毒印数量、消耗、触发窗口和解药规则，不能自行附加普通女巫的一解一毒限制。', '不能把一条主要目标记录当成已经维护全部毒印与连锁。'],
    hostNotes: ['逐项记录毒印持有者、关联关系、引爆选择与实际出局名单。', '先完成连锁和其他保护交互的人工核对，再确认天亮名单。'],
    automation: 'manual', automationNote: '不使用基础女巫药量或毒杀结算；只可记录主要目标，毒印、连锁和药量由主持人维护。', sourceIds: plan, needsTableAgreement: true,
  },
  'marksman-hunter': {
    timing: '狙击发动窗口须先核对百步猎人彩蛋牌',
    overview: '狼王计划中的彩蛋猎人，官方公告将其特色概括为狙击狼人。',
    skills: ['具有针对狼人的狙击能力，是百步猎人的独立牌面能力。'],
    cautions: ['公告没有明确完整发动窗口、目标判断、次数或未命中处理，不能仅凭“猎人”二字套用基础猎人死亡技能。'],
    hostNotes: ['开局前确认何时可以狙击、如何核对目标和是否消耗次数。', '使用人工裁定记录狙击结果，并单独记录技能消耗。'],
    automation: 'manual', automationNote: '没有专用狙击动作、资格和次数管理，不自动排入普通猎人开枪队列。', sourceIds: plan, needsTableAgreement: true,
  },
  'assassin-white-wolf-king': {
    timing: '精准刺杀的发动窗口须先核对刺客白狼王彩蛋牌',
    overview: '狼王计划中的彩蛋白狼王，官方公告明确其具有精准刺杀能力。',
    skills: ['属于狼人阵营，使用独特的刺杀能力改变对局。'],
    cautions: ['公告没有完整披露刺杀窗口、目标条件、次数和出局技能交互，不等同普通白狼王自爆带人。', '软件未开放该牌的普通自爆按钮，是当前操作支持范围，不是声称该身份不能自爆。'],
    hostNotes: ['开局前核对刺杀完整牌文与狼队共同活动口径。', '主持人处理刺杀、自爆、后续出局技能和日夜切换，并用裁定或备注留痕。'],
    automation: 'manual', automationNote: '可登记狼人身份；不自动发动刺杀或套用普通白狼王带人，特殊结果由主持人裁定。', sourceIds: plan, needsTableAgreement: true,
  },
  'vortex-villager': {
    timing: '白天投票相关窗口；完整时机须先核对彩蛋牌',
    overview: '狼王计划中的平民变体，拥有操控全场投票的特殊能力。',
    skills: ['官方公告将操控全场投票列为本板彩蛋能力之一。', '身份类型仍是平民；统计阵容及屠边时与普通平民合计，不因有技能转为神职。'],
    cautions: ['公告没有给出具体改票方式、次数及发动顺序；不能把操作撤销当成角色技能。'],
    hostNotes: ['开局前确认操控投票方式、宣布内容与消耗次数。', '保留原票型、技能声明和最终票型，按确认的规则进行主持人裁定。'],
    automation: 'manual', automationNote: '登记为平民变体；不自动改变票数、投票权或重新投票，技能由主持人处理。', sourceIds: plan, needsTableAgreement: true,
  },
  'awakened-guard': {
    timing: '夜间保护行动；完整目标限制和持续时间须核对觉醒牌',
    overview: '狼王计划与觉醒骑士官方完整阵容中出现的觉醒守卫，必须与普通守卫区分。',
    skills: ['作为觉醒版本的守卫神职参与夜间保护。', '此身份单独占座；不会同时额外生成一名普通守卫。'],
    cautions: ['现有两份阵容公告没有披露完整觉醒守护牌文，不能自行把普通守卫的连守、毒药免疫或守救冲突规则移植过来。'],
    hostNotes: ['开局前核对觉醒牌面的保护次数、目标范围、连续选择和伤害类型。', '记录全部受保护者及保护状态，天亮前人工核对各伤害来源。'],
    automation: 'manual', automationNote: '仅记录主要保护目标；不使用基础守卫保护和连守结算，觉醒保护及持续状态由主持人维护。', sourceIds: ['official-wolf-plan-2026', 'official-awakened-knight-2026'], needsTableAgreement: true,
  },
  'awakened-knight': {
    timing: '白天放逐发言阶段，可随时翻牌决斗',
    overview: '可连续决斗的好人神职，决斗错误时会连同目标一起出局。',
    skills: ['选择场上一名玩家决斗；目标为狼人时，目标出局，觉醒骑士可选择继续决斗。', '停止继续决斗后，当前所有出局玩家发表遗言并入夜。', '决斗目标是好人时，觉醒骑士与目标同时出局，当前出局玩家发表遗言后继续白天原发言流程。', '每名玩家只能被决斗一次。'],
    cautions: ['不是普通骑士的一次决斗；不能用普通放逐代替决斗。', '目标重复限制、连续决斗和出局联动需逐次核对，先完成技能处理再确认胜负。'],
    hostNotes: ['记录已决斗座位，成功后询问是否继续；结束时照读遗言与日夜去向。', '失败时同时记录骑士和目标出局，保留原发言位置。'],
    automation: 'manual', automationNote: '没有专用连续决斗、重复目标拦截或技能日夜切换；由主持人裁定出局并记录下一阶段。', sourceIds: ['official-awakened-knight-2026'], needsTableAgreement: true,
  },
  'awakened-wolf-beauty': {
    timing: '替代出局技能触发时；具体行动窗口须核对觉醒牌',
    overview: '觉醒版本的狼美人，以替代出局机制区别于普通狼美人的跟随出局。',
    skills: ['官方门派联赛对“发动技能使神职替代出局”单列记分。', '沙龙之夜官方说明确认存在觉醒狼美人替死出局，摄梦人的梦游可以保护此类伤害。'],
    cautions: ['以上资料未给出完整替死目标范围、次数与全部触发死因，不将普通魅惑规则当觉醒牌全文。', '软件暂未开放直接自爆操作，不等于牌面规则宣称禁止。'],
    hostNotes: ['单独记录替代关系、触发原因与剩余次数，不把它误记为普通狼美人殉情。', '先核对摄梦人等保护及实际受效者，再填写死亡名单。'],
    automation: 'manual', automationNote: '仅记录主要相关目标，不自动替代出局、消耗次数或触发普通狼美人跟随。', sourceIds: ['official-salon-2026', 'official-league-2026'], needsTableAgreement: true,
  },
  'awakened-seer': {
    timing: '夜间查验；完整目标形式须核对觉醒牌',
    overview: '沙龙之夜中的觉醒信息角色，不能简单复用普通预言家的查验结果。',
    skills: ['沙龙之夜官方说明中，觉醒预言家查验到咒狐会令咒狐出局。', '如果该次查验被蚀时狼妃反弹，则咒狐不会因这次查验出局。'],
    cautions: ['本次资料没有完整披露通常查验的目标数量、信息格式和次数；不得自行补成普通单人阵营查验。', '查验引发出局与普通信息反馈是两个不同的结算步骤。'],
    hostNotes: ['按核对的觉醒牌文私下告知信息，并记录原目标、反弹与真正受效者。', '涉及咒狐时，结算查验、封锁、梦游保护后再确认出局与第三方胜负。'],
    automation: 'manual', automationNote: '只记录主要查验目标；不生成觉醒查验信息或查杀咒狐，特殊交互由主持人处理。', sourceIds: salon, needsTableAgreement: true,
  },
  fox: {
    timing: '夜间被狼刀或查验时；任一主阵营清空后核对第三方胜负',
    overview: '独立于好人与狼人的第三方身份；沙龙之夜采用明确的咒狐胜利优先规则。',
    skills: ['被狼人夜间选中不会出局；被预言家查验会出局。', '沙龙之夜中魔镜少女找到咒狐不使其出局，觉醒预言家或幸运儿查验可以令其出局。', '沙龙之夜中可以获得奇迹商人的幸运儿能力，摄梦人的梦游可保护其查验出局伤害。', '沙龙之夜中，好人或狼人任一方全部出局时咒狐仍在场，则咒狐胜利；咒狐出局后才由另外两阵营清空对方取胜。'],
    cautions: ['咒狐与动物牌子狐是不同身份，不可共用角色或技能。', '上述完整胜负是沙龙之夜公告口径；不能无提示套用普通屠边、狼人数或好人计数。'],
    hostNotes: ['分别核对刀伤、查验者身份、反弹和保护，不能看到查验记录就直接判死。', '在天亮与白天出局连锁结束后人工核对三方胜负。'],
    automation: 'automatic', automationNote: '自动结算狼刀免疫、普通预言家查验致死，以及一方阵营清空时的咒狐胜利；其他特殊查验交互按对应角色处理。', sourceIds: ['official-card-data', 'official-salon-2026'], needsTableAgreement: true, camp: 'third',
  },
};
