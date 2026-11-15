import React from 'react';
import { Text, TextInput, View } from 'react-native';
import { boardIntroduction } from '../../game/board-reference';
import { boardSupport } from '../../game/board-support';
import type { Board } from '../../game/boards';
import { isIdentityCard } from '../../game/role-catalog';
import { ROLE_REFERENCE } from '../../game/role-reference';
import { ROLES, isWolf } from '../../game/roles';
import type { hostingSupport } from '../../game/support-policy';
import type { ResolvedTableRules } from '../../game/table-rules';
import type { Role, Rules } from '../../game/types';
import { shouldKeepDeadCalls } from '../../game/flow';
import { Button, Chip, Divider, InlineError } from '../kit';
import { Icon } from '../Icon';
import { boardRoleList } from '../labels';
import { MotionPressable } from '../motion';
import { useResponsive } from '../responsive';
import { colors, type } from '../../theme';
import { boardTagLabel } from './board-filter';
import { ChoiceRow, ToggleRow } from './Controls';
import { BoardSupportBadge } from './BoardIntroduction';
import { styles } from './styles';
import type { SetupPlayer, TreasureDeal } from './types';

export function BoardStep({ editingProfile, board, total, name, players, error, onNameChange, onOpenLibrary, onPreviewBoard, onEditLineup }: {
  editingProfile: boolean;
  board: Board;
  total: number;
  name: string;
  players: SetupPlayer[];
  error: string;
  onNameChange: (name: string) => void;
  onOpenLibrary: () => void;
  onPreviewBoard: () => void;
  onEditLineup: () => void;
}) {
  const support = boardSupport(board);
  return (
    <>
      <View style={styles.stepHeading}><Text accessibilityRole="header" style={type.title}>{editingProfile ? '设置常用阵容' : '今晚打哪个板子？'}</Text><Text style={type.footnote}>选好阵容，再确认本桌规则。</Text></View>
      <MotionPressable accessibilityRole="button" accessibilityLabel={`当前板子 ${board.name}，点击更换`} onPress={onOpenLibrary} style={styles.boardCard}>
        <View style={styles.rowBetween}>
          <View style={styles.flex}>
            <Text style={styles.boardEyebrow}>当前板子 · {boardTagLabel(board.tag)}</Text>
            <Text style={styles.boardTitle}>{board.name}</Text>
            <Text style={[type.footnote, styles.mt4]}>{board.subtitle}</Text>
          </View>
          <View style={styles.playerTotal}><Text style={styles.playerTotalValue}>{total}</Text><Text style={type.caption}>人</Text></View>
        </View>
        <BoardSupportBadge board={board} withSummary />
        <View style={styles.boardRoster}>{boardRoleList(board.roles).map(item => <View key={item.name} style={styles.boardRosterItem}><Text style={[styles.rosterName, item.wolf && styles.rosterWolf]}>{item.name}</Text><Text style={styles.rosterCount}>×{item.count}</Text></View>)}</View>
        {board.deck ? <Text style={type.footnote}>以上是 {Object.values(board.counts).reduce((a, b) => a + b, 0)} 张完整牌池；已自动洗牌，{total} 张入座、{Object.values(board.counts).reduce((a, b) => a + b, 0) - total} 张扣作底牌。</Text> : null}
        <Text style={type.footnote}>{boardIntroduction(board).overview}</Text>
        {support.level !== 'verified' ? <Text style={type.footnote}>{support.summary} 请先查看主持处理项。</Text> : null}
        <View style={styles.boardChange}><Text style={styles.changeHint}>点击更换板子</Text><Icon name="chevron-right" size={18} color={colors.textSecondary} /></View>
      </MotionPressable>
      <View style={styles.boardLinks}><Icon name="book" size={19} color={colors.textSecondary} /><View style={styles.flex}><Button title="查看当前板子介绍" variant="ghost" small onPress={onPreviewBoard} /></View></View>
      <Button title="自定义人数和角色" variant="secondary" onPress={onEditLineup} />
      {!editingProfile && players.some(player => !isIdentityCard(player.role)) ? <>
        <InlineError>旧方案把幸运儿当成了独立身份，需要补回这名玩家的原身份。</InlineError>
        <Button title="修正旧阵容" variant="secondary" onPress={onEditLineup} />
      </> : null}
      {!editingProfile ? <View style={styles.field}>
        <Text style={type.caption}>对局名称</Text>
        <TextInput value={name} onChangeText={onNameChange} accessibilityLabel="对局名称" placeholder="例如：周三固定局" placeholderTextColor={colors.textTertiary} style={styles.input} maxLength={24} />
      </View> : null}
      {error ? <InlineError>{error}</InlineError> : null}
    </>
  );
}

