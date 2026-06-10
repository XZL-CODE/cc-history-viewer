// 轻量级 i18n：zh / en 双字典 + React context + {name} 插值。
// 语言持久化到 localStorage；utils 等非组件代码通过 getCurrentLang() 读取当前语言。

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { zh } from "./zh";
import { en } from "./en";

export type LangCode = "zh" | "en";
export type DictKey = keyof typeof zh;

const STORAGE_KEY = "cc-viewer:lang";

const dicts: Record<LangCode, Record<DictKey, string>> = { zh, en };

function detectInitialLang(): LangCode {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved === "zh" || saved === "en") {
      return saved;
    }
  } catch {
    /* localStorage 不可用时回退到浏览器语言 */
  }
  return navigator.language?.toLowerCase().startsWith("zh") ? "zh" : "en";
}

/** 模块级当前语言：供 utils.ts 等非组件代码同步读取 */
let currentLang: LangCode = detectInitialLang();

export function getCurrentLang(): LangCode {
  return currentLang;
}

/** 纯函数翻译：组件外（如 utils）可直接调用 */
export function translate(
  key: DictKey,
  params?: Record<string, string | number>
): string {
  let s: string = dicts[currentLang][key] ?? zh[key];
  if (params) {
    for (const [k, v] of Object.entries(params)) {
      s = s.split(`{${k}}`).join(String(v));
    }
  }
  return s;
}

interface LangContextValue {
  lang: LangCode;
  setLang: (lang: LangCode) => void;
}

const LangContext = createContext<LangContextValue>({
  lang: currentLang,
  setLang: () => {},
});

export function LangProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<LangCode>(currentLang);

  const setLang = useCallback((next: LangCode) => {
    currentLang = next;
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      /* 忽略持久化失败 */
    }
    setLangState(next);
  }, []);

  const value = useMemo(() => ({ lang, setLang }), [lang, setLang]);
  return <LangContext.Provider value={value}>{children}</LangContext.Provider>;
}

export function useLang() {
  return useContext(LangContext);
}

/** 组件内取翻译函数；语言切换时使用方自动重渲染 */
export function useT() {
  const { lang } = useContext(LangContext);
  return useCallback(
    (key: DictKey, params?: Record<string, string | number>) => {
      let s: string = dicts[lang][key] ?? zh[key];
      if (params) {
        for (const [k, v] of Object.entries(params)) {
          s = s.split(`{${k}}`).join(String(v));
        }
      }
      return s;
    },
    [lang]
  );
}
