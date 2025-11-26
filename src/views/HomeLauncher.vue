<script setup lang="ts">
const tools = [
  {
    name: 'SPC File Converter',
    desc: 'Convert .spd spectral data to CSV with multi-file selection and batch downloads.',
    path: '/spc-converter',
  },
  {
    name: 'FL Image Processor',
    desc: 'Template match and crop images, merge them, and run quick color regression.',
    path: '/fl-image-processor',
  },
]
</script>

<template>
  <div class="page">
    <header class="page__header">
      <div>
        <p class="eyebrow">Tools</p>
        <h1>Choose a utility</h1>
        <p class="lead">Click a card to open a focused tool in this workspace.</p>
      </div>
    </header>

    <div class="tools-grid">
      <RouterLink v-for="tool in tools" :key="tool.path" :to="tool.path" class="tool-card surface-card">
        <div class="tool-card__body">
          <h2>{{ tool.name }}</h2>
          <p>{{ tool.desc }}</p>
        </div>
        <div class="tool-card__footer">
          <span>Open</span>
          <span aria-hidden="true">→</span>
        </div>
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

.tool-card {
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  aspect-ratio: 1/1;
  padding: 18px 16px;
  color: inherit;
  text-decoration: none;
}

.tool-card__body h2 {
  margin: 0;
  font-size: 24px;
}

.tool-card__body p {
  margin: 4px 0 0;
}

.tool-card__footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-weight: 600;
  color: var(--color-primary, #2563eb);
}
</style>