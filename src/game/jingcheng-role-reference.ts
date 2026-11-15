import type { RoleReference } from './role-reference';
import type { JingchengRole } from './jingcheng-roles';

export const JINGCHENG_REFERENCE_SOURCES = [
  { id: 'jingcheng-s15-treasure-post', title: '京城 S15《盗宝大师》公开规则图及问答', url: 'https://www.sina.cn/news/detail/5062652760689279.html' },
  { id: 'jingcheng-s15-treasure-image', title: '京城 S15·天空之城原始配置与技能图', url: 'https://wx3.sinaimg.cn/middle/4c0fb4baly1hs8mqybrzaj25ea2qs1kz.jpg' },
  { id: 'jingcheng-qingqiu-2026', title: '京城大师赛《青丘夜影》板型介绍（2026-09-11 版本）', url: 'https://www.sina.cn/news/detail/5339887734885313.html' },
  { id: 'jingcheng-masquerade', title: '京城大师赛《假面舞会》板子规则详解（转载）', url: 'https://www.233leyuan.com/post-detail/2066966750562693120' },
  { id: 'lal-mech-wolf', title: 'LAL 规则库：机械狼通灵师', url: 'https://werewolves.games/ji-xie-lang/' },
];
const treasure = ['jingcheng-s15-treasure-post', 'jingcheng-s15-treasure-image'];
const qingqiu = ['jingcheng-qingqiu-2026'];
const masquerade = ['jingcheng-masquerade'];

