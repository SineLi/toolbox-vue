<script setup lang="ts">
import { computed, provide, ref, watch } from 'vue'
import { StyleProvider, Themes } from '@varlet/ui'
import { useDark, useToggle } from '@vueuse/core'
import { useRoute, useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { getSavedLocale, saveLocale, type LocaleType } from '../i18n'
import ToolDocDrawer from './ToolDocDrawer.vue'

const { t, locale } = useI18n()
const isDark = useDark()
const toggleDark = useToggle(isDark)
const currentTheme = ref<'light' | 'dark'>('light')
const currentLanguage = ref<LocaleType>((locale.value as LocaleType) || 'en')
const languageMenu = ref()
const route = useRoute()
const router = useRouter()
const docDrawer = ref<InstanceType<typeof ToolDocDrawer> | null>(null)

const showBack = computed(() => route.name !== 'home')
const appBarTitle = computed(() => {
  const name = route.name?.toString() ?? ''
  if (name === 'spc-converter') return t('nav.spc')
  if (name === 'fl-image-processor') return t('nav.fl')
  if (name === 'info-center') return t('nav.info')
  return t('nav.home')
})

const currentToolKey = computed(() => {
  const name = route.name?.toString() ?? ''
  if (name === 'spc-converter') return 'spc'
  if (name === 'fl-image-processor') return 'fl'
  return ''
})

const currentToolTitle = computed(() => {
  if (currentToolKey.value === 'spc') return t('nav.spc')
  if (currentToolKey.value === 'fl') return t('nav.fl')
  return ''
})

const openDocs = () => {
  if (!currentToolKey.value) return
  docDrawer.value?.open()
}

provide('openDocs', openDocs)

const goBack = () => {
  if (window.history.length > 1) {
    router.back()
  } else {
    router.push({ name: 'home' })
  }
}

const goInfo = () => {
  router.push({ name: 'info-center' })
}

const CAUTheme = {
  light: {
    '--hsl-primary': '145, 100%, 22%',
    '--color-primary': 'hsla(var(--hsl-primary), 1)',
    '--hsl-on-primary': '0, 0%, 100%',
    '--color-on-primary': 'hsla(var(--hsl-on-primary), 1)',
    '--hsl-primary-container': '130, 92%, 76%',
    '--color-primary-container': 'hsla(var(--hsl-primary-container), 1)',
    '--hsl-on-primary-container': '136, 100%, 6%',
    '--color-on-primary-container': 'hsla(var(--hsl-on-primary-container), 1)',
    '--hsl-info': '120, 10%, 35%',
    '--color-info': 'hsla(var(--hsl-info), 1)',
    '--hsl-on-info': '0, 0%, 100%',
    '--color-on-info': 'hsla(var(--hsl-on-info), 1)',
    '--hsl-info-container': '112, 33%, 86%',
    '--color-info-container': 'hsla(var(--hsl-info-container), 1)',
    '--hsl-on-info-container': '128, 35%, 9%',
    '--color-on-info-container': 'hsla(var(--hsl-on-info-container), 1)',
    '--hsl-warning': '189, 31%, 33%',
    '--color-warning': 'hsla(var(--hsl-warning), 1)',
    '--hsl-on-warning': '0, 0%, 100%',
    '--color-on-warning': 'hsla(var(--hsl-on-warning), 1)',
    '--hsl-warning-container': '190, 69%, 85%',
    '--color-warning-container': 'hsla(var(--hsl-warning-container), 1)',
    '--hsl-on-warning-container': '188, 100%, 7%',
    '--color-on-warning-container': 'hsla(var(--hsl-on-warning-container), 1)',
    '--hsl-danger': '0, 75%, 42%',
    '--color-danger': 'hsla(var(--hsl-danger), 1)',
    '--hsl-on-danger': '0, 0%, 100%',
    '--color-on-danger': 'hsla(var(--hsl-on-danger), 1)',
    '--hsl-danger-container': '6, 100%, 92%',
    '--color-danger-container': 'hsla(var(--hsl-danger-container), 1)',
    '--hsl-on-danger-container': '358, 100%, 13%',
    '--color-on-danger-container': 'hsla(var(--hsl-on-danger-container), 1)',
    '--hsl-body': '70, 60%, 98%',
    '--color-body': 'hsla(var(--hsl-body), 1)',
    '--hsl-text': '100, 6%, 10%',
    '--color-text': 'hsla(var(--hsl-text), 1)',
    '--hsl-on-surface-variant': '120, 6%, 27%',
    '--color-on-surface-variant': 'hsla(var(--hsl-on-surface-variant), 1)',
    '--hsl-outline': '107, 4%, 46%',
    '--color-outline': 'hsla(var(--hsl-outline), 1)',
    '--hsl-inverse-surface': '120, 3%, 19%',
    '--color-inverse-surface': 'hsla(var(--hsl-inverse-surface), 1)',
    '--fab-trigger-size': '48px'
  },
  dark: {
    ...Themes.dark,
    '--hsl-primary': '133, 34%, 49%',
    '--color-primary': 'hsla(var(--hsl-primary), 1)',
    '--hsl-on-primary': '142, 100%, 11%',
    '--color-on-primary': 'hsla(var(--hsl-on-primary), 1)',
    '--hsl-primary-container': '144, 100%, 16%',
    '--color-primary-container': 'hsla(var(--hsl-primary-container), 1)',
    '--hsl-on-primary-container': '130, 92%, 76%',
    '--color-on-primary-container': 'hsla(var(--hsl-on-primary-container), 1)',
    '--hsl-info': '115, 18%, 76%',
    '--color-info': 'hsla(var(--hsl-info), 1)',
    '--hsl-on-info': '127, 20%, 17%',
    '--color-on-info': 'hsla(var(--hsl-on-info), 1)',
    '--hsl-info-container': '123, 14%, 26%',
    '--color-info-container': 'hsla(var(--hsl-info-container), 1)',
    '--hsl-on-info-container': '112, 33%, 86%',
    '--color-on-info-container': 'hsla(var(--hsl-on-info-container), 1)',
    '--hsl-warning': '190, 40%, 74%',
    '--color-warning': 'hsla(var(--hsl-warning), 1)',
    '--hsl-on-warning': '187, 100%, 12%',
    '--color-on-warning': 'hsla(var(--hsl-on-warning), 1)',
    '--hsl-warning-container': '188, 46%, 23%',
    '--color-warning-container': 'hsla(var(--hsl-warning-container), 1)',
    '--hsl-on-warning-container': '190, 69%, 85%',
    '--color-on-warning-container': 'hsla(var(--hsl-on-warning-container), 1)',
    '--hsl-danger': '6, 100%, 84%',
    '--color-danger': 'hsla(var(--hsl-danger), 1)',
    '--hsl-on-danger': '357, 100%, 21%',
    '--color-on-danger': 'hsla(var(--hsl-on-danger), 1)',
    '--hsl-danger-container': '356, 100%, 29%',
    '--color-danger-container': 'hsla(var(--hsl-danger-container), 1)',
    '--hsl-on-danger-container': '6, 100%, 84%',
    '--color-on-danger-container': 'hsla(var(--hsl-on-danger-container), 1)',
    '--hsl-body': '100, 6%, 10%',
    '--color-body': 'hsla(var(--hsl-body), 1)',
    '--hsl-text': '70, 10%, 88%',
    '--color-text': 'hsla(var(--hsl-text), 1)',
    '--hsl-on-surface-variant': '104, 9%, 77%',
    '--color-on-surface-variant': 'hsla(var(--hsl-on-surface-variant), 1)',
    '--hsl-outline': '108, 4%, 56%',
    '--color-outline': 'hsla(var(--hsl-outline), 1)',
    '--hsl-inverse-surface': '70, 10%, 88%',
    '--color-inverse-surface': 'hsla(var(--hsl-inverse-surface), 1)',
    '--fab-trigger-size': '48px'
  },
}

const getCookie = (name: string): string | null => {
  const target = document.cookie.split('; ').find((part) => part.startsWith(`${name}=`))
  if (!target) return null
  const value = target.split('=')[1] ?? ''
  return decodeURIComponent(value)
}

const setCookie = (name: string, value: string) => {
  document.cookie = `${name}=${encodeURIComponent(value)}; path=/; max-age=31536000`
}

const applyTheme = (theme: 'light' | 'dark') => {
  StyleProvider(CAUTheme[theme])
  document.documentElement.style.colorScheme = theme
  currentTheme.value = theme
  toggleDark(theme === 'dark')
}

const initThemeAndLanguage = () => {
  const theme = getCookie('theme')
  const language = getSavedLocale()

  if (theme === 'dark') {
    applyTheme('dark')
  } else {
    applyTheme('light')
  }

  const resolvedLang = language ?? (locale.value as LocaleType)
  currentLanguage.value = resolvedLang
  locale.value = resolvedLang
  saveLocale(resolvedLang)
  document.documentElement.setAttribute('lang', resolvedLang)
}

initThemeAndLanguage()

const toggleTheme = () => {
  applyTheme(currentTheme.value === 'light' ? 'dark' : 'light')
}

const languages = computed(() => [
  { label: t('language.zh'), value: 'zh' as LocaleType },
  { label: t('language.en'), value: 'en' as LocaleType },
])

const switchLanguage = (lang: LocaleType) => {
  currentLanguage.value = lang
  locale.value = lang
  saveLocale(lang)
  document.documentElement.setAttribute('lang', lang)
  languageMenu.value?.close()
}

watch(currentTheme, (newTheme) => {
  setCookie('theme', newTheme)
})

watch(currentLanguage, (newLanguage) => {
  locale.value = newLanguage
  saveLocale(newLanguage)
  document.documentElement.setAttribute('lang', newLanguage)
})
</script>

<template>
  <div class="app-shell">
    <var-app-bar class="app-bar" :title="appBarTitle">
      <template #left>
        <div class="app-bar-left">
          <var-button v-if="showBack" text round @click="goBack" :aria-label="t('common.back')">
            <var-icon name="chevron-left" />
          </var-button>
          <div v-else class="back-placeholder" aria-hidden="true"></div>
        </div>
      </template>
      <template #right>
        <var-button text round @click="toggleTheme">
          <var-icon :name="currentTheme === 'dark' ? 'white-balance-sunny' : 'weather-night'" />
        </var-button>
        <var-menu ref="languageMenu" placement="bottom-end">
          <var-button text round>
            <var-icon name="translate" />
          </var-button>
          <template #menu>
            <var-cell v-for="lang in languages" :key="lang.value" @click="switchLanguage(lang.value)">
              {{ lang.label }}
            </var-cell>
          </template>
        </var-menu>
        <var-button text round @click="goInfo">
          <var-icon name="information-outline" />
        </var-button>
      </template>
    </var-app-bar>

    <main class="app-body">
      <div class="app-content">
        <slot />
      </div>
    </main>
    <ToolDocDrawer
      v-if="currentToolKey"
      ref="docDrawer"
      :tool-key="currentToolKey"
      :tool-title="currentToolTitle"
    />
  </div>
</template>

<style scoped>
:global(:root) {
  --app-bar-height: 64px;
  --app-bar-z-index: 1300;
}

.app-shell {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  background: var(--color-body, #f7f8fb);
  position: relative;
}

.app-bar {
  height: var(--app-bar-height);
  display: flex;
  align-items: center;
  background: var(--color-primary-container, var(--color-primary, #2563eb));
  color: var(--color-on-primary-container, var(--color-on-primary, #ffffff));
  box-shadow: 0 8px 24px color-mix(in srgb, var(--color-primary, #2563eb) 16%, transparent);
  border-bottom: 1px solid color-mix(in srgb, currentColor 14%, transparent);
  backdrop-filter: blur(12px);
}

:global(.var-app-bar.app-bar) {
  position: fixed !important;
  top: 0;
  left: 0;
  right: 0;
  z-index: var(--app-bar-z-index) !important;
}

:global(.var-app-bar__content) {
  z-index: inherit;
}

.app-bar-left {
  display: flex;
  align-items: center;
  min-width: 48px;
  justify-content: center;
}

.back-placeholder {
  width: 44px;
  height: 44px;
}

.app-body {
  flex: 1;
  padding-top: var(--app-bar-height);
  position: relative;
}

.app-content {
  max-width: 1200px;
  margin: 0 auto;
  padding: 48px 24px;
  position: relative;
}
</style>
