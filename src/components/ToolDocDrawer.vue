<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import MarkdownIt from 'markdown-it'
import { useI18n } from 'vue-i18n'

const props = defineProps<{
  toolKey: string
  toolTitle?: string
}>()

const { t, locale } = useI18n()

const show = ref(false)
const loading = ref(false)
const error = ref('')
const fallbackUsed = ref(false)
const html = ref('')

const md = new MarkdownIt({
  linkify: true,
  breaks: true,
  html: true,
})

const rawDocs = import.meta.glob('../docs/tools/**/usage.*.md', { as: 'raw' }) as Record<
  string,
  () => Promise<string>
>

const dialogTitle = computed(() => t('docs.dialogTitle', { tool: props.toolTitle || props.toolKey }))

const findDocPath = (lang: string) => {
  const suffix = `usage.${lang}.md`
  return Object.keys(rawDocs).find(
    (path) => path.includes(`/tools/${props.toolKey}/`) && path.toLowerCase().endsWith(suffix),
  )
}

const loadDoc = async () => {
  loading.value = true
  error.value = ''
  fallbackUsed.value = false

  const candidates = [locale.value?.toString() || 'en', 'en']
  for (const lang of candidates) {
    const path = findDocPath(lang)
    if (!path) continue
    try {
      const loader = rawDocs[path]
      const content = loader ? await loader() : ''
      html.value = md.render(content)
      fallbackUsed.value = lang !== locale.value
      loading.value = false
      return
    } catch (e: any) {
      error.value = e?.message || String(e)
    }
  }

  html.value = ''
  loading.value = false
  if (!error.value) {
    error.value = t('docs.missing')
  }
}

watch(show, (val) => {
  if (val) loadDoc()
})

watch(
  () => props.toolKey,
  () => {
    if (show.value) loadDoc()
  },
)

watch(locale, () => {
  if (show.value) loadDoc()
})

const open = () => {
  show.value = true
}

const close = () => {
  show.value = false
}

defineExpose({ open, close })
</script>

<template>
  <var-popup
    v-model:show="show"
    position="bottom"
    overlay
    teleport="body"
    :style="{ borderRadius: '18px 18px 0 0' }"
    :class="['tool-doc-drawer', { 'tool-doc-drawer--open': show }]"
  >
    <div class="drawer">
      <header class="drawer__header">
        <div>
          <p class="drawer__eyebrow">{{ t('docs.usageEntry') }}</p>
          <h3 class="drawer__title">{{ dialogTitle }}</h3>
        </div>
        <var-button text round @click="close" :aria-label="t('common.back')">
          <var-icon name="close" />
        </var-button>
      </header>
      <div class="drawer__body">
        <div v-if="loading" class="doc-state">
          <var-loading type="wave" size="small" />
          <span>{{ t('docs.loading') }}</span>
        </div>
        <div v-else-if="error" class="doc-state doc-state--error">
          <p>{{ error }}</p>
          <var-button size="small" type="primary" @click="loadDoc">{{ t('docs.retry') }}</var-button>
        </div>
        <div v-else class="doc-content">
          <p v-if="fallbackUsed" class="doc-hint">{{ t('docs.fallback') }}</p>
          <div class="markdown" v-html="html"></div>
        </div>
      </div>
    </div>
  </var-popup>
</template>

<style scoped>
.tool-doc-drawer {
  --drawer-max-width: min(960px, 96vw);
  border-radius: 18px;
}

.drawer {
  /* width: var(--drawer-max-width); */
  max-height: 78vh;
  /* background: var(--color-surface, #ffffff); */
  border-radius: 18px 18px 0 0;
  box-shadow: 0 -10px 32px color-mix(in srgb, currentColor 16%, transparent);
  padding: 18px 18px 12px;
  margin: 0 auto;
  display: flex;
  flex-direction: column;
}

.drawer__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 8px;
}

.drawer__eyebrow {
  margin: 0;
  font-size: 12px;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--color-on-surface-variant, #6b7280);
}

.drawer__title {
  margin: 2px 0 0;
  font-size: 18px;
}

.drawer__body {
  overflow: auto;
  padding: 6px 2px 10px;
}

.doc-state {
  display: inline-flex;
  align-items: center;
  gap: 10px;
  color: var(--color-on-surface-variant, #6b7280);
}

.doc-state--error {
  flex-direction: column;
  align-items: flex-start;
}

.doc-hint {
  margin: 0 0 8px;
  font-size: 12px;
  color: var(--color-on-surface-variant, #6b7280);
}

.markdown {
  font-size: 14px;
  line-height: 1.6;
  color: var(--color-text, #111827);
}

.markdown :global(h1),
.markdown :global(h2),
.markdown :global(h3) {
  margin: 14px 0 8px;
}

.markdown :global(p) {
  margin: 8px 0;
}

.markdown :global(code) {
  background: color-mix(in srgb, currentColor 10%, transparent);
  padding: 2px 6px;
  border-radius: 6px;
}

@media (max-width: 640px) {
  .drawer {
    width: 100%;
  }
}
</style>
