import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { Drawer } from 'expo-router/drawer';
import { Ionicons } from '@expo/vector-icons';
import { StyleSheet } from 'react-native';

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={styles.container}>
      <Drawer
        screenOptions={{
          drawerStyle: {
            backgroundColor: '#1a0033',
          },
          drawerActiveTintColor: '#b794f6',
          drawerInactiveTintColor: '#9f7aea',
          headerStyle: {
            backgroundColor: '#2d1b4e',
          },
          headerTintColor: '#e9d5ff',
          headerTitleStyle: {
            fontWeight: 'bold',
          },
        }}
      >
        <Drawer.Screen
          name="index"
          options={{
            drawerLabel: 'Home',
            title: 'Psychic Awareness',
            drawerIcon: ({ color, size }) => (
              <Ionicons name="home" size={size} color={color} />
            ),
          }}
        />
        <Drawer.Screen
          name="training"
          options={{
            drawerLabel: 'Psychic Training',
            title: 'Psychic Training',
            drawerIcon: ({ color, size }) => (
              <Ionicons name="school" size={size} color={color} />
            ),
          }}
        />
        <Drawer.Screen
          name="oracle"
          options={{
            drawerLabel: 'Oracle Divination',
            title: 'Oracle Divination',
            drawerIcon: ({ color, size }) => (
              <Ionicons name="sparkles" size={size} color={color} />
            ),
          }}
        />
        <Drawer.Screen
          name="spirit-guides"
          options={{
            drawerLabel: 'Spirit Guides',
            title: 'Spirit Guides',
            drawerIcon: ({ color, size }) => (
              <Ionicons name="chatbubbles" size={size} color={color} />
            ),
          }}
        />
        <Drawer.Screen
          name="meditation"
          options={{
            drawerLabel: 'Meditation',
            title: 'Meditation Hub',
            drawerIcon: ({ color, size }) => (
              <Ionicons name="fitness" size={size} color={color} />
            ),
          }}
        />
        <Drawer.Screen
          name="journal"
          options={{
            drawerLabel: 'Journal',
            title: 'My Journal',
            drawerIcon: ({ color, size }) => (
              <Ionicons name="book" size={size} color={color} />
            ),
          }}
        />
      </Drawer>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});
