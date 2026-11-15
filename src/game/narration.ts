import { callActorStatus, callIdentitySeats, callIsActive, getNightAnnouncement, knifeActors, nightCallIdentityConfirmed, tally } from './engine';
import { isRole, isWolf, ROLES } from './roles';
import type { Game, Stage } from './types';
import { tableRules } from './table-rules';
import { shouldKeepDeadCalls } from './flow';
import { TREASURE_RESERVE_PREFIX } from './jingcheng-draw';

export type NarrationContext = { selected?: number | null; activeVoter?: number | null; speaker?: number | null; signup?: number[]; pkSpeaking?: boolean; voteMode?: 'individual' | 'group'; batchVoters?: number[]; editingVoter?: number | null };
export type HostNarration = { headline: string; spoken: string; privateNote: string; closing?: string };
export type PublicOutcome = { headline: string; spoken: string; eventId: number };

const numbered = (seat: number) => `${seat} 号`;
const seatList = (seats: number[]) => seats.map(numbered).join('、');
const sentence = (text: string) => /[。！？!?]$/.test(text) ? text : `${text}。`;
const isNightCall = (stage: Stage) => stage === 'wolves' || isRole(stage) && !!ROLES[stage].night;
const dawnReviewed = (game: Game) => !game.rules.flow?.manualDawn || Array.isArray(game.night.manualDeaths);
const electionBeforeAnnouncement = (game: Game) => game.day === 1 && game.rules.sheriff && !game.sheriffDone && game.rules.sheriffTiming !== 'after-announcement';
const nightAnnouncement = (game: Game) => (game.nightAnnouncement ?? getNightAnnouncement(game)).replace(/\s+出局$/, '出局');

/** Keep the completed action visible across its automatic night transition only. */
export function latestPublicOutcome(game: Game): PublicOutcome | null {
  let index = game.events.length - 1;
  if (/^进入第\s*\d+\s*夜$/.test(game.events[index]?.publicText ?? '')) index--;
  const event = game.events[index];
  if (!event?.publicText) return null;
  const spoken = event.publicText;
  let matches = false;
  if (event.stage === 'dawn' || event.stage === 'dawn-announcement') {
    matches = /^昨夜(?:平安夜|\s+\d+\s*号(?:、\d+\s*号)*\s*出局)$/.test(spoken);
  } else if (event.stage === 'last-words') {
    matches = /^\d+\s*号(?:发表|放弃)遗言$/.test(spoken);
  } else if (event.stage === 'sheriff-signup' || event.stage === 'sheriff-vote' || event.stage === 'exile-vote') {
    matches = /^(?:\d+\s*号(?:被放逐|白痴翻牌免死，失去投票权|当选警长)|警徽流失|本轮无人被放逐)$/.test(spoken);
  } else if (event.stage === 'hunter' || event.stage === 'shot') {
    matches = /^\d+\s*号.+(?:带走\s+\d+\s*号|不开枪|放弃带人)$/.test(spoken);
  } else if (event.stage === 'link') {
    matches = /^(?:\d+\s*号(?:随之出局|已出局，无需重复殉情)|无人殉情)$/.test(spoken);
  } else if (event.stage === 'badge') {
    matches = /^(?:\d+\s*号接任警长|警徽撕毁)$/.test(spoken);
  } else if (event.stage === 'discussion') matches = /^\d+\s*号狼人自爆$/.test(spoken);
  return matches ? { headline: spoken, spoken, eventId: event.id } : null;
}

/** A stored announcement can still be private while the first election is running. */
function hasAnnouncedNight(game: Game): boolean {
  return !game.announcementReady && game.events.some(event => event.day === game.day && event.text === '主持人确认并公布昨夜结果');
}

function publicNightResult(game: Game): string {
  if (isNightCall(game.stage)) return '昨夜结果将在天亮后公布';
  if ((game.stage === 'dawn' && electionBeforeAnnouncement(game)) || (game.announcementReady && game.stage !== 'dawn-announcement')) return '昨夜结果将在竞选后公布';
  if (((game.stage === 'dawn' || game.stage === 'dawn-announcement') && dawnReviewed(game)) || hasAnnouncedNight(game)) return nightAnnouncement(game);
  return '昨夜结果尚未公布，请稍候';
}

