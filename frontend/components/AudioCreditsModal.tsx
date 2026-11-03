import React from 'react';
import {
  Alert,
  Linking,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';

interface AudioCreditItem {
  id: string;
  artistName: string;
  artistUrl: string;
  platformName: string;
  platformUrl: string;
  licenseOnFile?: boolean;
}

const CREDITS_DATA: AudioCreditItem[] = [
  {
    id: '1',
    artistName: 'saavane',
    artistUrl:
      'https://pixabay.com/users/saavane-32312792/?utm_source=link-attribution&utm_medium=referral&utm_campaign=music&utm_content=317860',
    platformName: 'Pixabay',
    platformUrl:
      'https://pixabay.com//?utm_source=link-attribution&utm_medium=referral&utm_campaign=music&utm_content=317860',
    licenseOnFile: true,
  },
  {
    id: '2',
    artistName: 'un known',
    artistUrl:
      'https://pixabay.com/users/zenithhh-47563722/?utm_source=link-attribution&utm_medium=referral&utm_campaign=music&utm_content=274962',
    platformName: 'Pixabay',
    platformUrl:
      'https://pixabay.com//?utm_source=link-attribution&utm_medium=referral&utm_campaign=music&utm_content=274962',
    licenseOnFile: true,
  },
  {
    id: '3',
    artistName: 'Judy Ward',
    artistUrl:
      'https://pixabay.com/users/inhalinginfinity-43211836/?utm_source=link-attribution&utm_medium=referral&utm_campaign=music&utm_content=320326',
    platformName: 'Pixabay',
    platformUrl:
      'https://pixabay.com/music//?utm_source=link-attribution&utm_medium=referral&utm_campaign=music&utm_content=320326',
  },
  {
    id: '4',
    artistName: 'Michael-X_Studio',
    artistUrl:
      'https://pixabay.com/users/michael-x_studio-37629229/?utm_source=link-attribution&utm_medium=referral&utm_campaign=music&utm_content=285027',
    platformName: 'Pixabay',
    platformUrl:
      'https://pixabay.com/music//?utm_source=link-attribution&utm_medium=referral&utm_campaign=music&utm_content=285027',
  },
  {
    id: '5',
    artistName: 'LUCI STAR',
    artistUrl:
      'https://pixabay.com/users/lucistar-51454786/?utm_source=link-attribution&utm_medium=referral&utm_campaign=music&utm_content=379156',
    platformName: 'Pixabay',
    platformUrl:
      'https://pixabay.com//?utm_source=link-attribution&utm_medium=referral&utm_campaign=music&utm_content=379156',
  },
  {
    id: '6',
    artistName: 'Leigh Robinson',
    artistUrl:
      'https://pixabay.com/users/natureseye-18615106/?utm_source=link-attribution&utm_medium=referral&utm_campaign=music&utm_content=8028',
    platformName: 'Pixabay',
    platformUrl:
      'https://pixabay.com//?utm_source=link-attribution&utm_medium=referral&utm_campaign=music&utm_content=8028',
  },
  {
    id: '7',
    artistName: 'Siarhei Korbut',
    artistUrl:
      'https://pixabay.com/users/siarhei_korbut-49383247/?utm_source=link-attribution&utm_medium=referral&utm_campaign=music&utm_content=595932',
    platformName: 'Pixabay',
    platformUrl:
      'https://pixabay.com//?utm_source=link-attribution&utm_medium=referral&utm_campaign=music&utm_content=595932',
  },
  {
    id: '8',
    artistName: 'Doobie Sadeh',
    artistUrl:
      'https://pixabay.com/users/redproductions-970568/?utm_source=link-attribution&utm_medium=referral&utm_campaign=music&utm_content=20846',
    platformName: 'Pixabay',
    platformUrl:
      'https://pixabay.com//?utm_source=link-attribution&utm_medium=referral&utm_campaign=music&utm_content=20846',
  },
];

interface AudioCreditsModalProps {
  visible: boolean;
  onClose: () => void;
  accentColor?: string;
}

export function AudioCreditsModal({
  visible,
  onClose,
  accentColor = '#a855f7',
}: AudioCreditsModalProps) {
  const handleOpenUrl = (url: string) => {
    Alert.alert(
      'Leaving Application',
      'You are about to leave the app to open an external link in your browser. Do you wish to proceed?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Open Link',
          onPress: () => {
            Linking.openURL(url).catch(() => {
              Alert.alert('Error', 'Unable to open the link.');
            });
          },
        },
      ],
      { cancelable: true }
    );
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <View style={styles.overlay}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        <View style={styles.modalContent}>
          <LinearGradient
            colors={['#1e0e3a', '#0f0321', '#0a0018']}
            style={StyleSheet.absoluteFill}
          />
          <View style={styles.header}>
            <View style={styles.headerLeft}>
              <Ionicons name="musical-notes" size={20} color={accentColor} />
              <Text style={[styles.headerTitle, { color: accentColor }]}>
                Audio Credits
              </Text>
            </View>
            <TouchableOpacity
              onPress={onClose}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              style={styles.closeBtn}
            >
              <Ionicons name="close" size={22} color="#e9d5ff" />
            </TouchableOpacity>
          </View>

          <View style={[styles.headerLine, { backgroundColor: accentColor }]} />

          <ScrollView
            style={styles.scrollView}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={true}
          >
            {CREDITS_DATA.map((item, index) => (
              <React.Fragment key={item.id}>
                <View style={styles.creditCard}>
                  <Text style={styles.creditText}>
                    Music by{' '}
                    <Text
                      style={[styles.linkText, { color: accentColor }]}
                      onPress={() => handleOpenUrl(item.artistUrl)}
                    >
                      {item.artistName}
                    </Text>{' '}
                    from{' '}
                    <Text
                      style={[styles.linkText, { color: accentColor }]}
                      onPress={() => handleOpenUrl(item.platformUrl)}
                    >
                      {item.platformName}
                    </Text>
                  </Text>
                  {item.licenseOnFile ? (
                    <Text style={styles.licenseText}>License on file</Text>
                  ) : null}
                </View>
                {index < CREDITS_DATA.length - 1 ? (
                  <View style={styles.divider} />
                ) : null}
              </React.Fragment>
            ))}
          </ScrollView>

          <TouchableOpacity
            style={[styles.doneButton, { borderColor: accentColor }]}
            onPress={onClose}
            activeOpacity={0.8}
          >
            <Text style={[styles.doneButtonText, { color: accentColor }]}>
              Close
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    width: '100%',
    maxHeight: '80%',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(168,85,247,0.35)',
    padding: 20,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.5,
    shadowRadius: 20,
    elevation: 10,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '900',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  closeBtn: {
    padding: 4,
  },
  headerLine: {
    height: 2,
    width: 48,
    borderRadius: 1,
    opacity: 0.8,
    marginBottom: 16,
  },
  scrollView: {
    width: '100%',
  },
  scrollContent: {
    paddingVertical: 4,
  },
  creditCard: {
    paddingVertical: 8,
  },
  creditText: {
    color: '#e9d5ff',
    fontSize: 14,
    lineHeight: 22,
  },
  linkText: {
    fontWeight: '700',
    textDecorationLine: 'underline',
  },
  licenseText: {
    color: '#c4b5fd',
    fontSize: 13,
    marginTop: 4,
    fontStyle: 'italic',
  },
  divider: {
    height: 1,
    backgroundColor: 'rgba(168,85,247,0.25)',
    marginVertical: 12,
  },
  doneButton: {
    marginTop: 16,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
    backgroundColor: 'rgba(15, 3, 33, 0.6)',
  },
  doneButtonText: {
    fontSize: 14,
    fontWeight: '800',
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
});
