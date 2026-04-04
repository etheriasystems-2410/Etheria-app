import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useAuth } from '../contexts/AuthContext';
import AsyncStorage from '@react-native-async-storage/async-storage';

const BACKEND_URL = process.env.EXPO_PUBLIC_BACKEND_URL;

interface DrawingStatus {
  is_opted_in: boolean;
  opt_in_date: string | null;
  total_entries: number;
  next_drawing: string | null;
  prize_description: string | null;
  entries_this_month: number;
}

export default function ContestDashboard() {
  const router = useRouter();
  const { user, isPremium } = useAuth();
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState<DrawingStatus | null>(null);
  const [optingIn, setOptingIn] = useState(false);

  useEffect(() => {
    fetchStatus();
  }, []);

  const fetchStatus = async () => {
    try {
      const sessionToken = await AsyncStorage.getItem('session_token');
      const response = await fetch(`${BACKEND_URL}/api/prize-drawing/status`, {
        headers: {
          'Authorization': `Bearer ${sessionToken}`
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        setStatus(data);
      }
    } catch (error) {
      console.error('Error fetching status:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleOptIn = async () => {
    if (!isPremium) {
      Alert.alert(
        'Premium Required',
        'Prize drawings are exclusive to premium members. Upgrade to participate!',
        [{ text: 'OK' }]
      );
      return;
    }

    setOptingIn(true);
    try {
      const sessionToken = await AsyncStorage.getItem('session_token');
      const response = await fetch(`${BACKEND_URL}/api/prize-drawing/opt-in`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${sessionToken}`
        }
      });
      
      if (response.ok) {
        Alert.alert('Success!', 'You are now entered in the prize drawing!');
        fetchStatus();
      } else {
        const data = await response.json();
        Alert.alert('Error', data.detail || 'Failed to opt in');
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to opt in. Please try again.');
    } finally {
      setOptingIn(false);
    }
  };

  const handleOptOut = async () => {
    Alert.alert(
      'Opt Out',
      'Are you sure you want to opt out of prize drawings?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Opt Out',
          style: 'destructive',
          onPress: async () => {
            try {
              const sessionToken = await AsyncStorage.getItem('session_token');
              const response = await fetch(`${BACKEND_URL}/api/prize-drawing/opt-out`, {
                method: 'POST',
                headers: {
                  'Authorization': `Bearer ${sessionToken}`
                }
              });
              
              if (response.ok) {
                Alert.alert('Opted Out', 'You have been removed from prize drawings.');
                fetchStatus();
              }
            } catch (error) {
              Alert.alert('Error', 'Failed to opt out. Please try again.');
            }
          }
        }
      ]
    );
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return 'TBD';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      month: 'long',
      day: 'numeric',
      year: 'numeric'
    });
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#ffd700" />
      </View>
    );
  }

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#e9d5ff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Prize Drawing</Text>
        <View style={{ width: 24 }} />
      </View>

      {/* Hero Section */}
      <View style={styles.heroSection}>
        <Ionicons name="trophy" size={64} color="#ffd700" />
        <Text style={styles.heroTitle}>Monthly Prize Drawing</Text>
        <Text style={styles.heroSubtitle}>
          Premium members are automatically entered for a chance to win!
        </Text>
      </View>

      {/* Status Card */}
      <View style={styles.statusCard}>
        <View style={styles.statusHeader}>
          <View style={[
            styles.statusBadge,
            { backgroundColor: status?.is_opted_in ? 'rgba(34, 197, 94, 0.2)' : 'rgba(156, 163, 175, 0.2)' }
          ]}>
            <Ionicons 
              name={status?.is_opted_in ? "checkmark-circle" : "close-circle"} 
              size={24} 
              color={status?.is_opted_in ? "#22c55e" : "#9ca3af"} 
            />
          </View>
          <View style={styles.statusInfo}>
            <Text style={styles.statusTitle}>
              {status?.is_opted_in ? 'You\'re Entered!' : 'Not Entered'}
            </Text>
            <Text style={styles.statusSubtitle}>
              {status?.is_opted_in 
                ? `Opted in on ${formatDate(status.opt_in_date)}`
                : 'Opt in to participate'}
            </Text>
          </View>
        </View>

        {!status?.is_opted_in ? (
          <TouchableOpacity 
            style={[styles.optInButton, !isPremium && styles.buttonDisabled]}
            onPress={handleOptIn}
            disabled={optingIn}
          >
            {optingIn ? (
              <ActivityIndicator color="#0f0321" />
            ) : (
              <>
                <Ionicons name="add-circle" size={20} color="#0f0321" />
                <Text style={styles.optInText}>
                  {isPremium ? 'Enter Drawing' : 'Premium Required'}
                </Text>
              </>
            )}
          </TouchableOpacity>
        ) : (
          <TouchableOpacity 
            style={styles.optOutButton}
            onPress={handleOptOut}
          >
            <Ionicons name="exit-outline" size={20} color="#ef4444" />
            <Text style={styles.optOutText}>Opt Out</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Stats Section */}
      <View style={styles.statsSection}>
        <Text style={styles.sectionTitle}>Your Stats</Text>
        
        <View style={styles.statsGrid}>
          <View style={styles.statCard}>
            <Ionicons name="ticket" size={32} color="#a855f7" />
            <Text style={styles.statNumber}>{status?.total_entries || 0}</Text>
            <Text style={styles.statLabel}>Total Entries</Text>
          </View>
          
          <View style={styles.statCard}>
            <Ionicons name="calendar" size={32} color="#ec4899" />
            <Text style={styles.statNumber}>{status?.entries_this_month || 0}</Text>
            <Text style={styles.statLabel}>This Month</Text>
          </View>
        </View>
      </View>

      {/* Next Drawing */}
      <View style={styles.nextDrawingSection}>
        <Text style={styles.sectionTitle}>Next Drawing</Text>
        
        <View style={styles.drawingCard}>
          <View style={styles.drawingIcon}>
            <Ionicons name="gift" size={40} color="#ffd700" />
          </View>
          <View style={styles.drawingInfo}>
            <Text style={styles.drawingDate}>
              {formatDate(status?.next_drawing)}
            </Text>
            <Text style={styles.drawingPrize}>
              {status?.prize_description || 'Monthly Premium Prize'}
            </Text>
          </View>
        </View>
      </View>

      {/* How It Works */}
      <View style={styles.howItWorks}>
        <Text style={styles.sectionTitle}>How It Works</Text>
        
        <View style={styles.stepCard}>
          <View style={styles.stepNumber}>
            <Text style={styles.stepNumberText}>1</Text>
          </View>
          <View style={styles.stepContent}>
            <Text style={styles.stepTitle}>Be a Premium Member</Text>
            <Text style={styles.stepDescription}>
              Only premium subscribers are eligible for prize drawings.
            </Text>
          </View>
        </View>

        <View style={styles.stepCard}>
          <View style={styles.stepNumber}>
            <Text style={styles.stepNumberText}>2</Text>
          </View>
          <View style={styles.stepContent}>
            <Text style={styles.stepTitle}>Opt In</Text>
            <Text style={styles.stepDescription}>
              Click the button above to enter the monthly drawing.
            </Text>
          </View>
        </View>

        <View style={styles.stepCard}>
          <View style={styles.stepNumber}>
            <Text style={styles.stepNumberText}>3</Text>
          </View>
          <View style={styles.stepContent}>
            <Text style={styles.stepTitle}>Win Prizes</Text>
            <Text style={styles.stepDescription}>
              Winners are selected randomly and notified via email.
            </Text>
          </View>
        </View>
      </View>

      <View style={{ height: 40 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f0321',
  },
  loadingContainer: {
    flex: 1,
    backgroundColor: '#0f0321',
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    backgroundColor: '#1a0033',
    borderBottomWidth: 1,
    borderBottomColor: '#2d1b4e',
  },
  backButton: {
    padding: 4,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#e9d5ff',
  },
  heroSection: {
    alignItems: 'center',
    padding: 32,
    backgroundColor: 'rgba(255, 215, 0, 0.05)',
    borderBottomWidth: 1,
    borderBottomColor: '#2d1b4e',
  },
  heroTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#ffd700',
    marginTop: 16,
  },
  heroSubtitle: {
    fontSize: 14,
    color: '#9f7aea',
    textAlign: 'center',
    marginTop: 8,
    paddingHorizontal: 20,
  },
  statusCard: {
    margin: 16,
    backgroundColor: '#1a0033',
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: '#2d1b4e',
  },
  statusHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  statusBadge: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  statusInfo: {
    flex: 1,
  },
  statusTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#e9d5ff',
  },
  statusSubtitle: {
    fontSize: 13,
    color: '#9f7aea',
    marginTop: 2,
  },
  optInButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#ffd700',
    paddingVertical: 14,
    borderRadius: 12,
    gap: 8,
  },
  optInText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#0f0321',
  },
  optOutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    paddingVertical: 14,
    borderRadius: 12,
    gap: 8,
    borderWidth: 1,
    borderColor: '#ef4444',
  },
  optOutText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#ef4444',
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  statsSection: {
    padding: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#e9d5ff',
    marginBottom: 12,
  },
  statsGrid: {
    flexDirection: 'row',
    gap: 12,
  },
  statCard: {
    flex: 1,
    backgroundColor: '#1a0033',
    borderRadius: 16,
    padding: 20,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#2d1b4e',
  },
  statNumber: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#e9d5ff',
    marginTop: 8,
  },
  statLabel: {
    fontSize: 13,
    color: '#9f7aea',
    marginTop: 4,
  },
  nextDrawingSection: {
    padding: 16,
    paddingTop: 0,
  },
  drawingCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1a0033',
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: '#ffd700',
  },
  drawingIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: 'rgba(255, 215, 0, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  drawingInfo: {
    flex: 1,
  },
  drawingDate: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#ffd700',
  },
  drawingPrize: {
    fontSize: 14,
    color: '#9f7aea',
    marginTop: 4,
  },
  howItWorks: {
    padding: 16,
    paddingTop: 0,
  },
  stepCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#1a0033',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#2d1b4e',
  },
  stepNumber: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#7c3aed',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  stepNumberText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#fff',
  },
  stepContent: {
    flex: 1,
  },
  stepTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#e9d5ff',
  },
  stepDescription: {
    fontSize: 13,
    color: '#9f7aea',
    marginTop: 4,
    lineHeight: 18,
  },
});
