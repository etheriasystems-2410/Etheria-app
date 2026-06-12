/**
 * My Profile — drawer shortcut that redirects to /profile/{my_user_id}.
 *
 * Using a redirect (not a wrapper component) so the profile screen itself
 * remains the single source of truth — back navigation, deep-links, and
 * edit-mode all keep working without duplication.
 */
import React from 'react';
import { ActivityIndicator, View, StyleSheet } from 'react-native';
import { Redirect, useRouter } from 'expo-router';
import { useAuth } from '../contexts/AuthContext';

export default function MyProfileShortcut() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const userId = (user as any)?.user_id || (user as any)?.id;

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color="#fbbf24" />
      </View>
    );
  }

  // Not signed in → bounce to login
  if (!user) return <Redirect href="/auth/login" />;
  if (!userId) {
    // Edge case — fall back to home
    setTimeout(() => router.replace('/'), 0);
    return null;
  }
  return <Redirect href={`/profile/${userId}` as any} />;
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#0a0014' },
});
