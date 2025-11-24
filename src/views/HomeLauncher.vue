<script setup lang="ts">
const tools = [
  {
    name: 'SPC File Converter',
    desc: '将 .spd 光谱数据转换为 CSV，支持多文件选择、批量打包下载。',
    path: '/spc-converter',
  },
]
</script>

<template>
  <div class="page">
    <header class="page__header">
      <div>
        <p class="eyebrow">工具箱</p>
        <h1>选择一个工具开始</h1>
        <p class="lead">常用小工具集合，点击卡片进入对应页面。</p>
      </div>
    </header>

    <div class="tools-grid">
      <RouterLink v-for="tool in tools" :key="tool.path" :to="tool.path" class="tool-card surface-card">
        <div class="tool-card__body">
          <h2>{{ tool.name }}</h2>
          <p>{{ tool.desc }}</p>
        </div>
        <div class="tool-card__footer">
          <span>进入</span>
          <span aria-hidden="true">→</span>
        </div>
      </RouterLink>
    </div>
  </div>
</template>

<style scoped>
.tools-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
  gap: 16px;
  margin-top: 10px;
}

.tool-card {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 18px 16px;
  color: inherit;
  text-decoration: none;
}

.tool-card__body h2 {
  margin: 0;
  font-size: 18px;
}

.tool-card__body p {
  margin: 4px 0 0;
  color: #4b5563;
}

.tool-card__footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-weight: 600;
  color: #2563eb;
}
</style>
