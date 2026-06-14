/**
 * PsychicCard — "Psychic Gifts" group (family talent + self talent).
 *
 * Extracted from `app/profile/[id].tsx`.
 */
import React from 'react';
import { StyleSheet, Switch, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { Field } from './ProfileSubcomponents';
import type { Profile, ProfileSetter } from './types';

interface Props {
  view: Profile;
  form: Profile | null;
  setForm: ProfileSetter;
  editing: boolean;
  isSelf: boolean;
}

export default function PsychicCard({ view, form, setForm, editing, isSelf }: Props) {
  const update = (patch: Partial<Profile>) => {
    if (!form) return;
    setForm({ ...form, ...patch });
  };

  return (
    <View style={styles.groupCard}>
      <View style={styles.groupHeader}>
        <Ionicons name="flash" size={16} color="#fbbf24" />
        <Text style={styles.groupTitle}>Psychic Gifts</Text>
      </View>

      <View style={styles.boolRow}>
        <View style={styles.fieldLabelRow}>
          <Ionicons name="people-circle" size={14} color="#9f7aea" />
          <Text style={styles.fieldLabel}>
            Do I have psychic talent in my family?
          </Text>
        </View>
        {editing ? (
          <Switch
            value={!!view.family_has_psychic_talent}
            onValueChange={(v) => update({ family_has_psychic_talent: v })}
            trackColor={{ false: '#3b1f5e', true: '#fbbf24' }}
            thumbColor="#fff"
          />
        ) : (
          <Text style={styles.boolValue}>
            {view.family_has_psychic_talent ? 'Yes' : 'No'}
          </Text>
        )}
      </View>
      {(editing || view.family_has_psychic_talent) && (
        <Field
          label="Who & What (optional)"
          icon="document-text"
          editing={editing}
          value={view.family_psychic_details || ''}
          placeholder={
            isSelf ? 'If you wish to share — who, and what gifts?' : '—'
          }
          multiline
          onChange={(v: string) => update({ family_psychic_details: v })}
          maxLength={600}
        />
      )}

      <View style={styles.boolRow}>
        <View style={styles.fieldLabelRow}>
          <Ionicons name="sparkles" size={14} color="#9f7aea" />
          <Text style={styles.fieldLabel}>
            Do I have psychic talent of my own?
          </Text>
        </View>
        {editing ? (
          <Switch
            value={!!view.self_has_psychic_talent}
            onValueChange={(v) => update({ self_has_psychic_talent: v })}
            trackColor={{ false: '#3b1f5e', true: '#fbbf24' }}
            thumbColor="#fff"
          />
        ) : (
          <Text style={styles.boolValue}>
            {view.self_has_psychic_talent ? 'Yes' : 'No'}
          </Text>
        )}
      </View>
      {(editing || view.self_has_psychic_talent) && (
        <Field
          label="Your Gifts (optional)"
          icon="document-text"
          editing={editing}
          value={view.self_psychic_details || ''}
          placeholder={
            isSelf ? 'If you wish to share — what gifts do you have?' : '—'
          }
          multiline
          onChange={(v: string) => update({ self_psychic_details: v })}
          maxLength={600}
        />
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
  boolRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 6,
    marginBottom: 4,
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