function nightSpeech(game: Game): string {
  const role = game.stage === 'wolves' ? 'wolf' : game.stage;
  if (!isRole(role)) return '天黑请闭眼。请保持安静。';
  const name = ROLES[role].name;
  let action: string;
  switch (role) {
    case 'wolf': action = game.day === 1 && !tableRules(game.rules).firstNightKnife ? '请互相确认队友。本板首夜狼人不发动击杀。' : '请统一意见，用手势指认今晚要击杀的玩家。'; break;
    case 'guard': action = '请用手势指认今晚要守护的玩家；如果空守，请明确示意。'; break;
    case 'seer': action = '请用手势指认今晚要查验的玩家。请看手势，确认查验结果。'; break;
    case 'witch': action = '请看手势，确认今晚的刀口。请示意是否使用解药。请示意是否使用毒药；如果使用毒药，请指认目标。'; break;
    case 'wolf-beauty': action = '请用手势指认今晚要魅惑的玩家。'; break;
    case 'gargoyle':
    case 'pure-white':
    case 'wolf-shaman':
    case 'magic-mirror': action = '请用手势指认今晚要查验的玩家。请看手势，确认查验结果。'; break;
    case 'dreamer': action = '请用手势指认今晚要令其梦游的玩家。'; break;
    case 'red-moon-apostle': action = '请与狼队确认今晚的行动，并用手势示意。'; break;
    case 'hunter-demon': action = '请用手势指认今晚要狩猎的玩家。'; break;
    case 'nightmare': action = '请用手势指认今晚要恐惧的玩家。'; break;
    case 'time-wolf-consort': action = '请用手势指认今晚要封锁的玩家。'; break;
    case 'awakened-hidden-wolf': action = '请用手势确认今晚要模仿的技能，并指认目标。'; break;
    case 'miracle-merchant': action = '请用手势确认今晚要赠予的技能，并指认获得技能的玩家。'; break;
    case 'lone-girl': action = '请用手势指认你要崇拜的玩家。'; break;
    case 'sun-eater': action = '请用手势指认今晚要吞噬技能的玩家。'; break;
    case 'light-earl': action = '请用手势指认今晚要庇护的玩家。'; break;
    case 'fragrance-shadow': action = '请用手势指认今晚要缠绕的玩家。'; break;
    case 'medium': action = '请用手势指认今晚要查验的玩家。请看手势，确认对方的身份。'; break;
    case 'poisoner': action = '请示意今晚是否使用毒药；如果使用，请指认目标。'; break;
    case 'raven': action = '请用手势指认今晚的技能目标。'; break;
    case 'treasure-master': action = '请用手势选择今晚借用的身份牌，再按该身份的技能指认目标。'; break;
    case 'nine-tails': action = '请用手势指认今晚要标记的玩家。'; break;
    case 'baize': action = '请用手势指认今晚要清除标记的玩家。'; break;
    case 'dancer': action = '请用手势指认今晚共舞的三名玩家。'; break;
    case 'masked': action = '请用手势指认要查验是否在舞池的玩家，并示意是否使用面具置换。'; break;
    case 'mech-wolf': action = '请示意今晚是否学习；如果学习，请指认目标，并看手势确认对方身份。'; break;
    default: action = '请用手势示意今晚的行动。';
  }
  const firstCall = game.nightCalls.find(call => callIsActive(game, call));
  const identityOpenedNight = game.day === 1 && game.rules.flow?.identityCheck === 'at-nightfall';
  const opening = game.stage === firstCall && !identityOpenedNight ? '天黑了，请所有玩家闭眼。' : '';
  return `${opening}${name}请睁眼。${action}确认完毕，${name}请闭眼。`;
}

