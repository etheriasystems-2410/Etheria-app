import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';

// Configure notification handling
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

export interface NotificationPreferences {
  dailyOracle: boolean;
  oracleReadings: boolean;
  spiritGuideMessages: boolean;
  contestWinner: boolean;
  creatorMessages: boolean;
  dailyOracleTime: string; // HH:MM format
}

const DEFAULT_PREFERENCES: NotificationPreferences = {
  dailyOracle: true,
  oracleReadings: true,
  spiritGuideMessages: true,
  contestWinner: true,
  creatorMessages: true,
  dailyOracleTime: '09:00',
};

const PREFERENCES_KEY = 'notification_preferences';
const PUSH_TOKEN_KEY = 'push_token';

export async function registerForPushNotificationsAsync(): Promise<string | null> {
  let token: string | null = null;

  // Check if running on a physical device
  if (!Device.isDevice) {
    console.log('Push notifications require a physical device');
    return null;
  }

  // Check current permission status
  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;

  // Request permission if not already granted
  if (existingStatus !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }

  if (finalStatus !== 'granted') {
    console.log('Push notification permission not granted');
    return null;
  }

  // Get the Expo push token
  try {
    const projectId = Constants.expoConfig?.extra?.eas?.projectId;
    const tokenData = await Notifications.getExpoPushTokenAsync({
      projectId: projectId,
    });
    token = tokenData.data;
    
    // Store token locally
    await AsyncStorage.setItem(PUSH_TOKEN_KEY, token);
    
    console.log('Push token:', token);
  } catch (error) {
    console.error('Error getting push token:', error);
  }

  // Configure Android notification channel
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'Etheria Notifications',
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#7c3aed',
    });

    await Notifications.setNotificationChannelAsync('daily-oracle', {
      name: 'Daily Oracle Reminder',
      importance: Notifications.AndroidImportance.DEFAULT,
      description: 'Daily reminders for your oracle reading',
    });

    await Notifications.setNotificationChannelAsync('spirit-guide', {
      name: 'Spirit Guide Messages',
      importance: Notifications.AndroidImportance.HIGH,
      description: 'Messages from your spirit guide',
    });

    await Notifications.setNotificationChannelAsync('contest', {
      name: 'Contest Notifications',
      importance: Notifications.AndroidImportance.HIGH,
      description: 'Contest winner announcements',
    });
  }

  return token;
}

export async function getPushToken(): Promise<string | null> {
  return await AsyncStorage.getItem(PUSH_TOKEN_KEY);
}

export async function getNotificationPreferences(): Promise<NotificationPreferences> {
  try {
    const stored = await AsyncStorage.getItem(PREFERENCES_KEY);
    if (stored) {
      return { ...DEFAULT_PREFERENCES, ...JSON.parse(stored) };
    }
  } catch (error) {
    console.error('Error getting notification preferences:', error);
  }
  return DEFAULT_PREFERENCES;
}

export async function saveNotificationPreferences(preferences: NotificationPreferences): Promise<void> {
  try {
    await AsyncStorage.setItem(PREFERENCES_KEY, JSON.stringify(preferences));
    
    // Update scheduled notifications based on preferences
    await updateScheduledNotifications(preferences);
  } catch (error) {
    console.error('Error saving notification preferences:', error);
  }
}

export async function updateScheduledNotifications(preferences: NotificationPreferences): Promise<void> {
  // Cancel all existing scheduled notifications
  await Notifications.cancelAllScheduledNotificationsAsync();

  // Schedule daily oracle reminder if enabled
  if (preferences.dailyOracle) {
    const [hours, minutes] = preferences.dailyOracleTime.split(':').map(Number);
    
    await Notifications.scheduleNotificationAsync({
      content: {
        title: '✨ Daily Oracle Reading',
        body: 'The cards await your question. Discover what guidance the universe has for you today.',
        data: { screen: 'oracle' },
      },
      trigger: {
        hour: hours,
        minute: minutes,
        repeats: true,
      },
    });
  }
}

export async function sendLocalNotification(
  title: string,
  body: string,
  data?: Record<string, any>,
  channelId?: string
): Promise<void> {
  await Notifications.scheduleNotificationAsync({
    content: {
      title,
      body,
      data,
      ...(Platform.OS === 'android' && channelId ? { channelId } : {}),
    },
    trigger: null, // Send immediately
  });
}

export async function scheduleNotification(
  title: string,
  body: string,
  trigger: Notifications.NotificationTriggerInput,
  data?: Record<string, any>,
  channelId?: string
): Promise<string> {
  return await Notifications.scheduleNotificationAsync({
    content: {
      title,
      body,
      data,
      ...(Platform.OS === 'android' && channelId ? { channelId } : {}),
    },
    trigger,
  });
}

export function addNotificationReceivedListener(
  callback: (notification: Notifications.Notification) => void
): Notifications.EventSubscription {
  return Notifications.addNotificationReceivedListener(callback);
}

export function addNotificationResponseReceivedListener(
  callback: (response: Notifications.NotificationResponse) => void
): Notifications.EventSubscription {
  return Notifications.addNotificationResponseReceivedListener(callback);
}

export async function checkNotificationPermission(): Promise<boolean> {
  const { status } = await Notifications.getPermissionsAsync();
  return status === 'granted';
}
