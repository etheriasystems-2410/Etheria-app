/**
 * PathCard — "The Path I Walk" group (religion / coven / deities).
 *
 * Extracted from `app/profile/[id].tsx`. Read-only when `editing` is false.
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

export default function PathCard({ view, form, setForm, editing, isSelf }: Props) {
  const update = (patch: Partial<Profile>) => {
    if (!form) return;
    setForm({ ...form, ...patch });
  };

  return (
    <View style={styles.groupCard}>
      <View style={styles.groupHeader}>
        <Ionicons name="leaf" size={16} color="#fbbf24" />
        <Text style={styles.groupTitle}>The Path I Walk</Text>
      </View>

      <Field
        label="My Path"
        icon="compass"
        editing={editing}
        value={view.path_walked || ''}
        placeholder={
          isSelf ? 'Briefly describe your faith, walk, or religion' : '—'
        }
        multiline
        onChange={(v: string) => update({ path_walked: v })}
        maxLength={400}
      />

      <View style={styles.boolRow}>
        <View style={styles.fieldLabelRow}>
          <Ionicons name="people" size={14} color="#9f7aea" />
          <Text style={styles.fieldLabel}>
            Am I in a coven or religious group?
          </Text>
        </View>
        {editing ? (
          <Switch
            value={!!view.in_coven}
            onValueChange={(v) => update({ in_coven: v })}
            trackColor={{ false: '#3b1f5e', true: '#fbbf24' }}
            thumbColor="#fff"
          />
        ) : (
          <Text style={styles.boolValue}>{view.in_coven ? 'Yes' : 'No'}</Text>
        )}
      </View>
      {(editing || view.in_coven) && (
        <Field
          label="Group / Coven Name"
          icon="bookmark"
          editing={editing}
          value={view.coven_name || ''}
          placeholder={isSelf ? 'Optional — the name of your group' : '—'}
          onChange={(v: string) => update({ coven_name: v })}
          maxLength={120}
        />
      )}

      <Field
        label="Deities I Follow"
        icon="moon"
        editing={editing}
        value={view.deities_followed || ''}
        placeholder={
          isSelf ? 'Names of deities, spirits, or guides you honor' : '—'
        }
        multiline
        onChange={(v: string) => update({ deities_followed: v })}
        maxLength={400}
      />
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
