import { createI18n } from 'vue-i18n'
import en from './locales/en'
import zh from './locales/zh'

export type LocaleType = 'en' | 'zh'

export const LANGUAGE_COOKIE = 'language'

const getCookie = (name: string): string | null => {
  if (typeof document === 'undefined') return null
  const target = document.cookie.split('; ').find((part) => part.startsWith(`${name}=`))
  if (!target) return null
  const value = target.split('=').slice(1).join('=')
  return decodeURIComponent(value ?? '')
}

const setCookie = (name: string, value: string) => {
  if (typeof document === 'undefined') return
  document.cookie = `${name}=${encodeURIComponent(value)}; path=/; max-age=31536000`
}

export const getSavedLocale = (): LocaleType | null => {
  const saved = getCookie(LANGUAGE_COOKIE)
  if (saved === 'en' || saved === 'zh') return saved
  return null
}

export const saveLocale = (locale: LocaleType) => {
  setCookie(LANGUAGE_COOKIE, locale)
}

const browserLocale: LocaleType =
  typeof navigator !== 'undefined' && navigator.language?.toLowerCase().startsWith('zh') ? 'zh' : 'en'

const initialLocale = getSavedLocale() ?? browserLocale

const i18n = createI18n({
  legacy: false,
  locale: initialLocale,
  fallbackLocale: 'en',
  messages: {
    en,
    zh,
  },
})

export default i18n