function nightPrivateNote(game: Game, selected: number | null): string {
  const role = game.stage === 'wolves' ? 'wolf' : game.stage;
  if (!isRole(role)) return '';
  const call = game.stage === 'wolves' ? 'wolves' : role;
  const status = callActorStatus(game, call);
  const actors = game.stage === 'wolves' ? knifeActors(game) : game.players.filter(player => player.alive && player.role === role);
  const allIdentitySeats = callIdentitySeats(game, call);
  const confirmed = new Set(game.identityConfirmed ?? []);
  const identitySeats = allIdentitySeats.filter(seat => confirmed.has(seat));
  const identityLabel = game.stage === 'wolves' ? '狼人阵营' : ROLES[role].name;
  const identityPending = game.rules.flow?.identityCheck === 'during-night' && !nightCallIdentityConfirmed(game, call);
  const identityPrefix = identityPending
    ? `仅主持人核对。本步身份待确认：请在主持台点选实际睁眼的 ${allIdentitySeats.length} 个座位（${identityLabel}），确认后再执行技能。`
    : `仅主持人核对。本步身份/阵营：${seatList(identitySeats) || '无'}（${identityLabel}）。`;
  if (identityPending) return identityPrefix;
  if (!status.hasActor) return `${identityPrefix}本角色已出局，${shouldKeepDeadCalls(game.rules) ? '按赛前设置照常念完睁眼、行动、闭眼台词，避免通过省略流程暴露身份。' : '本夜无需行动。'}无需选择目标，点击下方按钮继续。`;
  if (status.blockedByFear) return `${identityPrefix}本角色仍存活，但本夜被噩梦之影恐惧，不能行动。公开台词仍照常念完，避免通过流程判断恐惧目标；无需选择目标，点击下方按钮继续。`;
  let note = `${identityPrefix}本步行动座位：${seatList(actors.map(player => player.seat)) || '无存活角色'}。先确认身份/阵营，再立即执行本步技能。`;
  if (selected !== null) {
    note += `已选目标：${numbered(selected)}。`;
    const target = game.players.find(player => player.seat === selected);
    if (target && role === 'seer') note += `查验反馈：${isWolf(target.role) ? '狼人' : '好人'}；仅用手势告知预言家。`;
    if (target && ['gargoyle', 'pure-white', 'wolf-shaman', 'magic-mirror', 'medium', 'mech-wolf'].includes(role)) {
      const observed = target.role === 'treasure-master' && game.special?.treasure?.borrowed ? game.special.treasure.borrowed : target.role;
      note += `目标身份：${ROLES[observed].name}；仅向当前行动角色反馈，特殊技能仍按本局规则处理。`;
    }
  }
  if (role === 'witch') note += `刀口：${game.night.knife === null ? '空刀' : numbered(game.night.knife)}。解药${game.medicine.save ? '可用' : '已使用'}，毒药${game.medicine.poison ? '可用' : '已使用'}。`;
  if (role === 'treasure-master') {
    const reserve = game.events.find(event => event.text.startsWith(TREASURE_RESERVE_PREFIX));
    if (reserve) note += `${reserve.text}。`;
    const treasure = game.special?.treasure;
    if (treasure) note += `今晚已借用：${treasure.borrowed ? ROLES[treasure.borrowed].name : '尚未选择'}；上夜：${treasure.lastBorrowed ? ROLES[treasure.lastBorrowed].name : '无'}。连续两夜不能借用同一张。`;
    if (selected !== null && treasure?.borrowed === 'medium') note += `查验反馈：${ROLES[game.players.find(p => p.seat === selected)!.role].name}；仅用手势告知。`;
    if (selected !== null && treasure?.borrowed === 'dreamer') note += `梦游者本夜免疫狼刀与毒药。`;
  }
  if (role === 'nine-tails') {
    const marked = game.players.filter(p => (game.special?.marks?.[p.seat] ?? 0) > 0);
    note += `当前标记：${marked.map(p => `${numbered(p.seat)}×${game.special?.marks?.[p.seat]}`).join('、') || '无'}。猎杀时刻在白天工具中自动判定。`;
  }
  if (role === 'baize') {
    const marked = game.players.filter(p => (game.special?.marks?.[p.seat] ?? 0) > 0);
    note += `可清除的标记：${marked.map(p => `${numbered(p.seat)}×${game.special?.marks?.[p.seat]}`).join('、') || '无'}。`;
  }
  if (role === 'mech-wolf') note += game.special?.mechLearned ? `已学习：${ROLES[game.special.mechLearned].name}（整局一次）。` : '尚未学习；整局只能学习一次。';
  if (role === 'poisoner') note += `毒药${game.special?.poisonerUsed ? '已用完' : '可用（整局一瓶）'}。`;
  if (role === 'dancer') {
    const visited = game.special?.danceVisited ?? [];
    note += `已进过舞池：${visited.map(numbered).join('、') || '无'}；每人整局只能进一次。`;
  }
  if (role === 'masked' && selected !== null) note += `目标${(game.special?.dance?.pool ?? []).includes(selected) ? '在' : '不在'}舞池；面具置换身份仍由主持人记录。`;
  return note;
}

