/* ====================================================================
   I18N PROVIDER — language state + t() over the string catalog
   ==================================================================== */

import { createContext, useContext, useMemo, useState } from "react";
import { Languages } from "lucide-react";
import { translate, LANGS } from "./strings.js";

const LANG_KEY = "quiznight.lang";

function initialLang() {
  try {
    const saved = localStorage.getItem(LANG_KEY);
    if (saved && LANGS.includes(saved)) return saved;
  } catch {
    /* ignore */
  }
  try {
    if (navigator.language && navigator.language.toLowerCase().startsWith("de")) return "de";
  } catch {
    /* ignore */
  }
  return "en";
}

export const I18nContext = createContext({ lang: "en", setLang: () => {}, t: (k) => k });

/** Wrap the app so any component can read the current language and t(). */
export function I18nProvider({ children }) {
  const [lang, setLangState] = useState(initialLang);
  const value = useMemo(() => {
    const setLang = (next) => {
      setLangState(next);
      try {
        localStorage.setItem(LANG_KEY, next);
      } catch {
        /* ignore */
      }
    };
    return { lang, setLang, t: (key, vars) => translate(lang, key, vars) };
  }, [lang]);
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

/** Access { lang, setLang, t }. */
export function useI18n() {
  return useContext(I18nContext);
}

/** Toggle between the two languages (EN ⇄ DE). */
export function LanguageToggle({ className = "" }) {
  const { lang, setLang, t } = useI18n();
  return (
    <button
      aria-label={t("lang.switch")}
      title={t("lang.switch")}
      onClick={() => setLang(lang === "de" ? "en" : "de")}
      className={`inline-flex items-center gap-1 rounded-lg p-2 text-sm font-semibold text-stone-400 transition hover:bg-stone-100 hover:text-stone-700 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 dark:text-stone-500 dark:hover:bg-stone-800 dark:hover:text-stone-200 ${className}`}
    >
      <Languages size={18} />
      {lang.toUpperCase()}
    </button>
  );
}
