import { STAGES, type StageInfo } from '../game/config';
import { ROLES } from '../game/roles';
import { getNightAnnouncement } from '../game/engine';
import type { Cause, Game, Stage } from '../game/types';
import type { Board } from '../game/boards';

export function stageInfo(stage: Stage, game?: Game): StageInfo {
  const customScript = game?.rules.flow?.scripts?.[stage]?.trim() || undefined;
  if (game && stage === 'dawn-announcement') {
    return { ...STAGES['dawn-announcement'], script: customScript ?? `请所有玩家睁眼。昨夜结果：${game.nightAnnouncement ?? getNightAnnouncement(game)}。`, help: '公开只读出局座位，不念私密预览中的死因或查验。确认后先处理死亡技能与警徽，再核对胜负。' };
  }
  if (game && stage === 'dawn') {
    const electionPending = game.day === 1 && game.rules.sheriff && !game.sheriffDone;
    if (!electionPending) return { ...STAGES.dawn, script: customScript ?? `天亮了，请所有玩家睁眼。昨夜结果：${getNightAnnouncement(game)}。请核对后公布名单。`, help: '确认公开播报后处理死亡技能和警徽，再继续白天流程。不要念出死亡原因。' };
    if (game.rules.sheriffTiming === 'after-announcement') return { ...STAGES.dawn, script: customScript ?? `天亮了，请所有玩家睁眼。先公布昨夜结果：${getNightAnnouncement(game)}，处理死亡技能后再开始警长竞选。`, help: '已公布的夜间死者不参与竞选或投票；如游戏已结束则不再竞选。不要念出死亡原因。' };
  }
  if (game && stage === 'sheriff-signup' && game.rules.sheriffTiming === 'after-announcement') {
    return { ...STAGES['sheriff-signup'], script: customScript ?? '昨夜结果已公布。现在开始警长竞选，请仍存活的上警玩家依次发言、退水，再确认参选名单。', help: '已出局玩家不再参选或投票。无人上警则警徽流失。' };
  }
  if (game && stage === 'sheriff-vote') {
    const beforeAnnouncement = game.announcementReady;
    return {
      ...STAGES['sheriff-vote'],
      script: customScript ?? `${beforeAnnouncement ? '昨夜结果尚未公布。' : '昨夜结果已公布。'}请本轮有资格的警下玩家投票。三、二、一，请投票。`,
      help: `${beforeAnnouncement ? '未公布的夜间死者仍按当前资格参与本轮。' : '已公布的出局玩家不再投票。'}每人记录目标或弃票。平票 PK 一次，再平票警徽流失。`,
    };
  }
  if (game && stage === 'last-words') {
    const seat = game.pending.find(item => item.kind === 'last-words')?.seat;
    return {
      ...STAGES['last-words'],
      script: customScript ?? (seat
        ? `请 ${seat} 号玩家发表遗言。其他玩家请保持安静。发言结束后，由主持人继续处理后续技能和流程。`
        : STAGES['last-words'].script),
      help: '逐人完成或放弃遗言；队列结束后再处理出局技能、警徽和胜负。',
    };
  }
  if (Object.prototype.hasOwnProperty.call(STAGES, stage)) return { ...STAGES[stage as keyof typeof STAGES], ...(customScript ? { script: customScript } : {}) };
  if (stage === 'wolves') return { title: '狼人行动', short: '狼人', script: customScript ?? ROLES.wolf.night!.script, help: ROLES.wolf.night!.help };
  const role = ROLES[stage as keyof typeof ROLES];
  if (role?.night) return { title: `${role.name}行动`, short: role.short, script: customScript ?? role.night.script, help: role.night.help };
  return { title: '主持流程', short: '流程', script: '', help: '' };
}

export function isNightStageId(stage: Stage): boolean {
  return stage === 'wolves' || !!ROLES[stage as keyof typeof ROLES]?.night;
}

export function causeLabel(cause?: Cause): string {
  return {
    knife: '夜间出局', poison: '中毒', exile: '被放逐', shot: '被开枪带走',
    explode: '自爆', ruling: '主持裁定', link: '殉情', dance: '舞池出局', hunt: '猎杀时刻', check: '查验出局', dream: '梦亡', 'demon-hunt': '猎魔',
  }[cause ?? 'ruling'] ?? '出局';
}

export function phaseLabel(game: Game): string {
  return `第 ${game.day} ${isNightStageId(game.stage) || game.stage === 'dawn' || game.stage === 'dawn-announcement' ? '夜' : '日'}`;
}

export function eventPeriodLabel(day: number, stage: Stage): string {
  return `第 ${day} ${isNightStageId(stage) || stage === 'dawn' || stage === 'dawn-announcement' ? '夜' : '天'}`;
}

export function boardLine(roles: Board['roles']): string {
  return Object.entries(roles)
    .filter(([, n]) => (n ?? 0) > 0)
    .map(([role, n]) => `${ROLES[role as keyof typeof ROLES].short}${n}`)
    .join(' · ');
}

export function boardRoleList(roles: Board['roles']): { name: string; count: number; wolf: boolean }[] {
  return Object.entries(roles)
    .filter(([, n]) => (n ?? 0) > 0)
    .map(([role, n]) => ({ name: ROLES[role as keyof typeof ROLES].name, count: n ?? 0, wolf: ROLES[role as keyof typeof ROLES].camp === 'wolf' }));
}