export const JINGCHENG_ROLE_REFERENCE: Record<JingchengRole, RoleReference> = {
  medium: {
    timing: '每夜独立查验阶段', overview: '京城大师赛常用的信息神职（机械狼通灵师、盗宝大师），查验反馈为具体身份。',
    skills: ['选择一名玩家，由主持人私下反馈其具体身份。', '盗宝大师版：验到盗宝大师时，反馈盗宝大师当夜选择的身份。'],
    cautions: ['借用通灵师的盗宝大师在自己的阶段查验，不在通灵师阶段重复行动。', '机械狼学习后被查验的反馈口径，以本桌采用的版本为准。'],
    hostNotes: ['先收齐盗宝大师或机械狼的当夜状态，再按本桌夜序反馈。', '查验结果属于私密信息。'],
    automation: 'partial', automationNote: '记录查验目标并在私密提示显示目标牌名；盗宝大师的借用身份、机械狼的学习状态由主持人核对。', sourceIds: [...treasure, 'lal-mech-wolf'],
  },
  poisoner: {
    timing: '夜间选择是否使用整局唯一毒药', overview: '只有一瓶毒药的独立身份，不是带解药的女巫。',
    skills: ['整局可在夜间毒杀一名玩家。', '本版被毒杀的猎人或狼王不能发动出局技能。'],
    cautions: ['没有解药，不套用女巫的解药余量或自救设置。', '梦游者的当夜免伤可能使毒药不造成出局；先处理保护再确认实际名单。'],
    hostNotes: ['在现场备忘标记药已使用；软件暂不自动扣除毒师药量。', '天亮复核以毒药死因录入实际出局，避免误发猎人或狼王技能。'],
    automation: 'automatic', automationNote: '自动记录毒药目标、整局一瓶的限制，并在天亮结算中毒出局；被毒的猎人与狼王不会发动技能。梦游免伤同样自动生效。', sourceIds: treasure,
  },
  raven: {
    timing: '按赛前确认的牌面在夜间行动', overview: '原始配置图明确列入的神职，须绑定本桌实际使用的乌鸦技能牌。',
    skills: ['本软件保留独立乌鸦行动及目标记录，不把乌鸦替换为其他神职。'],
    cautions: ['本次可核实的公开配置图未给出完整乌鸦技能，不能据此断言加一票、加两票或连续目标限制。', '开局前在补充约定写明票数、公布时机和限制，按实际牌面执行。'],
    hostNotes: ['将效果和次数写入现场备忘；计票系统不自动增加乌鸦票。', '涉及其技能的结果由主持人核对后裁定，不能拿普通玩家的额外投票冒充技能。'],
    automation: 'manual', automationNote: '只有独立行动和目标记录；额外票权与计票结果暂由主持人处理。', needsTableAgreement: true, sourceIds: treasure,
  },
  'treasure-master': {
    camp: 'third', timing: '首夜获知底牌；每夜在自己的独立阶段行动', overview: '京城 S15《天空之城》版本的可变阵营身份。第三方标记仅提示阵营待定，并不表示固定单独获胜。',
    skills: ['首夜获知三张底牌。底牌有狼人身份则归狼人，否则归好人。', '为狼人时，其他狼同伴全部出局后取得击杀能力。为好人时，底牌中神多算神、民多算民。', '每夜选一张底牌并使用其技能，连续两夜不能选同一张；始终在盗宝大师阶段执行。'],
    cautions: ['盗宝大师必须入座，不得成为底牌。底牌最多一狼，不能三神或三民。', '通灵师反馈其当夜借用身份。盗宝摄梦隔夜重复目标不梦亡；梦游者免疫夜间伤害，包括毒师的毒。', '盗宝摄梦当晚吃刀或吃毒，其梦游的猎人或狼王不能发动技能。'],
    hostNotes: ['赛前仅主持人查看底牌及阵营，赛中逐夜记录借用身份和上夜身份。', '狼同伴、神民边界、继承刀权、借用技能次数和胜负由主持人确认。'],
    automation: 'automatic', automationNote: '自动记录底牌与阵营、禁止连续两夜借同一张，并在天亮结算借用的摄梦保护、毒师毒药与通灵师身份反馈；继承刀权、借用次数和胜负自动处理。', sourceIds: treasure, needsTableAgreement: true,
  },
  'nine-tails': {
    timing: '每夜标记；白天自身发言阶段可发动猎杀时刻', overview: '青丘夜影的狼人阵营核心，独立于狼队行动，通过标记积累人数后一次性清场。',
    skills: ['每夜必须标记一名玩家；警徽与放逐投票中九尾投给谁，谁也获得一个标记。标记为隐藏状态，重复标记无额外效果。', '猎杀时刻：白天自己发言时举手发动。若“九尾 + 存活的被标记者”多于其余存活玩家，后者全部出局并入夜；否则无事发生。', '免疫女巫毒药；其他三名狼人全部出局后获得刀权。'],
    cautions: ['平票 PK 只计最后一次投票带来的标记。', '因猎杀时刻出局的玩家不能发动技能，白泽也不能传承。', '法官只结算发动成功的情况。'],
    hostNotes: ['在现场备忘逐夜记录标记名单，并把投票标记一并记入。', '猎杀时刻成功后，用“人工裁定”逐个改为出局，再在“更多”中手动推进或结束。'],
    automation: 'automatic', automationNote: '自动累计夜间标记与投票标记、判定猎杀时刻并结算 B 方出局（不能发动技能），免疫毒药、其他狼全灭后自动进入狼刀。', sourceIds: qingqiu, needsTableAgreement: true,
  },
  baize: {
    timing: '每夜清除标记；夜间死亡或被放逐时传承', overview: '青丘夜影的好人神职，负责清除九尾的标记，并能把身份传承给继承人。',
    skills: ['每夜选择一名玩家，清除其所有标记（无标记则无事发生）。', '传承（强制）：夜间死亡或被放逐时翻牌指定一名存活玩家为继承人。继承人为平民则成为神民双阵营；为神职则夜间出局后仍可参与当天发言和投票；为狼人或九尾则无事发生。'],
    cautions: ['白泽作为最后一神或被猎杀时刻清除出局后不能传承。', '传承后继承人不再拥有清除技能。'],
    hostNotes: ['记录继承人座位及其类型，屠边计算时把平民继承人同时算作神民。', '神职继承人夜间出局后，等投票流程全部结束再正式确认离场。'],
    automation: 'automatic', automationNote: '自动清除标记；白泽出局时进入传承流程，平民继承人按神民双阵营计胜负，神职继承人夜间出局会延迟到投票结束离场。', sourceIds: qingqiu, needsTableAgreement: true,
  },
  dancer: {
    timing: '第二夜起每夜行动，先于狼队', overview: '假面舞会的好人核心，用舞池让阵营人数少的一方出局。',
    skills: ['从第二夜开始，每晚选择三名玩家共舞；天亮时舞池中人数较少的阵营玩家出局。', '每名玩家只能进一次舞池。舞者自己在舞池时，当晚舞池玩家免疫狼刀，舞者免疫女巫毒药。'],
    cautions: ['舞池按阵营人数比较，平局如何处理需在赛前约定。', '假面的置换会改变舞池内的实际身份，结算前先核对。'],
    hostNotes: ['在现场备忘记录每晚三名舞池玩家与已进过舞池的名单。', '天亮复核时把舞池出局者加入名单，原因选“主持裁定”。'],
    automation: 'automatic', automationNote: '自动校验三名舞池玩家与整局进场限制，天亮结算少数阵营出局、舞池免疫狼刀与舞者免毒；平票时留待人工复核。', sourceIds: masquerade, needsTableAgreement: true,
  },
  masked: {
    timing: '第二夜起，在狼队之后行动', overview: '假面舞会的狼人阵营特殊角色，与其他狼人不见面，能偷换舞池中的身份。',
    skills: ['从第二夜开始，每晚先查验一名玩家是否在舞池。', '随后可用面具置换一名舞池玩家的身份。假面免疫女巫毒药。'],
    cautions: ['置换会影响舞池的阵营比较与之后的查验结果，需逐夜留痕。'],
    hostNotes: ['私下记录查验结果和置换前后的身份。', '天亮前与舞者的舞池名单一起核对。'],
    automation: 'partial', automationNote: '自动记录查验目标并显示其是否在舞池、第二夜起唤醒；面具置换身份仍由主持人记录。', sourceIds: masquerade, needsTableAgreement: true,
  },
  'mech-wolf': {
    timing: '每夜最先睁眼，整局学习一次', overview: '机械狼通灵师板的狼人阵营核心，不进狼窝，学习一名玩家的身份并继承其技能。',
    skills: ['夜间可学习一名玩家，得知其身份并获得对应技能；学习当夜通常不能立即使用。', '学通灵师得查验，学女巫得一瓶毒药（无解药），学守卫得守护，学猎人得开枪，学平民则相当于隐狼。', '其他狼人全部出局后获得刀权。'],
    cautions: ['京城机械狼与网易“觉醒隐狼”规则有差异，不能直接互换。', '学到技能后的次数、守护能否挡毒等细则在不同赛事中不同，开局前写入补充约定。'],
    hostNotes: ['私下记录学习目标、获得的技能和剩余次数。', '机械狼使用学到的技能时，把结果在天亮复核中一并处理。'],
    automation: 'partial', automationNote: '自动记录学习目标与身份、其他狼全灭后进入狼刀；学到猎人时自动获得出局开枪，学到守卫或女巫的技能使用仍由主持人处理。', sourceIds: ['lal-mech-wolf'], needsTableAgreement: true,
  },
};
