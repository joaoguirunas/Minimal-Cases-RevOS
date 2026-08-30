import { useMemo } from 'react';
import { useSettings } from './useSettings';
import { translations, Language } from '@/i18n/translations';

export const useTranslation = () => {
  const { data: settings } = useSettings();

  const currentLanguage: Language = useMemo(() => {
    const lang = settings?.language || 'pt-br';
    // Map 'pt-br' -> 'pt', 'en-us' -> 'en'
    return lang.startsWith('pt') ? 'pt' : 'en';
  }, [settings?.language]);

  const t = (key: string, replacements?: Record<string, string | number>): string => {
    const keys = key.split('.');
    let value: any = translations[currentLanguage];

    for (const k of keys) {
      value = value?.[k];
      if (!value) break;
    }

    // Fallback to English if not found in Portuguese
    if (!value && currentLanguage === 'pt') {
      value = translations.en;
      for (const k of keys) {
        value = value?.[k];
        if (!value) break;
      }
    }

    let result = value || key;

    // Replace placeholders like {hours}, {days}
    if (replacements && typeof result === 'string') {
      Object.entries(replacements).forEach(([key, val]) => {
        result = result.replace(`{${key}}`, String(val));
      });
    }

    return result;
  };

  return { t, currentLanguage };
};
