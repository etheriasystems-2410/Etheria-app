import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Image } from 'expo-image';
import { useAuth } from '../contexts/AuthContext';
import AsyncStorage from '@react-native-async-storage/async-storage';

const ETHERIA_IMAGE = 'https://customer-assets.emergentagent.com/job_meditation-nexus/artifacts/bfuvm2xh_4327b8ef020d7d471270d8452f31001dbd0d1e664d07a7235c64a236b0e6f6e6.jpg';
const BACKEND_URL = process.env.EXPO_PUBLIC_BACKEND_URL;

export default function Home() {
  const router = useRouter();
  const { isAuthenticated, user, isPremium } = useAuth();
  
  // Prize Drawing State
  const [prizeDrawingStatus, setPrizeDrawingStatus] = React.useState<{
    opted_in: boolean;
    eligible: boolean;
    weekly_usage_minutes: number;
    required_minutes: number;
    next_drawing?: string;
  } | null>(null);
  const [loadingPrizeStatus, setLoadingPrizeStatus] = React.useState(false);
  const [optingIn, setOptingIn] = React.useState(false);

  // Fetch prize drawing status when authenticated
  React.useEffect(() => {
    if (isAuthenticated) {
      fetchPrizeDrawingStatus();
    }
  }, [isAuthenticated]);

  const fetchPrizeDrawingStatus = async () => {
    setLoadingPrizeStatus(true);
    try {
      const sessionToken = await AsyncStorage.getItem('session_token');
      const response = await fetch(`${BACKEND_URL}/api/prize-drawing/status`, {
        headers: {
          'Authorization': `Bearer ${sessionToken}`
        }
      });
      const data = await response.json();
      setPrizeDrawingStatus(data);
    } catch (error) {
      console.error('Error fetching prize drawing status:', error);
    } finally {
      setLoadingPrizeStatus(false);
    }
  };

  const handleOptInPrizeDrawing = async (optIn: boolean) => {
    setOptingIn(true);
    try {
      const sessionToken = await AsyncStorage.getItem('session_token');
      const response = await fetch(`${BACKEND_URL}/api/prize-drawing/opt-in`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${sessionToken}`
        },
        body: JSON.stringify({ opt_in: optIn })
      });
      
      const data = await response.json();
      
      if (data.success) {
        setPrizeDrawingStatus(prev => prev ? { ...prev, opted_in: optIn } : null);
        Alert.alert(
          optIn ? 'Entered!' : 'Opted Out',
          data.message
        );
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to update prize drawing preference');
    } finally {
      setOptingIn(false);
    }
  };

  const features = [
    {
      title: 'Psychic Training',
      description: 'Develop your psychic abilities with guided lessons',
      icon: 'school' as const,
      route: '/training',
    },
    {
      title: 'Oracle Divination',
      description: 'Receive guidance from spirit guide oracle cards',
      icon: 'sparkles' as const,
      route: '/oracle',
    },
    {
      title: 'Spirit Guides',
      description: 'Chat with elemental spirit guides',
      icon: 'chatbubbles' as const,
      route: '/spirit-guides',
    },
    {
      title: 'Meditation',
      description: 'Practice meditation and astral travel',
      icon: 'fitness' as const,
      route: '/meditation',
    },
    {
      title: 'Journal',
      description: 'Track your spiritual journey',
      icon: 'book' as const,
      route: '/journal',
    },
  ];

  return (
    <ScrollView style={styles.container}>
      {/* Auth Buttons - Show login/signup if not authenticated */}
      {!isAuthenticated ? (
        <View style={styles.authSection}>
          <View style={styles.authButtons}>
            <TouchableOpacity
              style={styles.loginButton}
              onPress={() => router.push('/auth/login')}
            >
              <Ionicons name="log-in" size={20} color="#1a0033" />
              <Text style={styles.loginButtonText}>Log In</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.signupButton}
              onPress={() => router.push('/auth/signup')}
            >
              <Ionicons name="person-add" size={20} color="#b794f6" />
              <Text style={styles.signupButtonText}>Sign Up</Text>
            </TouchableOpacity>
          </View>
        </View>
      ) : (
        <View style={styles.userWelcome}>
          <View style={styles.userInfo}>
            <Ionicons name="person-circle" size={24} color="#b794f6" />
            <Text style={styles.userGreeting}>Welcome, {user?.name || 'Seeker'}</Text>
            {isPremium && (
              <View style={styles.premiumBadgeSmall}>
                <Ionicons name="star" size={12} color="#ffd700" />
              </View>
            )}
          </View>
        </View>
      )}

      {/* Hero Section with Image */}
      <View style={styles.heroSection}>
        <Image
          source={{ uri: ETHERIA_IMAGE }}
          style={styles.heroImage}
          contentFit="cover"
        />
        <View style={styles.heroOverlay}>
          <Text style={styles.heroTitle}>Welcome to Etheria</Text>
        </View>
      </View>

      {/* Welcome Message */}
      <View style={styles.welcomeSection}>
        <Text style={styles.welcomeText}>
          Discover tools to help you progress on your spiritual path. Practice and develop latent psychic abilities, enjoy guided meditations in this realm and beyond, consult a fully-intuitive oracle deck to receive guidance from your spirit guides, or communicate directly with a spirit guide attuned to your zodiac sign.
        </Text>

        <View style={styles.pricingCard}>
          <Ionicons name="diamond" size={28} color="#ffd700" />
          <Text style={styles.pricingTitle}>Unlock Full Access</Text>
          <Text style={styles.pricingText}>
            Access everything Etheria has to offer for a monthly commitment of only{' '}
            <Text style={styles.priceHighlight}>$3.99</Text>.
          </Text>
          <Text style={styles.pricingText}>
            A small investment to completely unlock your spiritual potential. Join today!
          </Text>
          <TouchableOpacity 
            style={styles.subscribeButton}
            onPress={() => router.push('/settings')}
          >
            <Ionicons name="star" size={20} color="#1a0033" />
            <Text style={styles.subscribeButtonText}>Subscribe Now</Text>
          </TouchableOpacity>
        </View>

        {/* Prize Drawing Section */}
        {isAuthenticated && (
          <View style={styles.prizeDrawingCard}>
            <View style={styles.prizeDrawingHeader}>
              <Ionicons name="gift" size={28} color="#ffd700" />
              <Text style={styles.prizeDrawingTitle}>Monthly Prize Drawing</Text>
            </View>
            
            <Text style={styles.prizeDrawingText}>
              Win a FREE month of Premium! Use the app's free features for at least 30 minutes per week to be eligible.
            </Text>

            {loadingPrizeStatus ? (
              <ActivityIndicator color="#b794f6" style={{ marginVertical: 12 }} />
            ) : prizeDrawingStatus ? (
              <>
                <View style={styles.usageProgress}>
                  <Text style={styles.usageLabel}>This Week's Usage:</Text>
                  <View style={styles.progressBar}>
                    <View 
                      style={[
                        styles.progressFill, 
                        { 
                          width: `${Math.min(100, (prizeDrawingStatus.weekly_usage_minutes / prizeDrawingStatus.required_minutes) * 100)}%` 
                        }
                      ]} 
                    />
                  </View>
                  <Text style={styles.usageText}>
                    {prizeDrawingStatus.weekly_usage_minutes.toFixed(0)} / {prizeDrawingStatus.required_minutes} min
                  </Text>
                </View>

                {prizeDrawingStatus.opted_in ? (
                  <View style={styles.optedInContainer}>
                    <View style={styles.optedInBadge}>
                      <Ionicons name="checkmark-circle" size={20} color="#10b981" />
                      <Text style={styles.optedInText}>You're entered!</Text>
                    </View>
                    {prizeDrawingStatus.next_drawing && (
                      <Text style={styles.nextDrawingText}>
                        Next drawing: {new Date(prizeDrawingStatus.next_drawing).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
                      </Text>
                    )}
                    <TouchableOpacity
                      style={styles.optOutButton}
                      onPress={() => handleOptInPrizeDrawing(false)}
                      disabled={optingIn}
                    >
                      <Text style={styles.optOutButtonText}>Opt Out</Text>
                    </TouchableOpacity>
                  </View>
                ) : (
                  <TouchableOpacity
                    style={[styles.enterDrawingButton, optingIn && styles.buttonDisabled]}
                    onPress={() => handleOptInPrizeDrawing(true)}
                    disabled={optingIn}
                  >
                    {optingIn ? (
                      <ActivityIndicator color="#1a0033" />
                    ) : (
                      <>
                        <Ionicons name="ticket" size={20} color="#1a0033" />
                        <Text style={styles.enterDrawingButtonText}>Enter Drawing</Text>
                      </>
                    )}
                  </TouchableOpacity>
                )}
              </>
            ) : (
              <Text style={styles.prizeDrawingText}>Loading status...</Text>
            )}
          </View>
        )}
      </View>

      {/* Features Grid */}
      <View style={styles.featuresHeader}>
        <Text style={styles.featuresHeaderText}>Explore Features</Text>
      </View>

      <View style={styles.featuresContainer}>
        {features.map((feature, index) => (
          <TouchableOpacity
            key={index}
            style={styles.featureCard}
            onPress={() => router.push(feature.route as any)}
            activeOpacity={0.7}
          >
            <View style={styles.featureIcon}>
              <Ionicons name={feature.icon} size={32} color="#e9d5ff" />
            </View>
            <View style={styles.featureContent}>
              <Text style={styles.featureTitle}>{feature.title}</Text>
              <Text style={styles.featureDescription}>{feature.description}</Text>
            </View>
            <Ionicons name="chevron-forward" size={24} color="#9f7aea" />
          </TouchableOpacity>
        ))}
      </View>

      {/* Footer */}
      <View style={styles.footer}>
        <Text style={styles.footerText}>
          We hope you enjoy our first application from Etheria Systems.
        </Text>
        <Text style={styles.signature}>-Etheria Developer</Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f0321',
  },
  authSection: {
    padding: 12,
    paddingTop: 12,
    paddingBottom: 8,
  },
  authButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  loginButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#b794f6',
    paddingVertical: 14,
    borderRadius: 12,
    gap: 8,
  },
  loginButtonText: {
    color: '#1a0033',
    fontSize: 16,
    fontWeight: 'bold',
  },
  signupButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#b794f6',
    gap: 8,
  },
  signupButtonText: {
    color: '#b794f6',
    fontSize: 16,
    fontWeight: 'bold',
  },
  userWelcome: {
    padding: 12,
    paddingTop: 12,
    paddingBottom: 8,
  },
  userInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  userGreeting: {
    color: '#e9d5ff',
    fontSize: 16,
    fontWeight: '500',
  },
  premiumBadgeSmall: {
    backgroundColor: 'rgba(255, 215, 0, 0.2)',
    padding: 4,
    borderRadius: 10,
  },
  heroSection: {
    height: 280,
    position: 'relative',
  },
  heroImage: {
    width: '100%',
    height: '100%',
  },
  heroOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: 16,
    paddingBottom: 24,
    backgroundColor: 'rgba(15, 3, 33, 0.7)',
  },
  heroTitle: {
    fontSize: 36,
    fontWeight: 'bold',
    color: '#e9d5ff',
    textAlign: 'center',
  },
  welcomeSection: {
    padding: 12,
  },
  welcomeText: {
    fontSize: 16,
    lineHeight: 26,
    color: '#c4b5fd',
    textAlign: 'center',
    marginBottom: 24,
  },
  pricingCard: {
    backgroundColor: '#1a0033',
    borderRadius: 20,
    padding: 16,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#7c3aed',
    marginTop: 8,
  },
  pricingTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#ffd700',
    marginTop: 12,
    marginBottom: 16,
  },
  pricingText: {
    fontSize: 15,
    lineHeight: 24,
    color: '#c4b5fd',
    textAlign: 'center',
    marginBottom: 12,
  },
  priceHighlight: {
    color: '#ffd700',
    fontWeight: 'bold',
    fontSize: 18,
  },
  subscribeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#b794f6',
    paddingHorizontal: 32,
    paddingVertical: 14,
    borderRadius: 25,
    marginTop: 16,
    gap: 8,
  },
  subscribeButtonText: {
    color: '#1a0033',
    fontSize: 18,
    fontWeight: 'bold',
  },
  featuresHeader: {
    paddingHorizontal: 12,
    paddingTop: 24,
    paddingBottom: 12,
  },
  featuresHeaderText: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#e9d5ff',
  },
  featuresContainer: {
    padding: 16,
    paddingTop: 4,
  },
  featureCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1a0033',
    borderRadius: 16,
    padding: 20,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#2d1b4e',
  },
  featureIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#2d1b4e',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
  },
  featureContent: {
    flex: 1,
  },
  featureTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#e9d5ff',
    marginBottom: 4,
  },
  featureDescription: {
    fontSize: 14,
    color: '#c4b5fd',
  },
  footer: {
    padding: 24,
    paddingBottom: 40,
    alignItems: 'center',
  },
  footerText: {
    fontSize: 15,
    color: '#9f7aea',
    textAlign: 'center',
    fontStyle: 'italic',
    lineHeight: 22,
  },
  signature: {
    fontSize: 16,
    color: '#b794f6',
    marginTop: 12,
    fontWeight: '600',
  },
  // Prize Drawing Styles
  prizeDrawingCard: {
    backgroundColor: 'rgba(16, 185, 129, 0.1)',
    borderRadius: 20,
    padding: 20,
    marginTop: 20,
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.3)',
  },
  prizeDrawingHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 12,
  },
  prizeDrawingTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#ffd700',
  },
  prizeDrawingText: {
    fontSize: 14,
    color: '#c4b5fd',
    lineHeight: 22,
    marginBottom: 16,
  },
  usageProgress: {
    marginBottom: 16,
  },
  usageLabel: {
    fontSize: 13,
    color: '#9f7aea',
    marginBottom: 8,
  },
  progressBar: {
    height: 8,
    backgroundColor: 'rgba(124, 58, 237, 0.3)',
    borderRadius: 4,
    overflow: 'hidden',
    marginBottom: 4,
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#10b981',
    borderRadius: 4,
  },
  usageText: {
    fontSize: 12,
    color: '#c4b5fd',
    textAlign: 'right',
  },
  optedInContainer: {
    alignItems: 'center',
    gap: 8,
  },
  optedInBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(16, 185, 129, 0.2)',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    gap: 6,
  },
  optedInText: {
    color: '#10b981',
    fontSize: 14,
    fontWeight: '600',
  },
  nextDrawingText: {
    color: '#9f7aea',
    fontSize: 13,
  },
  optOutButton: {
    marginTop: 8,
    paddingVertical: 6,
    paddingHorizontal: 16,
  },
  optOutButtonText: {
    color: '#ef4444',
    fontSize: 13,
  },
  enterDrawingButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#10b981',
    paddingVertical: 14,
    borderRadius: 12,
    gap: 8,
  },
  enterDrawingButtonText: {
    color: '#1a0033',
    fontSize: 16,
    fontWeight: 'bold',
  },
  buttonDisabled: {
    opacity: 0.7,
  },
});
