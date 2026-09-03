import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { dictionaries, en, Language, TranslationKey } from '../i18n/translations';

const STORAGE_KEY = 'asd.language';

export type TranslateVars = Record<string, string | number>;

interface I18nContextValue {
  lang: Language;
  setLang: (lang: Language) => void;
  toggleLang: () => void;
  /** Translate a key, substituting {placeholders} from `vars`. */
  t: (key: TranslationKey, vars?: TranslateVars) => string;
  /** Locale-aware number formatting (Indonesian uses a decimal comma). */
  n: (value: number, digits?: number) => string;
  /** Locale-aware short date. */
  d: (value: number | Date) => string;
  locale: string;
}

const I18nContext = createContext<I18nContextValue | null>(null);

function readStoredLanguage(): Language {
  if (typeof window === 'undefined') return 'id';
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (stored === 'id' || stored === 'en') return stored;
  } catch {
    /* localStorage can be unavailable in private browsing — ignore. */
  }
  // Bahasa Indonesia is the working default; English is one click away.
  return 'id';
}

export const I18nProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [lang, setLangState] = useState<Language>(readStoredLanguage);

  useEffect(() => {
    try {
      window.localStorage.setItem(STORAGE_KEY, lang);
    } catch {
      /* ignore */
    }
    document.documentElement.lang = lang;
  }, [lang]);

  const setLang = useCallback((next: Language) => setLangState(next), []);
  const toggleLang = useCallback(
    () => setLangState((prev) => (prev === 'id' ? 'en' : 'id')),
    []
  );

  const locale = lang === 'id' ? 'id-ID' : 'en-US';

  const t = useCallback(
    (key: TranslationKey, vars?: TranslateVars) => {
      const table = dictionaries[lang] as Record<TranslationKey, string>;
      let text = table[key] ?? en[key] ?? key;
      if (vars) {
        for (const [name, value] of Object.entries(vars)) {
          text = text.split(`{${name}}`).join(String(value));
        }
      }
      return text;
    },
    [lang]
  );

  const n = useCallback(
    (value: number, digits?: number) => {
      if (!Number.isFinite(value)) return '—';
      return new Intl.NumberFormat(locale, {
        minimumFractionDigits: digits ?? 0,
        maximumFractionDigits: digits ?? 2,
      }).format(value);
    },
    [locale]
  );

  const d = useCallback(
    (value: number | Date) => new Date(value).toLocaleDateString(locale),
    [locale]
  );

  const value = useMemo(
    () => ({ lang, setLang, toggleLang, t, n, d, locale }),
    [lang, setLang, toggleLang, t, n, d, locale]
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
};

export function useI18n(): I18nContextValue {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error('useI18n must be used inside <I18nProvider>');
  return ctx;
}
