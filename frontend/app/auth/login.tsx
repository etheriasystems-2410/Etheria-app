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
import * as WebBrowser from 'expo-web-browser';
import * as Linking from 'expo-linking';

// Simple math captcha generator
const generateCaptcha = () => {
  const num1 = Math.floor(Math.random() * 10) + 1;
  const num2 = Math.floor(Math.random() * 10) + 1;
  const operators = ['+', '-'];
  const operator = operators[Math.floor(Math.random() * operators.length)];
  
  let answer: number;
  if (operator === '+') {
    answer = num1 + num2;
  } else {
    // Ensure positive result
    if (num1 >= num2) {
      answer = num1 - num2;
    } else {
      return { question: `${num2} ${operator} ${num1}`, answer: num2 - num1 };
    }
  }
  
  return { question: `${num1} ${operator} ${num2}`, answer };
};

export default function Login() {
  const router = useRouter();
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  
  // Captcha state
  const [captcha, setCaptcha] = useState(generateCaptcha());
  const [captchaAnswer, setCaptchaAnswer] = useState('');
  const [captchaError, setCaptchaError] = useState(false);

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

  const refreshCaptcha = () => {
    setCaptcha(generateCaptcha());
    setCaptchaAnswer('');
    setCaptchaError(false);
  };

  const handleLogin = async () => {
    if (!email || !password) {
      Alert.alert('Error', 'Please fill in all fields');
      return;
    }

    // Validate captcha
    const userAnswer = parseInt(captchaAnswer, 10);
    if (isNaN(userAnswer) || userAnswer !== captcha.answer) {
      setCaptchaError(true);
      refreshCaptcha();
      Alert.alert('Captcha Error', 'Please solve the math problem correctly');
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
      refreshCaptcha();
      Alert.alert('Login Failed', error.message || 'Invalid email or password');
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    // REMINDER: DO NOT HARDCODE THE URL, OR ADD ANY FALLBACKS OR REDIRECT URLS, THIS BREAKS THE AUTH
    // Using Emergent Google OAuth - derive redirect URL dynamically
    if (Platform.OS === 'web') {
      const redirectUrl = window.location.origin + '/auth/callback';
      window.location.href = `https://auth.emergentagent.com/?redirect=${encodeURIComponent(redirectUrl)}`;
    } else {
      // For native apps, use WebBrowser for auth session
      try {
        setLoading(true);
        // Create the redirect URL using expo-linking
        const redirectUrl = Linking.createURL('/auth/callback');
        const authUrl = `https://auth.emergentagent.com/?redirect=${encodeURIComponent(redirectUrl)}`;
        
        console.log('Opening auth URL:', authUrl);
        console.log('Redirect URL:', redirectUrl);
        
        const result = await WebBrowser.openAuthSessionAsync(authUrl, redirectUrl);
        
        console.log('Auth result type:', result.type);
        if (result.type === 'success') {
          console.log('Auth result URL:', (result as any).url);
        }
        
        if (result.type === 'success' && (result as any).url) {
          const resultUrl = (result as any).url as string;
          // Parse the session_id from the returned URL
          // Emergent OAuth returns: redirect_url#session_id=xxx
          let sessionId: string | null = null;
          
          // Method 1: Check hash fragment first (most common for OAuth)
          if (resultUrl.includes('#')) {
            const hashPart = resultUrl.split('#')[1];
            if (hashPart) {
              const hashParams = new URLSearchParams(hashPart);
              sessionId = hashParams.get('session_id');
              console.log('Session ID from hash:', sessionId);
            }
          }
          
          // Method 2: Check query params
          if (!sessionId && resultUrl.includes('?')) {
            try {
              const url = new URL(resultUrl);
              sessionId = url.searchParams.get('session_id');
              console.log('Session ID from query:', sessionId);
            } catch (e) {
              // URL parsing might fail for exp:// URLs
              const queryMatch = resultUrl.match(/\?([^#]*)/);
              if (queryMatch) {
                const queryParams = new URLSearchParams(queryMatch[1]);
                sessionId = queryParams.get('session_id');
                console.log('Session ID from manual query parse:', sessionId);
              }
            }
          }
          
          // Method 3: Regex fallback for any location
          if (!sessionId) {
            const match = resultUrl.match(/session_id=([^&\s#]+)/);
            if (match) {
              sessionId = decodeURIComponent(match[1]);
              console.log('Session ID from regex:', sessionId);
            }
          }
          
          if (sessionId) {
            // Process the callback
            await processOAuthCallback(sessionId);
          } else {
            console.log('Full result URL:', resultUrl);
            Alert.alert('Login Failed', 'No session ID returned from authentication. Please try again.');
          }
        } else if (result.type === 'cancel') {
          // User cancelled - do nothing
          console.log('User cancelled login');
        } else if (result.type === 'dismiss') {
          console.log('Browser dismissed');
        }
      } catch (error: any) {
        console.error('Google login error:', error);
        Alert.alert('Login Error', error.message || 'Failed to complete Google login. Please try again.');
      } finally {
        setLoading(false);
      }
    }
  };

  const processOAuthCallback = async (sessionId: string) => {
    setLoading(true);
    try {
      const BACKEND_URL = process.env.EXPO_PUBLIC_BACKEND_URL;
      console.log('Processing OAuth callback with session:', sessionId);
      
      const response = await fetch(`${BACKEND_URL}/api/auth/google-callback?session_id=${sessionId}`, {
        method: 'POST',
        credentials: 'include',
      });

      console.log('OAuth callback response status:', response.status);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        console.error('OAuth callback error:', errorData);
        throw new Error(errorData.detail || 'Authentication failed');
      }

      const userData = await response.json();
      console.log('OAuth callback user data:', JSON.stringify(userData));

      // Get session token from response body (for mobile)
      if (userData.session_token) {
        console.log('Saving session token from response');
        await AsyncStorage.setItem('session_token', userData.session_token);
      }

      // Also check cookies as fallback
      const setCookie = response.headers.get('set-cookie');
      if (setCookie && !userData.session_token) {
        const tokenMatch = setCookie.match(/session_token=([^;]+)/);
        if (tokenMatch) {
          console.log('Saving session token from cookie');
          await AsyncStorage.setItem('session_token', tokenMatch[1]);
        }
      }

      // Store user data
      await AsyncStorage.setItem('user_data', JSON.stringify(userData));
      
      console.log('Google login successful, redirecting...');
      
      // Navigate to home
      router.replace('/');
    } catch (error: any) {
      console.error('processOAuthCallback error:', error);
      Alert.alert('Login Failed', error.message || 'Authentication failed');
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

            {/* Captcha Section */}
            <View style={styles.captchaSection}>
              <View style={styles.captchaHeader}>
                <Ionicons name="shield-checkmark" size={18} color="#9f7aea" />
                <Text style={styles.captchaLabel}>Security Check</Text>
              </View>
              <View style={styles.captchaRow}>
                <View style={styles.captchaQuestion}>
                  <Text style={styles.captchaText}>What is {captcha.question} = ?</Text>
                </View>
                <TextInput
                  style={[
                    styles.captchaInput,
                    captchaError && styles.captchaInputError
                  ]}
                  placeholder="?"
                  placeholderTextColor="#9f7aea"
                  value={captchaAnswer}
                  onChangeText={(text) => {
                    setCaptchaAnswer(text);
                    setCaptchaError(false);
                  }}
                  keyboardType="number-pad"
                  maxLength={3}
                />
                <TouchableOpacity onPress={refreshCaptcha} style={styles.refreshButton}>
                  <Ionicons name="refresh" size={20} color="#b794f6" />
                </TouchableOpacity>
              </View>
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

            <View style={styles.divider}>
              <View style={styles.dividerLine} />
              <Text style={styles.dividerText}>or</Text>
              <View style={styles.dividerLine} />
            </View>

            {/* Google Login - No captcha needed */}
            <TouchableOpacity style={styles.googleButton} onPress={handleGoogleLogin}>
              <Ionicons name="logo-google" size={20} color="#fff" />
              <Text style={styles.googleButtonText}>Continue with Google</Text>
              <View style={styles.noCaptchaBadge}>
                <Ionicons name="flash" size={12} color="#ffd700" />
              </View>
            </TouchableOpacity>
            <Text style={styles.googleHint}>No captcha required</Text>

            <View style={styles.signupPrompt}>
              <Text style={styles.signupPromptText}>Don't have an account? </Text>
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
