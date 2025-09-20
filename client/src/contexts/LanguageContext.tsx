import { createContext, useContext, useState, useEffect, ReactNode, useMemo, useCallback, useRef } from 'react';

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
  isLoading: boolean;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

interface LanguageProviderProps {
  children: ReactNode;
}

// Translation cache to avoid refetching
const translationCache = new Map<LanguageCode, Record<string, any>>();

// Helper function to get initial language from localStorage
const getInitialLanguage = (): LanguageCode => {
  const savedLanguage = localStorage.getItem('fra-atlas-language') as LanguageCode;
  return (savedLanguage && languages[savedLanguage]) ? savedLanguage : 'en';
};

export function LanguageProvider({ children }: LanguageProviderProps) {
  // Initialize with saved language to avoid double fetch
  const [currentLanguage, setCurrentLanguage] = useState<LanguageCode>(getInitialLanguage);
  const [translations, setTranslations] = useState<Record<string, any>>({});
  const [isLoading, setIsLoading] = useState(false);
  
  // Track current request to prevent race conditions
  const currentRequestRef = useRef<number>(0);

  // Load translations with caching and race condition protection
  const loadTranslations = useCallback(async (language: LanguageCode) => {
    // Generate unique request ID
    const requestId = ++currentRequestRef.current;
    
    // Check cache first
    if (translationCache.has(language)) {
      // Only update if this is still the latest request
      if (requestId === currentRequestRef.current) {
        const cachedTranslations = translationCache.get(language)!;
        setTranslations(cachedTranslations);
      }
      return;
    }

    setIsLoading(true);
    try {
      const response = await fetch(`/translations/${language}.json`);
      if (response.ok) {
        const data = await response.json();
        
        // Only update if this is still the latest request
        if (requestId === currentRequestRef.current) {
          translationCache.set(language, data);
          setTranslations(data);
        }
      } else {
        console.error(`Failed to load ${language} translations:`, response.status);
      }
    } catch (error) {
      console.error(`Failed to load ${language} translations:`, error);
    } finally {
      // Only clear loading if this is still the latest request
      if (requestId === currentRequestRef.current) {
        setIsLoading(false);
      }
    }
  }, []);

  // Load translations when language changes
  useEffect(() => {
    loadTranslations(currentLanguage);
  }, [currentLanguage, loadTranslations]);

  // Preload all translations on first load
  useEffect(() => {
    const preloadTranslations = async () => {
      // Preload both languages in the background
      for (const lang of Object.keys(languages) as LanguageCode[]) {
        if (!translationCache.has(lang)) {
          try {
            const response = await fetch(`/translations/${lang}.json`);
            if (response.ok) {
              const data = await response.json();
              translationCache.set(lang, data);
            }
          } catch (error) {
            // Silent fail for preloading
            console.debug(`Failed to preload ${lang} translations:`, error);
          }
        }
      }
    };

    // Preload after a short delay to not block initial render
    const timeoutId = setTimeout(preloadTranslations, 100);
    return () => clearTimeout(timeoutId);
  }, []);

  const setLanguage = useCallback((language: LanguageCode) => {
    if (language !== currentLanguage) {
      setCurrentLanguage(language);
      localStorage.setItem('fra-atlas-language', language);
    }
  }, [currentLanguage]);

  // Memoized translation function with nested key support
  const t = useMemo(() => {
    return (key: string, fallback?: string): string => {
      const keys = key.split('.');
      let value = translations;
      
      for (const k of keys) {
        value = value?.[k];
        if (value === undefined) break;
      }
      
      return typeof value === 'string' ? value : fallback || key;
    };
  }, [translations]);

  const contextValue = useMemo(() => ({
    currentLanguage,
    setLanguage,
    t,
    isLoading
  }), [currentLanguage, setLanguage, t, isLoading]);

  return (
    <LanguageContext.Provider value={contextValue}>
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