<script setup lang="ts">
import { computed, onUnmounted, ref, watch } from 'vue'
import MatchAndCrop from '../components/fl-image-processor/MatchAndCrop.vue'
import ImageMerge from '../components/fl-image-processor/ImageMerge.vue'
import ImageRegression from '../components/fl-image-processor/ImageRegression.vue'
import mergeIllustration from '../assets/fl-image-processor/merge.png'
import analyzeIllustration from '../assets/fl-image-processor/analyze.png'

interface ProcessedImage {
  url: string
  fileName: string
  text?: string
}

const steps = [
  { key: 0, title: 'Match & crop', desc: 'Use a template image to batch match and crop incoming files.' },
  { key: 1, title: 'Order & label', desc: 'Reorder cropped images, add captions, and generate a combined strip.' },
  { key: 2, title: 'Analyze colors', desc: 'Sample points and run quick regression on the merged image.' },
]

const step = ref(-1)
const processedImages = ref<ProcessedImage[]>([])
const fullRes = ref('')
const nextDisable = ref(false)
const maxStep = steps.length - 1
const stepHistory = ref<number[]>([])
const isNavigatingBack = ref(false)

const hasCroppedImages = computed(() => processedImages.value.length > 0)
const canGoNext = computed(() => {
  if (step.value === -1) return false
  if (step.value === 0) return hasCroppedImages.value && !nextDisable.value
  if (step.value === 1) return Boolean(fullRes.value)
  return true
})
const hasBackHistory = computed(() => stepHistory.value.length > 0)

watch(
  step,
  (newVal, oldVal) => {
    if (isNavigatingBack.value) {
      isNavigatingBack.value = false
      return
    }
    if (oldVal !== undefined && oldVal !== newVal) {
      stepHistory.value.push(oldVal)
    }
  },
  { flush: 'sync' },
)

const handleProcessingStart = () => {
  nextDisable.value = true
}

const handleProcessingFinished = (imageTasks: any[]) => {
  nextDisable.value = false
  processedImages.value = imageTasks
    .filter((task) => task.processedDataUrl)
    .map((task) => ({
      url: task.processedDataUrl as string,
      fileName: task.file.name as string,
      text: '',
    }))
  if (processedImages.value.length && step.value < 1) {
    step.value = 1
  }
}

const handleUpdateCanvases = (canvases: { fullRes: string }) => {
  if (fullRes.value && fullRes.value.startsWith('blob:')) {
    URL.revokeObjectURL(fullRes.value)
  }
  fullRes.value = canvases.fullRes
}

const prevStep = () => {
  if (step.value > 0) {
    step.value -= 1
  }
}

const nextStep = () => {
  if (step.value < maxStep && canGoNext.value) {
    step.value += 1
  }
}

const jumpTo = (target: number) => {
  step.value = target
}

const goBackStep = () => {
  const prev = stepHistory.value.pop()
  if (prev === undefined) {
    step.value = -1
    return
  }
  isNavigatingBack.value = true
  step.value = prev
}

onUnmounted(() => {
  if (fullRes.value && fullRes.value.startsWith('blob:')) {
    URL.revokeObjectURL(fullRes.value)
  }
  processedImages.value.forEach((img) => {
    if (img.url && img.url.startsWith('blob:')) {
      URL.revokeObjectURL(img.url)
    }
  })
})
</script>

<template>
  <div class="tool-page">
    <header class="page__header">
      <div>
        <p class="eyebrow">Image toolkit</p>
        <h1>FL Image Processor</h1>
        <p class="lead">
          Batch match and crop against a template, merge the results into one strip, then sample colors for quick
          regression.
        </p>
      </div>
    </header>

    <div class="steps-grid">
      <div
        v-for="item in steps"
        :key="item.key"
        class="step-chip surface-card"
        :class="{ 'step-chip--active': item.key === step }"
      >
        <div class="step-chip__index">{{ item.key + 1 }}</div>
        <div>
          <div class="step-chip__title">{{ item.title }}</div>
          <div class="step-chip__desc">{{ item.desc }}</div>
        </div>
      </div>
    </div>

    <div v-if="step === -1" class="welcome-grid">
      <var-card class="welcome-card" title="Start from template" @click="jumpTo(0)">
        <img :src="mergeIllustration" alt="Merge illustration" />
        <p>Upload a template, align and crop multiple images, then arrange them together.</p>
      </var-card>
      <var-card class="welcome-card" title="Jump to analysis" @click="jumpTo(2)">
        <img :src="analyzeIllustration" alt="Analysis illustration" />
        <p>Already have a merged image? Skip straight to sampling and regression.</p>
      </var-card>
    </div>

    <section v-show="step === 0" class="panel">
      <MatchAndCrop @processingStart="handleProcessingStart" @processingFinished="handleProcessingFinished" />
    </section>

    <section v-show="step === 1" class="panel">
      <ImageMerge :images="processedImages" @updateCanvases="handleUpdateCanvases" />
    </section>

    <section v-show="step === 2" class="panel">
      <ImageRegression :fullRes="fullRes" />
    </section>

    <div class="nav-bar" v-if="step >= 0">
      <var-button type="warning" text @click="goBackStep" :disabled="!hasBackHistory">Back</var-button>
      <div class="nav-actions">
        <var-button @click="prevStep" :disabled="step === 0">Previous</var-button>
        <var-button type="primary" @click="nextStep" :disabled="!canGoNext || step === maxStep">Next</var-button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.tool-page {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.steps-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
  gap: 12px;
}

.step-chip {
  padding: 14px;
  display: flex;
  gap: 10px;
  align-items: center;
  border-radius: 14px;
  border: 1px solid color-mix(in srgb, currentColor 8%, transparent);
  background: var(--color-surface, #fff);
}

.step-chip--active {
  border-color: var(--color-primary, #2563eb);
  box-shadow: 0 10px 24px color-mix(in srgb, var(--color-primary, #2563eb) 12%, transparent);
}

.step-chip__index {
  width: 32px;
  height: 32px;
  border-radius: 12px;
  display: grid;
  place-items: center;
  font-weight: 700;
  background: var(--color-primary-container, color-mix(in srgb, currentColor 16%, transparent));
}

.step-chip__title {
  font-weight: 700;
}

.step-chip__desc {
  font-size: 13px;
  color: #4b5563;
}

.welcome-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
  gap: 16px;
}

.welcome-card {
  min-height: 320px;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.welcome-card img {
  width: 100%;
  object-fit: cover;
  border-radius: 8px;
}

.panel {
  background: var(--color-surface, #fff);
  border-radius: 18px;
  padding: 12px;
  box-shadow: 0 14px 32px color-mix(in srgb, currentColor 10%, transparent);
}

.nav-bar {
  position: sticky;
  bottom: 12px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 10px;
  padding: 10px 0;
}

.nav-actions {
  display: flex;
  gap: 10px;
}
</style>
