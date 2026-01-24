import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { translations, type Language, type Translations } from './translations';

interface I18nContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: Translations;
}

const I18nContext = createContext<I18nContextType | undefined>(undefined);

const STORAGE_KEY = 'ice-map-language';

function detectLanguage(): Language {
  // Check localStorage first
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored === 'en' || stored === 'es') {
    return stored;
  }

  // Check browser language
  const browserLang = navigator.language.toLowerCase();
  if (browserLang.startsWith('es')) {
    return 'es';
  }

  return 'en';
}

export function I18nProvider({ children }: { children: ReactNode }) {
  const [language, setLanguageState] = useState<Language>('en');

  useEffect(() => {
    setLanguageState(detectLanguage());
  }, []);

  const setLanguage = (lang: Language) => {
    setLanguageState(lang);
    localStorage.setItem(STORAGE_KEY, lang);
    document.documentElement.lang = lang;
  };

  const t = translations[language];

  return (
    <I18nContext.Provider value={{ language, setLanguage, t }}>
      {children}
    </I18nContext.Provider>
  );
}

export function useI18n(): I18nContextType {
  const context = useContext(I18nContext);
  if (!context) {
    throw new Error('useI18n must be used within an I18nProvider');
  }
  return context;
}
