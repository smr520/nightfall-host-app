import React, { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { callTitle, countsFromRoles } from '../../game/boards';
import { DEFAULT_DEATH_RESOLUTION_ORDER, deathResolutionOrder, reconcileNightOrder, resolveNightOrder } from '../../game/flow';
import { ROLES, ROLE_IDS } from '../../game/roles';
import { isValidSpeechSeconds, MAX_SPEECH_SECONDS, MIN_SPEECH_SECONDS, speechSecondsForRules, SPEECH_LABELS, type SpeechKind } from '../../game/speech';
import type { DeathResolutionStep, HostingFlow, LastWordsPolicy, NightCall, Role, Rules, Stage } from '../../game/types';
import { shouldKeepDeadCalls } from '../../game/flow';
import { colors, radius, spacing, type } from '../../theme';
import { Button, Card, InlineError, SwitchRow } from '../kit';
import { ChoiceRow } from './Controls';

const fixedStages: { id: Stage; label: string }[] = [
  { id: 'identity-check', label: '旧版逐座确认' }, { id: 'dawn', label: '天亮核对' }, { id: 'dawn-announcement', label: '公布结果' }, { id: 'sheriff-signup', label: '警长竞选' },
  { id: 'sheriff-vote', label: '警长投票' }, { id: 'discussion', label: '白天发言' }, { id: 'exile-vote', label: '放逐投票' },
  { id: 'last-words', label: '出局遗言' }, { id: 'hunter', label: '猎人技能' }, { id: 'shot', label: '出局技能' },
  { id: 'link', label: '跟随出局' }, { id: 'badge', label: '警徽处理' },
];

export function WorkflowSettings({ roles, rules, onChange }: { roles: Role[]; rules: Rules; onChange: (rules: Rules) => void }) {
  const counts = countsFromRoles(Object.fromEntries(ROLE_IDS.map(role => [role, roles.filter(item => item === role).length])));
  const order = reconcileNightOrder(counts, rules.flow?.nightOrder);
  const resolutionOrder = deathResolutionOrder(rules.flow);
  const [scriptStage, setScriptStage] = useState<Stage>('discussion');
  const [error, setError] = useState('');
  const [duration, setDuration] = useState(String(rules.speechSeconds));
  const patch = (next: Partial<HostingFlow>) => onChange({ ...rules, flow: { ...rules.flow, ...next } });
  const patchTable = (next: NonNullable<Rules['table']>) => onChange({ ...rules, table: { ...rules.table, ...next } });
  const patchLastWords = (next: Partial<LastWordsPolicy>) => patch({
    lastWords: { ...rules.flow?.lastWords, ...next },
  });
  const move = (call: NightCall, delta: -1 | 1) => {
    const index = order.indexOf(call); const destination = index + delta;
    if (destination < 0 || destination >= order.length) return;
    const next = [...order]; [next[index], next[destination]] = [next[destination], next[index]];
    try { resolveNightOrder(counts, { nightOrder: next }); patch({ nightOrder: next }); setError(''); }
    catch (failure) { setError(failure instanceof Error ? failure.message : '请检查行动顺序'); }
  };
  const moveResolution = (step: DeathResolutionStep, delta: -1 | 1) => {
    const index = resolutionOrder.indexOf(step);
    const destination = index + delta;
    if (destination < 0 || destination >= resolutionOrder.length) return;
    const next = [...resolutionOrder];
    [next[index], next[destination]] = [next[destination], next[index]];
    patch({ deathResolutionOrder: next });
  };
  const relevantStages = fixedStages.filter(({ id }) => {
    if (id === 'identity-check') return rules.flow?.identityCheck === 'at-nightfall';
    if (id === 'sheriff-signup' || id === 'sheriff-vote' || id === 'badge') return rules.sheriff;
    if (id === 'hunter') return roles.includes('hunter');
    if (id === 'shot') return roles.some(role => role !== 'hunter' && ROLES[role].onDeath === 'shot');
    if (id === 'link') return roles.some(role => ROLES[role].onDeath === 'link');
    if (id === 'last-words') return Object.values(rules.flow?.lastWords ?? {}).some(Boolean);
    return true;
  });
  const scriptStages = [...order.map(id => ({ id: id as Stage, label: callTitle(id) })), ...relevantStages];
  const activeScriptStage = scriptStages.some(item => item.id === scriptStage) ? scriptStage : 'discussion';
  return <View style={styles.root}>
    <Card style={styles.group}>
      <Text style={type.headline}>夜间流程与白天节奏</Text>
      <Text style={type.footnote}>按本桌习惯设置，会随方案保存。不同桌不必套同一套现场节奏。</Text>
      <ChoiceRow
        label="夜间行动流程"
        value={rules.flow?.identityCheck ?? 'after-deal'}
        options={[
          { label: '发牌后自行看牌', value: 'after-deal' },
          { label: '确认即行动', value: 'during-night' },
        ]}
        onChange={identityCheck => patch({ identityCheck: identityCheck as NonNullable<HostingFlow['identityCheck']> })}
      />
      <Text style={type.footnote}>“确认即行动”直接进入正常夜晚。轮到某角色时，主持人先点选本步实际睁眼的座位；确认后对应角色组落到这些座位，再让玩家立即发动技能。</Text>
      <ChoiceRow
        label="放逐记录"
        value={rules.table?.exileRecord ?? 'detailed'}
        options={[
          { label: '逐人计票', value: 'detailed' },
          { label: '快速记录结果', value: 'quick' },
        ]}
        onChange={exileRecord => patchTable({ exileRecord: exileRecord as NonNullable<NonNullable<Rules['table']>['exileRecord']> })}
      />
      <Text style={type.footnote}>快速记录只点最终被票出的人，不再逐人录票；白痴、遗言、出局技能、警徽和胜负仍照常处理。</Text>
      {(rules.table?.exileRecord ?? 'detailed') !== 'quick' ? <SwitchRow
        label="允许放逐时投给自己"
        hint="默认关闭。关闭时逐人放逐投票不能把票投给本人；警长竞选和快速放逐结果不受此项影响。"
        value={rules.table?.exileSelfVote === true}
        onChange={exileSelfVote => patchTable({ exileSelfVote })}
      /> : null}
      <SwitchRow
        label="保留已出局角色的夜间口播"
        hint="默认开启：角色出局后仍照常念睁眼、行动、闭眼台词，避免通过省略流程暴露身份；点继续即可，不录入目标。关闭后才跳过后续夜间环节。"
        value={shouldKeepDeadCalls(rules)}
        onChange={keepDeadCalls => patch({ keepDeadCalls })}
      />
    </Card>
    <Card style={styles.group}>
      <Text style={type.headline}>夜间行动顺序</Text>
      <Text style={type.footnote}>这里只列本局阵容的夜间行动。用上下按钮调整，更换阵容时保留已有顺序并补上新增角色。{roles.includes('witch') ? '女巫在狼人之后用药。' : ''}</Text>
      {order.map((call, index) => <View key={call} style={styles.orderRow}>
        <Text style={styles.number}>{String(index + 1).padStart(2, '0')}</Text><Text style={[type.body, styles.flex]}>{callTitle(call)}</Text>
        {([-1, 1] as const).map(delta => <Pressable key={delta} accessibilityRole="button" accessibilityLabel={`${delta === -1 ? '上移' : '下移'}${callTitle(call)}`} accessibilityState={{ disabled: delta === -1 ? index === 0 : index === order.length - 1 }} disabled={delta === -1 ? index === 0 : index === order.length - 1} onPress={() => move(call, delta)} style={[styles.orderButton, (delta === -1 ? index === 0 : index === order.length - 1) && styles.disabled]}><Text style={type.headline}>{delta === -1 ? '↑' : '↓'}</Text></Pressable>)}
      </View>)}
      <Button title="恢复默认行动顺序" variant="ghost" small onPress={() => { patch({ nightOrder: reconcileNightOrder(counts) }); setError(''); }} />
      {error ? <InlineError>{error}</InlineError> : null}
    </Card>
    <Card style={styles.group}>
      <Text style={type.headline}>出局结算顺序</Text>
      <Text style={type.footnote}>默认先处理遗言，再处理出局技能，最后处理警徽。线下流程不同可以用上下按钮调整，确认后按这个顺序逐项处理。</Text>
      {resolutionOrder.map((step, index) => <View key={step} style={styles.orderRow}>
        <Text style={styles.number}>{String(index + 1).padStart(2, '0')}</Text>
        <Text style={[type.body, styles.flex]}>{step === 'last-words' ? '出局遗言' : step === 'death-skill' ? '出局技能' : '警徽处理'}</Text>
        {([-1, 1] as const).map(delta => {
          const disabled = delta === -1 ? index === 0 : index === resolutionOrder.length - 1;
          const label = step === 'last-words' ? '遗言' : step === 'death-skill' ? '出局技能' : '警徽';
          return <Pressable
            key={delta}
            accessibilityRole="button"
            accessibilityLabel={`${delta === -1 ? '上移' : '下移'}${label}结算`}
            accessibilityState={{ disabled }}
            disabled={disabled}
            onPress={() => moveResolution(step, delta)}
            style={[styles.orderButton, disabled && styles.disabled]}
          >
            <Text style={type.headline}>{delta === -1 ? '↑' : '↓'}</Text>
          </Pressable>;
        })}
      </View>)}
      <Button title="恢复默认出局顺序" variant="ghost" small onPress={() => patch({ deathResolutionOrder: [...DEFAULT_DEATH_RESOLUTION_ORDER] })} />
    </Card>
    <Card style={styles.group}>
      <SwitchRow label="天亮时手动确认出局名单" hint="确认出局座位和原因后，再按正常流程处理技能、警徽和胜负。" value={rules.flow?.manualDawn === true} onChange={manualDawn => patch({ manualDawn })} />
      <SwitchRow label="由主持人判定对局结束" hint="特殊胜负或尚未自动处理的技能可开启；完成技能与警徽后，在“更多”中手动结束对局。" value={rules.flow?.manualVictory === true} onChange={manualVictory => patch({ manualVictory })} />
      <Text style={type.headline}>出局遗言</Text>
      <Text style={type.footnote}>命中后进入独立队列，逐座位完成或放弃；全部遗言处理完，才继续出局技能、警徽和胜负。</Text>
      <SwitchRow label="首夜夜死有遗言" hint="第一夜因刀伤、毒药或夜间技能出局的玩家进入遗言队列。" value={rules.flow?.lastWords?.firstNight === true} onChange={firstNight => patchLastWords({ firstNight })} />
      <SwitchRow label="后续夜死有遗言" hint="第二夜及以后因夜间效果出局的玩家进入遗言队列。" value={rules.flow?.lastWords?.laterNight === true} onChange={laterNight => patchLastWords({ laterNight })} />
      <SwitchRow label="放逐有遗言" hint="被投票放逐的玩家先完成或放弃遗言，再处理猎人和警徽。" value={rules.flow?.lastWords?.exile === true} onChange={exile => patchLastWords({ exile })} />
      <SwitchRow label="技能带走有遗言" hint="被开枪、殉情或其他已记录技能带走的玩家进入遗言队列。" value={rules.flow?.lastWords?.skill === true} onChange={skill => patchLastWords({ skill })} />
      <SwitchRow label="自爆有遗言" hint="狼人自爆后按本桌约定进入遗言队列。" value={rules.flow?.lastWords?.explode === true} onChange={explode => patchLastWords({ explode })} />
      <Text style={type.headline}>每位玩家发言时长</Text>
      <View style={styles.choices}>{[60, 90, 120, 180].map(seconds => <Pressable key={seconds} accessibilityRole="button" accessibilityLabel={`发言时长 ${seconds} 秒`} accessibilityState={{ selected: rules.speechSeconds === seconds }} onPress={() => { onChange({ ...rules, speechSeconds: seconds }); setDuration(String(seconds)); }} style={[styles.choice, rules.speechSeconds === seconds && styles.active]}><Text style={[type.callout, rules.speechSeconds === seconds && styles.activeText]}>{seconds} 秒</Text></Pressable>)}</View>
      <View style={styles.durationRow}><TextInput value={duration} onChangeText={setDuration} keyboardType="number-pad" maxLength={4} accessibilityLabel="自定义发言秒数" style={styles.durationInput} /><Button title="应用秒数" small variant="secondary" onPress={() => { const seconds = Number(duration); if (!Number.isInteger(seconds) || seconds < 15 || seconds > 1800) { setError('发言时长支持 15–1800 秒的整数'); return; } onChange({ ...rules, speechSeconds: seconds }); setError(''); }} /></View>
      <Text style={type.footnote}>15–1800 秒。计时到零后由主持人决定何时结束发言。</Text>
      <PhaseDurations rules={rules} onChange={next => { onChange(next); setError(''); }} onError={setError} />
    </Card>
    <Card style={styles.group}>
      <Text style={type.headline}>我的主持词</Text><Text style={type.footnote}>这里只列本局会用到的环节。选择后编辑，留空沿用标准口播。可用 {'{目标}'}、{'{候选人}'}、{'{投票人}'}、{'{发言人}'}、{'{昨夜结果}'}。</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.scriptStages}>{scriptStages.map(item => <Pressable key={item.id} accessibilityRole="button" accessibilityLabel={`编辑口播：${item.label}`} accessibilityState={{ selected: activeScriptStage === item.id }} onPress={() => setScriptStage(item.id)} style={[styles.choice, activeScriptStage === item.id && styles.active]}><Text style={[type.callout, activeScriptStage === item.id && styles.activeText]}>{item.label}</Text></Pressable>)}</ScrollView>
      <TextInput value={rules.flow?.scripts?.[activeScriptStage] ?? ''} onChangeText={value => patch({ scripts: { ...rules.flow?.scripts, [activeScriptStage]: value } })} multiline maxLength={1200} accessibilityLabel={`自定义主持词：${scriptStages.find(item => item.id === activeScriptStage)?.label ?? activeScriptStage}`} placeholder="留空使用标准口播" placeholderTextColor={colors.textTertiary} style={styles.scriptInput} />
      <Text style={type.footnote}>夜间角色座位与目标会显示在私密提示中。公开口播只提供当前环节可公开的信息。</Text>
    </Card>
  </View>;
}