function voteNarration(game: Game, context: NarrationContext, selected: number | null): HostNarration {
  const vote = game.vote;
  const kind = game.stage === 'sheriff-vote' ? '警长' : '放逐';
  if (!vote) return { headline: `等待${kind}候选名单`, spoken: `现在进入${kind}投票。候选名单尚未确定，请稍候。`, privateNote: '仅主持人核对：当前尚无投票数据。' };
  const candidates = seatList(vote.candidates);
  if (vote.kind === 'exile' && tableRules(game.rules).exileRecord === 'quick') {
    const target = selected !== null && vote.candidates.includes(selected) ? selected : null;
    return {
      headline: target === null ? '谁被票出？' : `确认 ${numbered(target)}被放逐`,
      spoken: target === null
        ? `本轮放逐采用快速记录。请主持人直接点选被票出的座位，无需逐人录入每一票；确认后仍会正常处理遗言、出局技能、警徽和胜负。`
        : `请确认 ${numbered(target)}为本轮被放逐玩家。确认后直接进入出局结算。`,
      privateNote: '仅主持人核对：快速记录只省略逐票录入，不省略死亡后果。无人出局时请使用单独的“本轮无人出局”操作。',
    };
  }
  if (context.pkSpeaking && vote.round > 1) {
    const speaker = context.speaker != null && vote.candidates.includes(context.speaker) ? context.speaker : null;
    const headline = speaker !== null ? `请 ${numbered(speaker)}玩家进行 PK 发言` : `${candidates}进行 PK 发言`;
    return { headline, spoken: `${sentence(headline)}其他玩家请保持安静。所有平票候选人发言结束后，再进行本轮投票。`, privateNote: '' };
  }
  if (context.editingVoter != null && vote.voters.includes(context.editingVoter) && vote.ballots[context.editingVoter] !== undefined) {
    const target = selected !== null && vote.candidates.includes(selected) ? selected : null;
    const headline = `核对 ${numbered(context.editingVoter)}玩家投票`;
    return { headline, spoken: `${sentence(headline)}${target === null ? '请确认选择的候选人，也可以明确表示弃票。' : `请确认是否投给 ${numbered(target)}。`}`, privateNote: '修改后覆盖原票，不会增加第二张票。' };
  }
  const unrecorded = vote.voters.filter(seat => !Object.prototype.hasOwnProperty.call(vote.ballots, seat));
  if (context.voteMode === 'group' && (unrecorded.length || context.batchVoters?.length)) {
    const target = selected !== null && vote.candidates.includes(selected) ? selected : null;
    return { headline: target !== null ? `请投给 ${numbered(target)}的玩家举手` : '请各位玩家同时投票', spoken: `现在进行${kind}${vote.round > 1 ? ' PK' : ''}投票。候选人是 ${candidates}。${target !== null ? `投给 ${numbered(target)}的玩家请举手，其他玩家请放下手。` : '请有投票资格的玩家按主持人的提示举手示意，也可以明确表示弃票。'}`, privateNote: '按实际投票座位录入，同一玩家改票时只保留最后一次确认。' };
  }
  if (!unrecorded.length) {
    const scores = tally(game);
    const max = Math.max(0, ...scores.map(result => result.votes));
    const tied = scores.filter(result => result.votes === max).map(result => result.seat);
    const summary = scores.map(result => `${numbered(result.seat)} ${result.votes} 票`).join('，');
    let headline: string;
    let result: string;
    if (!max) {
      headline = vote.kind === 'sheriff' ? '本轮无人当选警长' : '本轮无人被放逐';
      result = `${vote.voters.length ? '本轮所有玩家均弃票。' : '本轮没有有投票资格的玩家。'}${vote.kind === 'sheriff' ? '无人当选警长，警徽流失。' : '本轮无人被放逐。'}`;
    } else if (tied.length > 1 && vote.round === 1 && (vote.kind === 'sheriff' ? tableRules(game.rules).sheriffTie : tableRules(game.rules).exileTie) === 'pk') {
      headline = `${seatList(tied)}平票，进入 PK`;
      result = `${seatList(tied)}平票。请这些玩家依次进行 PK 发言，其他玩家请保持安静。`;
    } else if (tied.length > 1) {
      headline = vote.kind === 'sheriff' ? `${vote.round > 1 ? '再次' : ''}平票，警徽流失` : `${vote.round > 1 ? '再次' : ''}平票，无人被放逐`;
      result = `本轮${vote.round > 1 ? '再次' : ''}平票。${vote.round === 1 ? '按赛前约定不进行 PK。' : ''}${vote.kind === 'sheriff' ? '无人当选警长，警徽流失。' : '本轮无人被放逐。'}`;
    } else {
      const elected = game.players.find(player => player.seat === tied[0]);
      const idiotExposed = vote.kind === 'exile' && elected?.role === 'idiot' && !elected.exposed;
      headline = idiotExposed ? `${numbered(tied[0])}白痴翻牌免死` : `${numbered(tied[0])}${vote.kind === 'sheriff' ? '当选警长' : '被放逐'}`;
      result = `${headline}。${idiotExposed ? `${numbered(tied[0])}继续参与发言，之后失去投票权。` : ''}`;
    }
    return { headline, spoken: `本轮投票已结束。${summary ? `${summary}。` : ''}${result}`, privateNote: '仅主持人核对：本轮投票已全部记录，可确认计票并进入后续流程。' };
  }
  const voter = context.activeVoter != null && vote.voters.includes(context.activeVoter) ? context.activeVoter : unrecorded[0];
  const target = selected !== null && vote.candidates.includes(selected) ? selected : null;
  const round = vote.round > 1 ? 'PK ' : '';
  return {
    headline: `请 ${numbered(voter)}玩家投票`,
    spoken: `现在进行${kind}${round}投票。本轮候选人是 ${candidates || '暂无候选人'}。请 ${numbered(voter)}投票${target !== null ? `，确认投给 ${numbered(target)}` : '，请指认你选择的候选人，也可以明确表示弃票'}。`,
    privateNote: '',
  };
}

