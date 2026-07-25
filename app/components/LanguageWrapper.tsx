'use client';

import { useTranslation } from 'react-i18next';
import { useEffect } from 'react';

interface LanguageWrapperProps {
  children: React.ReactNode;
}

export default function LanguageWrapper({ children }: LanguageWrapperProps) {
  const { i18n } = useTranslation();

  useEffect(() => {
    if (typeof document !== 'undefined') {
      document.documentElement.lang = i18n.language;
    }
  }, [i18n.language]);

  return <>{children}</>;
}

