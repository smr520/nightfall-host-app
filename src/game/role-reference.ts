import type { Camp, Role } from './roles';
import { EXTRA_REFERENCE_SOURCES, EXTRA_ROLE_REFERENCE } from './extra-role-reference';
import { JINGCHENG_REFERENCE_SOURCES, JINGCHENG_ROLE_REFERENCE } from './jingcheng-role-reference';

/** Reference rules and the app's implementation are deliberately described separately. */
export type RoleReference = {
  timing: string;
  overview: string;
  skills: string[];
  cautions: string[];
  hostNotes: string[];
  automation: 'automatic' | 'partial' | 'manual';
  automationNote: string;
  sourceIds: string[];
  needsTableAgreement?: boolean;
  /** A reference faction may differ from the simplified game engine. */
  camp?: Camp;
};

export const REFERENCE_SOURCES: { id: string; title: string; url: string }[] = [
  { id: 'official-cards', title: '网易《狼人杀》官网角色图鉴', url: 'https://www.langrensha.com/' },
  { id: 'official-card-data', title: '官网角色图鉴公开资料', url: 'https://langrensha.res.netease.com/pc/gw/20190509150909/js/kapaiData_02806e2.js' },
  { id: 'official-fragrance', title: '官方小助手：寻香识命角色与板子说明', url: 'https://www.taptap.cn/moment/380003300654714856' },
  ...EXTRA_REFERENCE_SOURCES,
  ...JINGCHENG_REFERENCE_SOURCES,
];

const official = ['official-cards', 'official-card-data'];

