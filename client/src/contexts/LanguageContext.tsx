import { createContext, useContext, useState, useEffect, ReactNode } from 'react';

// Available languages with their codes and names
export const languages = {
  hi: { name: 'Hindi', nativeName: 'हिन्दी' },
  en: { name: 'English', nativeName: 'English' }
} as const;

export type LanguageCode = keyof typeof languages;

interface LanguageContextType {
  currentLanguage: LanguageCode;
  setLanguage: (language: LanguageCode) => void;
  t: (key: string, fallback?: string) => string;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

interface LanguageProviderProps {
  children: ReactNode;
}

export function LanguageProvider({ children }: LanguageProviderProps) {
  const [currentLanguage, setCurrentLanguage] = useState<LanguageCode>('hi');
  const [translations, setTranslations] = useState<Record<string, any>>({});

  // Load translations when language changes
  useEffect(() => {
    const loadTranslations = async () => {
      try {
        const response = await fetch(`/translations/${currentLanguage}.json`);
        if (response.ok) {
          const data = await response.json();
          setTranslations(data);
        }
      } catch (error) {
        console.error('Failed to load translations:', error);
      }
    };

    loadTranslations();
  }, [currentLanguage]);

  // Load saved language preference
  useEffect(() => {
    const savedLanguage = localStorage.getItem('fra-atlas-language') as LanguageCode;
    if (savedLanguage && languages[savedLanguage]) {
      setCurrentLanguage(savedLanguage);
    }
  }, []);

  const setLanguage = (language: LanguageCode) => {
    setCurrentLanguage(language);
    localStorage.setItem('fra-atlas-language', language);
  };

  // Translation function with nested key support
  const t = (key: string, fallback?: string): string => {
    const keys = key.split('.');
    let value = translations;
    
    for (const k of keys) {
      value = value?.[k];
      if (value === undefined) break;
    }
    
    return typeof value === 'string' ? value : fallback || key;
  };

  return (
    <LanguageContext.Provider value={{ currentLanguage, setLanguage, t }}>
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