function PhaseDurations({ rules, onChange, onError }: {
  rules: Rules;
  onChange: (rules: Rules) => void;
  onError: (message: string) => void;
}) {
  const kinds: SpeechKind[] = ['sheriff', 'pk', 'lastWords'];
  const [kind, setKind] = useState<SpeechKind>('sheriff');
  const current = speechSecondsForRules(rules, kind);
  const [draft, setDraft] = useState(String(current));
  const apply = (seconds: number) => {
    if (!isValidSpeechSeconds(seconds)) {
      onError(`发言时长支持 ${MIN_SPEECH_SECONDS}–${MAX_SPEECH_SECONDS} 秒的整数`);
      return;
    }
    onChange({
      ...rules,
      speechDurations: { ...rules.speechDurations, [kind]: seconds },
    });
  };
  return <>
    <Text style={type.headline}>其他环节单独计时</Text>
    <Text style={type.footnote}>警上、PK 和遗言可分别设置；未设置的环节继续沿用上面的发言时长。</Text>
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.scriptStages}>
      {kinds.map(item => (
        <Pressable
          key={item}
          accessibilityRole="button"
          accessibilityLabel={`计时类型：${SPEECH_LABELS[item]}`}
          accessibilityState={{ selected: kind === item }}
          onPress={() => {
            setKind(item);
            setDraft(String(speechSecondsForRules(rules, item)));
          }}
          style={[styles.choice, kind === item && styles.active]}
        >
          <Text style={[type.callout, kind === item && styles.activeText]}>{SPEECH_LABELS[item]} · {speechSecondsForRules(rules, item)} 秒</Text>
        </Pressable>
      ))}
    </ScrollView>
    <View style={styles.choices}>
      {[30, 45, 60, 90, 120].map(seconds => (
        <Pressable
          key={seconds}
          accessibilityRole="button"
          accessibilityLabel={`${SPEECH_LABELS[kind]} ${seconds} 秒`}
          accessibilityState={{ selected: current === seconds }}
          onPress={() => { setDraft(String(seconds)); apply(seconds); }}
          style={[styles.choice, current === seconds && styles.active]}
        >
          <Text style={[type.callout, current === seconds && styles.activeText]}>{seconds} 秒</Text>
        </Pressable>
      ))}
    </View>
    <View style={styles.durationRow}>
      <TextInput
        value={draft}
        onChangeText={setDraft}
        keyboardType="number-pad"
        maxLength={4}
        accessibilityLabel={`${SPEECH_LABELS[kind]}自定义秒数`}
        style={styles.durationInput}
      />
      <Button title="应用该环节时长" small variant="secondary" onPress={() => apply(Number(draft))} />
    </View>
  </>;
}
const styles = StyleSheet.create({ root: { gap: spacing.md }, group: { gap: spacing.md }, flex: { flex: 1 }, orderRow: { minHeight: 52, flexDirection: 'row', alignItems: 'center', gap: spacing.sm, borderBottomWidth: StyleSheet.hairlineWidth, borderColor: colors.lineSoft }, number: { ...type.numeric, fontSize: 15, width: 26, color: colors.textTertiary }, orderButton: { width: 48, minHeight: 48, alignItems: 'center', justifyContent: 'center', borderRadius: radius.sm, backgroundColor: colors.surfaceAlt }, disabled: { opacity: 0.3 }, choices: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }, choice: { minHeight: 48, paddingHorizontal: spacing.md, justifyContent: 'center', alignItems: 'center', borderRadius: radius.sm, backgroundColor: colors.surfaceAlt }, active: { backgroundColor: colors.accent }, activeText: { color: colors.onAccent }, durationRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm }, durationInput: { minHeight: 48, flex: 1, borderRadius: radius.sm, paddingHorizontal: spacing.md, backgroundColor: colors.surfaceAlt, color: colors.text, fontSize: 16 }, scriptStages: { gap: spacing.sm }, scriptInput: { minHeight: 140, borderRadius: radius.sm, padding: spacing.md, backgroundColor: colors.surfaceAlt, color: colors.text, fontSize: 16, lineHeight: 24, textAlignVertical: 'top' } });
