<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

const { t } = useI18n()

const tools = computed(() => [
  {
    name: t('home.tools.spc.name'),
    desc: t('home.tools.spc.desc'),
    path: '/spc-converter',
  },
  {
    name: t('home.tools.fl.name'),
    desc: t('home.tools.fl.desc'),
    path: '/fl-image-processor',
  },
])
</script>

<template>
  <div class="page">
    <header class="page__header">
      <div>
        <p class="eyebrow">{{ t('home.eyebrow') }}</p>
        <h1>{{ t('home.title') }}</h1>
        <p class="lead">{{ t('home.lead') }}</p>
      </div>
    </header>

    <div class="tools-grid">
      <RouterLink v-for="tool in tools" :key="tool.path" :to="tool.path" class="tool-link">
        <var-card class="tool-card" :elevation="2" ripple>
          <div class="tool-card__body">
            <h2 class="tool-card__title">{{ tool.name }}</h2>
            <p class="tool-card__desc">{{ tool.desc }}</p>
          </div>
          <div class="tool-card__footer">
            <span>{{ t('home.open') }}</span>
            <var-icon name="chevron-right" size="18" />
          </div>
        </var-card>
      </RouterLink>
    </div>
  </div>
</template>

<style scoped>
.tools-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
  gap: 16px;
  margin-top: 10px;
}

.tool-link {
  color: inherit;
  text-decoration: none;
  display: block;
  height: 100%;
}

.tool-card {
  /* --card-background: var(--color-surface, #ffffff); */
  --card-border-radius: 16px;
  --card-padding: 18px 16px;
  /* --card-title-color: var(--color-text, #111827);
  --card-content-color: var(--color-on-surface-variant, #4b5563); */
  min-height: 220px;
  height: 100%;
  border-radius: 16px;
  /* transition: transform 0.16s ease, box-shadow 0.16s ease; */
}

.tool-card {
  transform: translateY(0) scale(1);
  box-shadow: (.1,.5,.1,1);
  transition: transform 180ms cubic-bezier(.2,.8,.2,1), box-shadow 180ms cubic-bezier(.2,.8,.2,1);
  will-change: transform, box-shadow;
}

.tool-card:hover {
  transform: translateY(-6px) scale(1.02);
  box-shadow: 0 10px 30px rgba(0,0,0,0.08), 0 2px 6px rgba(0,0,0,0.04);
}

.tool-card__body {
  display: flex;
  flex-direction: column;
  gap: 6px;
  flex: 1;
  color: var(--color-text, #111827);
}

.tool-card__title {
  margin: 0;
  font-size: 22px;
  letter-spacing: -0.01em;
}

.tool-card__desc {
  margin: 0;
  color: var(--color-on-surface-variant, #4b5563);
  line-height: 1.5;
}

.tool-card__footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-weight: 600;
  color: var(--color-primary, #2563eb);
  margin-top: 16px;
}

:deep(.var-card__container) {
  display: flex;
  flex-direction: column;
  height: 100%;
  gap: 8px;
}
</style>
