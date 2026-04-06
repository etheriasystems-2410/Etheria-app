import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

export interface Language {
  code: string;
  name: string;
  nativeName: string;
  ttsVoice: string; // OpenAI TTS voice identifier
}

export const LANGUAGES: Language[] = [
  { code: 'en', name: 'English', nativeName: 'English', ttsVoice: 'alloy' },
  { code: 'es', name: 'Spanish', nativeName: 'Español', ttsVoice: 'alloy' },
  { code: 'fr', name: 'French', nativeName: 'Français', ttsVoice: 'alloy' },
  { code: 'de', name: 'German', nativeName: 'Deutsch', ttsVoice: 'alloy' },
  { code: 'it', name: 'Italian', nativeName: 'Italiano', ttsVoice: 'alloy' },
  { code: 'pt', name: 'Portuguese', nativeName: 'Português', ttsVoice: 'alloy' },
  { code: 'ja', name: 'Japanese', nativeName: '日本語', ttsVoice: 'alloy' },
  { code: 'ko', name: 'Korean', nativeName: '한국어', ttsVoice: 'alloy' },
  { code: 'zh', name: 'Chinese', nativeName: '中文', ttsVoice: 'alloy' },
];

// Translation keys type
type TranslationKeys = keyof typeof translations.en;

// Translations for all supported languages
const translations = {
  en: {
    // Common
    loading: 'Loading...',
    error: 'Error',
    success: 'Success',
    cancel: 'Cancel',
    save: 'Save',
    delete: 'Delete',
    edit: 'Edit',
    back: 'Back',
    next: 'Next',
    done: 'Done',
    close: 'Close',
    confirm: 'Confirm',
    yes: 'Yes',
    no: 'No',
    ok: 'OK',
    
    // Auth
    welcomeBack: 'Welcome Back',
    signIn: 'Sign In',
    signUp: 'Sign Up',
    email: 'Email',
    password: 'Password',
    confirmPassword: 'Confirm Password',
    forgotPassword: 'Forgot Password?',
    noAccount: "Don't have an account?",
    hasAccount: 'Already have an account?',
    createAccount: 'Create Account',
    logout: 'Logout',
    
    // Navigation
    home: 'Home',
    training: 'Training',
    meditation: 'Meditation',
    oracle: 'Oracle',
    spiritGuides: 'Spirit Guides',
    journal: 'Journal',
    settings: 'Settings',
    profile: 'Profile',
    
    // Home
    welcomeMessage: 'Welcome to Etheria',
    dailyOracle: 'Daily Oracle',
    continueLearning: 'Continue Learning',
    startMeditation: 'Start Meditation',
    
    // Training
    psychicTraining: 'Psychic Training',
    selectAbility: 'Select an ability to train',
    clairvoyance: 'Clairvoyance',
    telepathy: 'Telepathy',
    precognition: 'Precognition',
    psychometry: 'Psychometry',
    auraReading: 'Aura Reading',
    remoteViewing: 'Remote Viewing',
    
    // Meditation
    meditationTitle: 'Meditation',
    binauralBeats: 'Binaural Beats',
    aiGuided: 'AI Guided',
    timedMeditation: 'Timed Meditation',
    chakraMeditation: 'Chakra Meditation',
    selectDuration: 'Select Duration',
    minutes: 'minutes',
    startSession: 'Start Session',
    pauseSession: 'Pause',
    resumeSession: 'Resume',
    endSession: 'End Session',
    
    // Oracle
    oracleTitle: 'Oracle Divination',
    selectSpread: 'Select a spread',
    singleCard: 'Single Card',
    threeCard: 'Three Card',
    celticCross: 'Celtic Cross',
    drawCards: 'Draw Cards',
    yourReading: 'Your Reading',
    cardMeaning: 'Card Meaning',
    
    // Spirit Guides
    spiritGuidesTitle: 'Spirit Guides',
    selectGuide: 'Select your guide to begin',
    enterBirthday: 'Enter birthday for guide pairing',
    changeBirthday: 'Change birthday',
    typeMessage: 'Type your message...',
    send: 'Send',
    
    // Journal
    journalTitle: 'Progress Journal',
    newEntry: 'New Entry',
    entries: 'Entries',
    noEntries: 'No entries yet',
    writeThoughts: 'Write your thoughts...',
    
    // Settings
    settingsTitle: 'Settings',
    appSettings: 'App Settings',
    theme: 'Theme',
    language: 'Language',
    subscription: 'Subscription',
    premium: 'Premium',
    freePlan: 'Free Plan',
    upgradeToPremium: 'Upgrade to Premium',
    restorePurchase: 'Restore Purchase',
    support: 'Support',
    helpCenter: 'Help Center',
    contactUs: 'Contact Us',
    privacyPolicy: 'Privacy Policy',
    termsOfService: 'Terms of Service',
    about: 'About',
    version: 'Version',
    editProfile: 'Edit Profile',
    name: 'Name',
    
    // Premium
    premiumFeatures: 'Premium Features',
    unlockAll: 'Unlock all features',
    perMonth: '/month',
    subscribe: 'Subscribe',
    premiumRequired: 'Premium Required',
    upgradeMessage: 'Upgrade to premium to access this feature',
    
    // Themes
    selectTheme: 'Select Theme',
    mysticPurple: 'Mystic Purple',
    oceanBlue: 'Ocean Blue',
    forestGreen: 'Forest Green',
    sunsetOrange: 'Sunset Orange',
    midnightBlack: 'Midnight Black',
    roseGold: 'Rose Gold',
    premiumTheme: 'Premium Theme',
    currentTheme: 'Current',
    
    // Languages
    selectLanguage: 'Select Language',
    languageChanged: 'Language changed successfully',
    
    // Support/Contact
    contact: 'Contact',
    feedbackBugReports: 'Feedback & Bug Reports',
    emailUs: 'Email Us',
    visitWebsite: 'Visit Our Website',
    whatsappSupport: 'WhatsApp Support',
    chatDirectly: 'Chat with us directly',
    followFacebook: 'Follow on Facebook',
    followInstagram: 'Follow on Instagram',
    followTiktok: 'Follow on TikTok',
    
    // Misc
    comingSoon: 'Coming Soon',
    featureNotAvailable: 'This feature is not available yet',
  },
  es: {
    // Common
    loading: 'Cargando...',
    error: 'Error',
    success: 'Éxito',
    cancel: 'Cancelar',
    save: 'Guardar',
    delete: 'Eliminar',
    edit: 'Editar',
    back: 'Atrás',
    next: 'Siguiente',
    done: 'Hecho',
    close: 'Cerrar',
    confirm: 'Confirmar',
    yes: 'Sí',
    no: 'No',
    ok: 'OK',
    
    // Auth
    welcomeBack: 'Bienvenido de nuevo',
    signIn: 'Iniciar sesión',
    signUp: 'Registrarse',
    email: 'Correo electrónico',
    password: 'Contraseña',
    confirmPassword: 'Confirmar contraseña',
    forgotPassword: '¿Olvidaste tu contraseña?',
    noAccount: '¿No tienes una cuenta?',
    hasAccount: '¿Ya tienes una cuenta?',
    createAccount: 'Crear cuenta',
    logout: 'Cerrar sesión',
    
    // Navigation
    home: 'Inicio',
    training: 'Entrenamiento',
    meditation: 'Meditación',
    oracle: 'Oráculo',
    spiritGuides: 'Guías Espirituales',
    journal: 'Diario',
    settings: 'Configuración',
    profile: 'Perfil',
    
    // Home
    welcomeMessage: 'Bienvenido a Etheria',
    dailyOracle: 'Oráculo Diario',
    continueLearning: 'Continuar Aprendiendo',
    startMeditation: 'Iniciar Meditación',
    
    // Training
    psychicTraining: 'Entrenamiento Psíquico',
    selectAbility: 'Selecciona una habilidad para entrenar',
    clairvoyance: 'Clarividencia',
    telepathy: 'Telepatía',
    precognition: 'Precognición',
    psychometry: 'Psicometría',
    auraReading: 'Lectura de Aura',
    remoteViewing: 'Visión Remota',
    
    // Meditation
    meditationTitle: 'Meditación',
    binauralBeats: 'Ritmos Binaurales',
    aiGuided: 'Guiada por IA',
    timedMeditation: 'Meditación Cronometrada',
    chakraMeditation: 'Meditación de Chakras',
    selectDuration: 'Seleccionar Duración',
    minutes: 'minutos',
    startSession: 'Iniciar Sesión',
    pauseSession: 'Pausar',
    resumeSession: 'Reanudar',
    endSession: 'Terminar Sesión',
    
    // Oracle
    oracleTitle: 'Adivinación Oracular',
    selectSpread: 'Selecciona una tirada',
    singleCard: 'Carta Única',
    threeCard: 'Tres Cartas',
    celticCross: 'Cruz Celta',
    drawCards: 'Sacar Cartas',
    yourReading: 'Tu Lectura',
    cardMeaning: 'Significado de la Carta',
    
    // Spirit Guides
    spiritGuidesTitle: 'Guías Espirituales',
    selectGuide: 'Selecciona tu guía para comenzar',
    enterBirthday: 'Ingresa tu cumpleaños para emparejar guía',
    changeBirthday: 'Cambiar cumpleaños',
    typeMessage: 'Escribe tu mensaje...',
    send: 'Enviar',
    
    // Journal
    journalTitle: 'Diario de Progreso',
    newEntry: 'Nueva Entrada',
    entries: 'Entradas',
    noEntries: 'Sin entradas aún',
    writeThoughts: 'Escribe tus pensamientos...',
    
    // Settings
    settingsTitle: 'Configuración',
    appSettings: 'Ajustes de la App',
    theme: 'Tema',
    language: 'Idioma',
    subscription: 'Suscripción',
    premium: 'Premium',
    freePlan: 'Plan Gratuito',
    upgradeToPremium: 'Actualizar a Premium',
    restorePurchase: 'Restaurar Compra',
    support: 'Soporte',
    helpCenter: 'Centro de Ayuda',
    contactUs: 'Contáctanos',
    privacyPolicy: 'Política de Privacidad',
    termsOfService: 'Términos de Servicio',
    about: 'Acerca de',
    version: 'Versión',
    editProfile: 'Editar Perfil',
    name: 'Nombre',
    
    // Premium
    premiumFeatures: 'Funciones Premium',
    unlockAll: 'Desbloquea todas las funciones',
    perMonth: '/mes',
    subscribe: 'Suscribirse',
    premiumRequired: 'Se Requiere Premium',
    upgradeMessage: 'Actualiza a premium para acceder a esta función',
    
    // Themes
    selectTheme: 'Seleccionar Tema',
    mysticPurple: 'Púrpura Místico',
    oceanBlue: 'Azul Océano',
    forestGreen: 'Verde Bosque',
    sunsetOrange: 'Naranja Atardecer',
    midnightBlack: 'Negro Medianoche',
    roseGold: 'Oro Rosa',
    premiumTheme: 'Tema Premium',
    currentTheme: 'Actual',
    
    // Languages
    selectLanguage: 'Seleccionar Idioma',
    languageChanged: 'Idioma cambiado exitosamente',
    
    // Support/Contact
    contact: 'Contacto',
    feedbackBugReports: 'Comentarios y Errores',
    emailUs: 'Envíanos un Email',
    visitWebsite: 'Visita Nuestro Sitio',
    whatsappSupport: 'Soporte WhatsApp',
    chatDirectly: 'Chatea con nosotros',
    followFacebook: 'Síguenos en Facebook',
    followInstagram: 'Síguenos en Instagram',
    followTiktok: 'Síguenos en TikTok',
    
    // Misc
    comingSoon: 'Próximamente',
    featureNotAvailable: 'Esta función aún no está disponible',
  },
  fr: {
    // Common
    loading: 'Chargement...',
    error: 'Erreur',
    success: 'Succès',
    cancel: 'Annuler',
    save: 'Enregistrer',
    delete: 'Supprimer',
    edit: 'Modifier',
    back: 'Retour',
    next: 'Suivant',
    done: 'Terminé',
    close: 'Fermer',
    confirm: 'Confirmer',
    yes: 'Oui',
    no: 'Non',
    ok: 'OK',
    
    // Auth
    welcomeBack: 'Bon retour',
    signIn: 'Se connecter',
    signUp: "S'inscrire",
    email: 'E-mail',
    password: 'Mot de passe',
    confirmPassword: 'Confirmer le mot de passe',
    forgotPassword: 'Mot de passe oublié?',
    noAccount: "Vous n'avez pas de compte?",
    hasAccount: 'Vous avez déjà un compte?',
    createAccount: 'Créer un compte',
    logout: 'Déconnexion',
    
    // Navigation
    home: 'Accueil',
    training: 'Entraînement',
    meditation: 'Méditation',
    oracle: 'Oracle',
    spiritGuides: 'Guides Spirituels',
    journal: 'Journal',
    settings: 'Paramètres',
    profile: 'Profil',
    
    // Home
    welcomeMessage: 'Bienvenue sur Etheria',
    dailyOracle: 'Oracle Quotidien',
    continueLearning: 'Continuer à Apprendre',
    startMeditation: 'Commencer la Méditation',
    
    // Training
    psychicTraining: 'Entraînement Psychique',
    selectAbility: 'Sélectionnez une capacité à entraîner',
    clairvoyance: 'Clairvoyance',
    telepathy: 'Télépathie',
    precognition: 'Précognition',
    psychometry: 'Psychométrie',
    auraReading: "Lecture d'Aura",
    remoteViewing: 'Vision à Distance',
    
    // Meditation
    meditationTitle: 'Méditation',
    binauralBeats: 'Battements Binauraux',
    aiGuided: 'Guidée par IA',
    timedMeditation: 'Méditation Chronométrée',
    chakraMeditation: 'Méditation des Chakras',
    selectDuration: 'Sélectionner la Durée',
    minutes: 'minutes',
    startSession: 'Démarrer la Session',
    pauseSession: 'Pause',
    resumeSession: 'Reprendre',
    endSession: 'Terminer la Session',
    
    // Oracle
    oracleTitle: 'Divination Oraculaire',
    selectSpread: 'Sélectionnez un tirage',
    singleCard: 'Carte Unique',
    threeCard: 'Trois Cartes',
    celticCross: 'Croix Celtique',
    drawCards: 'Tirer les Cartes',
    yourReading: 'Votre Lecture',
    cardMeaning: 'Signification de la Carte',
    
    // Spirit Guides
    spiritGuidesTitle: 'Guides Spirituels',
    selectGuide: 'Sélectionnez votre guide pour commencer',
    enterBirthday: "Entrez votre anniversaire pour l'appariement",
    changeBirthday: "Changer l'anniversaire",
    typeMessage: 'Tapez votre message...',
    send: 'Envoyer',
    
    // Journal
    journalTitle: 'Journal de Progression',
    newEntry: 'Nouvelle Entrée',
    entries: 'Entrées',
    noEntries: 'Pas encore d\'entrées',
    writeThoughts: 'Écrivez vos pensées...',
    
    // Settings
    settingsTitle: 'Paramètres',
    appSettings: "Paramètres de l'App",
    theme: 'Thème',
    language: 'Langue',
    subscription: 'Abonnement',
    premium: 'Premium',
    freePlan: 'Plan Gratuit',
    upgradeToPremium: 'Passer à Premium',
    restorePurchase: "Restaurer l'Achat",
    support: 'Support',
    helpCenter: "Centre d'Aide",
    contactUs: 'Nous Contacter',
    privacyPolicy: 'Politique de Confidentialité',
    termsOfService: "Conditions d'Utilisation",
    about: 'À Propos',
    version: 'Version',
    editProfile: 'Modifier le Profil',
    name: 'Nom',
    
    // Premium
    premiumFeatures: 'Fonctionnalités Premium',
    unlockAll: 'Débloquez toutes les fonctionnalités',
    perMonth: '/mois',
    subscribe: "S'abonner",
    premiumRequired: 'Premium Requis',
    upgradeMessage: 'Passez à premium pour accéder à cette fonctionnalité',
    
    // Themes
    selectTheme: 'Sélectionner le Thème',
    mysticPurple: 'Violet Mystique',
    oceanBlue: 'Bleu Océan',
    forestGreen: 'Vert Forêt',
    sunsetOrange: 'Orange Coucher de Soleil',
    midnightBlack: 'Noir Minuit',
    roseGold: 'Or Rose',
    premiumTheme: 'Thème Premium',
    currentTheme: 'Actuel',
    
    // Languages
    selectLanguage: 'Sélectionner la Langue',
    languageChanged: 'Langue changée avec succès',
    
    // Support/Contact
    contact: 'Contact',
    feedbackBugReports: 'Commentaires et Bugs',
    emailUs: 'Envoyez-nous un Email',
    visitWebsite: 'Visitez Notre Site',
    whatsappSupport: 'Support WhatsApp',
    chatDirectly: 'Discutez avec nous',
    followFacebook: 'Suivez sur Facebook',
    followInstagram: 'Suivez sur Instagram',
    followTiktok: 'Suivez sur TikTok',
    
    // Misc
    comingSoon: 'Bientôt Disponible',
    featureNotAvailable: "Cette fonctionnalité n'est pas encore disponible",
  },
  de: {
    // Common
    loading: 'Laden...',
    error: 'Fehler',
    success: 'Erfolg',
    cancel: 'Abbrechen',
    save: 'Speichern',
    delete: 'Löschen',
    edit: 'Bearbeiten',
    back: 'Zurück',
    next: 'Weiter',
    done: 'Fertig',
    close: 'Schließen',
    confirm: 'Bestätigen',
    yes: 'Ja',
    no: 'Nein',
    ok: 'OK',
    
    // Auth
    welcomeBack: 'Willkommen zurück',
    signIn: 'Anmelden',
    signUp: 'Registrieren',
    email: 'E-Mail',
    password: 'Passwort',
    confirmPassword: 'Passwort bestätigen',
    forgotPassword: 'Passwort vergessen?',
    noAccount: 'Kein Konto?',
    hasAccount: 'Bereits ein Konto?',
    createAccount: 'Konto erstellen',
    logout: 'Abmelden',
    
    // Navigation
    home: 'Startseite',
    training: 'Training',
    meditation: 'Meditation',
    oracle: 'Orakel',
    spiritGuides: 'Geistführer',
    journal: 'Tagebuch',
    settings: 'Einstellungen',
    profile: 'Profil',
    
    // Home
    welcomeMessage: 'Willkommen bei Etheria',
    dailyOracle: 'Tägliches Orakel',
    continueLearning: 'Weiter Lernen',
    startMeditation: 'Meditation Starten',
    
    // Training
    psychicTraining: 'Psychisches Training',
    selectAbility: 'Wähle eine Fähigkeit zum Trainieren',
    clairvoyance: 'Hellsehen',
    telepathy: 'Telepathie',
    precognition: 'Präkognition',
    psychometry: 'Psychometrie',
    auraReading: 'Aura Lesen',
    remoteViewing: 'Fernwahrnehmung',
    
    // Meditation
    meditationTitle: 'Meditation',
    binauralBeats: 'Binaurale Beats',
    aiGuided: 'KI-Geführt',
    timedMeditation: 'Zeitgesteuerte Meditation',
    chakraMeditation: 'Chakra Meditation',
    selectDuration: 'Dauer Wählen',
    minutes: 'Minuten',
    startSession: 'Sitzung Starten',
    pauseSession: 'Pause',
    resumeSession: 'Fortsetzen',
    endSession: 'Sitzung Beenden',
    
    // Oracle
    oracleTitle: 'Orakel Weissagung',
    selectSpread: 'Wähle eine Legung',
    singleCard: 'Einzelkarte',
    threeCard: 'Drei Karten',
    celticCross: 'Keltisches Kreuz',
    drawCards: 'Karten Ziehen',
    yourReading: 'Deine Lesung',
    cardMeaning: 'Kartenbedeutung',
    
    // Spirit Guides
    spiritGuidesTitle: 'Geistführer',
    selectGuide: 'Wähle deinen Führer zum Beginnen',
    enterBirthday: 'Geburtstag für Führerpaarung eingeben',
    changeBirthday: 'Geburtstag ändern',
    typeMessage: 'Nachricht eingeben...',
    send: 'Senden',
    
    // Journal
    journalTitle: 'Fortschrittstagebuch',
    newEntry: 'Neuer Eintrag',
    entries: 'Einträge',
    noEntries: 'Noch keine Einträge',
    writeThoughts: 'Schreibe deine Gedanken...',
    
    // Settings
    settingsTitle: 'Einstellungen',
    appSettings: 'App-Einstellungen',
    theme: 'Thema',
    language: 'Sprache',
    subscription: 'Abonnement',
    premium: 'Premium',
    freePlan: 'Kostenloser Plan',
    upgradeToPremium: 'Auf Premium Upgraden',
    restorePurchase: 'Kauf Wiederherstellen',
    support: 'Support',
    helpCenter: 'Hilfezentrum',
    contactUs: 'Kontakt',
    privacyPolicy: 'Datenschutzrichtlinie',
    termsOfService: 'Nutzungsbedingungen',
    about: 'Über',
    version: 'Version',
    editProfile: 'Profil Bearbeiten',
    name: 'Name',
    
    // Premium
    premiumFeatures: 'Premium-Funktionen',
    unlockAll: 'Alle Funktionen freischalten',
    perMonth: '/Monat',
    subscribe: 'Abonnieren',
    premiumRequired: 'Premium Erforderlich',
    upgradeMessage: 'Upgrade auf Premium für diese Funktion',
    
    // Themes
    selectTheme: 'Thema Auswählen',
    mysticPurple: 'Mystisches Lila',
    oceanBlue: 'Ozeanblau',
    forestGreen: 'Waldgrün',
    sunsetOrange: 'Sonnenuntergang Orange',
    midnightBlack: 'Mitternachtsschwarz',
    roseGold: 'Roségold',
    premiumTheme: 'Premium-Thema',
    currentTheme: 'Aktuell',
    
    // Languages
    selectLanguage: 'Sprache Auswählen',
    languageChanged: 'Sprache erfolgreich geändert',
    
    // Support/Contact
    contact: 'Kontakt',
    feedbackBugReports: 'Feedback & Fehler',
    emailUs: 'E-Mail senden',
    visitWebsite: 'Unsere Website besuchen',
    whatsappSupport: 'WhatsApp Support',
    chatDirectly: 'Direkt mit uns chatten',
    followFacebook: 'Folgen auf Facebook',
    followInstagram: 'Folgen auf Instagram',
    followTiktok: 'Folgen auf TikTok',
    
    // Misc
    comingSoon: 'Demnächst',
    featureNotAvailable: 'Diese Funktion ist noch nicht verfügbar',
  },
  it: {
    // Common
    loading: 'Caricamento...',
    error: 'Errore',
    success: 'Successo',
    cancel: 'Annulla',
    save: 'Salva',
    delete: 'Elimina',
    edit: 'Modifica',
    back: 'Indietro',
    next: 'Avanti',
    done: 'Fatto',
    close: 'Chiudi',
    confirm: 'Conferma',
    yes: 'Sì',
    no: 'No',
    ok: 'OK',
    
    // Auth
    welcomeBack: 'Bentornato',
    signIn: 'Accedi',
    signUp: 'Registrati',
    email: 'Email',
    password: 'Password',
    confirmPassword: 'Conferma Password',
    forgotPassword: 'Password dimenticata?',
    noAccount: 'Non hai un account?',
    hasAccount: 'Hai già un account?',
    createAccount: 'Crea Account',
    logout: 'Esci',
    
    // Navigation
    home: 'Home',
    training: 'Allenamento',
    meditation: 'Meditazione',
    oracle: 'Oracolo',
    spiritGuides: 'Guide Spirituali',
    journal: 'Diario',
    settings: 'Impostazioni',
    profile: 'Profilo',
    
    // Home
    welcomeMessage: 'Benvenuto su Etheria',
    dailyOracle: 'Oracolo Giornaliero',
    continueLearning: 'Continua ad Imparare',
    startMeditation: 'Inizia Meditazione',
    
    // Training
    psychicTraining: 'Allenamento Psichico',
    selectAbility: 'Seleziona un\'abilità da allenare',
    clairvoyance: 'Chiaroveggenza',
    telepathy: 'Telepatia',
    precognition: 'Precognizione',
    psychometry: 'Psicometria',
    auraReading: 'Lettura dell\'Aura',
    remoteViewing: 'Visione Remota',
    
    // Meditation
    meditationTitle: 'Meditazione',
    binauralBeats: 'Battiti Binaurali',
    aiGuided: 'Guidata da IA',
    timedMeditation: 'Meditazione Cronometrata',
    chakraMeditation: 'Meditazione dei Chakra',
    selectDuration: 'Seleziona Durata',
    minutes: 'minuti',
    startSession: 'Inizia Sessione',
    pauseSession: 'Pausa',
    resumeSession: 'Riprendi',
    endSession: 'Termina Sessione',
    
    // Oracle
    oracleTitle: 'Divinazione Oracolare',
    selectSpread: 'Seleziona una stesa',
    singleCard: 'Carta Singola',
    threeCard: 'Tre Carte',
    celticCross: 'Croce Celtica',
    drawCards: 'Pesca Carte',
    yourReading: 'La Tua Lettura',
    cardMeaning: 'Significato della Carta',
    
    // Spirit Guides
    spiritGuidesTitle: 'Guide Spirituali',
    selectGuide: 'Seleziona la tua guida per iniziare',
    enterBirthday: 'Inserisci compleanno per abbinamento',
    changeBirthday: 'Cambia compleanno',
    typeMessage: 'Scrivi il tuo messaggio...',
    send: 'Invia',
    
    // Journal
    journalTitle: 'Diario dei Progressi',
    newEntry: 'Nuova Voce',
    entries: 'Voci',
    noEntries: 'Nessuna voce ancora',
    writeThoughts: 'Scrivi i tuoi pensieri...',
    
    // Settings
    settingsTitle: 'Impostazioni',
    appSettings: 'Impostazioni App',
    theme: 'Tema',
    language: 'Lingua',
    subscription: 'Abbonamento',
    premium: 'Premium',
    freePlan: 'Piano Gratuito',
    upgradeToPremium: 'Passa a Premium',
    restorePurchase: 'Ripristina Acquisto',
    support: 'Supporto',
    helpCenter: 'Centro Assistenza',
    contactUs: 'Contattaci',
    privacyPolicy: 'Informativa sulla Privacy',
    termsOfService: 'Termini di Servizio',
    about: 'Info',
    version: 'Versione',
    editProfile: 'Modifica Profilo',
    name: 'Nome',
    
    // Premium
    premiumFeatures: 'Funzionalità Premium',
    unlockAll: 'Sblocca tutte le funzionalità',
    perMonth: '/mese',
    subscribe: 'Abbonati',
    premiumRequired: 'Premium Richiesto',
    upgradeMessage: 'Passa a premium per accedere a questa funzionalità',
    
    // Themes
    selectTheme: 'Seleziona Tema',
    mysticPurple: 'Viola Mistico',
    oceanBlue: 'Blu Oceano',
    forestGreen: 'Verde Foresta',
    sunsetOrange: 'Arancio Tramonto',
    midnightBlack: 'Nero Mezzanotte',
    roseGold: 'Oro Rosa',
    premiumTheme: 'Tema Premium',
    currentTheme: 'Attuale',
    
    // Languages
    selectLanguage: 'Seleziona Lingua',
    languageChanged: 'Lingua cambiata con successo',
    
    // Support/Contact
    contact: 'Contatto',
    feedbackBugReports: 'Feedback e Bug',
    emailUs: 'Inviaci un\'Email',
    visitWebsite: 'Visita il Nostro Sito',
    whatsappSupport: 'Supporto WhatsApp',
    chatDirectly: 'Chatta con noi',
    followFacebook: 'Seguici su Facebook',
    followInstagram: 'Seguici su Instagram',
    followTiktok: 'Seguici su TikTok',
    
    // Misc
    comingSoon: 'Prossimamente',
    featureNotAvailable: 'Questa funzionalità non è ancora disponibile',
  },
  pt: {
    // Common
    loading: 'Carregando...',
    error: 'Erro',
    success: 'Sucesso',
    cancel: 'Cancelar',
    save: 'Salvar',
    delete: 'Excluir',
    edit: 'Editar',
    back: 'Voltar',
    next: 'Próximo',
    done: 'Concluído',
    close: 'Fechar',
    confirm: 'Confirmar',
    yes: 'Sim',
    no: 'Não',
    ok: 'OK',
    
    // Auth
    welcomeBack: 'Bem-vindo de Volta',
    signIn: 'Entrar',
    signUp: 'Cadastrar',
    email: 'E-mail',
    password: 'Senha',
    confirmPassword: 'Confirmar Senha',
    forgotPassword: 'Esqueceu a senha?',
    noAccount: 'Não tem uma conta?',
    hasAccount: 'Já tem uma conta?',
    createAccount: 'Criar Conta',
    logout: 'Sair',
    
    // Navigation
    home: 'Início',
    training: 'Treinamento',
    meditation: 'Meditação',
    oracle: 'Oráculo',
    spiritGuides: 'Guias Espirituais',
    journal: 'Diário',
    settings: 'Configurações',
    profile: 'Perfil',
    
    // Home
    welcomeMessage: 'Bem-vindo ao Etheria',
    dailyOracle: 'Oráculo Diário',
    continueLearning: 'Continuar Aprendendo',
    startMeditation: 'Iniciar Meditação',
    
    // Training
    psychicTraining: 'Treinamento Psíquico',
    selectAbility: 'Selecione uma habilidade para treinar',
    clairvoyance: 'Clarividência',
    telepathy: 'Telepatia',
    precognition: 'Precognição',
    psychometry: 'Psicometria',
    auraReading: 'Leitura de Aura',
    remoteViewing: 'Visão Remota',
    
    // Meditation
    meditationTitle: 'Meditação',
    binauralBeats: 'Batidas Binaurais',
    aiGuided: 'Guiada por IA',
    timedMeditation: 'Meditação Cronometrada',
    chakraMeditation: 'Meditação dos Chakras',
    selectDuration: 'Selecionar Duração',
    minutes: 'minutos',
    startSession: 'Iniciar Sessão',
    pauseSession: 'Pausar',
    resumeSession: 'Retomar',
    endSession: 'Encerrar Sessão',
    
    // Oracle
    oracleTitle: 'Adivinhação Oracular',
    selectSpread: 'Selecione uma tiragem',
    singleCard: 'Carta Única',
    threeCard: 'Três Cartas',
    celticCross: 'Cruz Celta',
    drawCards: 'Tirar Cartas',
    yourReading: 'Sua Leitura',
    cardMeaning: 'Significado da Carta',
    
    // Spirit Guides
    spiritGuidesTitle: 'Guias Espirituais',
    selectGuide: 'Selecione seu guia para começar',
    enterBirthday: 'Digite aniversário para pareamento',
    changeBirthday: 'Alterar aniversário',
    typeMessage: 'Digite sua mensagem...',
    send: 'Enviar',
    
    // Journal
    journalTitle: 'Diário de Progresso',
    newEntry: 'Nova Entrada',
    entries: 'Entradas',
    noEntries: 'Nenhuma entrada ainda',
    writeThoughts: 'Escreva seus pensamentos...',
    
    // Settings
    settingsTitle: 'Configurações',
    appSettings: 'Configurações do App',
    theme: 'Tema',
    language: 'Idioma',
    subscription: 'Assinatura',
    premium: 'Premium',
    freePlan: 'Plano Gratuito',
    upgradeToPremium: 'Atualizar para Premium',
    restorePurchase: 'Restaurar Compra',
    support: 'Suporte',
    helpCenter: 'Central de Ajuda',
    contactUs: 'Fale Conosco',
    privacyPolicy: 'Política de Privacidade',
    termsOfService: 'Termos de Serviço',
    about: 'Sobre',
    version: 'Versão',
    editProfile: 'Editar Perfil',
    name: 'Nome',
    
    // Premium
    premiumFeatures: 'Recursos Premium',
    unlockAll: 'Desbloqueie todos os recursos',
    perMonth: '/mês',
    subscribe: 'Assinar',
    premiumRequired: 'Premium Necessário',
    upgradeMessage: 'Atualize para premium para acessar este recurso',
    
    // Themes
    selectTheme: 'Selecionar Tema',
    mysticPurple: 'Roxo Místico',
    oceanBlue: 'Azul Oceano',
    forestGreen: 'Verde Floresta',
    sunsetOrange: 'Laranja Pôr do Sol',
    midnightBlack: 'Preto Meia-Noite',
    roseGold: 'Ouro Rosa',
    premiumTheme: 'Tema Premium',
    currentTheme: 'Atual',
    
    // Languages
    selectLanguage: 'Selecionar Idioma',
    languageChanged: 'Idioma alterado com sucesso',
    
    // Support/Contact
    contact: 'Contato',
    feedbackBugReports: 'Feedback e Bugs',
    emailUs: 'Envie um Email',
    visitWebsite: 'Visite Nosso Site',
    whatsappSupport: 'Suporte WhatsApp',
    chatDirectly: 'Converse conosco',
    followFacebook: 'Siga no Facebook',
    followInstagram: 'Siga no Instagram',
    followTiktok: 'Siga no TikTok',
    
    // Misc
    comingSoon: 'Em Breve',
    featureNotAvailable: 'Este recurso ainda não está disponível',
  },
  ja: {
    // Common
    loading: '読み込み中...',
    error: 'エラー',
    success: '成功',
    cancel: 'キャンセル',
    save: '保存',
    delete: '削除',
    edit: '編集',
    back: '戻る',
    next: '次へ',
    done: '完了',
    close: '閉じる',
    confirm: '確認',
    yes: 'はい',
    no: 'いいえ',
    ok: 'OK',
    
    // Auth
    welcomeBack: 'おかえりなさい',
    signIn: 'ログイン',
    signUp: '登録',
    email: 'メール',
    password: 'パスワード',
    confirmPassword: 'パスワード確認',
    forgotPassword: 'パスワードを忘れた？',
    noAccount: 'アカウントをお持ちでない？',
    hasAccount: 'すでにアカウントをお持ち？',
    createAccount: 'アカウント作成',
    logout: 'ログアウト',
    
    // Navigation
    home: 'ホーム',
    training: 'トレーニング',
    meditation: '瞑想',
    oracle: 'オラクル',
    spiritGuides: 'スピリットガイド',
    journal: '日記',
    settings: '設定',
    profile: 'プロフィール',
    
    // Home
    welcomeMessage: 'Etheriaへようこそ',
    dailyOracle: 'デイリーオラクル',
    continueLearning: '学習を続ける',
    startMeditation: '瞑想を始める',
    
    // Training
    psychicTraining: 'サイキックトレーニング',
    selectAbility: 'トレーニングする能力を選択',
    clairvoyance: '透視能力',
    telepathy: 'テレパシー',
    precognition: '予知能力',
    psychometry: 'サイコメトリー',
    auraReading: 'オーラリーディング',
    remoteViewing: 'リモートビューイング',
    
    // Meditation
    meditationTitle: '瞑想',
    binauralBeats: 'バイノーラルビート',
    aiGuided: 'AIガイド付き',
    timedMeditation: 'タイマー瞑想',
    chakraMeditation: 'チャクラ瞑想',
    selectDuration: '時間を選択',
    minutes: '分',
    startSession: 'セッション開始',
    pauseSession: '一時停止',
    resumeSession: '再開',
    endSession: 'セッション終了',
    
    // Oracle
    oracleTitle: 'オラクル占い',
    selectSpread: 'スプレッドを選択',
    singleCard: '1枚引き',
    threeCard: '3枚引き',
    celticCross: 'ケルト十字',
    drawCards: 'カードを引く',
    yourReading: 'あなたのリーディング',
    cardMeaning: 'カードの意味',
    
    // Spirit Guides
    spiritGuidesTitle: 'スピリットガイド',
    selectGuide: 'ガイドを選んで始める',
    enterBirthday: 'ガイドマッチング用の誕生日を入力',
    changeBirthday: '誕生日を変更',
    typeMessage: 'メッセージを入力...',
    send: '送信',
    
    // Journal
    journalTitle: '進捗日記',
    newEntry: '新規エントリー',
    entries: 'エントリー',
    noEntries: 'まだエントリーがありません',
    writeThoughts: 'あなたの思いを書いて...',
    
    // Settings
    settingsTitle: '設定',
    appSettings: 'アプリ設定',
    theme: 'テーマ',
    language: '言語',
    subscription: 'サブスクリプション',
    premium: 'プレミアム',
    freePlan: '無料プラン',
    upgradeToPremium: 'プレミアムにアップグレード',
    restorePurchase: '購入を復元',
    support: 'サポート',
    helpCenter: 'ヘルプセンター',
    contactUs: 'お問い合わせ',
    privacyPolicy: 'プライバシーポリシー',
    termsOfService: '利用規約',
    about: '概要',
    version: 'バージョン',
    editProfile: 'プロフィール編集',
    name: '名前',
    
    // Premium
    premiumFeatures: 'プレミアム機能',
    unlockAll: '全ての機能をアンロック',
    perMonth: '/月',
    subscribe: '購読',
    premiumRequired: 'プレミアムが必要',
    upgradeMessage: 'この機能にアクセスするにはプレミアムにアップグレード',
    
    // Themes
    selectTheme: 'テーマを選択',
    mysticPurple: 'ミスティックパープル',
    oceanBlue: 'オーシャンブルー',
    forestGreen: 'フォレストグリーン',
    sunsetOrange: 'サンセットオレンジ',
    midnightBlack: 'ミッドナイトブラック',
    roseGold: 'ローズゴールド',
    premiumTheme: 'プレミアムテーマ',
    currentTheme: '現在',
    
    // Languages
    selectLanguage: '言語を選択',
    languageChanged: '言語が正常に変更されました',
    
    // Support/Contact
    contact: '連絡先',
    feedbackBugReports: 'フィードバックとバグ',
    emailUs: 'メールを送る',
    visitWebsite: 'ウェブサイトを訪問',
    whatsappSupport: 'WhatsAppサポート',
    chatDirectly: '直接チャット',
    followFacebook: 'Facebookでフォロー',
    followInstagram: 'Instagramでフォロー',
    followTiktok: 'TikTokでフォロー',
    
    // Misc
    comingSoon: '近日公開',
    featureNotAvailable: 'この機能はまだ利用できません',
  },
  ko: {
    // Common
    loading: '로딩 중...',
    error: '오류',
    success: '성공',
    cancel: '취소',
    save: '저장',
    delete: '삭제',
    edit: '편집',
    back: '뒤로',
    next: '다음',
    done: '완료',
    close: '닫기',
    confirm: '확인',
    yes: '예',
    no: '아니오',
    ok: '확인',
    
    // Auth
    welcomeBack: '다시 오신 것을 환영합니다',
    signIn: '로그인',
    signUp: '가입하기',
    email: '이메일',
    password: '비밀번호',
    confirmPassword: '비밀번호 확인',
    forgotPassword: '비밀번호를 잊으셨나요?',
    noAccount: '계정이 없으신가요?',
    hasAccount: '이미 계정이 있으신가요?',
    createAccount: '계정 만들기',
    logout: '로그아웃',
    
    // Navigation
    home: '홈',
    training: '훈련',
    meditation: '명상',
    oracle: '오라클',
    spiritGuides: '영적 가이드',
    journal: '일지',
    settings: '설정',
    profile: '프로필',
    
    // Home
    welcomeMessage: 'Etheria에 오신 것을 환영합니다',
    dailyOracle: '오늘의 오라클',
    continueLearning: '학습 계속하기',
    startMeditation: '명상 시작',
    
    // Training
    psychicTraining: '심령 훈련',
    selectAbility: '훈련할 능력을 선택하세요',
    clairvoyance: '투시력',
    telepathy: '텔레파시',
    precognition: '예지력',
    psychometry: '사이코메트리',
    auraReading: '오라 리딩',
    remoteViewing: '원격 투시',
    
    // Meditation
    meditationTitle: '명상',
    binauralBeats: '바이노럴 비트',
    aiGuided: 'AI 가이드',
    timedMeditation: '시간 명상',
    chakraMeditation: '차크라 명상',
    selectDuration: '시간 선택',
    minutes: '분',
    startSession: '세션 시작',
    pauseSession: '일시 정지',
    resumeSession: '재개',
    endSession: '세션 종료',
    
    // Oracle
    oracleTitle: '오라클 점술',
    selectSpread: '스프레드 선택',
    singleCard: '싱글 카드',
    threeCard: '쓰리 카드',
    celticCross: '켈틱 크로스',
    drawCards: '카드 뽑기',
    yourReading: '당신의 리딩',
    cardMeaning: '카드 의미',
    
    // Spirit Guides
    spiritGuidesTitle: '영적 가이드',
    selectGuide: '시작할 가이드를 선택하세요',
    enterBirthday: '가이드 매칭을 위한 생일 입력',
    changeBirthday: '생일 변경',
    typeMessage: '메시지를 입력하세요...',
    send: '보내기',
    
    // Journal
    journalTitle: '진행 일지',
    newEntry: '새 항목',
    entries: '항목',
    noEntries: '아직 항목이 없습니다',
    writeThoughts: '생각을 적어주세요...',
    
    // Settings
    settingsTitle: '설정',
    appSettings: '앱 설정',
    theme: '테마',
    language: '언어',
    subscription: '구독',
    premium: '프리미엄',
    freePlan: '무료 플랜',
    upgradeToPremium: '프리미엄으로 업그레이드',
    restorePurchase: '구매 복원',
    support: '지원',
    helpCenter: '도움말 센터',
    contactUs: '문의하기',
    privacyPolicy: '개인정보 처리방침',
    termsOfService: '서비스 약관',
    about: '정보',
    version: '버전',
    editProfile: '프로필 편집',
    name: '이름',
    
    // Premium
    premiumFeatures: '프리미엄 기능',
    unlockAll: '모든 기능 잠금 해제',
    perMonth: '/월',
    subscribe: '구독하기',
    premiumRequired: '프리미엄 필요',
    upgradeMessage: '이 기능에 액세스하려면 프리미엄으로 업그레이드하세요',
    
    // Themes
    selectTheme: '테마 선택',
    mysticPurple: '미스틱 퍼플',
    oceanBlue: '오션 블루',
    forestGreen: '포레스트 그린',
    sunsetOrange: '선셋 오렌지',
    midnightBlack: '미드나이트 블랙',
    roseGold: '로즈 골드',
    premiumTheme: '프리미엄 테마',
    currentTheme: '현재',
    
    // Languages
    selectLanguage: '언어 선택',
    languageChanged: '언어가 성공적으로 변경되었습니다',
    
    // Support/Contact
    contact: '연락처',
    feedbackBugReports: '피드백 및 버그',
    emailUs: '이메일 보내기',
    visitWebsite: '웹사이트 방문',
    whatsappSupport: 'WhatsApp 지원',
    chatDirectly: '직접 채팅',
    followFacebook: 'Facebook 팔로우',
    followInstagram: 'Instagram 팔로우',
    followTiktok: 'TikTok 팔로우',
    
    // Misc
    comingSoon: '곧 출시',
    featureNotAvailable: '이 기능은 아직 사용할 수 없습니다',
  },
  zh: {
    // Common
    loading: '加载中...',
    error: '错误',
    success: '成功',
    cancel: '取消',
    save: '保存',
    delete: '删除',
    edit: '编辑',
    back: '返回',
    next: '下一步',
    done: '完成',
    close: '关闭',
    confirm: '确认',
    yes: '是',
    no: '否',
    ok: '好的',
    
    // Auth
    welcomeBack: '欢迎回来',
    signIn: '登录',
    signUp: '注册',
    email: '邮箱',
    password: '密码',
    confirmPassword: '确认密码',
    forgotPassword: '忘记密码？',
    noAccount: '没有账户？',
    hasAccount: '已有账户？',
    createAccount: '创建账户',
    logout: '退出登录',
    
    // Navigation
    home: '首页',
    training: '训练',
    meditation: '冥想',
    oracle: '神谕',
    spiritGuides: '灵性向导',
    journal: '日志',
    settings: '设置',
    profile: '个人资料',
    
    // Home
    welcomeMessage: '欢迎来到 Etheria',
    dailyOracle: '每日神谕',
    continueLearning: '继续学习',
    startMeditation: '开始冥想',
    
    // Training
    psychicTraining: '灵能训练',
    selectAbility: '选择要训练的能力',
    clairvoyance: '透视能力',
    telepathy: '心灵感应',
    precognition: '预知能力',
    psychometry: '触物感应',
    auraReading: '灵气阅读',
    remoteViewing: '遥视',
    
    // Meditation
    meditationTitle: '冥想',
    binauralBeats: '双耳节拍',
    aiGuided: 'AI引导',
    timedMeditation: '定时冥想',
    chakraMeditation: '脉轮冥想',
    selectDuration: '选择时长',
    minutes: '分钟',
    startSession: '开始会话',
    pauseSession: '暂停',
    resumeSession: '继续',
    endSession: '结束会话',
    
    // Oracle
    oracleTitle: '神谕占卜',
    selectSpread: '选择牌阵',
    singleCard: '单张牌',
    threeCard: '三张牌',
    celticCross: '凯尔特十字',
    drawCards: '抽牌',
    yourReading: '您的解读',
    cardMeaning: '牌面含义',
    
    // Spirit Guides
    spiritGuidesTitle: '灵性向导',
    selectGuide: '选择您的向导开始',
    enterBirthday: '输入生日以匹配向导',
    changeBirthday: '更改生日',
    typeMessage: '输入您的消息...',
    send: '发送',
    
    // Journal
    journalTitle: '进度日志',
    newEntry: '新条目',
    entries: '条目',
    noEntries: '暂无条目',
    writeThoughts: '写下您的想法...',
    
    // Settings
    settingsTitle: '设置',
    appSettings: '应用设置',
    theme: '主题',
    language: '语言',
    subscription: '订阅',
    premium: '高级版',
    freePlan: '免费版',
    upgradeToPremium: '升级到高级版',
    restorePurchase: '恢复购买',
    support: '支持',
    helpCenter: '帮助中心',
    contactUs: '联系我们',
    privacyPolicy: '隐私政策',
    termsOfService: '服务条款',
    about: '关于',
    version: '版本',
    editProfile: '编辑个人资料',
    name: '姓名',
    
    // Premium
    premiumFeatures: '高级功能',
    unlockAll: '解锁所有功能',
    perMonth: '/月',
    subscribe: '订阅',
    premiumRequired: '需要高级版',
    upgradeMessage: '升级到高级版以访问此功能',
    
    // Themes
    selectTheme: '选择主题',
    mysticPurple: '神秘紫',
    oceanBlue: '海洋蓝',
    forestGreen: '森林绿',
    sunsetOrange: '日落橙',
    midnightBlack: '午夜黑',
    roseGold: '玫瑰金',
    premiumTheme: '高级主题',
    currentTheme: '当前',
    
    // Languages
    selectLanguage: '选择语言',
    languageChanged: '语言更改成功',
    
    // Support/Contact
    contact: '联系',
    feedbackBugReports: '反馈和错误',
    emailUs: '发送邮件',
    visitWebsite: '访问网站',
    whatsappSupport: 'WhatsApp支持',
    chatDirectly: '直接聊天',
    followFacebook: '关注Facebook',
    followInstagram: '关注Instagram',
    followTiktok: '关注TikTok',
    
    // Misc
    comingSoon: '即将推出',
    featureNotAvailable: '此功能尚不可用',
  },
};