export const ROLE_REFERENCE: Record<Role, RoleReference> = {
  wolf: {
    timing: '每夜狼队行动；白天按桌规自爆',
    overview: '狼人阵营的基础角色，夜间合作，白天隐藏身份。',
    skills: ['每夜由具备刀权的狼队共同确定一名袭击目标。', '白天是否可以自爆、何时自爆，先按本桌规则确认。'],
    cautions: ['特殊狼人不一定与狼队见面，也不一定能自爆；请单独查看该牌。'],
    hostNotes: ['只记录狼队最终确认的刀口；无人被选时明确记录空刀。', '夜间目标、狼队身份和死因只向主持人展示。'],
    automation: 'automatic', automationNote: '可记录刀口、处理基础夜间伤害；白天发言阶段支持普通自爆并推进流程。特殊狼人限制需另核对。', sourceIds: official,
  },
  villager: {
    timing: '白天发言与投票',
    overview: '好人阵营的基础身份，没有主动夜间技能。',
    skills: ['通过公开发言、投票和其他玩家给出的信息寻找狼人。'],
    cautions: ['屠边与屠城影响胜负；村民仍存活不代表神职全部出局后游戏一定继续。'],
    hostNotes: ['夜间不单独唤醒村民。', '按座位和本轮投票资格录入票型，不把弃票当成漏记。'],
    automation: 'automatic', automationNote: '自动维护存活、投票资格，并按本局屠边或屠城规则判断胜负。', sourceIds: official,
  },
  seer: {
    timing: '每夜预言家行动',
    overview: '好人信息角色，查验阵营而非所有角色的具体牌名。',
    skills: ['选择一名其他玩家，获得“好人”或“狼人”的查验结果。'],
    cautions: ['不能查验自己；有特殊查验伪装的变体牌时，须先确认该板规则。'],
    hostNotes: ['将结果仅告知预言家，确认收到后再闭眼。', '公开死亡播报中不得包含查验目标与结果。'],
    automation: 'automatic', automationNote: '按当前角色注册的阵营生成私密查验结果，校验不能自验。特殊牌的伪装或反伤未统一实现。', sourceIds: official,
  },
  witch: {
    timing: '每夜女巫行动，按剩余药量选择',
    overview: '拥有各一瓶的解药和毒药，需要区分本局桌规与参考规则。',
    skills: ['解药用于救当夜狼队袭击目标，毒药用于使指定玩家出局；每瓶整局仅一次。'],
    cautions: ['官网图鉴口径为不能自救、同夜最多使用一瓶；线下变体必须在开局前说清。', '本软件提供自救时机、同夜双药和守救同人的桌规开关。', '特殊角色的免毒、封锁和反伤不能仅靠基础用药结果判断。'],
    hostNotes: ['先核对解药、毒药是否已消耗，再确认目标。', '是否展示刀口以及药用完后的手势口径，开局前统一。'],
    automation: 'automatic', automationNote: '自动校验药量、自救限制、双药限制与基础毒杀；特殊角色交互仍需核对角色说明。', sourceIds: official, needsTableAgreement: true,
  },
  hunter: {
    timing: '满足本局出局触发条件后',
    overview: '好人阵营的出局技能角色，可选择一名玩家开枪带走。',
    skills: ['官网基础口径是被狼刀或被放逐时可发动；可以选择不开枪。'],
    cautions: ['被毒、被技能带走或跟随出局是否能开枪，不能只看“已经死亡”。', '“猎人被毒可开枪”属于本软件可配置桌规，不是所有版本的通用规则。'],
    hostNotes: ['先确认死亡原因和技能资格，再公开身份并处理目标。', '开枪及其引发的后续出局处理完后，再处理警徽与胜负。'],
    automation: 'partial', automationNote: '刀伤或放逐后可开枪，被毒按桌规；跟随出局和被技能带走不会再排入开枪。人工裁定出局仍可由主持人处理技能，其他特殊联动须核对。', sourceIds: official, needsTableAgreement: true,
  },
  idiot: {
    timing: '首次被放逐时',
    overview: '通常也称愚者；被放逐可翻牌免死，翻牌后仍能发言。',
    skills: ['首次放逐时翻牌保留存活状态，同时失去后续投票权。'],
    cautions: ['夜间或其他非放逐原因出局，不能靠翻牌免死。', '是否保留警徽、再次被放逐的处理口径，需要开局先统一。'],
    hostNotes: ['翻牌后记录“已翻牌”，不要误记为夜间死亡。'],
    automation: 'automatic', automationNote: '自动处理首次放逐翻牌、失去投票权，并在本软件流程中处理其警徽。', sourceIds: official, needsTableAgreement: true,
  },
  guard: {
    timing: '每夜守卫行动',
    overview: '保护角色，主要阻挡狼队的基础夜间袭击。',
    skills: ['每夜选择一名玩家守护，阻挡其当夜受到的基础狼刀。'],
    cautions: ['官网图鉴禁止连续两夜守同一人；本桌采用允许连守的变体时，需在赛前开启对应设置。', '守护不等于免疫所有夜间技能；基础守护不能挡毒。', '守救同一人的结果以开局设置为准。'],
    hostNotes: ['核对上一夜目标；本软件可自守或空守。', '只向主持人保留守护对象，公开结果不说被谁保护。'],
    automation: 'automatic', automationNote: '按本桌设置校验是否可连续守同一人，并按守救桌规结算基础狼刀。', sourceIds: official, needsTableAgreement: true,
  },
  'wolf-beauty': {
    timing: '夜间魅惑；符合条件出局后处理跟随',
    overview: '狼人阵营的魅惑角色，被魅惑者通常不知道自己被选中。',
    skills: ['夜间指定魅惑对象；官网图鉴描述的放逐或猎人射击触发后，对象跟随出局且不能发动技能。'],
    cautions: ['被毒、决斗等死亡原因是否触发，必须绑定具体板子。', '自爆、自刀、连续魅惑等限制应先确认，软件未全部强制校验。'],
    hostNotes: ['把魅惑与普通击杀分开记录，不向被魅惑者泄露。', '核对跟随目标是否已死亡，以及跟随出局是否禁用技能。'],
    automation: 'partial', automationNote: '记录魅惑，在放逐或枪类技能出局后处理跟随；被毒、刀伤不触发，跟随者不再发动出局技能，警徽仍需处理。人工裁定可处理例外；骑士等特殊交互未完整实现。', sourceIds: official, needsTableAgreement: true,
  },
  knight: {
    timing: '白天竞选结束后、放逐投票前',
    overview: '主动翻牌决斗的好人角色，决斗对象不能是自己。',
    skills: ['决斗狼人使对方出局并进入夜晚；决斗好人则骑士出局，继续白天原流程。'],
    cautions: ['决斗与其他角色的跟随、出局技能之间的优先顺序需按板子确认。'],
    hostNotes: ['先公开宣布决斗，再核对目标阵营与当天是否进入夜晚。'],
    automation: 'manual', automationNote: '没有专用决斗动作和次数管理；需主持人核对规则并通过人工裁定记录，不能依赖普通放逐替代决斗。', sourceIds: official, needsTableAgreement: true,
  },
  'wolf-king': {
    timing: '满足条件出局后',
    overview: '狼人阵营的出局带人角色，不能与白狼王混用规则。',
    skills: ['符合触发原因时可带走一名玩家；官网图鉴排除被毒与跟随出局。'],
    cautions: ['自爆和特殊死亡原因是否能带人，以本桌板子为准。'],
    hostNotes: ['先识别是狼王还是白狼王，再核对死亡原因。'],
    automation: 'partial', automationNote: '支持出局带人；被毒或跟随出局不触发。人工裁定可处理例外，其他特殊死亡原因仍按本桌版本核对。', sourceIds: official, needsTableAgreement: true,
  },
  'white-wolf-king': {
    timing: '白天自爆时',
    overview: '狼人阵营的自爆带人角色，普通出局不会自动获得带人机会。',
    skills: ['自爆时选择带走一名玩家；非自爆出局不能发动这项技能。'],
    cautions: ['自爆时机、警徽与特殊角色交互，以本桌开局说明为准。'],
    hostNotes: ['先确认白狼王自爆，再处理其带人以及随后产生的死亡技能。'],
    automation: 'automatic', automationNote: '当前仅在白天发言阶段自爆后排入带人；普通狼刀、毒杀或放逐不会触发。特殊交互仍需核对。', sourceIds: official, needsTableAgreement: true,
  },
  gargoyle: {
    timing: '夜间单独查验；符合条件后继承刀权',
    overview: '单独行动的狼人信息角色，通常不与其他狼人互认。',
    skills: ['查验其他玩家的具体身份，不能自验或重复查验。', '官网口径中，其他狼人全部出局后可继承狼队袭击能力。'],
    cautions: ['与狼队互不见面；预言家查验其结果为狼人。'],
    hostNotes: ['私下给出牌名信息，记录已查验名单和刀权是否已转移。'],
    automation: 'automatic', automationNote: '自动记录查验身份，禁止自验和重复查验；不能自爆；其他狼人全部出局后继承刀权。', sourceIds: official, needsTableAgreement: true,
  },
  gravekeeper: {
    timing: '夜间，获知上一白天的放逐信息',
    overview: '好人信息角色，获知上一位被放逐者的阵营。',
    skills: ['夜间获取上一白天被放逐玩家是好人还是狼人的信息。'],
    cautions: ['首夜或上一个白天没有放逐结果时，信息口径需先约定。', '提供的是阵营，不是具体身份；不公开告诉全场。'],
    hostNotes: ['核对放逐记录后单独告知守墓人；不要把狼刀死者当成放逐者。'],
    automation: 'manual', automationNote: '当前夜间流程没有守墓人专用唤醒和信息反馈步骤，需要主持人额外处理。', sourceIds: official, needsTableAgreement: true,
  },
  dreamer: {
    timing: '每夜选择梦游者；天亮处理梦亡',
    overview: '以梦游状态影响夜间伤害的好人角色。',
    skills: ['官网口径中每夜必须选一名梦游者，梦游者免疫夜间伤害。', '连续两夜梦游同一人，或摄梦人夜间出局时，当夜梦游者随之出局。'],
    cautions: ['梦游者不应获知自己被选中；具体保护与梦亡优先级需按板子确认。'],
    hostNotes: ['同时记住上夜与今夜目标，检查摄梦人本夜是否出局。'],
    automation: 'automatic', automationNote: '自动结算梦游免伤、连续两夜同一目标的梦亡，以及摄梦人夜间出局时梦游者随之出局；梦游者不获知被选中。', sourceIds: official, needsTableAgreement: true,
  },
  'red-moon-apostle': {
    timing: '白天自爆；符合条件的放逐后延迟出局',
    overview: '具有封印和特殊出局时机的狼人角色。',
    skills: ['官网图鉴描述自爆后进入夜晚，并封印当晚好人技能。', '作为最后一名被放逐的狼人时，具有延迟到次日天亮后出局的机制。'],
    cautions: ['资料中“赤月使徒”与“血月使徒”命名并存，开局先确认使用的牌面版本。'],
    hostNotes: ['明确封印影响范围、持续夜晚及延迟出局对胜负的影响。'],
    automation: 'partial', automationNote: '当前按普通狼人处理自爆与死亡，额外夜间目标只留记录；封印、延迟死亡和特殊胜负尚未实现。', sourceIds: official, needsTableAgreement: true,
  },
  'hunter-demon': {
    timing: '从第二夜开始狩猎',
    overview: '通过目标阵营决定狩猎结果的好人角色。',
    skills: ['猎中狼人时目标出局；猎中好人时猎魔人出局。', '官网图鉴口径下免疫女巫毒药。'],
    cautions: ['首夜不应按正常狩猎结算；特殊狼人的保护或反伤依板子处理。'],
    hostNotes: ['先核对夜数，再按目标阵营私下记录结算。'],
    automation: 'automatic', automationNote: '第二夜起自动结算狩猎；猎中狼人目标出局，猎中好人自身出局；免疫女巫毒药；猎魔出局不触发死亡技能。', sourceIds: official, needsTableAgreement: true,
  },
  'pure-white': {
    timing: '每夜查验；第二夜起具有查杀效果',
    overview: '能获知具体身份的好人查验角色。',
    skills: ['每夜查验一名玩家的具体身份。', '官网口径中从第二夜起，查验到狼人会使该狼人出局。'],
    cautions: ['不要把普通预言家的阵营反馈套用于纯白之女。', '与狼巫同时查验导致出局时，按所选板子的结算先后执行。'],
    hostNotes: ['私下告知具体牌名，并区分首夜与后续夜晚的伤害效果。'],
    automation: 'automatic', automationNote: '自动显示具体身份；第二夜起查验到狼人会在天亮结算出局，查验致死不触发死亡技能。', sourceIds: official, needsTableAgreement: true,
  },
  'wolf-shaman': {
    timing: '每夜查验；第二夜起可查杀纯白之女',
    overview: '狼人阵营的信息角色，查验范围和普通狼刀不同。',
    skills: ['官网口径中可查验非狼人阵营玩家的具体身份。', '第二夜起查验到纯白之女会使其出局。'],
    cautions: ['不能把任意存活座位都视为合法查验目标。'],
    hostNotes: ['核对目标阵营、夜数，以及与纯白之女的交互。'],
    automation: 'automatic', automationNote: '限制为非狼人目标并显示具体身份；第二夜起查验到纯白之女会在天亮结算出局。', sourceIds: official, needsTableAgreement: true,
  },
  nightmare: {
    timing: '每夜其他角色行动前',
    overview: '以恐惧阻止目标当晚行动的狼人角色。',
    skills: ['恐惧一名玩家使其当夜无法行动；若目标是狼人，官网口径中整队无法袭击。', '不能连续两夜恐惧同一目标。'],
    cautions: ['首夜先恐惧再与狼队确认身份；恐惧对被动技能的影响按板子约定。'],
    hostNotes: ['先确认恐惧对象，再决定后面的角色能否行动，不要仅照常录目标。'],
    automation: 'automatic', automationNote: '自动结算恐惧：目标当夜主动技能失效；恐惧狼人时整队无法袭击；禁止连续两夜恐惧同一目标。', sourceIds: official, needsTableAgreement: true,
  },
  'time-wolf-consort': {
    timing: '夜间先手封锁；生效后的次夜起失去技能',
    overview: '将针对封锁对象的特定好人技能转回施放者的狼人角色。',
    skills: ['好人对封锁目标使用查验、毒药或守护时，官网口径视为对技能使用者自身生效。', '技能生效后，下一夜永久失去封锁能力。'],
    cautions: ['封锁是效果转向，不能简单当作“目标的所有技能失效”。', '是否生效与失去能力的判断需记录完整。'],
    hostNotes: ['逐项核对原始目标、实际受效者与本夜是否已触发生效。'],
    automation: 'partial', automationNote: '仅记录封锁目标；未实现效果转向和能力永久失效管理。', sourceIds: official, needsTableAgreement: true,
  },
  'sequence-prince': {
    timing: '白天第一次放逐投票结束后',
    overview: '每局一次改变放逐投票进程的好人角色。',
    skills: ['翻牌回到该次投票之前，额外发言后重新投票，每局限一次。'],
    cautions: ['不是任意修改某一张票，也不等于平票 PK；技能消耗需单独记录。'],
    hostNotes: ['保留原票型，明确宣布重投及新的投票资格。'],
    automation: 'manual', automationNote: '没有专用重投和技能次数管理；撤销只是操作恢复，不能当成已完整实现该技能。', sourceIds: official, needsTableAgreement: true,
  },
  'magic-mirror': {
    timing: '每夜查验',
    overview: '好人阵营的具体身份查验角色。',
    skills: ['官网图鉴描述每夜查验一名玩家的具体身份。'],
    cautions: ['不能只反馈好人或狼人；未核实的“镜像替身”等效果不能自行附加。'],
    hostNotes: ['单独告知目标牌名，避免在公开记录中泄露。'],
    automation: 'partial', automationNote: '记录查验目标，在私密提示显示目标牌名；其他特殊角色的身份伪装与交互仍需主持人核对。', sourceIds: official,
  },
  'awakened-hidden-wolf': {
    timing: '模仿与独立行动按板子规则处理',
    overview: '与其他狼队成员不互认，可通过模仿获得目标身份及技能。',
    skills: ['官网图鉴描述不能自爆、不参与其他狼人的夜间讨论与袭击。', '选择模仿目标后获知其身份，并在该夜结束后获得目标技能；其他狼人出局后有独立袭击机制。'],
    cautions: ['模仿次数、技能池、获得技能后的具体用法须结合对应版本说明。', '不要因软件把它归为狼人，就让其提前参加狼队行动。'],
    hostNotes: ['分别记录模仿对象、获得能力的时间和独立刀权。'],
    automation: 'partial', automationNote: '可记录模仿目标，并禁止自爆；狼队参与限制、技能复制、次数或独立刀权仍需主持人管理。', sourceIds: official, needsTableAgreement: true,
  },
  'miracle-merchant': {
    timing: '夜间先行动；整局送出技能一次',
    overview: '选择其他玩家作为幸运儿，并赠送一种一次性技能。',
    skills: ['从查验、毒药、守护三类能力中选一种赠予幸运儿。', '若选中狼人，官网口径中对方不得能力，商人在次日出局。'],
    cautions: ['官网图鉴允许未使用前在夜间行动，不是只能首夜送技能。', '幸运儿是被赋予的状态，不应再额外占用一张独立身份牌。'],
    hostNotes: ['记录幸运儿原身份、赠送技能、使用时机、是否已消耗和商人结算。'],
    automation: 'partial', automationNote: '当前仅首夜记录一个目标；没有技能类型、赠送次数、幸运儿能力或选狼反噬结算。', sourceIds: official, needsTableAgreement: true,
  },
  'lucky-one': {
    timing: '获得商人赠予后，依所获技能行动',
    overview: '幸运儿是角色获得的附加能力状态，不是另一张基础身份牌。',
    skills: ['由奇迹商人选中后，按规则获得一次性查验、毒药或守护。'],
    cautions: ['获得能力不会自动改变其原阵营；被选中的狼人按商人规则处理。', '仅写“幸运儿”会丢失原身份与阵营，不能据此判断胜负。'],
    hostNotes: ['原身份牌与附加技能要分别记录，使用后标明已消耗。'],
    automation: 'manual', automationNote: '幸运儿只作为附加状态说明，不单独配入座位；赠予能力和消耗仍需主持人另行记录，不能据此自动完成商人板全部结算。', sourceIds: official, needsTableAgreement: true,
  },
  'evil-knight': {
    timing: '夜间被查验或被用毒时触发反伤',
    overview: '版本待确认：软件现名“恶灵骑士”，官网图鉴列名“恶夜骑士”，应以实物牌面为准。',
    skills: ['官网恶夜骑士与狼队一同行动，不能自爆且不在夜间出局。', '拥有一次反伤：被预言家查验或被女巫用毒，会使对应技能使用者出局。'],
    cautions: ['需确认牌名是否为同一角色，以及反伤次数、优先顺序与特殊技能交互。'],
    hostNotes: ['先核对牌面版本；记录是否触发、由谁触发以及反伤是否已用。'],
    automation: 'manual', automationNote: '没有夜间免死、反伤或次数管理；当前基础狼刀、毒药与查验仍会照常处理，不能据此自动主持该牌。', sourceIds: official, needsTableAgreement: true,
  },
  'lone-girl': {
    timing: '首夜选择崇拜对象',
    overview: '依附崇拜对象胜负的特殊阵营角色，不宜固定视为普通好人。',
    skills: ['首夜私下选定一名崇拜对象，获胜条件与该对象一致。', '双方不因崇拜关系自动获知彼此的身份或关系。'],
    cautions: ['其阵营、获胜归属和屠边计数需按具体板子说明确认。'],
    hostNotes: ['保密记录崇拜对象，结束时单独核对其胜负归属。'],
    automation: 'partial', automationNote: '能记录首夜对象，但当前引擎固定当好人处理，无法按崇拜对象判胜；不具备第三方胜负结算。', sourceIds: official, needsTableAgreement: true, camp: 'third',
  },
  'sun-eater': {
    timing: '从第二夜开始吞噬并使用能力',
    overview: '夺取好人技能并使原使用者当夜失去技能的狼人角色。',
    skills: ['选择一名好人，获得其能力并可当夜使用；目标当夜失去该能力直到天亮。', '不能连续两夜吞噬同一名玩家。'],
    cautions: ['吞噬不是普通攻击；获得能力的具体次数和交互应按对应版本解释。'],
    hostNotes: ['分别记录被吞噬者、借用技能的实际目标以及原使用者当夜是否被禁用。'],
    automation: 'partial', automationNote: '仅记录一个吞噬目标；未限制第二夜、好人目标和连续选择，也无能力转移或禁用结算。', sourceIds: official, needsTableAgreement: true,
  },
  'light-earl': {
    timing: '从第二夜开始庇护其他玩家',
    overview: '以流光庇护阻挡多类夜间伤害的好人角色。',
    skills: ['每夜选一名其他玩家提供夜间免伤，官网口径包括毒药与梦游伤害。', '不能连续两夜庇护同一目标。'],
    cautions: ['不能自保，首夜不行动；不要把其保护范围等同于普通守卫。'],
    hostNotes: ['核对夜数、前夜目标，以及本夜所有伤害来源。'],
    automation: 'automatic', automationNote: '第二夜起自动庇护，挡狼刀、毒药与梦亡；禁止自保和连续两夜庇护同一目标。', sourceIds: official, needsTableAgreement: true,
  },
  'fragrance-shadow': {
    timing: '首夜获得一名狼同伴信息；每夜缠绕两人',
    overview: '通常独立于狼队行动，以两名玩家之间的跟随出局关系发挥作用。',
    skills: ['官方角色说明中不能自爆，首夜获知随机一名其他狼人的座位。', '每夜缠绕两名玩家，其中一人出局时另一人跟随，触发跟随的能力整局限一次。', '其他狼人全部出局后，按规则加入狼队获得刀权。'],
    cautions: ['缠绕必须记录两个人；跟随触发条件、持续时机与特殊技能交互请对照本桌说明。'],
    hostNotes: ['分开记录狼同伴信息、缠绕双方、跟随机会是否耗尽和刀权状态。'],
    automation: 'partial', automationNote: '当前只能录一个目标；没有双目标缠绕、跟随次数、信息反馈、独立狼队或刀权管理。', sourceIds: ['official-fragrance'], needsTableAgreement: true,
  },
  'awakened-wolf-king': {
    timing: '夜间可传授狼王爪；持有者满足条件出局时发动',
    overview: '以两次狼王爪及传授机制为核心的狼人角色。',
    skills: ['官网图鉴描述拥有两次狼王爪，可夜间将一次传给存活狼队友。', '持爪者出局后可选择一名玩家一同出局；觉醒狼王可自爆与自刀。'],
    cautions: ['传授、持有次数、不同死亡原因能否触发，需要完整板子规则。', '不要直接按普通狼王的一次出局技能处理整局。'],
    hostNotes: ['逐次记录技能归属、是否已传授与每名持有者的剩余次数。'],
    automation: 'partial', automationNote: '当前只按简化出局带人处理；没有两次狼王爪、传授流程与持有者状态管理。', sourceIds: official, needsTableAgreement: true,
  },
  ...EXTRA_ROLE_REFERENCE,
  ...JINGCHENG_ROLE_REFERENCE,
};