export function RulesStep({ editingProfile, board, rules, supportedRules, table, tableSummary, manualRoles, detailsOpen, hasWitch, hasGuardSave, hasHunterPoison, hasGuard, onSetRules, onToggleDetails, onOpenReference, onOpenFlow, onOpenOpening }: {
  editingProfile: boolean;
  board: Board;
  rules: Rules;
  supportedRules: Rules;
  table: ResolvedTableRules;
  tableSummary: string[];
  manualRoles: Role[];
  detailsOpen: boolean;
  hasWitch: boolean;
  hasGuardSave: boolean;
  hasHunterPoison: boolean;
  hasGuard: boolean;
  onSetRules: (next: Rules) => void;
  onToggleDetails: () => void;
  onOpenReference: (role?: Role) => void;
  onOpenFlow: () => void;
  onOpenOpening: () => void;
}) {
  return (
    <>
      <Text accessibilityRole="header" style={type.title}>先定好本桌规则</Text>
      <Text style={type.footnote}>按今晚实际玩法调整。这里是本桌约定，预设不代表所有线下店和赛事的统一规则。开局后按已确认设置主持。</Text>
      <View style={styles.group}>
        <Text style={type.caption}>夜间行动与放逐记录</Text>
        <ChoiceRow
          label="夜间行动流程"
          value={rules.flow?.identityCheck ?? 'after-deal'}
          options={[
            { label: '发牌后自行看牌', value: 'after-deal' },
            { label: '确认即行动', value: 'during-night' },
          ]}
          onChange={identityCheck => onSetRules({
            ...rules,
            flow: { ...rules.flow, identityCheck: identityCheck as NonNullable<Rules['flow']>['identityCheck'] },
          })}
        />
        <Text style={type.footnote}>选“确认即行动”后不会增加开局核对步骤。法官按夜间顺序依次唤醒玩家：主持台先让主持人点选本步实际睁眼的座位，确认身份或阵营后立即发动技能，用完闭眼，再叫下一个角色。</Text>
        <Divider />
        <ChoiceRow
          label="放逐记录"
          value={table.exileRecord}
          options={[
            { label: '逐人计票', value: 'detailed' },
            { label: '快速记录结果', value: 'quick' },
          ]}
          onChange={exileRecord => onSetRules({
            ...rules,
            table: { ...rules.table, exileRecord: exileRecord as 'detailed' | 'quick' },
          })}
        />
        <Text style={type.footnote}>快速记录直接选择被票出的座位，不再逐人录票；死亡技能、遗言、警徽和胜负仍正常处理。</Text>
        <Divider />
        <ChoiceRow
          label="出局角色夜间口播"
          value={shouldKeepDeadCalls(rules) ? 'keep' : 'skip'}
          options={[{ label: '默认保留', value: 'keep' }, { label: '跳过', value: 'skip' }]}
          onChange={keepDeadCalls => onSetRules({
            ...rules,
            flow: { ...rules.flow, keepDeadCalls: keepDeadCalls === 'keep' },
          })}
        />
        <Text style={type.footnote}>默认保留出局角色的空唤醒口播，避免用流程省略暴露谁已出局。主持台只看台词，不录入行动。</Text>
      </View>
      <View style={styles.group}>
        <Text style={type.caption}>胜负与警长</Text>
        <ToggleRow label="开启警长竞选" value={rules.sheriff} onChange={v => onSetRules({ ...rules, sheriff: v })} />
        <Divider />
        <ChoiceRow label="胜负条件" value={rules.win} options={[{ label: '屠边', value: 'edge' }, { label: '屠城', value: 'all' }]} onChange={v => onSetRules({ ...rules, win: v as Rules['win'] })} />
      </View>
      {manualRoles.length ? <View style={[styles.group, styles.hostNotice]}>
        <Text style={type.headline}>本局需主持人核对的角色</Text>
        <Text style={type.footnote}>{manualRoles.map(role => ROLES[role].name).join('、')}含需现场处理的规则。开局前确认即可。</Text>
        {detailsOpen ? board.unresolved?.map(point => <Text key={point} style={type.body}>{point}</Text>) : null}
        {detailsOpen ? manualRoles.map(role => <View key={role} style={styles.field}>
          <Text style={type.headline}>{ROLES[role].name}</Text>
          <Text style={type.footnote}>{ROLE_REFERENCE[role].automationNote}</Text>
        </View>) : null}
        <Button title="查看特殊角色处理范围" variant="secondary" onPress={() => onOpenReference(manualRoles[0])} />
      </View> : null}
      {hasWitch || hasGuardSave || hasHunterPoison ? <View style={styles.group}>
        <Text style={type.caption}>神职限制</Text>
        {hasWitch ? <>
          <ChoiceRow label="女巫自救" value={rules.selfSave} options={[{ label: '不可', value: 'never' }, { label: '首夜', value: 'first' }, { label: '始终', value: 'always' }]} onChange={v => onSetRules({ ...rules, selfSave: v as Rules['selfSave'] })} />
          <Divider />
          <ToggleRow label="允许同夜双药" value={rules.doubleMedicine} onChange={v => onSetRules({ ...rules, doubleMedicine: v })} />
        </> : null}
        {hasGuardSave ? <>
          <Divider />
          <ChoiceRow label="守救同人" value={rules.guardSave} options={[{ label: '仍死亡', value: 'die' }, { label: '存活', value: 'live' }]} onChange={v => onSetRules({ ...rules, guardSave: v as Rules['guardSave'] })} />
        </> : null}
        {hasHunterPoison ? <>
          <Divider />
          <ToggleRow label="猎人被毒可开枪" value={rules.hunterPoison} onChange={v => onSetRules({ ...rules, hunterPoison: v })} />
        </> : null}
      </View> : null}
      <View style={styles.group}>
        <Text style={type.headline}>更多桌规与流程</Text>
        <Text style={type.footnote}>警长顺序与票权、平票、连守、台词和补充约定。未展开时，已保存的设置仍照常生效。</Text>
        <Button title={detailsOpen ? '收起更多桌规' : '展开更多桌规'} variant="secondary" onPress={onToggleDetails} />
      </View>
      {detailsOpen ? <>
        <View style={styles.group}>
          <Text style={type.caption}>顺序、票权与平票</Text>
          {rules.sheriff ? <>
            <ChoiceRow label="首日公布顺序" value={rules.sheriffTiming ?? 'before-announcement'} options={[{ label: '先竞选后公布', value: 'before-announcement' }, { label: '先公布后竞选', value: 'after-announcement' }]} onChange={v => onSetRules({ ...rules, sheriffTiming: v as Rules['sheriffTiming'] })} />
            <Divider />
            <ChoiceRow label="警长票权" value={String(rules.sheriffWeight)} options={[{ label: '1 票', value: '1' }, { label: '1.5 票', value: '1.5' }]} onChange={v => onSetRules({ ...rules, sheriffWeight: Number(v) as 1 | 1.5 })} />
            <Divider />
            <ChoiceRow label="警长平票" value={table.sheriffTie} options={[{ label: 'PK 一轮', value: 'pk' }, { label: '直接流失警徽', value: 'none' }]} onChange={v => onSetRules({ ...rules, table: { ...rules.table, sheriffTie: v as 'pk' | 'none' } })} />
            <Divider />
          </> : null}
          {table.exileRecord === 'quick' ? <Text style={type.footnote}>快速放逐只记录最终结果，不计算平票或 PK；本局不会播报放逐 PK 计时。</Text> : <>
            <ChoiceRow label="放逐平票" value={table.exileTie} options={[{ label: 'PK 一轮', value: 'pk' }, { label: '本轮无人出局', value: 'none' }]} onChange={v => onSetRules({ ...rules, table: { ...rules.table, exileTie: v as 'pk' | 'none' } })} />
            <Text style={type.footnote}>选择 PK 时最多再投一轮；再次平票则警徽流失或无人出局。全员弃票不进入 PK。</Text>
          </>}
          {hasGuard ? <>
            <Divider />
            <ToggleRow label="允许守卫连续守同一人" value={table.guardRepeat} onChange={guardRepeat => onSetRules({ ...rules, table: { ...rules.table, guardRepeat } })} />
          </> : null}
        </View>
        <View style={styles.group}>
          <View style={styles.rowBetween}><Text style={type.headline}>主持流程</Text><Chip>{rules.flow ? '我的设置' : '板子默认'}</Chip></View>
          <Text style={type.footnote}>夜间行动顺序 · 自定义主持词 · 每人 {rules.speechSeconds} 秒{supportedRules.flow?.identityCheck === 'during-night' || supportedRules.flow?.identityCheck === 'at-nightfall' ? ' · 夜间行动流程：确认即行动' : ' · 发牌后自行看牌'}{supportedRules.flow?.manualDawn ? ' · 天亮手动复核' : ''}{supportedRules.flow?.manualVictory ? ' · 主持人判定结束' : ''}</Text>
          <Button title="自定义主持流程" variant="secondary" onPress={onOpenFlow} />
        </View>
        <View style={styles.group}>
          <Text style={type.headline}>本桌补充约定</Text>
          <Text style={type.footnote}>写好遗言、出局是否翻牌、自爆或特殊角色等约定，开场一起宣读。这里的文字由主持人现场执行。</Text>
          <TextInput accessibilityLabel="本桌补充约定" value={rules.table?.notes ?? ''} onChangeText={notes => onSetRules({ ...rules, table: { ...rules.table, notes } })} multiline maxLength={1200} placeholder="例如：仅首夜出局和白天被放逐的玩家有遗言；出局不翻身份；遗言 30 秒。" placeholderTextColor={colors.textTertiary} style={[styles.input, styles.notesInput]} />
          <Text style={type.caption}>{(rules.table?.notes ?? '').length} / 1200 · 补充文字不会改变自动结算</Text>
        </View>
      </> : null}
      <View style={[styles.group, styles.ruleSummary]}>
        <Text style={type.headline}>{editingProfile ? '方案采用的桌规' : '本局采用的桌规'}</Text>
        {detailsOpen ? tableSummary.map(line => <Text key={line} style={type.body}>{line}</Text>) : <Text style={type.footnote}>{rules.sheriff ? `有警长 · ${rules.sheriffWeight} 票 · ${rules.sheriffTiming === 'after-announcement' ? '先公布后竞选' : '先竞选后公布'}` : '不上警'} · {rules.win === 'all' ? '屠城' : '屠边'} · 每人 {rules.speechSeconds} 秒{rules.table?.notes ? ' · 含本桌补充约定' : ''}</Text>}
        <Button title="预览开场宣读" variant="secondary" onPress={onOpenOpening} />
        <Text style={type.footnote}>{editingProfile ? `每位玩家发言 ${rules.speechSeconds} 秒。保存后设为默认方案，不会开始对局；方案不保存玩家姓名。` : `每位玩家发言 ${rules.speechSeconds} 秒。确认以上约定后，再核对座位开始第一夜。`}</Text>
      </View>
    </>
  );
}

