import { createContext, useContext } from 'react';
import { AppLanguage } from '../../shared/types';
import { defaultLanguage, messages, TranslationKey } from './messages';

type TranslationValues = Record<string, string | number>;

export interface I18nContextValue {
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

export const useI18n = () => useContext(I18nContext);

export const createI18nContextValue = (language: AppLanguage): I18nContextValue => {
  const dictionary = messages[language] ?? messages[defaultLanguage];

  return {
    language,
    t: (key, values) => formatMessage(dictionary[key] ?? messages[defaultLanguage][key], values),
    setLanguage: async () => undefined,
  };
};
