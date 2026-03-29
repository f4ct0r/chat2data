import React, { createContext, useContext, useEffect, useState } from 'react';
import { AppLanguage } from '../../shared/types';
import { defaultLanguage, isSupportedLanguage, messages, TranslationKey } from './messages';

type TranslationValues = Record<string, string | number>;

interface I18nContextValue {
  language: AppLanguage;
  t: (key: TranslationKey, values?: TranslationValues) => string;
  setLanguage: (language: AppLanguage, persist?: boolean) => Promise<void>;
}

const formatMessage = (template: string, values?: TranslationValues) => {
  if (!values) {
    return template;
  }

  return Object.entries(values).reduce((message, [key, value]) => {
    return message.replaceAll(`{${key}}`, String(value));
  }, template);
};

const defaultContextValue: I18nContextValue = {
  language: defaultLanguage,
  t: (key, values) => formatMessage(messages[defaultLanguage][key], values),
  setLanguage: async () => undefined,
};

export const I18nContext = createContext<I18nContextValue>(defaultContextValue);

export const I18nProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [language, setLanguageState] = useState<AppLanguage>(defaultLanguage);

  useEffect(() => {
    let cancelled = false;

    void window.api.settings.getAppLanguage()
      .then((savedLanguage) => {
        if (!cancelled && isSupportedLanguage(savedLanguage)) {
          setLanguageState(savedLanguage);
        }
      })
      .catch((error) => {
        console.error('Failed to load app language', error);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const setLanguage = async (nextLanguage: AppLanguage, persist: boolean = true) => {
    setLanguageState(nextLanguage);
    if (persist) {
      await window.api.settings.setAppLanguage(nextLanguage);
    }
  };

  const t = (key: TranslationKey, values?: TranslationValues) => {
    const dictionary = messages[language] ?? messages[defaultLanguage];
    const fallback = messages[defaultLanguage][key];
    return formatMessage(dictionary[key] ?? fallback, values);
  };

  return (
    <I18nContext.Provider value={{ language, t, setLanguage }}>
      {children}
    </I18nContext.Provider>
  );
};

export const useI18n = () => useContext(I18nContext);
