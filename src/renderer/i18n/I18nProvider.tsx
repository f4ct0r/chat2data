import React, { useEffect, useState } from 'react';
import { AppLanguage } from '../../shared/types';
import { I18nContext, type I18nContextValue } from './i18n-context';
import { defaultLanguage, isSupportedLanguage, messages } from './messages';

type TranslationValues = Record<string, string | number>;

const formatMessage = (template: string, values?: TranslationValues) => {
  if (!values) {
    return template;
  }

  return Object.entries(values).reduce((message, [key, value]) => {
    return message.replaceAll(`{${key}}`, String(value));
  }, template);
};

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

  const t: I18nContextValue['t'] = (key, values) => {
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
