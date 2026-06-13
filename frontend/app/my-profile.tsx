/**
 * My Profile — drawer shortcut that navigates to /profile/{my_user_id}.
 *
 * Implemented with `router.replace` inside an effect (instead of <Redirect/>)
 * because <Redirect/> inside a Drawer.Screen can race with the drawer's own
 * focus events and leave the user staring at a blank screen.
 */
import React, { useEffect } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '../contexts/AuthContext';

export default function MyProfileShortcut() {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;
    if (!user) {
      router.replace('/auth/login' as any);
      return;
    }
    const userId = (user as any).user_id || (user as any).id;
    if (userId) {
      router.replace(`/profile/${userId}` as any);
    } else {
      // Edge case — should never happen, but go home if it does
      router.replace('/' as any);
    }
  }, [user, loading, router]);

  return (
    <View style={styles.center}>
      <ActivityIndicator color="#fbbf24" size="large" />
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#0a0014' },
});
