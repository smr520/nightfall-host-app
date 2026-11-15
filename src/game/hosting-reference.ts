import { callTitle } from './boards';
import { callIsActive } from './engine';
import { isNightStage } from './host-ui';
import type { Game } from './types';
import { tableRules } from './table-rules';
import { hasLastWordsPolicy } from './last-words';

export const HOSTING_STEPS: { id: string; title: string; description: string; checks: string[] }[] = [
  { id: 'prepare', title: '开局确认', description: '先统一阵容、桌规和座位，再按本桌约定进入夜晚。', checks: ['核对人数、角色与实际发出的身份牌。', '身份可在发牌后自行看牌，或采用“夜间行动流程：确认即行动”；后者不增加开局逐座核对步骤。', '向全桌说明警长顺序、胜负条件、女巫用药和猎人限制；图鉴介绍不替代本桌约定。'] },
  { id: 'night', title: '夜间行动流程', description: '按本局角色生成的顺序依次唤醒、确认身份或阵营、执行技能、闭眼，再进入下一个角色。', checks: ['主持词可以念，刀口、身份和技能目标只供主持人核对。', '采用“确认即行动”时，轮到某角色就在这一步显示对应座位号；先确认身份或阵营，再立即执行技能，闭眼并完成该步后自动记入身份记录。', '已出局角色默认保留空唤醒口播，念完直接继续；只有主持人明确关闭时才跳过。', '每步明确选择目标或空过；仅首夜角色仍只在首夜行动。仅记录目标的特殊技能需要现场复核，不能把记录等同于自动结算。'] },
  { id: 'dawn', title: '天亮与首日竞选', description: '按开局桌规决定先竞选还是先公布昨夜结果。', checks: ['先核对私密预览，公开时只念出局座位，不念死因或查验结果。', '先竞选的桌规：完成竞选后再确认公布，未公布死者仍可参与竞选。', '先公布的桌规：先处理死亡技能、警徽和胜负，再由存活玩家竞选。'] },
  { id: 'discussion', title: '白天发言', description: '现场确认发言顺序和本轮特殊技能，再进入放逐投票。', checks: ['由主持人或警长按桌规指定发言方向。', '白天发言可按座位计时；赛前开启的遗言策略命中后，软件会生成独立队列并逐座位处理。', '特殊结算使用人工裁定时填写理由，便于事后核对。'] },
  { id: 'vote', title: '放逐记录', description: '放逐可按本桌节奏逐人录票，或直接记录最终被票出的座位。', checks: ['警长竞选始终逐人记录；警长加权仅用于逐人放逐投票。', '快速放逐只记录最终结果，不计算票型、平票或 PK；死亡技能、遗言、警徽和胜负仍正常处理。', '逐人放逐的平票政策可设为 PK 一轮或无人出局；PK 候选人不投本轮 PK。'] },
  { id: 'resolve', title: '技能与警徽', description: '先处理待结算的出局技能，再处理警徽，最后核对胜负。', checks: ['猎人是否被毒可开枪按本局开关执行；其余特殊触发条件须核对本桌版本。', '警徽只能交给存活且未翻牌白痴的玩家，也可以撕毁。', '仍有死亡技能或警徽待处理时，先完成队列，再进入下一环节。'] },
  { id: 'review', title: '结束与复盘', description: '确认胜方和结束原因后，再公开身份并查看完整时间线。', checks: ['普通胜负按屠边或屠城计算；特殊胜负由主持人核对。', '提前结束需写明原因。', '复盘含私密身份和夜间信息，分享前确认所有人已结束游戏。'] },
];

