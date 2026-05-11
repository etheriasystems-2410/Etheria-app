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
import { GlassCard, GlowButton, StarField, SectionTitle } from '../components/ui';
import { palette, spacing, radii, typography, shadows, gradients } from '../theme/tokens';

const ETHERIA_IMAGE = 'https://customer-assets.emergentagent.com/job_meditation-nexus/artifacts/d3xhv7qx_47721.png';
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
      en: 'Discover tools to help you progress on your spiritual path. Practice and develop latent psychic abilities, enjoy guided meditations in this realm and beyond, consult a fully-intuitive oracle deck to receive guidance from your spirit guides, or communicate directly with a spirit guide attuned to your zodiac sign.',
      es: 'Descubre herramientas para ayudarte a progresar en tu camino espiritual. Practica y desarrolla habilidades psíquicas latentes, disfruta de meditaciones guiadas, consulta un oráculo intuitivo para recibir orientación de tus guías espirituales, o comunícate directamente con un guía espiritual alineado con tu signo zodiacal.',
      fr: 'Découvrez des outils pour vous aider à progresser sur votre chemin spirituel. Pratiquez et développez vos capacités psychiques latentes, profitez de méditations guidées, consultez un oracle intuitif pour recevoir des conseils de vos guides spirituels, ou communiquez directement avec un guide spirituel aligné sur votre signe du zodiaque.',
      de: 'Entdecken Sie Werkzeuge, die Ihnen helfen, auf Ihrem spirituellen Weg voranzukommen. Üben und entwickeln Sie latente psychische Fähigkeiten, genießen Sie geführte Meditationen, konsultieren Sie ein intuitives Orakel, um Führung von Ihren Geistführern zu erhalten, oder kommunizieren Sie direkt mit einem Geistführer, der auf Ihr Sternzeichen abgestimmt ist.',
      it: 'Scopri strumenti per aiutarti a progredire nel tuo cammino spirituale. Pratica e sviluppa abilità psichiche latenti, goditi meditazioni guidate, consulta un oracolo intuitivo per ricevere guida dai tuoi spiriti guida, o comunica direttamente con una guida spirituale allineata al tuo segno zodiacale.',
      pt: 'Descubra ferramentas para ajudá-lo a progredir em seu caminho espiritual. Pratique e desenvolva habilidades psíquicas latentes, desfrute de meditações guiadas, consulte um oráculo intuitivo para receber orientação de seus guias espirituais, ou comunique-se diretamente com um guia espiritual alinhado ao seu signo do zodíaco.',
      ja: 'スピリチュアルな道を進むためのツールを発見しましょう。潜在的な超能力を練習し発達させ、ガイド付き瞑想を楽しみ、直感的なオラクルでスピリットガイドからの導きを受け取り、あなたの星座に調和したスピリットガイドと直接コミュニケーションしましょう。',
      ko: '영적 여정에서 발전할 수 있도록 도와주는 도구를 발견하세요. 잠재적인 초능력을 연습하고 개발하고, 가이드 명상을 즐기고, 직관적인 오라클로 영적 가이드의 안내를 받거나, 당신의 별자리에 맞춰진 영적 가이드와 직접 소통하세요.',
      zh: '发现帮助您在灵性道路上进步的工具。练习和开发潜在的超能力，享受指导冥想，咨询直觉神谕牌以获得灵性向导的指引，或与与您星座相配的灵性向导直接交流。',
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
      <StarField count={45} goldRatio={0.18} />

      <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: spacing['5xl'] }}>
        {/* Hero Banner */}
        <View style={styles.heroBanner}>
          <Image source={{ uri: HEADER_BANNER_IMAGE }} style={styles.heroBannerImage} contentFit="cover" />
          <LinearGradient
            colors={['rgba(13,0,21,0.0)', 'rgba(13,0,21,0.55)', 'rgba(13,0,21,0.95)']}
            style={StyleSheet.absoluteFill}
          />
          <View style={styles.heroBannerContent}>
            <Text style={styles.heroEyebrow}>✦ Mystical Realm ✦</Text>
            <Text style={styles.heroBrand}>ETHERIA</Text>
            <View style={styles.heroGlyphRow}>
              <View style={styles.heroGlyphLine} />
              <Ionicons name="sparkles" size={12} color={palette.gold} style={{ marginHorizontal: 10 }} />
              <View style={styles.heroGlyphLine} />
            </View>
          </View>
        </View>

        {/* Auth or Welcome */}
        {!isAuthenticated ? (
          <View style={styles.authSection}>
            <GlowButton
              label={t('signIn')}
              icon="log-in"
              variant="gold"
              size="md"
              onPress={() => router.push('/auth/login')}
              style={{ flex: 1 }}
            />
            <GlowButton
              label={t('signUp')}
              icon="person-add"
              variant="secondary"
              size="md"
              onPress={() => router.push('/auth/signup')}
              style={{ flex: 1 }}
            />
          </View>
        ) : (
          <View style={styles.welcomePillWrap}>
            <GlassCard variant="default" style={styles.welcomePill} padded={false}>
              <View style={styles.welcomeRow}>
                <View style={styles.avatarBubble}>
                  <Ionicons name="person" size={18} color={palette.gold} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.welcomeEyebrow}>Welcome back</Text>
                  <Text style={styles.welcomeName}>{user?.name || 'Seeker'}</Text>
                </View>
                {isPremium && (
                  <View style={styles.premiumPill}>
                    <Ionicons name="star" size={12} color={palette.gold} />
                    <Text style={styles.premiumPillText}>Premium</Text>
                  </View>
                )}
              </View>
            </GlassCard>
          </View>
        )}

        {/* Hero Image with title */}
        <View style={styles.heroImageWrap}>
          <Image source={{ uri: ETHERIA_IMAGE }} style={styles.heroImageFull} contentFit="cover" />
          <LinearGradient
            colors={['rgba(13,0,21,0)', 'rgba(13,0,21,0.4)', 'rgba(13,0,21,0.95)']}
            style={StyleSheet.absoluteFill}
          />
          <View style={styles.heroImageContent}>
            <Text style={styles.heroTitle}>{t('welcomeMessage')}</Text>
          </View>
        </View>

        {/* Intro card */}
        <View style={{ paddingHorizontal: spacing.lg, marginTop: -28 }}>
          <GlassCard variant="strong" style={{ borderRadius: radii['2xl'] }}>
            <Text style={styles.introText}>{getWelcomeText()}</Text>
          </GlassCard>
        </View>

        {/* Subscription card (free users) */}
        {!isPremium && (
          <View style={{ paddingHorizontal: spacing.lg, marginTop: spacing.lg }}>
            <GlassCard variant="gold" style={{ borderRadius: radii['2xl'] }}>
              <View style={{ alignItems: 'center' }}>
                <View style={styles.diamondBubble}>
                  <Ionicons name="diamond" size={26} color={palette.gold} />
                </View>
                <Text style={styles.unlockTitle}>{getUnlockText()}</Text>
                <Text style={styles.unlockText}>
                  {languageCode === 'en' ? (
                    <>Unlock everything Etheria offers for only </>
                  ) : null}
                  <Text style={styles.priceHighlight}>$3.99</Text>
                  <Text style={styles.unlockText}>{languageCode === 'en' ? ' / month.' : `/${t('perMonth').replace('/', '')}`}</Text>
                </Text>
                <GlowButton
                  label={getSubscribeText()}
                  icon="star"
                  variant="gold"
                  size="md"
                  onPress={() => router.push('/settings')}
                  style={{ marginTop: spacing.lg }}
                />
              </View>
            </GlassCard>
          </View>
        )}

        {/* Prize Drawing */}
        {isAuthenticated && (
          <View style={{ paddingHorizontal: spacing.lg, marginTop: spacing.lg }}>
            <GlassCard style={{ borderRadius: radii['2xl'] }}>
              <View style={styles.prizeHeader}>
                <View style={styles.giftBubble}>
                  <Ionicons name="gift" size={20} color={palette.gold} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.prizeTitle}>Monthly Prize Drawing</Text>
                  <Text style={styles.prizeSubtitle}>Win a FREE month of Premium</Text>
                </View>
              </View>
              <Text style={styles.prizeBody}>
                Use the app's free features for at least 30 minutes per week to be eligible.
              </Text>

              {loadingPrizeStatus ? (
                <ActivityIndicator color={palette.lavender} style={{ marginVertical: spacing.md }} />
              ) : prizeDrawingStatus ? (
                <>
                  <View style={styles.usageProgress}>
                    <View style={styles.usageRow}>
                      <Text style={styles.usageLabel}>This Week's Usage</Text>
                      <Text style={styles.usageValue}>
                        {prizeDrawingStatus.weekly_usage_minutes.toFixed(0)} / {prizeDrawingStatus.required_minutes} min
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
                  </View>

                  {prizeDrawingStatus.opted_in ? (
                    <View style={styles.optedInContainer}>
                      <View style={styles.optedInBadge}>
                        <Ionicons name="checkmark-circle" size={16} color={palette.success} />
                        <Text style={styles.optedInText}>You're entered</Text>
                      </View>
                      {prizeDrawingStatus.next_drawing && (
                        <Text style={styles.nextDrawingText}>
                          Next drawing: {new Date(prizeDrawingStatus.next_drawing).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
                        </Text>
                      )}
                      <TouchableOpacity onPress={() => handleOptInPrizeDrawing(false)} disabled={optingIn} style={styles.optOutBtn}>
                        <Text style={styles.optOutText}>Opt Out</Text>
                      </TouchableOpacity>
                    </View>
                  ) : (
                    <GlowButton
                      label="Enter Drawing"
                      icon="ticket"
                      variant="gold"
                      size="md"
                      onPress={() => handleOptInPrizeDrawing(true)}
                      loading={optingIn}
                      fullWidth
                      style={{ marginTop: spacing.md }}
                    />
                  )}
                </>
              ) : (
                <Text style={styles.prizeBody}>Loading status...</Text>
              )}
            </GlassCard>
          </View>
        )}

        {/* Features */}
        <SectionTitle title="Explore Features" subtitle="Tools for your spiritual path" icon="compass" />

        <View style={styles.featuresContainer}>
          {features.map((feature, index) => (
            <TouchableOpacity
              key={index}
              onPress={() => router.push(feature.route as any)}
              activeOpacity={0.85}
              style={{ marginBottom: spacing.md }}
            >
              <GlassCard style={styles.featureCard}>
                <View style={styles.featureRow}>
                  <LinearGradient
                    colors={['rgba(168,85,247,0.30)', 'rgba(124,58,237,0.10)']}
                    style={styles.featureIcon}
                  >
                    <Ionicons name={feature.icon} size={26} color={palette.gold} />
                  </LinearGradient>
                  <View style={styles.featureContent}>
                    <Text style={styles.featureTitle}>{feature.title}</Text>
                    <Text style={styles.featureDescription} numberOfLines={2}>
                      {feature.description}
                    </Text>
                  </View>
                  <View style={styles.chevronBubble}>
                    <Ionicons name="chevron-forward" size={16} color={palette.lavender} />
                  </View>
                </View>
              </GlassCard>
            </TouchableOpacity>
          ))}
        </View>

        {/* Community */}
        {isAuthenticated && (
          <View style={{ paddingHorizontal: spacing.lg, marginTop: spacing.md }}>
            <TouchableOpacity onPress={() => router.push('/community')} activeOpacity={0.85}>
              <GlassCard variant="gold" style={styles.communityCard}>
                <View style={styles.featureRow}>
                  <LinearGradient
                    colors={['rgba(251,191,36,0.30)', 'rgba(217,119,6,0.10)']}
                    style={styles.featureIcon}
                  >
                    <Ionicons name="people" size={26} color={palette.gold} />
                  </LinearGradient>
                  <View style={styles.featureContent}>
                    <Text style={styles.featureTitle}>Join the Community</Text>
                    <Text style={styles.featureDescription}>Connect with fellow seekers</Text>
                  </View>
                  <View style={styles.chevronBubble}>
                    <Ionicons name="chevron-forward" size={16} color={palette.gold} />
                  </View>
                </View>
              </GlassCard>
            </TouchableOpacity>
          </View>
        )}

        {/* Footer */}
        <View style={styles.footer}>
          <View style={styles.footerGlyphRow}>
            <View style={styles.footerLine} />
            <Ionicons name="sparkles" size={11} color={palette.gold} style={{ marginHorizontal: 8 }} />
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

  // Hero banner
  heroBanner: {
    height: 130,
    width: '100%',
    overflow: 'hidden',
    borderBottomLeftRadius: radii.lg,
    borderBottomRightRadius: radii.lg,
  },
  heroBannerImage: { width: '100%', height: '100%' },
  heroBannerContent: {
    position: 'absolute',
    bottom: 0, left: 0, right: 0,
    alignItems: 'center',
    paddingBottom: spacing.md,
  },
  heroEyebrow: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1.4,
    color: palette.gold,
    marginBottom: 4,
    textShadowColor: 'rgba(0,0,0,0.8)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  heroBrand: {
    fontSize: 26,
    fontWeight: '800',
    color: palette.starWhite,
    letterSpacing: 5,
    textShadowColor: 'rgba(168,85,247,0.7)',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 12,
  },
  heroGlyphRow: { flexDirection: 'row', alignItems: 'center', marginTop: 6 },
  heroGlyphLine: { width: 32, height: 1, backgroundColor: 'rgba(251,191,36,0.6)' },

  // Auth section
  authSection: {
    flexDirection: 'row',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    gap: spacing.sm,
  },

  // Welcome pill
  welcomePillWrap: { paddingHorizontal: spacing.lg, paddingTop: spacing.md },
  welcomePill: { borderRadius: radii.pill, paddingHorizontal: spacing.md, paddingVertical: 8 },
  welcomeRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  avatarBubble: {
    width: 32, height: 32, borderRadius: radii.pill,
    backgroundColor: 'rgba(251,191,36,0.15)',
    borderWidth: 1, borderColor: palette.goldBorder,
    alignItems: 'center', justifyContent: 'center',
  },
  welcomeEyebrow: { fontSize: 9, fontWeight: '700', letterSpacing: 1.2, color: palette.mist, textTransform: 'uppercase' },
  welcomeName: { fontSize: 15, fontWeight: '700', color: palette.iceLavender, marginTop: 1 },
  premiumPill: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: 'rgba(251,191,36,0.15)',
    borderColor: palette.goldBorder, borderWidth: 1,
    paddingHorizontal: 8, paddingVertical: 3,
    borderRadius: radii.pill,
  },
  premiumPillText: { color: palette.gold, fontSize: 10, fontWeight: '700', letterSpacing: 0.3 },

  // Hero image
  heroImageWrap: {
    height: 180,
    width: '100%',
    marginTop: spacing.md,
    overflow: 'hidden',
  },
  heroImageFull: { width: '100%', height: '100%' },
  heroImageContent: {
    position: 'absolute', left: 0, right: 0, bottom: 28,
    paddingHorizontal: spacing.lg,
  },
  heroTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: palette.starWhite,
    textAlign: 'center',
    textShadowColor: 'rgba(0,0,0,0.85)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 10,
  },

  // Intro card
  introText: {
    fontSize: 13.5,
    lineHeight: 20,
    color: palette.mist,
    textAlign: 'center',
  },

  // Subscription/unlock card
  diamondBubble: {
    width: 44, height: 44, borderRadius: radii.pill,
    backgroundColor: 'rgba(251,191,36,0.12)',
    borderWidth: 1, borderColor: palette.goldBorder,
    alignItems: 'center', justifyContent: 'center',
    marginBottom: spacing.sm,
  },
  unlockTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: palette.gold,
    textAlign: 'center',
    marginBottom: 6,
  },
  unlockText: {
    fontSize: 13,
    color: palette.mist,
    textAlign: 'center',
    lineHeight: 19,
  },
  priceHighlight: {
    color: palette.gold,
    fontWeight: '800',
    fontSize: 16,
  },

  // Prize drawing
  prizeHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: 6 },
  giftBubble: {
    width: 34, height: 34, borderRadius: radii.pill,
    backgroundColor: 'rgba(251,191,36,0.12)',
    borderWidth: 1, borderColor: palette.goldBorder,
    alignItems: 'center', justifyContent: 'center',
  },
  prizeTitle: { fontSize: 15, fontWeight: '700', color: palette.iceLavender },
  prizeSubtitle: { fontSize: 11, fontWeight: '600', letterSpacing: 0.3, color: palette.gold, marginTop: 1 },
  prizeBody: { fontSize: 12.5, color: palette.mist, lineHeight: 18, marginBottom: spacing.sm },
  usageProgress: { marginBottom: spacing.sm },
  usageRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 5 },
  usageLabel: { fontSize: 11, color: palette.lavender, fontWeight: '500' },
  usageValue: { fontSize: 11, color: palette.iceLavender, fontWeight: '700' },
  progressBar: {
    height: 6,
    backgroundColor: 'rgba(124,58,237,0.25)',
    borderRadius: radii.pill,
    overflow: 'hidden',
  },
  progressFill: { height: '100%', borderRadius: radii.pill },
  optedInContainer: { alignItems: 'center', gap: 6, paddingTop: 6 },
  optedInBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    backgroundColor: 'rgba(16,185,129,0.15)',
    borderColor: 'rgba(16,185,129,0.4)', borderWidth: 1,
    paddingHorizontal: 12, paddingVertical: 5, borderRadius: radii.pill,
  },
  optedInText: { color: palette.success, fontSize: 12, fontWeight: '700' },
  nextDrawingText: { color: palette.lavender, fontSize: 11 },
  optOutBtn: { marginTop: 2, paddingVertical: 4, paddingHorizontal: 14 },
  optOutText: { color: palette.danger, fontSize: 12, fontWeight: '600' },

  // Features
  featuresContainer: { paddingHorizontal: spacing.lg, marginTop: spacing.xs },
  featureCard: { borderRadius: radii.lg },
  featureRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  featureIcon: {
    width: 40, height: 40, borderRadius: radii.md,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: palette.glassBorder,
  },
  featureContent: { flex: 1 },
  featureTitle: { fontSize: 15, fontWeight: '700', color: palette.starWhite, marginBottom: 1 },
  featureDescription: { fontSize: 12, color: palette.mist, lineHeight: 16 },
  chevronBubble: {
    width: 24, height: 24, borderRadius: radii.pill,
    backgroundColor: 'rgba(183,148,246,0.10)',
    borderWidth: 1, borderColor: 'rgba(183,148,246,0.3)',
    alignItems: 'center', justifyContent: 'center',
  },

  // Community
  communityCard: { borderRadius: radii.lg },

  // Footer
  footer: { paddingHorizontal: spacing.xl, paddingTop: spacing.xl, paddingBottom: spacing.lg, alignItems: 'center' },
  footerGlyphRow: { flexDirection: 'row', alignItems: 'center', marginBottom: spacing.sm },
  footerLine: { width: 32, height: 1, backgroundColor: 'rgba(251,191,36,0.4)' },
  footerText: { fontSize: 12, color: palette.lavender, textAlign: 'center', fontStyle: 'italic', lineHeight: 18 },
  signature: { fontSize: 11, fontWeight: '600', letterSpacing: 1.0, color: palette.gold, marginTop: 6 },
});
