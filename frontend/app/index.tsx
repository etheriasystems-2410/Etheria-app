import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';
import { useTheme } from '../contexts/ThemeContext';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { GlassCard, GlowButton, Mist, SectionTitle } from '../components/ui';
import { palette, spacing, radii, typography, shadows, gradients } from '../theme/tokens';

const ETHERIA_IMAGE = 'https://customer-assets.emergentagent.com/job_a75d84fa-0948-4f28-9189-c803d31a5037/artifacts/88c8k78q_8227.jpg';
const HEADER_BANNER_IMAGE = 'https://customer-assets.emergentagent.com/job_meditation-nexus/artifacts/oz3admmj_47815.jpg';
const BACKEND_URL = process.env.EXPO_PUBLIC_BACKEND_URL;

export default function Home() {
  const router = useRouter();
  const { isAuthenticated, user, isPremium } = useAuth();
  const { t, languageCode } = useLanguage();
  const { theme } = useTheme();
  
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

  // Feature descriptions with translations
  const getFeatureDescription = (key: string): string => {
    const descriptions: Record<string, Record<string, string>> = {
      training: {
        en: 'Develop your psychic abilities with guided lessons',
        es: 'Desarrolla tus habilidades psíquicas con lecciones guiadas',
        fr: 'Développez vos capacités psychiques avec des leçons guidées',
        de: 'Entwickle deine psychischen Fähigkeiten mit geführten Lektionen',
        it: 'Sviluppa le tue abilità psichiche con lezioni guidate',
        pt: 'Desenvolva suas habilidades psíquicas com lições guiadas',
        ja: 'ガイド付きレッスンで超能力を開発しましょう',
        ko: '가이드 레슨으로 초능력을 개발하세요',
        zh: '通过指导课程开发您的超能力',
      },
      oracle: {
        en: 'Receive guidance from spirit guide oracle cards',
        es: 'Recibe orientación de las cartas del oráculo',
        fr: 'Recevez des conseils des cartes oracle',
        de: 'Erhalte Führung von Orakelkarten',
        it: 'Ricevi guida dalle carte oracolo',
        pt: 'Receba orientação das cartas de oráculo',
        ja: 'オラクルカードからガイダンスを受け取りましょう',
        ko: '오라클 카드로부터 안내를 받으세요',
        zh: '从神谕卡中获得指引',
      },
      spiritGuides: {
        en: 'Chat with elemental spirit guides',
        es: 'Chatea con guías espirituales elementales',
        fr: 'Discutez avec des guides spirituels élémentaires',
        de: 'Chatte mit elementaren Geistführern',
        it: 'Chatta con guide spirituali elementali',
        pt: 'Converse com guias espirituais elementais',
        ja: '元素の精霊ガイドとチャット',
        ko: '원소 정령 가이드와 대화하세요',
        zh: '与元素灵性向导聊天',
      },
      meditation: {
        en: 'Practice meditation and mindfulness',
        es: 'Practica meditación y atención plena',
        fr: 'Pratiquez la méditation et la pleine conscience',
        de: 'Praktiziere Meditation und Achtsamkeit',
        it: 'Pratica meditazione e consapevolezza',
        pt: 'Pratique meditação e atenção plena',
        ja: '瞑想とマインドフルネスを実践',
        ko: '명상과 마음챙김을 실천하세요',
        zh: '练习冥想和正念',
      },
      journal: {
        en: 'Track your spiritual journey',
        es: 'Registra tu viaje espiritual',
        fr: 'Suivez votre parcours spirituel',
        de: 'Verfolge deine spirituelle Reise',
        it: 'Segui il tuo percorso spirituale',
        pt: 'Acompanhe sua jornada espiritual',
        ja: 'スピリチュアルな旅を記録',
        ko: '영적 여정을 기록하세요',
        zh: '记录您的灵性之旅',
      },
      community: {
        en: 'Connect with fellow seekers',
        es: 'Conecta con otros buscadores',
        fr: 'Connectez-vous avec d\'autres chercheurs',
        de: 'Verbinde dich mit anderen Suchenden',
        it: 'Connettiti con altri cercatori',
        pt: 'Conecte-se com outros buscadores',
        ja: '仲間の探求者とつながる',
        ko: '동료 탐구자들과 연결하세요',
        zh: '与其他求道者联系',
      },
      dreams: {
        en: 'Unlock the meaning of your dreams',
        es: 'Descubre el significado de tus sueños',
        fr: 'Découvrez la signification de vos rêves',
        de: 'Entschlüsseln Sie die Bedeutung Ihrer Träume',
        it: 'Scopri il significato dei tuoi sogni',
        pt: 'Descubra o significado dos seus sonhos',
        ja: '夢の意味を解き明かす',
        ko: '꿈의 의미를 해석하세요',
        zh: '解读您梦境的含义',
      },
      astral: {
        en: 'Learn astral projection techniques',
        es: 'Aprende técnicas de proyección astral',
        fr: 'Apprenez les techniques de projection astrale',
        de: 'Lerne Techniken der Astralprojektion',
        it: 'Impara le tecniche di proiezione astrale',
        pt: 'Aprenda técnicas de projeção astral',
        ja: 'アストラル投射技術を学ぶ',
        ko: '유체이탈 기술을 배우세요',
        zh: '学习星体投射技术',
      },
    };
    return descriptions[key]?.[languageCode] || descriptions[key]?.en || '';
  };

  // Features ordered to match navigation menu
  const features = [
    {
      title: t('meditationTitle'),
      description: getFeatureDescription('meditation'),
      icon: 'fitness' as const,
      route: '/meditation',
    },
    {
      title: t('spiritGuidesTitle'),
      description: getFeatureDescription('spiritGuides'),
      icon: 'chatbubbles' as const,
      route: '/spirit-guides',
    },
    {
      title: t('oracleTitle'),
      description: getFeatureDescription('oracle'),
      icon: 'sparkles' as const,
      route: '/oracle',
    },
    {
      title: 'Dream Interpreter',
      description: getFeatureDescription('dreams'),
      icon: 'moon' as const,
      route: '/dreams',
    },
    {
      title: 'Astral Travel',
      description: getFeatureDescription('astral'),
      icon: 'planet' as const,
      route: '/astral-training',
    },
    {
      title: t('psychicTraining'),
      description: getFeatureDescription('training'),
      icon: 'school' as const,
      route: '/training',
    },
    {
      title: t('journalTitle'),
      description: getFeatureDescription('journal'),
      icon: 'book' as const,
      route: '/journal',
    },
  ];

  // Welcome text translations
  const getWelcomeText = (): string => {
    const texts: Record<string, string> = {
      en: 'Toolkit designed to aid you on your quest to enlightenment.',
      es: 'Conjunto de herramientas diseñado para ayudarte en tu búsqueda de la iluminación.',
      fr: 'Trousse conçue pour vous accompagner dans votre quête de l\'illumination.',
      de: 'Werkzeugset, das Sie auf Ihrer Reise zur Erleuchtung begleitet.',
      it: 'Toolkit progettato per assisterti nella tua ricerca dell\'illuminazione.',
      pt: 'Kit de ferramentas concebido para apoiá-lo em sua busca pela iluminação.',
      ja: '悟りへの探求を支えるためのツールキットです。',
      ko: '깨달음을 향한 여정을 돕도록 설계된 도구 모음입니다.',
      zh: '一套助您追寻觉悟之旅的工具集。',
    };
    return texts[languageCode] || texts.en;
  };

  const getUnlockText = (): string => {
    const texts: Record<string, string> = {
      en: 'Unlock Full Access',
      es: 'Desbloquea Acceso Completo',
      fr: 'Débloquez l\'Accès Complet',
      de: 'Vollzugriff Freischalten',
      it: 'Sblocca Accesso Completo',
      pt: 'Desbloqueie Acesso Completo',
      ja: 'フルアクセスを解除',
      ko: '전체 액세스 잠금 해제',
      zh: '解锁完整访问',
    };
    return texts[languageCode] || texts.en;
  };

  const getSubscribeText = (): string => {
    const texts: Record<string, string> = {
      en: 'Subscribe Now',
      es: 'Suscríbete Ahora',
      fr: 'Abonnez-vous Maintenant',
      de: 'Jetzt Abonnieren',
      it: 'Abbonati Ora',
      pt: 'Assine Agora',
      ja: '今すぐ購読',
      ko: '지금 구독',
      zh: '立即订阅',
    };
    return texts[languageCode] || texts.en;
  };

  return (
    <View style={styles.root}>
      {/* Cosmic background */}
      <LinearGradient
        colors={['#1a0033', '#0d0015', '#000000']}
        style={StyleSheet.absoluteFill}
      />
      <Mist count={8} intensity="medium" />

      <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: spacing['4xl'] }}>
        {/* Hero Banner — slim mystical strip */}
        <View style={styles.heroBanner}>
          <Image source={{ uri: HEADER_BANNER_IMAGE }} style={styles.heroBannerImage} contentFit="cover" />
          <LinearGradient
            colors={['rgba(13,0,21,0.0)', 'rgba(13,0,21,0.55)', 'rgba(13,0,21,0.95)']}
            style={StyleSheet.absoluteFill}
          />
          <View style={styles.heroBannerContent}>
            <Text style={styles.heroEyebrow}>✦ Mystical Realm ✦</Text>
            <Text style={styles.heroBrand}>ETHERIA</Text>
          </View>
        </View>

        {/* Auth or Welcome */}
        {!isAuthenticated ? (
          <View style={styles.authSection}>
            <GlowButton
              label={t('signIn')}
              icon="log-in"
              variant="gold"
              size="sm"
              onPress={() => router.push('/auth/login')}
              style={{ flex: 1 }}
            />
            <GlowButton
              label={t('signUp')}
              icon="person-add"
              variant="secondary"
              size="sm"
              onPress={() => router.push('/auth/signup')}
              style={{ flex: 1 }}
            />
          </View>
        ) : (
          <View style={styles.welcomePillWrap}>
            <View style={styles.welcomePill}>
              <View style={styles.avatarBubble}>
                <Ionicons name="person" size={16} color={palette.gold} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.welcomeEyebrow}>Welcome back</Text>
                <Text style={styles.welcomeName} numberOfLines={1}>{user?.name || 'Seeker'}</Text>
              </View>
              {isPremium && (
                <View style={styles.premiumPill}>
                  <Ionicons name="star" size={11} color={palette.gold} />
                  <Text style={styles.premiumPillText}>Premium</Text>
                </View>
              )}
            </View>
          </View>
        )}

        {/* Hero Image — keeps the mystical eye but with cleaner tagline */}
        <View style={styles.heroImageWrap}>
          <Image source={{ uri: ETHERIA_IMAGE }} style={styles.heroImageFull} contentFit="cover" />
          <LinearGradient
            colors={['rgba(13,0,21,0)', 'rgba(13,0,21,0.5)', 'rgba(13,0,21,0.95)']}
            style={StyleSheet.absoluteFill}
          />
          <View style={styles.heroImageContent}>
            <Text style={styles.heroTagline} numberOfLines={2}>
              {getWelcomeText()}
            </Text>
          </View>
        </View>

        {/* Slim subscription pill (free users only) */}
        {!isPremium && (
          <TouchableOpacity
            activeOpacity={0.8}
            onPress={() => router.push('/settings')}
            style={styles.subPillTouch}
          >
            <LinearGradient
              colors={['rgba(251,191,36,0.20)', 'rgba(124,58,237,0.10)']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.subPill}
            >
              <View style={styles.subPillIcon}>
                <Ionicons name="diamond" size={14} color={palette.gold} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.subPillTitle}>Unlock Premium</Text>
                <Text style={styles.subPillSub}>Everything Etheria offers · $3.99/mo</Text>
              </View>
              <Ionicons name="chevron-forward" size={16} color={palette.gold} />
            </LinearGradient>
          </TouchableOpacity>
        )}

        {/* Prize Drawing */}
        {isAuthenticated && (
          <View style={{ paddingHorizontal: spacing.lg, marginTop: spacing.md }}>
            <View style={styles.prizeCard}>
              <View style={styles.prizeHeader}>
                <View style={styles.giftBubble}>
                  <Ionicons name="gift" size={16} color={palette.gold} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.prizeTitle}>Monthly Prize Drawing</Text>
                  <Text style={styles.prizeSubtitle}>Win a FREE month of Premium</Text>
                </View>
              </View>

              {loadingPrizeStatus ? (
                <ActivityIndicator color={palette.lavender} style={{ marginVertical: 4 }} />
              ) : prizeDrawingStatus ? (
                <>
                  <View style={styles.usageRow}>
                    <Text style={styles.usageLabel}>This week</Text>
                    <Text style={styles.usageValue}>
                      {prizeDrawingStatus.weekly_usage_minutes.toFixed(0)}/{prizeDrawingStatus.required_minutes} min
                    </Text>
                  </View>
                  <View style={styles.progressBar}>
                    <LinearGradient
                      colors={['#fcd34d', '#fbbf24']}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 0 }}
                      style={[
                        styles.progressFill,
                        { width: `${Math.min(100, (prizeDrawingStatus.weekly_usage_minutes / prizeDrawingStatus.required_minutes) * 100)}%` },
                      ]}
                    />
                  </View>

                  {prizeDrawingStatus.opted_in ? (
                    <View style={styles.optedInRow}>
                      <View style={styles.optedInBadge}>
                        <Ionicons name="checkmark-circle" size={13} color={palette.success} />
                        <Text style={styles.optedInText}>Entered</Text>
                      </View>
                      <TouchableOpacity onPress={() => handleOptInPrizeDrawing(false)} disabled={optingIn} hitSlop={8}>
                        <Text style={styles.optOutText}>Opt out</Text>
                      </TouchableOpacity>
                    </View>
                  ) : (
                    <TouchableOpacity
                      activeOpacity={0.85}
                      onPress={() => handleOptInPrizeDrawing(true)}
                      disabled={optingIn}
                      style={styles.enterDrawingBtn}
                    >
                      {optingIn ? (
                        <ActivityIndicator color="#1a0033" size="small" />
                      ) : (
                        <>
                          <Ionicons name="ticket" size={14} color="#1a0033" />
                          <Text style={styles.enterDrawingText}>Enter Drawing</Text>
                        </>
                      )}
                    </TouchableOpacity>
                  )}
                </>
              ) : null}
            </View>
          </View>
        )}

        {/* Features */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionEyebrow}>EXPLORE</Text>
          <Text style={styles.sectionTitle}>Your Spiritual Path</Text>
        </View>

        <View style={styles.featuresContainer}>
          {features.map((feature, index) => (
            <TouchableOpacity
              key={index}
              onPress={() => router.push(feature.route as any)}
              activeOpacity={0.85}
              style={styles.featureRowWrap}
            >
              <View style={styles.featureRow}>
                <LinearGradient
                  colors={['rgba(168,85,247,0.30)', 'rgba(124,58,237,0.10)']}
                  style={styles.featureIcon}
                >
                  <Ionicons name={feature.icon} size={20} color={palette.gold} />
                </LinearGradient>
                <View style={styles.featureContent}>
                  <Text style={styles.featureTitle}>{feature.title}</Text>
                  <Text style={styles.featureDescription} numberOfLines={1}>
                    {feature.description}
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={14} color={palette.lavender} />
              </View>
            </TouchableOpacity>
          ))}
        </View>

        {/* Community */}
        {isAuthenticated && (
          <View style={styles.featuresContainer}>
            <TouchableOpacity
              onPress={() => router.push('/community')}
              activeOpacity={0.85}
              style={styles.featureRowWrap}
            >
              <View style={[styles.featureRow, styles.communityHighlight]}>
                <LinearGradient
                  colors={['rgba(251,191,36,0.30)', 'rgba(217,119,6,0.10)']}
                  style={styles.featureIcon}
                >
                  <Ionicons name="people" size={20} color={palette.gold} />
                </LinearGradient>
                <View style={styles.featureContent}>
                  <Text style={styles.featureTitle}>Join the Community</Text>
                  <Text style={styles.featureDescription}>Connect with fellow seekers</Text>
                </View>
                <Ionicons name="chevron-forward" size={14} color={palette.gold} />
              </View>
            </TouchableOpacity>
          </View>
        )}

        {/* Footer */}
        <View style={styles.footer}>
          <View style={styles.footerGlyphRow}>
            <View style={styles.footerLine} />
            <Ionicons name="sparkles" size={9} color={palette.gold} style={{ marginHorizontal: 6 }} />
            <View style={styles.footerLine} />
          </View>
          <Text style={styles.footerText}>We hope you enjoy our first application from Etheria Systems.</Text>
          <Text style={styles.signature}>— Etheria Developer</Text>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#0d0015' },
  container: { flex: 1 },

  // Hero banner — slim mystical strip
  heroBanner: {
    height: 110,
    width: '100%',
    overflow: 'hidden',
  },
  heroBannerImage: { width: '100%', height: '100%' },
  heroBannerContent: {
    position: 'absolute',
    bottom: 10, left: 0, right: 0,
    alignItems: 'center',
  },
  heroEyebrow: {
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 1.6,
    color: palette.gold,
    marginBottom: 2,
    textShadowColor: 'rgba(0,0,0,0.8)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  heroBrand: {
    fontSize: 22,
    fontWeight: '800',
    color: palette.starWhite,
    letterSpacing: 5,
    textShadowColor: 'rgba(168,85,247,0.7)',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 12,
  },

  // Auth section
  authSection: {
    flexDirection: 'row',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    gap: spacing.sm,
  },

  // Welcome pill
  welcomePillWrap: { paddingHorizontal: spacing.lg, paddingTop: spacing.md },
  welcomePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: 'rgba(168,85,247,0.10)',
    borderColor: 'rgba(183,148,246,0.25)',
    borderWidth: 1,
    borderRadius: radii.pill,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  avatarBubble: {
    width: 28, height: 28, borderRadius: 14,
    backgroundColor: 'rgba(251,191,36,0.15)',
    borderWidth: 1, borderColor: palette.goldBorder,
    alignItems: 'center', justifyContent: 'center',
  },
  welcomeEyebrow: { fontSize: 8, fontWeight: '700', letterSpacing: 1.2, color: palette.mist, textTransform: 'uppercase' },
  welcomeName: { fontSize: 13, fontWeight: '700', color: palette.iceLavender, marginTop: 1 },
  premiumPill: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: 'rgba(251,191,36,0.15)',
    borderColor: palette.goldBorder, borderWidth: 1,
    paddingHorizontal: 8, paddingVertical: 3,
    borderRadius: radii.pill,
  },
  premiumPillText: { color: palette.gold, fontSize: 10, fontWeight: '700', letterSpacing: 0.3 },

  // Hero image — keeps eye, tagline overlay
  heroImageWrap: {
    height: 200,
    width: '100%',
    marginTop: spacing.md,
    overflow: 'hidden',
  },
  heroImageFull: { width: '100%', height: '100%' },
  heroImageContent: {
    position: 'absolute', left: 0, right: 0, bottom: 18,
    paddingHorizontal: spacing.xl,
  },
  heroTagline: {
    fontSize: 14,
    lineHeight: 20,
    color: palette.iceLavender,
    textAlign: 'center',
    fontStyle: 'italic',
    fontWeight: '500',
    textShadowColor: 'rgba(0,0,0,0.85)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 8,
  },

  // Slim subscription pill
  subPillTouch: { paddingHorizontal: spacing.lg, marginTop: spacing.md },
  subPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: palette.goldBorder,
  },
  subPillIcon: {
    width: 28, height: 28, borderRadius: 14,
    backgroundColor: 'rgba(251,191,36,0.18)',
    borderWidth: 1, borderColor: palette.goldBorder,
    alignItems: 'center', justifyContent: 'center',
  },
  subPillTitle: { fontSize: 13, fontWeight: '700', color: palette.gold, letterSpacing: 0.2 },
  subPillSub: { fontSize: 11, color: palette.mist, marginTop: 1 },

  // Prize drawing — slim card
  prizeCard: {
    backgroundColor: 'rgba(168,85,247,0.08)',
    borderColor: 'rgba(183,148,246,0.22)',
    borderWidth: 1,
    borderRadius: radii.lg,
    padding: 12,
  },
  prizeHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 8 },
  giftBubble: {
    width: 28, height: 28, borderRadius: 14,
    backgroundColor: 'rgba(251,191,36,0.15)',
    borderWidth: 1, borderColor: palette.goldBorder,
    alignItems: 'center', justifyContent: 'center',
  },
  prizeTitle: { fontSize: 13, fontWeight: '700', color: palette.iceLavender },
  prizeSubtitle: { fontSize: 10, fontWeight: '600', letterSpacing: 0.3, color: palette.gold, marginTop: 1 },
  usageRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 5 },
  usageLabel: { fontSize: 10, color: palette.lavender, fontWeight: '500' },
  usageValue: { fontSize: 10, color: palette.iceLavender, fontWeight: '700' },
  progressBar: {
    height: 5,
    backgroundColor: 'rgba(124,58,237,0.25)',
    borderRadius: radii.pill,
    overflow: 'hidden',
    marginBottom: 8,
  },
  progressFill: { height: '100%', borderRadius: radii.pill },
  optedInRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
  },
  optedInBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: 'rgba(16,185,129,0.15)',
    borderColor: 'rgba(16,185,129,0.4)', borderWidth: 1,
    paddingHorizontal: 10, paddingVertical: 3, borderRadius: radii.pill,
  },
  optedInText: { color: palette.success, fontSize: 11, fontWeight: '700' },
  optOutText: { color: palette.danger, fontSize: 11, fontWeight: '600' },
  enterDrawingBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: palette.gold,
    paddingVertical: 8,
    borderRadius: radii.pill,
  },
  enterDrawingText: { color: '#1a0033', fontSize: 12, fontWeight: '800', letterSpacing: 0.3 },

  // Section header (Explore Features)
  sectionHeader: {
    paddingHorizontal: spacing.lg,
    marginTop: spacing.xl,
    marginBottom: spacing.sm,
  },
  sectionEyebrow: {
    fontSize: 9, fontWeight: '700', letterSpacing: 1.6, color: palette.gold, marginBottom: 2,
  },
  sectionTitle: { fontSize: 17, fontWeight: '700', color: palette.iceLavender },

  // Features
  featuresContainer: { paddingHorizontal: spacing.lg },
  featureRowWrap: { marginBottom: 8 },
  featureRow: {
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
  communityHighlight: {
    backgroundColor: 'rgba(251,191,36,0.07)',
    borderColor: 'rgba(251,191,36,0.32)',
  },
  featureIcon: {
    width: 36, height: 36, borderRadius: 10,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: palette.glassBorder,
  },
  featureContent: { flex: 1 },
  featureTitle: { fontSize: 13.5, fontWeight: '700', color: palette.starWhite },
  featureDescription: { fontSize: 11, color: palette.mist, marginTop: 1 },

  // Footer
  footer: { paddingHorizontal: spacing.xl, paddingTop: spacing.xl, paddingBottom: spacing.lg, alignItems: 'center' },
  footerGlyphRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  footerLine: { width: 28, height: 1, backgroundColor: 'rgba(251,191,36,0.4)' },
  footerText: { fontSize: 11, color: palette.lavender, textAlign: 'center', fontStyle: 'italic', lineHeight: 16 },
  signature: { fontSize: 10, fontWeight: '600', letterSpacing: 1.0, color: palette.gold, marginTop: 4 },
});