/** Public text is ready to read aloud; night identities and target feedback stay private. */
export function hostNarration(game: Game, fallback: string, context: NarrationContext = {}): HostNarration {
  const stage = game.stage;
  const night = isNightCall(stage);
  const selected = context.selected != null && game.players.some(player => player.seat === context.selected) ? context.selected : null;
  const livingSelected = selected !== null && game.players.some(player => player.seat === selected && player.alive) ? selected : null;
  const pending = game.pending[0];
  const signup = context.signup ?? game.signup;
  let result: HostNarration;

  if (stage === 'identity-check') {
    const confirmed = game.identityConfirmed ?? [];
    const next = game.players.find(player => !confirmed.includes(player.seat));
    const chosen = context.selected != null && game.players.some(player => player.seat === context.selected && !confirmed.includes(context.selected))
      ? context.selected
      : next?.seat ?? null;
    const player = chosen === null ? undefined : game.players.find(item => item.seat === chosen);
    result = {
      headline: chosen === null ? '身份确认已完成' : `请 ${numbered(chosen)}确认身份`,
      spoken: chosen === null
        ? '所有玩家身份已经确认。请主持人继续进入第一夜。'
        : `天黑了，请所有玩家闭眼。请 ${numbered(chosen)}玩家睁眼确认自己的身份牌，确认无误后闭眼。`,
      privateNote: player
        ? `仅主持人核对：${numbered(player.seat)}身份为${ROLES[player.role].name}。公开口播不要读出身份。`
        : '仅主持人核对：身份确认进度已保存。',
    };
  } else if (night) {
    const role = stage === 'wolves' ? 'wolf' : stage;
    result = { headline: `${isRole(role) ? ROLES[role].name : '夜间角色'}行动`, spoken: nightSpeech(game), privateNote: nightPrivateNote(game, selected) };
  } else if (stage === 'dawn' || stage === 'dawn-announcement') {
    const deferred = stage === 'dawn' && electionBeforeAnnouncement(game);
    const reviewed = dawnReviewed(game);
    const preview = getNightAnnouncement(game).replace(/\s+出局$/, '出局');
    const privateNote = `仅主持人核对。${reviewed ? '昨夜名单已具备公布条件。' : '昨夜名单尚未复核，先确认最终出局名单。'}${deferred ? '本局先竞选，竞选结束前不公开夜间结果。' : ''}私密${reviewed ? '名单' : '预览'}：${preview}。`;
    if (deferred) result = { headline: '天亮了，开始警长竞选', spoken: '天亮了，请所有玩家睁眼。现在开始警长竞选，昨夜结果将在竞选结束后公布。想要竞选警长的玩家，请举手示意。', privateNote };
    else if (!reviewed) result = { headline: '天亮了，请等待昨夜结果', spoken: '天亮了，请所有玩家睁眼。昨夜结果稍后公布，请保持安静并耐心等待。', privateNote };
    else {
      const announcement = nightAnnouncement(game);
      result = { headline: announcement, spoken: `天亮了，请所有玩家睁眼。${sentence(announcement)}${announcement.includes('平安夜') ? '请各位玩家保持安静，等待下一环节。' : '请出局玩家暂时保持安静，等待遗言或技能环节。'}`, privateNote };
    }
  } else if (stage === 'last-words') {
    const lastWords = pending?.kind === 'last-words' ? pending : undefined;
    const seat = lastWords?.seat ?? null;
    const deadPlayer = seat === null ? undefined : game.players.find(item => item.seat === seat);
    result = {
      headline: seat === null ? '等待遗言队列' : `请 ${seat} 号玩家发表遗言`,
      spoken: seat === null
        ? '当前没有待处理的遗言，请主持人检查后续流程。'
        : `请 ${seat} 号玩家发表遗言。其他玩家请保持安静。发言结束后，由主持人继续处理后续技能和流程。`,
      privateNote: deadPlayer?.death
        ? `仅主持人核对：${seat} 号因${deadPlayer.death.cause === 'exile' ? '放逐' : deadPlayer.death.cause === 'explode' ? '自爆' : '本局死亡效果'}出局，已按赛前约定进入遗言队列。`
        : '仅主持人核对：按当前队列处理遗言，不向其他玩家读出私密死因。',
    };
  } else if (stage === 'sheriff-signup') {
    const timing = game.announcementReady ? '昨夜结果将在竞选后公布。' : hasAnnouncedNight(game) ? '昨夜结果已公布。' : '';
    const speaker = context.speaker != null && signup.includes(context.speaker) ? context.speaker : null;
    result = {
      headline: speaker !== null ? `请 ${numbered(speaker)}玩家进行警上发言` : signup.length ? `上警玩家：${seatList(signup)}` : '警长竞选，请举手上警',
      spoken: speaker !== null ? `请 ${numbered(speaker)}玩家进行警上发言，其他玩家请保持安静。发言结束后，请明确表示是否退水。` : `${timing}现在开始警长竞选。想要竞选警长的玩家，请举手示意。${signup.length ? `当前上警玩家是 ${seatList(signup)}。` : ''}请上警玩家依次发言，发言后决定是否退水。`,
      privateNote: '',
    };
  } else if (stage === 'sheriff-vote' || stage === 'exile-vote') result = voteNarration(game, context, selected);
  else if (stage === 'discussion') {
    const speaker = context.speaker != null && game.players.some(player => player.seat === context.speaker) ? context.speaker : null;
    const headline = speaker !== null ? `请 ${numbered(speaker)}玩家发言` : game.sheriff !== null ? `请 ${numbered(game.sheriff)}警长指定发言顺序` : '现在开始白天发言';
    result = { headline, spoken: speaker !== null ? `${headline}。其他玩家请保持安静。` : `${headline}。请各位玩家按指定顺序依次发言，未轮到的玩家请保持安静。`, privateNote: '' };
  } else if (stage === 'hunter' || stage === 'shot') {
    const skill = pending?.kind === stage ? pending : undefined;
    const role = stage === 'hunter' ? '猎人' : skill?.role ? ROLES[skill.role].name : '出局角色';
    const actor = skill ? `${numbered(skill.seat)}${role}` : role;
    const verb = stage === 'hunter' ? '开枪' : '带走一名玩家';
    const headline = `请 ${actor}决定是否${verb}`;
    result = { headline, spoken: `${headline}。${livingSelected !== null ? `你指认的目标是 ${numbered(livingSelected)}，请确认是否发动技能；` : '如要发动技能，请指认一名存活玩家；'}${stage === 'hunter' ? '如果不开枪，请明确表示。' : '如果放弃带人，请明确表示。'}`, privateNote: skill ? '' : '仅主持人核对：当前没有对应的待处理技能。' };
  } else if (stage === 'badge') {
    const holder = pending?.kind === 'badge' ? `${numbered(pending.seat)}玩家` : '原警长';
    const target = livingSelected !== null && !game.players.find(player => player.seat === livingSelected)?.exposed ? livingSelected : null;
    result = { headline: `${holder}，警徽移交给谁`, spoken: `请 ${holder}处理警徽。${target !== null ? `是否将警徽移交给 ${numbered(target)}？请明确表示，` : '请指认一名存活且有投票资格的玩家接任警长，'}也可以选择撕毁警徽。`, privateNote: '' };
  } else if (stage === 'heir') {
    const baize = pending?.kind === 'heir' ? numbered(pending.seat) : '白泽';
    result = { headline: `请 ${baize}指定继承人`, spoken: `请 ${baize}翻牌，指定一名存活玩家为继承人。继承人不能拒绝。`, privateNote: '仅主持人核对：平民继承人变为神民双阵营；神职继承人夜间出局会延迟到投票结束；狼人或九尾继承人不受影响。' };
  } else if (stage === 'link') {
    const skill = pending?.kind === 'link' ? pending : undefined;
    const target = skill ? skill.target ?? selected : null;
    const targetPlayer = game.players.find(player => player.seat === target);
    const headline = !targetPlayer ? '本次无人殉情出局' : targetPlayer.alive ? `${numbered(targetPlayer.seat)}因殉情出局` : `${numbered(targetPlayer.seat)}已出局，无需重复殉情`;
    result = { headline, spoken: `${sentence(headline)}请其他玩家保持安静，等待后续流程。`, privateNote: skill ? `仅主持人核对：${numbered(skill.seat)}的殉情目标${targetPlayer ? `为 ${numbered(targetPlayer.seat)}` : '为空'}。` : '仅主持人核对：当前没有待处理的殉情技能。' };
  } else if (stage === 'ended') {
    const winner = game.winner === 'good' ? '好人阵营获胜' : game.winner === 'wolf' ? '狼人阵营获胜' : game.winner === 'third' ? '第三方阵营获胜' : game.winner === 'draw' ? '本局平局' : '本局游戏结束';
    result = { headline: winner, spoken: `${sentence(winner)}本局游戏结束。现在可以公开身份，进入复盘。`, privateNote: '' };
  } else result = { headline: '主持流程', spoken: fallback.trim() || '请各位玩家保持安静，等待下一环节。', privateNote: '' };

  const custom = game.rules.flow?.scripts?.[stage]?.trim();
  if (custom) {
    const candidates = game.vote?.candidates ?? signup;
    const choice = stage === 'link'
      ? pending?.kind === 'link' ? pending.target ?? selected : null
      : stage === 'hunter' || stage === 'shot' || stage === 'badge'
        ? livingSelected !== null && (stage !== 'badge' || !game.players.find(player => player.seat === livingSelected)?.exposed) ? livingSelected : null
        : stage === 'sheriff-vote' || stage === 'exile-vote'
          ? selected !== null && candidates.includes(selected) ? selected : null
          : selected;
    const voter = context.activeVoter != null && game.vote?.voters.includes(context.activeVoter)
      ? context.activeVoter : game.vote?.voters.find(seat => !Object.prototype.hasOwnProperty.call(game.vote!.ballots, seat));
    const speaker = context.speaker != null && game.players.some(player => player.seat === context.speaker) ? context.speaker : null;
    const values: Record<string, string> = {
      目标: night ? '你指认的玩家' : choice !== null ? numbered(choice) : '你选择的玩家',
      投票人: night ? '本轮行动的角色' : voter != null ? numbered(voter) : '有投票资格的玩家',
      发言人: night ? '本轮行动的角色' : speaker !== null ? numbered(speaker) : '轮到发言的玩家',
      候选人: night ? '可选择的玩家' : candidates.length ? seatList(candidates) : '尚未确定',
      昨夜结果: publicNightResult(game),
    };
    result.spoken = custom.replace(/\{(目标|投票人|发言人|候选人|昨夜结果)\}/g, (_, key: string) => values[key]);
  }
  return result;
}
