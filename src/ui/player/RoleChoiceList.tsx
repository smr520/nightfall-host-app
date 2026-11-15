import React, { useMemo } from 'react';
import { Text, TextInput, View } from 'react-native';
import { ROLES, type Role } from '../../game/roles';
import { CAMP_LABELS, CAMP_ORDER, campOfRole, filterPlayerRoles, PLAYER_ROLE_IDS } from '../../player/role-options';
import { colors } from '../../theme';
import { MotionPressable } from '../motion';
import { styles } from './styles';

export function RoleChoiceList({ roles = PLAYER_ROLE_IDS, selected, onSelect, query, onQueryChange, showSearch = true, searchLabel = '搜索具体身份', accessibilityPrefix = '具体身份' }: {
  roles?: readonly Role[];
  selected: Role | null;
  onSelect: (role: Role) => void;
  query: string;
  onQueryChange: (query: string) => void;
  showSearch?: boolean;
  searchLabel?: string;
  accessibilityPrefix?: string;
}) {
  const filtered = useMemo(() => filterPlayerRoles(query, roles), [query, roles]);
  return (
    <>
      {showSearch ? <TextInput
        accessibilityLabel={searchLabel}
        value={query}
        onChangeText={onQueryChange}
        placeholder="搜索角色名或技能"
        placeholderTextColor={colors.textTertiary}
        style={styles.input}
        maxLength={30}
      /> : null}
      <View style={styles.roleOptions}>
        {CAMP_ORDER.map(camp => {
          const roles = filtered.filter(role => campOfRole(role) === camp);
          if (!roles.length) return null;
          return (
            <View key={camp} style={styles.roleOptions}>
              <Text style={styles.roleGroup}>{CAMP_LABELS[camp]}</Text>
              <View style={styles.chipRow}>
                {roles.map(role => (
                  <MotionPressable
                    key={role}
                    accessibilityRole="button"
                    accessibilityLabel={`${accessibilityPrefix} ${ROLES[role].name}`}
                    accessibilityState={{ selected: selected === role }}
                    onPress={() => onSelect(role)}
                    style={({ pressed }) => [styles.roleChip, selected === role && styles.roleChipActive, pressed && { opacity: 0.65 }]}
                  >
                    <Text style={[styles.roleChipText, selected === role && styles.roleChipTextActive]}>{ROLES[role].name}</Text>
                  </MotionPressable>
                ))}
              </View>
            </View>
          );
        })}
        {!filtered.length ? <Text style={styles.footnote}>没有匹配的角色，换个关键词试试。</Text> : null}
      </View>
    </>
  );
}
