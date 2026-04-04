import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Alert,
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useAuth } from '../../contexts/AuthContext';
import * as WebBrowser from 'expo-web-browser';
import * as Linking from 'expo-linking';
import AsyncStorage from '@react-native-async-storage/async-storage';

const BACKEND_URL = process.env.EXPO_PUBLIC_BACKEND_URL;

export default function Signup() {
  const router = useRouter();
  const { signup } = useAuth();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);

  const handleSignup = async () => {
    if (!name || !email || !password || !confirmPassword) {
      Alert.alert('Error', 'Please fill in all fields');
      return;
    }

    if (password !== confirmPassword) {
      Alert.alert('Error', 'Passwords do not match');
      return;
    }

    if (password.length < 6) {
      Alert.alert('Error', 'Password must be at least 6 characters');
      return;
    }

    setLoading(true);
    try {
      await signup(email.trim(), password, name.trim());
      router.replace('/');
    } catch (error: any) {
      Alert.alert('Signup Failed', error.message || 'Could not create account');
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignup = async () => {
    if (Platform.OS === 'web') {
      const redirectUrl = window.location.origin + '/auth/callback';
      window.location.href = `https://auth.emergentagent.com/?redirect=${encodeURIComponent(redirectUrl)}`;
    } else {
      try {
        setGoogleLoading(true);
        const redirectUrl = Linking.createURL('/auth/callback');
        const authUrl = `https://auth.emergentagent.com/?redirect=${encodeURIComponent(redirectUrl)}`;
        
        const result = await WebBrowser.openAuthSessionAsync(authUrl, redirectUrl);
        
        if (result.type === 'success' && result.url) {
          let sessionId: string | null = null;
          
          try {
            const url = new URL(result.url);
            sessionId = url.searchParams.get('session_id');
            
            if (!sessionId && url.hash) {
              const hashParams = new URLSearchParams(url.hash.substring(1));
              sessionId = hashParams.get('session_id');
            }
          } catch (e) {
            const match = result.url.match(/session_id=([^&]+)/);
            if (match) {
              sessionId = match[1];
            }
          }
          
          if (sessionId) {
            await processOAuthCallback(sessionId);
          } else {
            Alert.alert('Signup Failed', 'No session ID returned. Please try again.');
          }
        }
      } catch (error: any) {
        console.error('Google signup error:', error);
        Alert.alert('Signup Error', error.message || 'Failed to complete Google signup. Please try again.');
      } finally {
        setGoogleLoading(false);
      }
    }
  };

  const processOAuthCallback = async (sessionId: string) => {
    try {
      const response = await fetch(`${BACKEND_URL}/api/auth/google-callback?session_id=${sessionId}`, {
        method: 'POST',
        credentials: 'include',
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.detail || 'Authentication failed');
      }

      const userData = await response.json();

      const setCookie = response.headers.get('set-cookie');
      if (setCookie) {
        const tokenMatch = setCookie.match(/session_token=([^;]+)/);
        if (tokenMatch) {
          await AsyncStorage.setItem('session_token', tokenMatch[1]);
        }
      }

      if (userData.session_token) {
        await AsyncStorage.setItem('session_token', userData.session_token);
      }

      await AsyncStorage.setItem('user_data', JSON.stringify(userData));
      router.replace('/');
    } catch (error: any) {
      Alert.alert('Signup Failed', error.message || 'Authentication failed');
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.header}>
          <Ionicons name="sparkles" size={60} color="#b794f6" />
          <Text style={styles.title}>Create Account</Text>
          <Text style={styles.subtitle}>Begin your spiritual awakening</Text>
        </View>

        <View style={styles.form}>
          <View style={styles.inputContainer}>
            <Ionicons name="person" size={20} color="#9f7aea" style={styles.inputIcon} />
            <TextInput
              style={styles.input}
              placeholder="Name"
              placeholderTextColor="#9f7aea"
              value={name}
              onChangeText={setName}
              autoCapitalize="words"
            />
          </View>

          <View style={styles.inputContainer}>
            <Ionicons name="mail" size={20} color="#9f7aea" style={styles.inputIcon} />
            <TextInput
              style={styles.input}
              placeholder="Email"
              placeholderTextColor="#9f7aea"
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              autoComplete="email"
            />
          </View>

          <View style={styles.inputContainer}>
            <Ionicons name="lock-closed" size={20} color="#9f7aea" style={styles.inputIcon} />
            <TextInput
              style={styles.input}
              placeholder="Password"
              placeholderTextColor="#9f7aea"
              value={password}
              onChangeText={setPassword}
              secureTextEntry={!showPassword}
              autoCapitalize="none"
            />
            <TouchableOpacity
              onPress={() => setShowPassword(!showPassword)}
              style={styles.eyeIcon}
            >
              <Ionicons
                name={showPassword ? 'eye-off' : 'eye'}
                size={20}
                color="#9f7aea"
              />
            </TouchableOpacity>
          </View>

          <View style={styles.inputContainer}>
            <Ionicons name="lock-closed" size={20} color="#9f7aea" style={styles.inputIcon} />
            <TextInput
              style={styles.input}
              placeholder="Confirm Password"
              placeholderTextColor="#9f7aea"
              value={confirmPassword}
              onChangeText={setConfirmPassword}
              secureTextEntry={!showPassword}
              autoCapitalize="none"
            />
          </View>

          <TouchableOpacity
            style={[styles.signupButton, loading && styles.signupButtonDisabled]}
            onPress={handleSignup}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.signupButtonText}>Create Account</Text>
            )}
          </TouchableOpacity>

          <View style={styles.divider}>
            <View style={styles.dividerLine} />
            <Text style={styles.dividerText}>or</Text>
            <View style={styles.dividerLine} />
          </View>

          <TouchableOpacity
            style={[styles.googleButton, googleLoading && styles.signupButtonDisabled]}
            onPress={handleGoogleSignup}
            disabled={googleLoading}
          >
            {googleLoading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <>
                <Ionicons name="logo-google" size={20} color="#fff" />
                <Text style={styles.googleButtonText}>Sign up with Google</Text>
              </>
            )}
          </TouchableOpacity>

          <View style={styles.loginPrompt}>
            <Text style={styles.loginPromptText}>Already have an account? </Text>
            <TouchableOpacity onPress={() => router.push('/auth/login')}>
              <Text style={styles.loginLink}>Sign In</Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f0321',
  },
  scrollContent: {
    flexGrow: 1,
    padding: 12,
    justifyContent: 'center',
  },
  header: {
    alignItems: 'center',
    marginBottom: 48,
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#e9d5ff',
    marginTop: 16,
  },
  subtitle: {
    fontSize: 16,
    color: '#c4b5fd',
    marginTop: 8,
    textAlign: 'center',
  },
  form: {
    width: '100%',
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#2d1b4e',
    borderRadius: 12,
    paddingHorizontal: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#7c3aed',
  },
  inputIcon: {
    marginRight: 12,
  },
  input: {
    flex: 1,
    color: '#e9d5ff',
    fontSize: 16,
    paddingVertical: 16,
  },
  eyeIcon: {
    padding: 4,
  },
  signupButton: {
    backgroundColor: '#7c3aed',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 8,
  },
  signupButtonDisabled: {
    opacity: 0.6,
  },
  signupButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
  },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 20,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: '#4c1d95',
  },
  dividerText: {
    color: '#9f7aea',
    paddingHorizontal: 16,
    fontSize: 14,
  },
  googleButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#4285f4',
    paddingVertical: 16,
    borderRadius: 12,
    gap: 10,
  },
  googleButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  loginPrompt: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 24,
  },
  loginPromptText: {
    color: '#c4b5fd',
    fontSize: 16,
  },
  loginLink: {
    color: '#b794f6',
    fontSize: 16,
    fontWeight: '600',
  },
});
