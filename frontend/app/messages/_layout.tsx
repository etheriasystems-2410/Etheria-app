/**
 * Stack layout for the Messages section so the drawer treats `messages` as a
 * single group (Inbox + per-thread view) instead of listing each file
 * separately. The parent app/_layout.tsx provides the "Inbox" drawer entry
 * pointing here.
 */
import { Stack } from 'expo-router';
import React from 'react';

export default function MessagesLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="[threadId]" />
    </Stack>
  );
}
