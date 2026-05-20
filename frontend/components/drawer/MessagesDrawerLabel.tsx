/**
 * Drawer label for the Inbox entry — includes an unread DM count badge.
 */
import React from 'react';
import { Text, View } from 'react-native';
import useDMUnread from '../../hooks/useDMUnread';

interface Props {
  color: string;
}

export default function MessagesDrawerLabel({ color }: Props) {
  const { unread } = useDMUnread(true);
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
      <Text style={{ color, fontSize: 14, fontWeight: '500', flex: 1 }}>Inbox</Text>
      {unread > 0 && (
        <View
          style={{
            backgroundColor: '#fbbf24',
            minWidth: 22,
            height: 22,
            borderRadius: 11,
            alignItems: 'center',
            justifyContent: 'center',
            paddingHorizontal: 6,
            marginRight: 8,
          }}
        >
          <Text style={{ color: '#1a0033', fontSize: 11, fontWeight: '800' }}>
            {unread > 99 ? '99+' : unread}
          </Text>
        </View>
      )}
    </View>
  );
}
