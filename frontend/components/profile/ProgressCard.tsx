/**
 * ProgressCard — read-only grid of training/oracle/journal stats with an
 * optional self-only "Show progress publicly" toggle at the bottom.
 *
 * Extracted from `app/profile/[id].tsx`. Renders nothing if `view.stats` is
 * absent (e.g. another user with show_progress=false).
 */
import React from 'react';
import { StyleSheet, Switch, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { StatTile } from './ProfileSubcomponents';
import type { Profile, ProfileSetter } from './types';

interface Props {
  view: Profile;
  form: Profile | null;
  setForm: ProfileSetter;
  editing: boolean;
  isSelf: boolean;
}

export default function ProgressCard({ view, form, setForm, editing, isSelf }: Props) {
  if (!view.stats) return null;

  return (
    <View style={styles.groupCard}>
      <View style={styles.groupHeader}>
        <Ionicons name="trophy" size={16} color="#fbbf24" />
        <Text style={styles.groupTitle}>Progress</Text>
      </View>

      <View style={styles.statsGrid}>
        <StatTile icon="school" label="Modules completed" value={view.stats.modules_completed} />
        <StatTile icon="flame" label="Current streak" value={`${view.stats.current_streak}d`} />
        <StatTile icon="ribbon" label="Longest streak" value={`${view.stats.longest_streak}d`} />
        <StatTile icon="sparkles" label="Cards drawn" value={view.stats.total_cards_drawn} />
        <StatTile icon="book" label="Journal entries" value={view.stats.journal_entries} />
        <StatTile icon="calendar" label="Days a member" value={view.stats.days_as_member} />
      </View>

      {isSelf && (
        <View style={[styles.boolRow, styles.dividerRow]}>
          <View style={styles.fieldLabelRow}>
            <Ionicons name="eye" size={14} color="#9f7aea" />
            <Text style={styles.fieldLabel}>
              Show progress on my public profile
            </Text>
          </View>
          {editing && form ? (
            <Switch
              value={view.show_progress !== false}
              onValueChange={(v) => setForm({ ...form, show_progress: v })}
              trackColor={{ false: '#3b1f5e', true: '#fbbf24' }}
              thumbColor="#fff"
            />
          ) : (
            <Text style={styles.boolValue}>
              {view.show_progress === false ? 'Hidden' : 'Visible'}
            </Text>
          )}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  groupCard: {
    marginVertical: 8,
    padding: 12,
    borderRadius: 14,
    backgroundColor: 'rgba(15,5,35,0.55)',
    borderWidth: 1,
    borderColor: 'rgba(251,191,36,0.25)',
  },
  groupHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 8,
    paddingBottom: 6,
    borderBottomWidth: 1,
    borderColor: 'rgba(251,191,36,0.18)',
  },
  groupTitle: {
    color: '#fbbf24',
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 4 },
  boolRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 6,
    marginBottom: 4,
  },
  dividerRow: {
    marginTop: 6,
    paddingTop: 8,
    borderTopWidth: 1,
    borderColor: 'rgba(251,191,36,0.18)',
  },
  boolValue: { color: '#e9d5ff', fontSize: 13, fontWeight: '700' },
  fieldLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginBottom: 5,
  },
  fieldLabel: {
    color: '#cbb6ff',
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
});
