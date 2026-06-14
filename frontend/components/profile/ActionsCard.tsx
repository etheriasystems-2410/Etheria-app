/**
 * ActionsCard — "Reach out" tiles shown when viewing someone else's profile.
 *
 * The four tiles are:
 *   ✉️  Email          → opens ComposeModal in 'email' mode
 *   📜  Direct Mail    → opens ComposeModal in 'dm-letter' mode
 *   💬  Instant Msg    → opens (or creates) a DM thread
 *   ➕  Add to Circle  → context-dependent: invite / pending / accept / remove
 *
 * Extracted from `app/profile/[id].tsx`.
 */
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { ActionTile } from './ProfileSubcomponents';
import type { Profile } from './types';

interface Props {
  view: Profile;
  actionBusy: string | null;
  onEmail: () => void;
  onLetter: () => void;
  onDM: () => void;
  onCircleInvite: () => void;
  onCircleRemove: () => void;
  onPendingInTap: () => void;
}

export default function ActionsCard({
  view,
  actionBusy,
  onEmail,
  onLetter,
  onDM,
  onCircleInvite,
  onCircleRemove,
  onPendingInTap,
}: Props) {
  return (
    <View style={styles.actionsCard}>
      <Text style={styles.actionsTitle}>Reach out</Text>
      <View style={styles.actionGrid}>
        <ActionTile
          icon="mail"
          label="Email"
          sub="Server forwards to their inbox"
          color="#fbbf24"
          onPress={onEmail}
        />
        <ActionTile
          icon="document-text"
          label="Direct Mail"
          sub="In-app letter"
          color="#9f7aea"
          onPress={onLetter}
        />
        <ActionTile
          icon="chatbubbles"
          label="Instant Message"
          sub="Real-time chat"
          color="#10b981"
          onPress={onDM}
          loading={actionBusy === 'dm'}
        />
        {view.circle_relationship === 'in_circle' ? (
          <ActionTile
            icon="people-circle"
            label="In your Circle ✓"
            sub="Tap to remove"
            color="#ef4444"
            onPress={onCircleRemove}
          />
        ) : view.circle_relationship === 'invite_pending_out' ? (
          <ActionTile
            icon="time"
            label="Invite Pending"
            sub="Awaiting response"
            color="#6b7280"
            onPress={() => {}}
            disabled
          />
        ) : view.circle_relationship === 'invite_pending_in' ? (
          <ActionTile
            icon="mail-unread"
            label="Invited You"
            sub="Check My Circle"
            color="#06b6d4"
            onPress={onPendingInTap}
          />
        ) : (
          <ActionTile
            icon="person-add"
            label="Add to Circle"
            sub="They must accept"
            color="#fbbf24"
            onPress={onCircleInvite}
            loading={actionBusy === 'circle'}
          />
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  actionsCard: {
    marginTop: 10,
    padding: 14,
    borderRadius: 14,
    backgroundColor: 'rgba(15,5,35,0.65)',
    borderWidth: 1,
    borderColor: 'rgba(251,191,36,0.25)',
  },
  actionsTitle: {
    color: '#fbbf24',
    fontSize: 13,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginBottom: 10,
  },
  actionGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
});
