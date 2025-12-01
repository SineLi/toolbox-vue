<template>
  <div class="info-center">
    <var-card class="content-card" :title="currentFile?.displayName || t('info.noSelection')">
      <template #extra>
        <var-chip type="primary" size="small" v-if="currentFile">{{ currentFile.shortPath }}</var-chip>
      </template>
      <div v-if="files.length === 0" class="empty">{{ t('info.empty') }}</div>
      <div v-else-if="currentHtml" class="markdown" v-html="currentHtml"></div>
      <div v-else class="empty">{{ t('info.noContent') }}</div>
    </var-card>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import MarkdownIt from 'markdown-it'
import { useI18n } from 'vue-i18n'

const { t } = useI18n()

const md = new MarkdownIt({
  linkify: true,
  breaks: true,
})

const rawModules = import.meta.glob('../logs/**/*.md', { as: 'raw', eager: true }) as Record<string, string>

type FileEntry = {
  id: string
  path: string
  shortPath: string
  displayName: string
  content: string
}

const files = Object.entries(rawModules).map<FileEntry>(([path, content]) => {
  const parts = path.split('/')
  const filename = parts[parts.length - 1] || 'untitled.md'
  const displayName = filename.replace(/\.md$/i, '')
  const shortPath = path.replace(/^..\/logs\//, 'logs/')
  return {
    id: path,
    path,
    shortPath,
    displayName,
    content,
  }
})

const selectedId = ref<string>(files[0]?.id || '')

const currentFile = computed(() => files.find((f) => f.id === selectedId.value))
const currentHtml = computed(() => (currentFile.value ? md.render(currentFile.value.content) : ''))

// If no selection but files exist, pick the first
if (!selectedId.value && files.length > 0) {
  selectedId.value = files[0].id
}
</script>

<style scoped>
.info-center {
  display: block;
}

.content-card {
  --card-border-radius: 18px;
}

.markdown {
  padding: 8px 2px;
}

.markdown :global(h1),
.markdown :global(h2),
.markdown :global(h3) {
  margin: 12px 0 6px;
}

.markdown :global(p) {
  margin: 8px 0;
}

.markdown :global(pre) {
  background: color-mix(in srgb, currentColor 10%, transparent);
  padding: 10px;
  border-radius: 8px;
  overflow: auto;
}

.markdown :global(code) {
  font-family: ui-monospace, SFMono-Regular, SFMono, Consolas, 'Liberation Mono', Menlo, monospace;
}

.empty {
  padding: 12px;
  color: var(--color-on-surface-variant, #6b7280);
}
</style>
