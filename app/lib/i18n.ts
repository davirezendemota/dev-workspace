import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';

import pagesPtBR from '@/app/locales/pt-BR/pages.json';
import pagesEnUS from '@/app/locales/en-US/pages.json';

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: {
      'pt-BR': {
        pages: pagesPtBR,
      },
      'en-US': {
        pages: pagesEnUS,
      },
    },
    fallbackLng: 'pt-BR',
    defaultNS: 'pages',
    ns: ['pages'],
    interpolation: {
      escapeValue: false,
    },
    detection: {
      order: ['localStorage', 'navigator'],
      caches: ['localStorage'],
      lookupLocalStorage: 'i18nextLng',
    },
  });

export default i18n;