export const BASIC_RULES: { id: string; title: string; paragraphs: string[] }[] = [
  { id: 'scope', title: '规则口径', paragraphs: ['本页说明本软件现有流程与默认规则，不代表所有赛事、门店和角色版本都完全相同。开局前以“桌规”页面确认本局约定。', '软件支持 6–16 人阵容，至少有狼人、村民和一种神职。角色图鉴覆盖当前可选角色；有介绍不代表特殊技能均已自动实现。'] },
  { id: 'win', title: '阵营与胜负', paragraphs: ['默认屠边：所有狼人出局，好人获胜；所有村民或所有神职出局，狼人获胜。屠城：所有狼人出局，好人获胜；所有好人出局，狼人获胜。', '程序先处理待结算技能与警徽，再判断普通胜负。特殊角色的额外胜负条件需要主持人按约定核对，必要时使用“主持裁定结束本局”。'] },
  { id: 'night', title: '夜间行动流程与结算', paragraphs: ['标准说法是“夜间行动流程”，也常口语称为“走夜”或“过夜间流程”。法官按夜间顺序依次唤醒玩家：先确认身份或阵营，确认后马上发动技能，用完闭眼，再叫下一个角色。默认保留已出局角色的完整空唤醒口播，念完直接继续，不录入行动；主持人明确关闭时才跳过。', '刀口、查验、用药和目标记录属于私密信息。普通刀伤、女巫毒药、守卫及已实现的保护参与夜间预览。只有目标记录的特殊技能不代表已产生效果，主持人需要按图鉴中的“软件处理范围”核对。'] },
  { id: 'sheriff', title: '首日竞选与警徽', paragraphs: ['警长可以关闭。开启时可选“先竞选后公布死亡”或“先公布死亡后竞选”；后者先处理死亡技能和胜负，已出局玩家不再参选或投票。', '无人上警则警徽流失，一人上警则直接当选；多人上警进入投票。警长的放逐票权可设为 1 票或 1.5 票。警长出局后可移交或撕毁警徽。'] },
  { id: 'medicine', title: '女巫与守卫', paragraphs: ['女巫各有一瓶解药和毒药。自救可设为禁止、仅首夜或始终允许；是否允许同夜双药也由本局桌规决定。空刀不能使用解药，已消耗的药不能再次使用。', '守卫可以自守或空守，默认禁止连续两夜守同一人，本桌可在赛前改为允许连守。同守同救的目标存活或死亡由开局选择决定；守卫不抵挡女巫毒药。'] },
  { id: 'voting', title: '放逐、弃票与 PK', paragraphs: ['放逐可选逐人计票或快速记录。逐人模式记录每名合资格玩家的一票或弃票，警长加权票只计入放逐投票；快速模式直接选择最终被票出者，不计算票型、平票或 PK。', '逐人模式的警长与放逐平票分别选择：进入一轮 PK，或直接警徽流失 / 无人出局。选择 PK 后再次平票，或首轮全员弃票，都不产生当选或放逐。PK 候选人不参与该轮投票。', '两种放逐记录都会继续处理白痴翻牌、遗言、出局技能、警徽和胜负。'] },
  { id: 'death-skills', title: '遗言、出局技能与人工裁定', paragraphs: ['赛前可按首夜夜死、后续夜死、放逐、技能带走和自爆分别开启遗言。命中后先逐座位完成或放弃遗言，再处理猎人、狼王、殉情、白泽传承和警徽。', '猎人被毒是否开枪按桌规开关执行。白狼王只在自爆时进入带人流程。其他特殊角色的触发和限制需结合该版本规则核对。', '人工裁定在白天发言阶段调整玩家状态，并记录理由。它不是完整的特殊角色技能引擎；查看图鉴中的自动处理范围后再使用相应板子。'] },
];

export type HostingProgress = { current: string; next: string; check: string };