export function RosterStep({ total, wolfCount, goodCount, thirdCount, board, deal, players, tableSummary, support, supportedRules, error, seatNumberWidth, onNameChange, onShuffle, onRedeal, onRoleSeat, onOpenReference, onOpenFlow }: {
  total: number;
  wolfCount: number;
  goodCount: number;
  thirdCount: number;
  board: Board;
  deal?: TreasureDeal;
  players: SetupPlayer[];
  tableSummary: string[];
  support: ReturnType<typeof hostingSupport>;
  supportedRules: Rules;
  error: string;
  seatNumberWidth: number;
  onNameChange: (index: number, name: string) => void;
  onShuffle: () => void;
  onRedeal: () => void;
  onRoleSeat: (index: number) => void;
  onOpenReference: () => void;
  onOpenFlow: () => void;
}) {
  const responsive = useResponsive();
  const progressiveIdentity = supportedRules.flow?.identityCheck === 'during-night';
  return (
    <>
      <Text accessibilityRole="header" style={type.title}>{progressiveIdentity ? '确认座位，身份夜间核对' : '核对座位'}</Text>
      <View style={styles.summaryRow}>
        <Chip>{total} 人</Chip>
        <Chip tone="wolf">狼 {wolfCount}</Chip>
        <Chip tone="success">好人 {goodCount}</Chip>
        {thirdCount ? <Chip>第三方 {thirdCount}</Chip> : null}
        <Chip>{board.name}</Chip>
      </View>
      <Text style={type.footnote}>{progressiveIdentity
        ? '这里只确认人数、姓名和座位，不再提前设定每个座位是什么身份牌。身份将在夜间逐项确认：轮到狼人、预言家等角色时，主持台先请你点选本步实际睁眼的座位，再进入刀人或技能操作。'
        : `姓名可以不填。点击身份可与另一座位互换，板子的角色和人数保持一致。身份默认对玩家隐藏，主持台可临时查看。${supportedRules.flow?.identityCheck === 'at-nightfall' ? '开始后先完成逐座身份核对。' : '开始主持后直接进入第一夜。'}`}</Text>
      {!progressiveIdentity ? <Button title="随机分配身份" variant="secondary" onPress={onShuffle} /> : null}
      {deal && deal.boardId === board.id ? <View style={[styles.group, styles.hostNotice]}>
        <Text accessibilityRole="header" style={type.headline}>底牌 · 仅主持人可见</Text>
        <Text style={type.body}>{deal.reserve.map(role => ROLES[role].name).join('、')}</Text>
        <Text style={type.footnote}>盗宝大师本局归{deal.camp === 'wolf' ? '狼人' : '好人'}阵营。首夜私下把这 3 张底牌交给盗宝大师查看；开局后会写入主持记录。</Text>
        <Button title="重新洗牌" variant="secondary" onPress={onRedeal} />
      </View> : null}
      <View style={[styles.seatList, responsive.isWideTablet && styles.seatListWide]}>
        <View style={styles.seatTableHead}><Text style={[styles.seatTableNumber, { width: seatNumberWidth }]}>座位</Text><Text style={[type.caption, styles.flex]}>玩家姓名 · 可不填</Text><Text style={styles.seatTableRole}>{progressiveIdentity ? '确认方式' : '身份'}</Text></View>
        {players.map((player, index) => (
          <View key={index} style={responsive.isWideTablet ? styles.seatItemWide : undefined}>
            {index > 0 ? <Divider /> : null}
            <View style={styles.seatRow}>
              <Text style={[styles.seatNumber, { width: seatNumberWidth }]}>{String(index + 1).padStart(2, '0')}</Text>
              <TextInput
                value={player.name}
                onChangeText={value => onNameChange(index, value)}
                accessibilityLabel={`${index + 1}号玩家姓名`}
                placeholder={`${index + 1} 号玩家`}
                placeholderTextColor={colors.textTertiary}
                style={styles.nameInput}
                maxLength={12}
              />
              {progressiveIdentity
                ? <Text accessibilityLabel={`${index + 1}号身份将在夜间确认`} style={styles.seatTableRole}>夜间确认</Text>
                : <MotionPressable accessibilityRole="button" accessibilityLabel={`${index + 1}号身份 ${ROLES[player.role].name}，点击更改`} onPress={() => onRoleSeat(index)} style={styles.rolePill}>
                  <Text style={[styles.rolePillText, isWolf(player.role) && styles.rolePillWolf]}>{ROLES[player.role].short}</Text>
                </MotionPressable>}
            </View>
          </View>
        ))}
      </View>
      <View style={styles.group}>
        <Text style={type.headline}>开局前核对</Text>
        <Text style={type.footnote}>{progressiveIdentity
          ? '确认姓名与座位后开始第一夜。身份不会在本页写入，主持人会按夜间行动逐步核对并记录。'
          : '确认身份与座位，并按上一步约定的桌规开始第一夜。需要调整桌规可返回上一步。'}操作前确认手机仅主持人可见。</Text>
        {tableSummary.map(line => <Text key={line} style={type.footnote}>{line}</Text>)}
        <Button title="查看本局规则与角色" variant="secondary" onPress={onOpenReference} />
      </View>
      {support.checks.length ? <View style={[styles.group, styles.hostNotice]}>
        <Text accessibilityRole="header" style={type.headline}>本局现场处理清单</Text>
        {support.checks.map(check => <View key={check.role} style={styles.field}><Text style={type.callout}>{ROLES[check.role].name}</Text><Text style={type.footnote}>{check.note}</Text></View>)}
        {support.manualDawn ? <Text style={type.footnote}>{supportedRules.flow?.manualDawn ? '已启用天亮手动复核，确认实际出局后再公布。' : '天亮手动复核已关闭，请确认本桌可以按基础夜间结果结算。'}</Text> : null}
        {support.manualVictory ? <Text style={type.footnote}>{supportedRules.flow?.manualVictory ? '已启用主持人判定结束，完整处理特殊技能后，在“更多”结束对局。' : '主持人判定结束已关闭，将按基础阵营条件自动结束。'}</Text> : null}
        <Button title="调整本局处理方式" variant="secondary" onPress={onOpenFlow} />
      </View> : null}
      {error ? <InlineError>{error}</InlineError> : null}
    </>
  );
}
