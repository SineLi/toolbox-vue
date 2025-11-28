<script setup lang="ts">
import { computed, onUnmounted, ref, watch } from 'vue'
import MatchAndCrop from '../components/fl-image-processor/MatchAndCrop.vue'
import ImageMerge from '../components/fl-image-processor/ImageMerge.vue'
import ImageRegression from '../components/fl-image-processor/ImageRegression.vue'

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
const activeStep = computed(() => (step.value >= 0 ? step.value : 0))
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

const md3Primary = 'var(--color-primary, #2563eb)'
</script>

<template>
  <div class="tool-page">
    <var-card class="steps-card" :elevation="1">
      <var-steps
        class="steps-bar"
        :active="activeStep"
        direction="horizontal"
        :active-color="md3Primary"
        inactive-color="color-mix(in srgb, currentColor 16%, transparent)"
      >
        <var-step v-for="item in steps" :key="item.key">
          <div class="step-meta">
            <div class="step-meta__title">Step {{ item.key + 1 }} · {{ item.title }}</div>
            <div class="step-meta__desc">{{ item.desc }}</div>
          </div>
        </var-step>
      </var-steps>
    </var-card>

    <div v-if="step === -1" class="welcome-grid">
      <var-card class="welcome-card" :elevation="1" ripple @click="jumpTo(0)">
        <div class="welcome-card__title-row">
          <div>
            <p class="welcome-card__eyebrow">Recommended</p>
            <div class="welcome-card__title">Start with match & crop</div>
          </div>
          <!-- <var-chip type="primary" size="small" class="welcome-card__chip">Step 1</var-chip> -->
        </div>
        <p class="welcome-card__desc">
          Upload a template, align and crop multiple images, then arrange them together for merging.
        </p>
        <div class="welcome-card__footer">
          <span>Open match & crop</span>
          <var-icon name="chevron-right" size="18" />
        </div>
      </var-card>
      <var-card class="welcome-card" :elevation="1" ripple @click="jumpTo(2)">
        <div class="welcome-card__title-row">
          <div>
            <p class="welcome-card__eyebrow">Have a merged image</p>
            <div class="welcome-card__title">Go straight to analysis</div>
          </div>
        </div>
        <p class="welcome-card__desc">
          Skip cropping and head directly to sampling and regression on your merged strip.
        </p>
        <div class="welcome-card__footer">
          <span>Open regression</span>
          <var-icon name="chevron-right" size="18" />
        </div>
      </var-card>
    </div>

    <section v-show="step === 0">
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

.steps-card {
  --card-border-radius: 20px;
  padding: 8px;
}

.steps-bar {
  padding: 8px;
  border-radius: 16px;
}

:deep(.var-step__horizontal) {
  gap: 6px;
}

:deep(.var-step__horizontal-tag) {
  box-shadow: 0 4px 10px color-mix(in srgb, currentColor 16%, transparent);
}

:deep(.var-step__horizontal-content) {
  text-align: center;
}

.step-meta {
  max-width: 200px;
  margin: 0 auto;
}

.step-meta__title {
  font-weight: 700;
  font-size: 14px;
}

.step-meta__desc {
  font-size: 12px;
  color: var(--color-on-surface-variant, #4b5563);
  line-height: 1.5;
}

.welcome-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
  gap: 16px;
}

.welcome-card {
  display: flex;
  flex-direction: column;
  gap: 10px;
  --card-border-radius: 20px;
  cursor: pointer;
}

.welcome-card__title-row {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 10px;
}

.welcome-card__eyebrow {
  margin: 0;
  font-size: 12px;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: var(--color-on-surface-variant, #4b5563);
}

.welcome-card__title {
  font-weight: 700;
  font-size: 18px;
}

.welcome-card__desc {
  margin: 0;
  color: var(--color-on-surface-variant, #4b5563);
  line-height: 1.5;
}

.welcome-card__chip {
  margin-top: 2px;
}

.welcome-card__footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-weight: 600;
  color: var(--color-primary, #2563eb);
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
