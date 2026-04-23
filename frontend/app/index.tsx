import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert, ActivityIndicator, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Image } from 'expo-image';
import { Video, ResizeMode } from 'expo-av';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';
import { useTheme } from '../contexts/ThemeContext';
import AsyncStorage from '@react-native-async-storage/async-storage';

const ETHERIA_IMAGE = 'https://customer-assets.emergentagent.com/job_meditation-nexus/artifacts/d3xhv7qx_47721.png';
const HEADER_BANNER_IMAGE = 'https://customer-assets.emergentagent.com/job_meditation-nexus/artifacts/oz3admmj_47815.jpg';
const HERO_VIDEO = require('../assets/videos/hero-background.mp4');
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
    <ScrollView style={[styles.container, { backgroundColor: theme.background }]}>
      {/* Header Banner */}
      <View style={styles.headerBanner}>
        <Image
          source={{ uri: HEADER_BANNER_IMAGE }}
          style={styles.headerBannerImage}
          contentFit="cover"
        />
        <View style={styles.headerBannerOverlay}>
          <Text style={styles.headerBannerTitle}>Etheria</Text>
        </View>
      </View>

      {/* Auth Buttons - Show login/signup if not authenticated */}
      {!isAuthenticated ? (
        <View style={styles.authSection}>
          <View style={styles.authButtons}>
            <TouchableOpacity
              style={[styles.loginButton, { backgroundColor: theme.accentLight }]}
              onPress={() => router.push('/auth/login')}
            >
              <Ionicons name="log-in" size={20} color={theme.background} />
              <Text style={[styles.loginButtonText, { color: theme.background }]}>{t('signIn')}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.signupButton, { borderColor: theme.accentLight }]}
              onPress={() => router.push('/auth/signup')}
            >
              <Ionicons name="person-add" size={20} color={theme.accentLight} />
              <Text style={[styles.signupButtonText, { color: theme.accentLight }]}>{t('signUp')}</Text>
            </TouchableOpacity>
          </View>
        </View>
      ) : (
        <View style={styles.userWelcome}>
          <View style={styles.userInfo}>
            <Ionicons name="person-circle" size={24} color={theme.accentLight} />
            <Text style={styles.userGreeting}>{t('welcomeMessage').split(' ').slice(0, 1).join(' ')}, {user?.name || 'Seeker'}</Text>
            {isPremium && (
              <View style={styles.premiumBadgeSmall}>
                <Ionicons name="star" size={12} color="#ffd700" />
              </View>
            )}
          </View>
        </View>
      )}

      {/* Hero Section with Video Background */}
      <View style={styles.heroSection}>
        {/* Video Background */}
        <Video
          source={HERO_VIDEO}
          style={styles.heroVideo}
          resizeMode={ResizeMode.CONTAIN}
          shouldPlay
          isLooping
          isMuted
          onError={() => console.log('Video failed to load')}
        />
        {/* Fallback Image (hidden behind video) */}
        <Image
          source={{ uri: ETHERIA_IMAGE }}
          style={styles.heroImageFallback}
          contentFit="cover"
        />
        <View style={styles.heroOverlay}>
          <Text style={styles.heroTitle}>{t('welcomeMessage')}</Text>
        </View>
      </View>

      {/* Welcome Message */}
      <View style={styles.welcomeSection}>
        <Text style={styles.welcomeText}>
          {getWelcomeText()}
        </Text>

        {/* Hide subscription box for premium users */}
        {!isPremium && (
          <View style={[styles.pricingCard, { backgroundColor: theme.cardBackground }]}>
            <Ionicons name="diamond" size={28} color="#ffd700" />
            <Text style={styles.pricingTitle}>{getUnlockText()}</Text>
            <Text style={styles.pricingText}>
              {languageCode === 'en' ? (
                <>Access everything Etheria has to offer for a monthly commitment of only{' '}
                <Text style={styles.priceHighlight}>$3.99</Text>.</>
              ) : (
                <Text style={styles.priceHighlight}>$3.99/{t('perMonth').replace('/', '')}</Text>
              )}
            </Text>
            <TouchableOpacity 
              style={[styles.subscribeButton, { backgroundColor: theme.accent }]}
              onPress={() => router.push('/settings')}
            >
              <Ionicons name="star" size={20} color="#1a0033" />
              <Text style={styles.subscribeButtonText}>{getSubscribeText()}</Text>
            </TouchableOpacity>
          </View>
        )}

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

      {/* Community Link */}
      {isAuthenticated && (
        <View style={styles.communitySection}>
          <TouchableOpacity
            style={styles.communityButton}
            onPress={() => router.push('/community')}
            activeOpacity={0.8}
          >
            <View style={styles.communityIconContainer}>
              <Ionicons name="people" size={28} color="#e9d5ff" />
            </View>
            <View style={styles.communityContent}>
              <Text style={styles.communityTitle}>Join the Community</Text>
              <Text style={styles.communityDescription}>Connect with fellow spiritual seekers</Text>
            </View>
            <Ionicons name="chevron-forward" size={24} color="#9f7aea" />
          </TouchableOpacity>
        </View>
      )}

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
  // Header Banner styles
  headerBanner: {
    height: 120,
    width: '100%',
    position: 'relative',
  },
  headerBannerImage: {
    width: '100%',
    height: '100%',
  },
  headerBannerOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(10, 0, 20, 0.4)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerBannerTitle: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#fff',
    letterSpacing: 4,
    textTransform: 'uppercase',
    textShadowColor: 'rgba(0, 0, 0, 0.75)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 4,
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
    width: '100%',
    aspectRatio: 9/16,
    maxHeight: 550,
    position: 'relative',
    overflow: 'hidden',
    backgroundColor: '#0f0321',
  },
  heroVideo: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    width: '100%',
    height: '100%',
  },
  heroImageFallback: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    width: '100%',
    height: '100%',
    zIndex: -1, // Behind video
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
    paddingVertical: 8,
    paddingHorizontal: 24,
    minWidth: 100,
  },
  optOutButtonText: {
    color: '#ef4444',
    fontSize: 14,
    fontWeight: '500',
    textAlign: 'center',
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
  // Community section styles
  communitySection: {
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  communityButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1a0033',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#2d1b4e',
  },
  communityIconContainer: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#2d1b4e',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
  },
  communityContent: {
    flex: 1,
    flexShrink: 1,
  },
  communityTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 4,
  },
  communityDescription: {
    fontSize: 14,
    color: '#9f7aea',
    flexWrap: 'wrap',
  },
});
