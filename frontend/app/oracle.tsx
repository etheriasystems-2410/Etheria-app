import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Modal,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

const BACKEND_URL = process.env.EXPO_PUBLIC_BACKEND_URL;

interface Reading {
  card: {
    name: string;
    element: string;
    description: string;
  };
  interpretation: string;
  timestamp: string;
}

export default function Oracle() {
  const [loading, setLoading] = useState(false);
  const [currentReading, setCurrentReading] = useState<Reading | null>(null);
  const [showReading, setShowReading] = useState(false);

  const drawCard = async () => {
    setLoading(true);
    try {
      const response = await fetch(`${BACKEND_URL}/api/oracle/draw`, {
        method: 'POST',
      });
      const data = await response.json();
      setCurrentReading(data);
      setShowReading(true);
    } catch (error) {
      console.error('Error drawing card:', error);
    } finally {
      setLoading(false);
    }
  };

  const saveReading = async () => {
    if (!currentReading) return;
    try {
      await fetch(`${BACKEND_URL}/api/oracle/save`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(currentReading),
      });
      setShowReading(false);
      setCurrentReading(null);
    } catch (error) {
      console.error('Error saving reading:', error);
    }
  };

  const getElementColor = (element: string) => {
    switch (element.toLowerCase()) {
      case 'fire':
        return '#ef4444';
      case 'water':
        return '#3b82f6';
      case 'earth':
        return '#10b981';
      case 'air':
        return '#a855f7';
      default:
        return '#8b5cf6';
    }
  };

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.header}>
          <Ionicons name="sparkles" size={60} color="#b794f6" />
          <Text style={styles.title}>Oracle Divination</Text>
          <Text style={styles.subtitle}>Seek wisdom from the spirit guides</Text>
        </View>

        <View style={styles.cardContainer}>
          <View style={styles.cardBack}>
            <Ionicons name="moon" size={80} color="#b794f6" />
          </View>
        </View>

        <TouchableOpacity
          style={[styles.drawButton, loading && styles.drawButtonDisabled]}
          onPress={drawCard}
          disabled={loading}
          activeOpacity={0.8}
        >
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <>
              <Ionicons name="hand-left" size={24} color="#fff" />
              <Text style={styles.drawButtonText}>Draw a Card</Text>
            </>
          )}
        </TouchableOpacity>

        <TouchableOpacity style={styles.historyButton} activeOpacity={0.7}>
          <Ionicons name="time" size={20} color="#c4b5fd" />
          <Text style={styles.historyButtonText}>View Past Readings</Text>
        </TouchableOpacity>
      </ScrollView>

      <Modal visible={showReading} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <ScrollView>
              {currentReading && (
                <>
                  <View style={styles.modalHeader}>
                    <View
                      style={[
                        styles.elementBadge,
                        { backgroundColor: getElementColor(currentReading.card.element) },
                      ]}
                    >
                      <Text style={styles.elementText}>{currentReading.card.element}</Text>
                    </View>
                  </View>
                  <Text style={styles.cardName}>{currentReading.card.name}</Text>
                  <Text style={styles.cardDescription}>{currentReading.card.description}</Text>
                  <View style={styles.divider} />
                  <Text style={styles.interpretationTitle}>Interpretation</Text>
                  <Text style={styles.interpretation}>{currentReading.interpretation}</Text>
                </>
              )}
            </ScrollView>
            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.modalButton, styles.saveButton]}
                onPress={saveReading}
              >
                <Ionicons name="save" size={20} color="#fff" />
                <Text style={styles.modalButtonText}>Save Reading</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalButton, styles.closeButton]}
                onPress={() => setShowReading(false)}
              >
                <Text style={styles.modalButtonText}>Close</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f0321',
  },
  scrollContent: {
    padding: 20,
    alignItems: 'center',
  },
  header: {
    alignItems: 'center',
    marginBottom: 40,
    marginTop: 20,
  },
  title: {
    fontSize: 28,
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
  cardContainer: {
    marginBottom: 40,
  },
  cardBack: {
    width: 200,
    height: 300,
    backgroundColor: '#1a0033',
    borderRadius: 20,
    borderWidth: 2,
    borderColor: '#b794f6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  drawButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#7c3aed',
    paddingHorizontal: 32,
    paddingVertical: 16,
    borderRadius: 25,
    gap: 8,
    minWidth: 180,
    justifyContent: 'center',
  },
  drawButtonDisabled: {
    opacity: 0.6,
  },
  drawButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
  },
  historyButton: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 16,
    gap: 8,
  },
  historyButtonText: {
    color: '#c4b5fd',
    fontSize: 16,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.9)',
    justifyContent: 'center',
    padding: 20,
  },
  modalContent: {
    backgroundColor: '#1a0033',
    borderRadius: 24,
    padding: 24,
    maxHeight: '90%',
    borderWidth: 1,
    borderColor: '#2d1b4e',
  },
  modalHeader: {
    alignItems: 'center',
    marginBottom: 16,
  },
  elementBadge: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
  },
  elementText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  cardName: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#e9d5ff',
    textAlign: 'center',
    marginBottom: 12,
  },
  cardDescription: {
    fontSize: 16,
    color: '#c4b5fd',
    textAlign: 'center',
    marginBottom: 20,
  },
  divider: {
    height: 1,
    backgroundColor: '#2d1b4e',
    marginVertical: 20,
  },
  interpretationTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#b794f6',
    marginBottom: 12,
  },
  interpretation: {
    fontSize: 16,
    color: '#e9d5ff',
    lineHeight: 24,
    marginBottom: 20,
  },
  modalButtons: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 16,
  },
  modalButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 12,
    gap: 8,
  },
  saveButton: {
    backgroundColor: '#7c3aed',
  },
  closeButton: {
    backgroundColor: '#2d1b4e',
  },
  modalButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});
