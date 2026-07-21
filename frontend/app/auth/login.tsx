import React, { useState, useEffect } from 'react';
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
import AsyncStorage from '@react-native-async-storage/async-storage';

export default function Login() {
  const router = useRouter();
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);

  // Load remembered email on mount
  useEffect(() => {
    loadRememberedEmail();
  }, []);

  const loadRememberedEmail = async () => {
    try {
      const rememberedEmail = await AsyncStorage.getItem('remembered_email');
      const wasRemembered = await AsyncStorage.getItem('remember_me');
      if (rememberedEmail && wasRemembered === 'true') {
        setEmail(rememberedEmail);
        setRememberMe(true);
      }
    } catch (error) {
      console.error('Error loading remembered email:', error);
    }
  };

  const handleLogin = async () => {
    if (!email || !password) {
      Alert.alert('Error', 'Please fill in all fields');
      return;
    }

    setLoading(true);
    try {
      await login(email.trim(), password);
      
      // Handle Remember Me
      if (rememberMe) {
        await AsyncStorage.setItem('remembered_email', email.trim());
        await AsyncStorage.setItem('remember_me', 'true');
      } else {
        await AsyncStorage.removeItem('remembered_email');
        await AsyncStorage.setItem('remember_me', 'false');
      }
      
      router.replace('/');
    } catch (error: any) {
      Alert.alert('Login Failed', error.message || 'Invalid email or password');
    } finally {
      setLoading(false);
    }
  };


  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView 
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.content}>
          <View style={styles.header}>
            <View style={styles.moonBubble}>
              <Ionicons name="moon" size={36} color="#fbbf24" />
            </View>
            <Text style={styles.eyebrow}>✦ Welcome ✦</Text>
            <Text style={styles.title}>Welcome Back</Text>
            <View style={styles.glyphRow}>
              <View style={styles.glyphLine} />
              <Ionicons name="sparkles" size={11} color="#fbbf24" style={{ marginHorizontal: 8 }} />
              <View style={styles.glyphLine} />
            </View>
            <Text style={styles.subtitle}>Sign in to continue your spiritual journey</Text>
          </View>

          <View style={styles.form}>
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

            {/* Remember Me Checkbox */}
            <TouchableOpacity
              style={styles.rememberMeRow}
              onPress={() => setRememberMe(!rememberMe)}
            >
              <View style={[styles.checkbox, rememberMe && styles.checkboxChecked]}>
                {rememberMe && (
                  <Ionicons name="checkmark" size={16} color="#1a0033" />
                )}
              </View>
              <Text style={styles.rememberMeText}>Remember me</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.loginButton, loading && styles.loginButtonDisabled]}
              onPress={handleLogin}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.loginButtonText}>Sign In</Text>
              )}
            </TouchableOpacity>

            <View style={styles.signupPrompt}>
              <Text style={styles.signupPromptText}>Don{'\u2019'}t have an account? </Text>
              <TouchableOpacity onPress={() => router.push('/auth/signup')}>
                <Text style={styles.signupLink}>Sign Up</Text>
              </TouchableOpacity>
            </View>
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
  },
  content: {
    flex: 1,
    padding: 12,
    justifyContent: 'center',
  },
  header: {
    alignItems: 'center',
    marginBottom: 32,
  },
  moonBubble: {
    width: 76,
    height: 76,
    borderRadius: 38,
    backgroundColor: 'rgba(251,191,36,0.10)',
    borderWidth: 1,
    borderColor: 'rgba(251,191,36,0.4)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
    shadowColor: '#fbbf24',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.4,
    shadowRadius: 18,
    elevation: 8,
  },
  eyebrow: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1.6,
    color: '#fbbf24',
    marginBottom: 4,
  },
  glyphRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
    marginBottom: 4,
  },
  glyphLine: { width: 32, height: 1, backgroundColor: 'rgba(251,191,36,0.55)' },
  title: {
    fontSize: 28,
    fontWeight: '800',
    color: '#ffffff',
    letterSpacing: 0.3,
    textShadowColor: 'rgba(168,85,247,0.6)',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 12,
  },
  subtitle: {
    fontSize: 13,
    color: '#c4b5fd',
    marginTop: 4,
    textAlign: 'center',
    fontStyle: 'italic',
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
  captchaSection: {
    backgroundColor: '#1a0033',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#2d1b4e',
  },
  captchaHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  captchaLabel: {
    color: '#9f7aea',
    fontSize: 14,
    fontWeight: '600',
  },
  captchaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  captchaQuestion: {
    flex: 1,
    backgroundColor: '#2d1b4e',
    borderRadius: 8,
    padding: 12,
  },
  captchaText: {
    color: '#e9d5ff',
    fontSize: 16,
    fontWeight: '600',
  },
  captchaInput: {
    width: 60,
    backgroundColor: '#2d1b4e',
    borderRadius: 8,
    padding: 12,
    color: '#e9d5ff',
    fontSize: 16,
    textAlign: 'center',
    borderWidth: 1,
    borderColor: '#7c3aed',
  },
  captchaInputError: {
    borderColor: '#ef4444',
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
  },
  refreshButton: {
    padding: 12,
    backgroundColor: '#2d1b4e',
    borderRadius: 8,
  },
  rememberMeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
    gap: 12,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: '#7c3aed',
    backgroundColor: '#2d1b4e',
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxChecked: {
    backgroundColor: '#b794f6',
    borderColor: '#b794f6',
  },
  rememberMeText: {
    color: '#c4b5fd',
    fontSize: 15,
  },
  loginButton: {
    backgroundColor: '#7c3aed',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
  },
  loginButtonDisabled: {
    opacity: 0.6,
  },
  loginButtonText: {
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
    backgroundColor: '#2d1b4e',
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
    backgroundColor: '#2d1b4e',
    borderRadius: 12,
    paddingVertical: 16,
    borderWidth: 1,
    borderColor: '#7c3aed',
    gap: 12,
    position: 'relative',
  },
  googleButtonText: {
    color: '#e9d5ff',
    fontSize: 16,
    fontWeight: '600',
  },
  noCaptchaBadge: {
    position: 'absolute',
    right: 16,
  },
  googleHint: {
    textAlign: 'center',
    color: '#9f7aea',
    fontSize: 12,
    marginTop: 8,
  },
  signupPrompt: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 24,
  },
  signupPromptText: {
    color: '#c4b5fd',
    fontSize: 16,
  },
  signupLink: {
    color: '#b794f6',
    fontSize: 16,
    fontWeight: '600',
  },
});