/** A conditional roadmap, never a promise to skip pending skills or victory checks. */
export function hostingProgress(game: Game): HostingProgress {
  const stage = game.stage;
  const deathWork = hasLastWordsPolicy(game.rules) ? '遗言（如命中）→ 出局技能与警徽' : '出局技能与警徽';
  if (stage === 'identity-check') {
    const confirmed = game.identityConfirmed?.length ?? 0;
    return {
      current: '旧版逐座身份核对',
      next: confirmed >= game.players.length ? '第一夜' : `剩余 ${game.players.length - confirmed} 人确认 → 第一夜`,
      check: '按座位逐人核对；公开只读座位号，身份内容只留在主持端。全部确认后才会进入第一夜。',
    };
  }
  if (isNightStage(stage)) {
    const remaining = game.nightCalls.slice(Math.max(0, game.nightCalls.indexOf(stage as Game['nightCalls'][number]) + 1));
    const next = remaining.find(call => callIsActive(game, call));
    return { current: '夜间行动', next: next ? callTitle(next) : '天亮核对', check: '收齐本步操作，确认目标或明确空过，再推进下一步。' };
  }
  if (stage === 'dawn') {
    const election = game.day === 1 && game.rules.sheriff && !game.sheriffDone;
    return { current: '天亮核对', next: election
      ? game.rules.sheriffTiming === 'after-announcement' ? `公布结果 → ${deathWork} → 核对胜负 → 竞选` : '警长竞选 → 公布昨夜结果'
      : `公布结果 → ${deathWork} → 核对胜负`, check: '核对私密预览；公开只读出局座位，不念死亡原因。' };
  }
  if (stage === 'dawn-announcement') return { current: '公布昨夜结果', next: `${deathWork} → 核对胜负 → 未结束则白天发言`, check: '先确认公开名单，再处理遗言和需要发动的死亡技能。' };
  if (stage === 'last-words') {
    const queued = game.pending.filter(item => item.kind === 'last-words').length;
    return {
      current: '出局遗言',
      next: queued > 1 ? `剩余 ${queued - 1} 名遗言 → 出局技能与警徽` : '出局技能与警徽 → 核对胜负',
      check: '按队列逐座位完成或明确放弃遗言；遗言结束后再处理出局技能和警徽。',
    };
  }
  if (stage === 'sheriff-signup') return { current: '警长竞选', next: '确认最终名单 → 投票或直接当选', check: '候选人完成发言、退水后，再确认最终上警名单。' };
  if (stage === 'sheriff-vote') return { current: game.vote?.round === 2 ? '警长 PK 投票' : '警长投票', next: `${game.vote?.round === 2 || tableRules(game.rules).sheriffTie === 'none' ? '计票' : '计票 / PK'} → ${game.announcementReady ? '公布昨夜结果' : '核对待处理技能与胜负'}`, check: '逐人记录目标或弃票，全部录齐后再计票。' };
  if (stage === 'discussion') return { current: '白天发言', next: '放逐投票；自爆则进入出局结算', check: '确认发言顺序并完成本轮发言，再发起投票。' };
  if (stage === 'exile-vote') {
    if (tableRules(game.rules).exileRecord === 'quick') {
      return {
        current: '快速放逐记录',
        next: `${deathWork} → 核对胜负`,
        check: '直接选择被票出的座位，或明确本轮无人出局；确认后继续正常出局结算。',
      };
    }
    return { current: game.vote?.round === 2 ? '放逐 PK 投票' : '放逐投票', next: `${game.vote?.round === 2 || tableRules(game.rules).exileTie === 'none' ? '计票' : '计票 / PK'} → ${deathWork} → 核对胜负`, check: '核对本轮投票资格，逐人记录后再确认票型。' };
  }
  if (stage === 'ended') return { current: '对局结束', next: '公开身份与复盘', check: '确认所有人结束游戏后，再分享含身份的记录。' };
  return { current: stage === 'badge' ? '警徽处理' : stage === 'heir' ? '白泽传承' : '出局技能', next: `${hasLastWordsPolicy(game.rules) ? '剩余遗言、技能与警徽' : '剩余技能与警徽'} → 核对胜负 → ${game.resume === 'night' ? '下一夜' : !game.sheriffDone ? '首日竞选' : '白天发言'}`, check: '按待处理顺序逐项确认；存在技能队列时不跳步。' };
}
