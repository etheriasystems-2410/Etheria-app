import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { useLanguage } from '../contexts/LanguageContext';
import { useTheme } from '../contexts/ThemeContext';
import { Mist } from '../components/ui';
import { palette, spacing, radii } from '../theme/tokens';

interface MeditationType {
  id: string;
  icon: string;
  color: string;
  route: string;
}

const meditationTypeIds: MeditationType[] = [
  { id: 'chakra', icon: 'ellipse', color: '#ec4899', route: '/meditation/chakra' },
  { id: 'binaural', icon: 'headset', color: '#8b5cf6', route: '/meditation/binaural' },
  { id: 'aiGuided', icon: 'mic', color: '#3b82f6', route: '/meditation/ai-guided' },
  { id: 'timed', icon: 'timer', color: '#10b981', route: '/meditation/timed' },
];

export default function Meditation() {
  const router = useRouter();
  const { t, languageCode } = useLanguage();
  const { theme } = useTheme();

  // Translated meditation types
  const getMeditationTitle = (id: string): string => {
    const titles: Record<string, Record<string, string>> = {
      chakra: { en: 'Chakra Meditation', es: 'Meditación de Chakras', fr: 'Méditation des Chakras', de: 'Chakra Meditation', it: 'Meditazione Chakra', pt: 'Meditação dos Chakras', ja: 'チャクラ瞑想', ko: '차크라 명상', zh: '脉轮冥想' },
      binaural: { en: 'Binaural Meditation', es: 'Meditación Binaural', fr: 'Méditation Binaurale', de: 'Binaurale Meditation', it: 'Meditazione Binaurale', pt: 'Meditação Binaural', ja: 'バイノーラル瞑想', ko: '바이노럴 명상', zh: '双耳节拍冥想' },
      aiGuided: { en: 'AI Guided Meditation', es: 'Meditación Guiada por IA', fr: 'Méditation Guidée par IA', de: 'KI-Geführte Meditation', it: 'Meditazione Guidata IA', pt: 'Meditação Guiada por IA', ja: 'AIガイド瞑想', ko: 'AI 가이드 명상', zh: 'AI引导冥想' },
      timed: { en: 'Timed Meditation', es: 'Meditación Cronometrada', fr: 'Méditation Chronométrée', de: 'Zeitgesteuerte Meditation', it: 'Meditazione Cronometrata', pt: 'Meditação Cronometrada', ja: 'タイマー瞑想', ko: '시간 명상', zh: '定时冥想' },
      astral: { en: 'Astral Travel Practice', es: 'Práctica de Viaje Astral', fr: 'Voyage Astral', de: 'Astralreise Übung', it: 'Viaggio Astrale', pt: 'Viagem Astral', ja: 'アストラル旅行', ko: '아스트랄 여행', zh: '星体旅行' },
    };
    return titles[id]?.[languageCode] || titles[id]?.en || id;
  };

  const getMeditationDesc = (id: string): string => {
    const descs: Record<string, Record<string, string>> = {
      chakra: { en: 'Heal and realign your energy centers', es: 'Sana y realinea tus centros de energía', fr: 'Guérissez et réalignez vos centres énergétiques', de: 'Heile und richte deine Energiezentren neu aus', it: 'Guarisci e riallinea i tuoi centri energetici', pt: 'Cure e realinhe seus centros de energia', ja: 'エネルギーセンターを癒し再調整', ko: '에너지 센터 치유 및 재정렬', zh: '治愈并重新调整您的能量中心' },
      binaural: { en: 'Brain wave synchronization through sound', es: 'Sincronización de ondas cerebrales mediante sonido', fr: 'Synchronisation des ondes cérébrales par le son', de: 'Gehirnwellen-Synchronisation durch Klang', it: 'Sincronizzazione delle onde cerebrali attraverso il suono', pt: 'Sincronização de ondas cerebrais através do som', ja: '音による脳波同期', ko: '소리를 통한 뇌파 동기화', zh: '通过声音同步脑波' },
      aiGuided: { en: 'Personalized meditation with AI guidance', es: 'Meditación personalizada con guía de IA', fr: 'Méditation personnalisée avec guidance IA', de: 'Personalisierte Meditation mit KI-Führung', it: 'Meditazione personalizzata con guida IA', pt: 'Meditação personalizada com orientação de IA', ja: 'AIガイダンスによるパーソナライズ瞑想', ko: 'AI 안내를 통한 맞춤 명상', zh: 'AI指导的个性化冥想' },
      timed: { en: 'Meditate with ambient sounds and timer', es: 'Medita con sonidos ambientales y temporizador', fr: 'Méditez avec sons ambiants et minuteur', de: 'Meditiere mit Umgebungsgeräuschen und Timer', it: 'Medita con suoni ambientali e timer', pt: 'Medite com sons ambiente e temporizador', ja: '環境音とタイマーで瞑想', ko: '주변 소리와 타이머로 명상', zh: '使用环境声音和计时器冥想' },
      astral: { en: 'Guided journey beyond the physical', es: 'Viaje guiado más allá de lo físico', fr: 'Voyage guidé au-delà du physique', de: 'Geführte Reise jenseits des Physischen', it: 'Viaggio guidato oltre il fisico', pt: 'Jornada guiada além do físico', ja: '肉体を超えたガイド付き旅', ko: '물리적 세계를 넘어선 가이드 여행', zh: '超越物质的引导之旅' },
    };
    return descs[id]?.[languageCode] || descs[id]?.en || '';
  };

  // Get translated header text
  const getHeaderTitle = (): string => {
    const titles: Record<string, string> = {
      en: 'Meditation Hub', es: 'Centro de Meditación', fr: 'Centre de Méditation',
      de: 'Meditationszentrum', it: 'Centro Meditazione', pt: 'Centro de Meditação',
      ja: '瞑想ハブ', ko: '명상 허브', zh: '冥想中心'
    };
    return titles[languageCode] || titles.en;
  };

  const getSubtitle = (): string => {
    const subtitles: Record<string, string> = {
      en: 'Choose your meditation practice', es: 'Elige tu práctica de meditación',
      fr: 'Choisissez votre pratique de méditation', de: 'Wähle deine Meditationspraxis',
      it: 'Scegli la tua pratica di meditazione', pt: 'Escolha sua prática de meditação',
      ja: '瞑想の練習を選択', ko: '명상 연습을 선택하세요', zh: '选择您的冥想练习'
    };
    return subtitles[languageCode] || subtitles.en;
  };

  return (
    <View style={styles.root}>
      <LinearGradient colors={['#1a0033', '#0d0015', '#000000']} style={StyleSheet.absoluteFill} />
      <Mist count={6} intensity="soft" />

      <ScrollView style={styles.container} contentContainerStyle={styles.scrollContent}>
        {/* Hero Section with Image Background */}
        <View style={styles.heroSection}>
          <Image
            source={require('../assets/backgrounds/meditation-bg.jpg')}
            style={styles.heroImage}
            contentFit="cover"
          />
          <LinearGradient
            colors={['rgba(13,0,21,0)', 'rgba(13,0,21,0.55)', 'rgba(13,0,21,0.95)']}
            style={StyleSheet.absoluteFill}
          />
          <View style={styles.heroOverlay}>
            <Text style={styles.heroEyebrow}>✦ Inner Stillness ✦</Text>
            <Text style={styles.heroTitle}>{getHeaderTitle()}</Text>
            <View style={styles.heroGlyphRow}>
              <View style={styles.heroGlyphLine} />
              <Ionicons name="sparkles" size={11} color={palette.gold} style={{ marginHorizontal: 8 }} />
              <View style={styles.heroGlyphLine} />
            </View>
            <Text style={styles.heroSubtitle}>{getSubtitle()}</Text>
          </View>
        </View>

        {/* Section header */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionEyebrow}>PRACTICES</Text>
          <Text style={styles.sectionTitle}>Select Your Path</Text>
        </View>

        <View style={styles.typesContainer}>
          {meditationTypeIds.map((type, index) => (
            <TouchableOpacity
              key={index}
              onPress={() => router.push(type.route as any)}
              activeOpacity={0.85}
              style={styles.typeRowWrap}
            >
              <View style={styles.typeRow}>
                <LinearGradient
                  colors={[`${type.color}55`, `${type.color}11`]}
                  style={styles.typeIcon}
                >
                  <Ionicons name={type.icon as any} size={20} color={palette.gold} />
                </LinearGradient>
                <View style={styles.typeContent}>
                  <Text style={styles.typeTitle}>{getMeditationTitle(type.id)}</Text>
                  <Text style={styles.typeDescription} numberOfLines={1}>{getMeditationDesc(type.id)}</Text>
                </View>
                <Ionicons name="chevron-forward" size={14} color={palette.lavender} />
              </View>
            </TouchableOpacity>
          ))}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#0d0015' },
  container: { flex: 1 },
  scrollContent: { flexGrow: 1, paddingBottom: spacing['4xl'] },

  heroSection: {
    height: 180,
    width: '100%',
    overflow: 'hidden',
  },
  heroImage: { width: '100%', height: '100%' },
  heroOverlay: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 18,
    paddingHorizontal: spacing.xl,
    alignItems: 'center',
  },
  heroEyebrow: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1.6,
    color: palette.gold,
    marginBottom: 4,
    textShadowColor: 'rgba(0,0,0,0.85)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  heroTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: palette.starWhite,
    letterSpacing: 0.3,
    textAlign: 'center',
    textShadowColor: 'rgba(168,85,247,0.6)',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 12,
  },
  heroGlyphRow: { flexDirection: 'row', alignItems: 'center', marginTop: 6, marginBottom: 4 },
  heroGlyphLine: { width: 32, height: 1, backgroundColor: 'rgba(251,191,36,0.6)' },
  heroSubtitle: {
    fontSize: 12,
    color: palette.iceLavender,
    textAlign: 'center',
    fontStyle: 'italic',
    textShadowColor: 'rgba(0,0,0,0.8)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },

  sectionHeader: {
    paddingHorizontal: spacing.lg,
    marginTop: spacing.xl,
    marginBottom: spacing.sm,
  },
  sectionEyebrow: {
    fontSize: 9, fontWeight: '700', letterSpacing: 1.6, color: palette.gold, marginBottom: 2,
  },
  sectionTitle: { fontSize: 17, fontWeight: '700', color: palette.iceLavender },

  typesContainer: { paddingHorizontal: spacing.lg },
  typeRowWrap: { marginBottom: 8 },
  typeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: radii.lg,
    backgroundColor: 'rgba(168,85,247,0.07)',
    borderWidth: 1,
    borderColor: 'rgba(183,148,246,0.18)',
  },
  typeIcon: {
    width: 36, height: 36, borderRadius: 10,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: palette.glassBorder,
  },
  typeContent: { flex: 1 },
  typeTitle: { fontSize: 13.5, fontWeight: '700', color: palette.starWhite },
  typeDescription: { fontSize: 11, color: palette.mist, marginTop: 1 },
});