interface LanguageContextType {
  language: Language;
  languageCode: string;
  setLanguage: (code: string) => Promise<void>;
  t: (key: TranslationKeys) => string;
  availableLanguages: Language[];
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

const LANGUAGE_STORAGE_KEY = '@etheria_language';

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [languageCode, setLanguageCode] = useState<string>('en');

  useEffect(() => {
    loadSavedLanguage();
  }, []);

  const loadSavedLanguage = async () => {
    try {
      const savedLanguage = await AsyncStorage.getItem(LANGUAGE_STORAGE_KEY);
      if (savedLanguage && LANGUAGES.find(l => l.code === savedLanguage)) {
        setLanguageCode(savedLanguage);
      }
    } catch (error) {
      console.error('Error loading language:', error);
    }
  };

  const setLanguage = async (code: string) => {
    if (LANGUAGES.find(l => l.code === code)) {
      setLanguageCode(code);
      try {
        await AsyncStorage.setItem(LANGUAGE_STORAGE_KEY, code);
      } catch (error) {
        console.error('Error saving language:', error);
      }
    }
  };

  const t = (key: TranslationKeys): string => {
    const langTranslations = translations[languageCode as keyof typeof translations] || translations.en;
    return langTranslations[key] || translations.en[key] || key;
  };

  const language = LANGUAGES.find(l => l.code === languageCode) || LANGUAGES[0];

  return (
    <LanguageContext.Provider value={{ language, languageCode, setLanguage, t, availableLanguages: LANGUAGES }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (context === undefined) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return context;
}

export { translations };
