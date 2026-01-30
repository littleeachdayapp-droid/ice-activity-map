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

  // Report form
  form: {
    title: string;
    activityType: string;
    description: string;
    descriptionPlaceholder: string;
    descriptionRequired: string;
    streetAddress: string;
    streetAddressPlaceholder: string;
    streetAddressHint: string;
    city: string;
    cityPlaceholder: string;
    cityRequired: string;
    state: string;
    selectState: string;
    stateRequired: string;
    coordinates: string;
    optional: string;
    latitude: string;
    longitude: string;
    coordinatesHint: string;
    lookupAddress: string;
    lookingUp: string;
    geocodeNeedsCity: string;
    geocodeNotFound: string;
    geocodeError: string;
    disclaimer: string;
    cancel: string;
    submit: string;
    submitting: string;
    submitted: string;
    thankYou: string;
    // Photo upload
    addPhoto: string;
    tapToAddPhoto: string;
    photoHint: string;
    removePhoto: string;
    extractingLocation: string;
    locationFromPhoto: string;
    photoInvalidType: string;
    photoTooLarge: string;
  };

  // Admin
  admin: {
    title: string;
    moderationQueue: string;
    approve: string;
    reject: string;
    pending: string;
    approved: string;
    rejected: string;
    noReports: string;
    login: string;
    logout: string;
    adminKey: string;
    invalidKey: string;
    flaggedReports: string;
    moderationLog: string;
  };

  // Analytics
  analytics: {
    title: string;
    reportsOverTime: string;
    byActivityType: string;
    topLocations: string;
    recentActivity: string;
    totalReports: string;
    last7Days: string;
    last30Days: string;
  };
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
    spanish: 'Español',

    // Report form
    form: {
      title: 'Report ICE/CBP Activity',
      activityType: 'Activity Type',
      description: 'Description',
      descriptionPlaceholder: 'Describe what you witnessed...',
      descriptionRequired: 'Description is required',
      streetAddress: 'Street Address',
      streetAddressPlaceholder: 'e.g., 123 Main St',
      streetAddressHint: 'For more precise location mapping',
      city: 'City',
      cityPlaceholder: 'e.g., Los Angeles',
      cityRequired: 'City is required',
      state: 'State',
      selectState: 'Select state...',
      stateRequired: 'State is required',
      coordinates: 'Coordinates',
      optional: 'optional',
      latitude: 'Latitude',
      longitude: 'Longitude',
      coordinatesHint: 'If left blank, we will geocode from the city/state',
      lookupAddress: 'Look up from address',
      lookingUp: 'Looking up...',
      geocodeNeedsCity: 'Please enter a city and state first',
      geocodeNotFound: 'Address not found. Please check the address or enter coordinates manually.',
      geocodeError: 'Could not look up address. Please enter coordinates manually.',
      disclaimer: 'Reports are reviewed by moderators before appearing on the map. Only submit reports of activity you personally witnessed.',
      cancel: 'Cancel',
      submit: 'Submit Report',
      submitting: 'Submitting...',
      submitted: 'Report Submitted',
      thankYou: 'Thank you for your report. It will be reviewed by moderators.',
      // Photo upload
      addPhoto: 'Add Photo',
      tapToAddPhoto: 'Tap to add a photo',
      photoHint: 'Photos with GPS data will auto-fill location. Max 10MB.',
      removePhoto: 'Remove photo',
      extractingLocation: 'Extracting location...',
      locationFromPhoto: 'Location extracted from photo',
      photoInvalidType: 'Please select an image file',
      photoTooLarge: 'Photo must be less than 10MB'
    },

    // Admin
    admin: {
      title: 'Admin Dashboard',
      moderationQueue: 'Moderation Queue',
      approve: 'Approve',
      reject: 'Reject',
      pending: 'Pending',
      approved: 'Approved',
      rejected: 'Rejected',
      noReports: 'No reports in queue',
      login: 'Login',
      logout: 'Logout',
      adminKey: 'Admin Key',
      invalidKey: 'Invalid admin key',
      flaggedReports: 'Flagged Reports',
      moderationLog: 'Moderation Log'
    },

    // Analytics
    analytics: {
      title: 'Analytics',
      reportsOverTime: 'Reports Over Time',
      byActivityType: 'By Activity Type',
      topLocations: 'Top Locations',
      recentActivity: 'Recent Activity',
      totalReports: 'Total Reports',
      last7Days: 'Last 7 Days',
      last30Days: 'Last 30 Days'
    }
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
    spanish: 'Español',

    // Report form
    form: {
      title: 'Reportar Actividad de ICE/CBP',
      activityType: 'Tipo de Actividad',
      description: 'Descripción',
      descriptionPlaceholder: 'Describe lo que presenciaste...',
      descriptionRequired: 'La descripción es requerida',
      streetAddress: 'Dirección',
      streetAddressPlaceholder: 'ej., 123 Calle Principal',
      streetAddressHint: 'Para una ubicación más precisa en el mapa',
      city: 'Ciudad',
      cityPlaceholder: 'ej., Los Ángeles',
      cityRequired: 'La ciudad es requerida',
      state: 'Estado',
      selectState: 'Seleccionar estado...',
      stateRequired: 'El estado es requerido',
      coordinates: 'Coordenadas',
      optional: 'opcional',
      latitude: 'Latitud',
      longitude: 'Longitud',
      coordinatesHint: 'Si se deja en blanco, geocodificaremos desde la ciudad/estado',
      lookupAddress: 'Buscar desde dirección',
      lookingUp: 'Buscando...',
      geocodeNeedsCity: 'Por favor ingresa una ciudad y estado primero',
      geocodeNotFound: 'Dirección no encontrada. Verifica la dirección o ingresa las coordenadas manualmente.',
      geocodeError: 'No se pudo buscar la dirección. Por favor ingresa las coordenadas manualmente.',
      disclaimer: 'Los reportes son revisados por moderadores antes de aparecer en el mapa. Solo envía reportes de actividad que presenciaste personalmente.',
      cancel: 'Cancelar',
      submit: 'Enviar Reporte',
      submitting: 'Enviando...',
      submitted: 'Reporte Enviado',
      thankYou: 'Gracias por tu reporte. Será revisado por moderadores.',
      // Photo upload
      addPhoto: 'Agregar Foto',
      tapToAddPhoto: 'Toca para agregar una foto',
      photoHint: 'Las fotos con datos GPS completarán la ubicación automáticamente. Máximo 10MB.',
      removePhoto: 'Eliminar foto',
      extractingLocation: 'Extrayendo ubicación...',
      locationFromPhoto: 'Ubicación extraída de la foto',
      photoInvalidType: 'Por favor selecciona un archivo de imagen',
      photoTooLarge: 'La foto debe ser menor a 10MB'
    },

    // Admin
    admin: {
      title: 'Panel de Administración',
      moderationQueue: 'Cola de Moderación',
      approve: 'Aprobar',
      reject: 'Rechazar',
      pending: 'Pendiente',
      approved: 'Aprobado',
      rejected: 'Rechazado',
      noReports: 'No hay reportes en cola',
      login: 'Iniciar Sesión',
      logout: 'Cerrar Sesión',
      adminKey: 'Clave de Admin',
      invalidKey: 'Clave de admin inválida',
      flaggedReports: 'Reportes Marcados',
      moderationLog: 'Registro de Moderación'
    },

    // Analytics
    analytics: {
      title: 'Analíticas',
      reportsOverTime: 'Reportes en el Tiempo',
      byActivityType: 'Por Tipo de Actividad',
      topLocations: 'Ubicaciones Principales',
      recentActivity: 'Actividad Reciente',
      totalReports: 'Total de Reportes',
      last7Days: 'Últimos 7 Días',
      last30Days: 'Últimos 30 Días'
    }
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
