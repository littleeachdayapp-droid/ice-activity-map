export type Language = 'en' | 'es';

export interface Translations {
  // App header
  appTitle: string;
  appSubtitle: string;

  // Filters
  filters: string;
  closeFilters: string;
  timeRange: string;
  activityTypes: string;
  last24Hours: string;
  last7Days: string;
  last30Days: string;
  allTime: string;

  // Activity types
  raid: string;
  checkpoint: string;
  arrest: string;
  surveillance: string;
  other: string;

  // Report details
  location: string;
  description: string;
  reportedBy: string;
  time: string;
  verified: string;
  unverified: string;
  disputed: string;
  close: string;

  // Report count
  report: string;
  reports: string;
  loading: string;
  demoData: string;

  // Time formatting
  lessThanAnHourAgo: string;
  hoursAgo: string;
  daysAgo: string;

  // Verification
  confirmReport: string;
  disputeReport: string;
  yourVote: string;
  confirmations: string;
  disputes: string;
  addComment: string;
  submitVote: string;
  removeVote: string;

  // Flagging
  flagReport: string;
  flagReason: string;
  spam: string;
  misinformation: string;
  duplicate: string;
  inappropriate: string;
  otherReason: string;
  flagDetails: string;
  submitFlag: string;
  reportFlagged: string;

  // Push notifications
  enableNotifications: string;
  notificationsEnabled: string;
  notificationsDisabled: string;
  notifyForArea: string;
  radiusKm: string;
  selectActivityTypes: string;

  // Errors
  errorLoadingReports: string;
  errorSubmitting: string;
  tryAgain: string;

  // Language
  language: string;
  english: string;
  spanish: string;
}

export const translations: Record<Language, Translations> = {
  en: {
    // App header
    appTitle: 'ICE Activity Map',
    appSubtitle: 'Community-reported immigration enforcement activity',

    // Filters
    filters: 'Filters',
    closeFilters: 'Close Filters',
    timeRange: 'Time Range',
    activityTypes: 'Activity Types',
    last24Hours: 'Last 24 hours',
    last7Days: 'Last 7 days',
    last30Days: 'Last 30 days',
    allTime: 'All time',

    // Activity types
    raid: 'Raid',
    checkpoint: 'Checkpoint',
    arrest: 'Arrest',
    surveillance: 'Surveillance',
    other: 'Other',

    // Report details
    location: 'Location',
    description: 'Description',
    reportedBy: 'Reported by',
    time: 'Time',
    verified: 'Verified',
    unverified: 'Unverified',
    disputed: 'Disputed',
    close: 'Close',

    // Report count
    report: 'report',
    reports: 'reports',
    loading: 'Loading...',
    demoData: '(demo data)',

    // Time formatting
    lessThanAnHourAgo: 'Less than an hour ago',
    hoursAgo: 'hours ago',
    daysAgo: 'days ago',

    // Verification
    confirmReport: 'Confirm this report',
    disputeReport: 'Dispute this report',
    yourVote: 'Your vote',
    confirmations: 'confirmations',
    disputes: 'disputes',
    addComment: 'Add a comment (optional)',
    submitVote: 'Submit',
    removeVote: 'Remove vote',

    // Flagging
    flagReport: 'Flag Report',
    flagReason: 'Reason for flagging',
    spam: 'Spam',
    misinformation: 'Misinformation',
    duplicate: 'Duplicate',
    inappropriate: 'Inappropriate',
    otherReason: 'Other',
    flagDetails: 'Additional details (optional)',
    submitFlag: 'Submit Flag',
    reportFlagged: 'Report flagged',

    // Push notifications
    enableNotifications: 'Enable Notifications',
    notificationsEnabled: 'Notifications enabled',
    notificationsDisabled: 'Notifications disabled',
    notifyForArea: 'Notify me for activity in this area',
    radiusKm: 'Radius (km)',
    selectActivityTypes: 'Activity types to notify',

    // Errors
    errorLoadingReports: 'Error loading reports',
    errorSubmitting: 'Error submitting',
    tryAgain: 'Try again',

    // Language
    language: 'Language',
    english: 'English',
    spanish: 'Español'
  },

  es: {
    // App header
    appTitle: 'Mapa de Actividad de ICE',
    appSubtitle: 'Actividad de inmigración reportada por la comunidad',

    // Filters
    filters: 'Filtros',
    closeFilters: 'Cerrar Filtros',
    timeRange: 'Período',
    activityTypes: 'Tipos de Actividad',
    last24Hours: 'Últimas 24 horas',
    last7Days: 'Últimos 7 días',
    last30Days: 'Últimos 30 días',
    allTime: 'Todo el tiempo',

    // Activity types
    raid: 'Redada',
    checkpoint: 'Retén',
    arrest: 'Arresto',
    surveillance: 'Vigilancia',
    other: 'Otro',

    // Report details
    location: 'Ubicación',
    description: 'Descripción',
    reportedBy: 'Reportado por',
    time: 'Hora',
    verified: 'Verificado',
    unverified: 'Sin verificar',
    disputed: 'Disputado',
    close: 'Cerrar',

    // Report count
    report: 'reporte',
    reports: 'reportes',
    loading: 'Cargando...',
    demoData: '(datos de demostración)',

    // Time formatting
    lessThanAnHourAgo: 'Hace menos de una hora',
    hoursAgo: 'horas',
    daysAgo: 'días',

    // Verification
    confirmReport: 'Confirmar este reporte',
    disputeReport: 'Disputar este reporte',
    yourVote: 'Tu voto',
    confirmations: 'confirmaciones',
    disputes: 'disputas',
    addComment: 'Agregar comentario (opcional)',
    submitVote: 'Enviar',
    removeVote: 'Eliminar voto',

    // Flagging
    flagReport: 'Reportar',
    flagReason: 'Razón del reporte',
    spam: 'Spam',
    misinformation: 'Desinformación',
    duplicate: 'Duplicado',
    inappropriate: 'Inapropiado',
    otherReason: 'Otro',
    flagDetails: 'Detalles adicionales (opcional)',
    submitFlag: 'Enviar Reporte',
    reportFlagged: 'Reporte enviado',

    // Push notifications
    enableNotifications: 'Activar Notificaciones',
    notificationsEnabled: 'Notificaciones activadas',
    notificationsDisabled: 'Notificaciones desactivadas',
    notifyForArea: 'Notificarme de actividad en esta área',
    radiusKm: 'Radio (km)',
    selectActivityTypes: 'Tipos de actividad a notificar',

    // Errors
    errorLoadingReports: 'Error al cargar reportes',
    errorSubmitting: 'Error al enviar',
    tryAgain: 'Intentar de nuevo',

    // Language
    language: 'Idioma',
    english: 'English',
    spanish: 'Español'
  }
};

// Activity type keys for iteration
export const ACTIVITY_TYPE_KEYS = ['raid', 'checkpoint', 'arrest', 'surveillance', 'other'] as const;

// Get translated activity type label
export function getActivityTypeLabel(type: string, lang: Language): string {
  const key = type as keyof Pick<Translations, 'raid' | 'checkpoint' | 'arrest' | 'surveillance' | 'other'>;
  return translations[lang][key] || type;
}

// Get translated status label
export function getStatusLabel(status: string, lang: Language): string {
  const key = status as keyof Pick<Translations, 'verified' | 'unverified' | 'disputed'>;
  return translations[lang][key] || status;
}
