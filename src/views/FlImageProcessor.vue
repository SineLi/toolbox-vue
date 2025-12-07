<script setup lang="ts">
import { computed, nextTick, onUnmounted, ref, watch ,inject} from 'vue'
import { useI18n } from 'vue-i18n'
import MatchAndCrop from '../components/fl-image-processor/MatchAndCrop.vue'
import ImageMerge from '../components/fl-image-processor/ImageMerge.vue'
import ImageRegression from '../components/fl-image-processor/ImageRegression.vue'

interface ProcessedImage {
  url: string
  fileName: string
  text?: string
}

const { t } = useI18n()

const steps = computed(() => [
  { key: 0, title: t('flPage.steps.match.title'), desc: t('flPage.steps.match.desc') },
  { key: 1, title: t('flPage.steps.order.title'), desc: t('flPage.steps.order.desc') },
  { key: 2, title: t('flPage.steps.analyze.title'), desc: t('flPage.steps.analyze.desc') },
])

const step = ref(-1)
const activeStep = computed(() => (step.value >= 0 ? step.value : 0))
const processedImages = ref<ProcessedImage[]>([])
const fullRes = ref('')
const nextDisable = ref(false)
const maxStep = computed(() => steps.value.length - 1)
const stepHistory = ref<number[]>([])
const isNavigatingBack = ref(false)
const imageMergeRef = ref<InstanceType<typeof ImageMerge> | null>(null)

const hasCroppedImages = computed(() => processedImages.value.length > 0)
const canGoNext = computed(() => {
  if (step.value === -1) return false
  if (step.value === 0) return hasCroppedImages.value && !nextDisable.value
  if (step.value === 1) return Boolean(fullRes.value)
  return true
})
const hasBackHistory = computed(() => stepHistory.value.length > 0)

const updateProcessedImages = (imageTasks: any[]) => {
  const existingTexts = new Map(processedImages.value.map((img) => [img.url, img.text || '']))
  processedImages.value = imageTasks
    .filter((task) => task.processedDataUrl)
    .map((task) => ({
      url: task.processedDataUrl as string,
      fileName: task.file.name as string,
      text: existingTexts.get(task.processedDataUrl as string) || '',
    }))
  if (!processedImages.value.length && fullRes.value) {
    if (fullRes.value.startsWith('blob:')) {
      URL.revokeObjectURL(fullRes.value)
    }
    fullRes.value = ''
  }
}
  const openDocs = inject<() => void>('openDocs')

  const fabClick = () => {
    if (openDocs) openDocs()
  }

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

const handleProcessingFinished = async (imageTasks: any[]) => {
  nextDisable.value = false
  updateProcessedImages(imageTasks)
  if (processedImages.value.length && step.value < 1) {
    step.value = 1
  }
  await nextTick()
  imageMergeRef.value?.drawCompositeImage?.()
}

const handleTasksUpdated = async (imageTasks: any[]) => {
  updateProcessedImages(imageTasks)
  await nextTick()
  imageMergeRef.value?.drawCompositeImage?.()
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
  if (step.value < maxStep.value && canGoNext.value) {
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
    <var-card class="steps-card">
      <var-steps
        class="steps-bar"
        :active="activeStep"
        direction="horizontal"
        :active-color="md3Primary"
        inactive-color="color-mix(in srgb, currentColor 16%, transparent)"
      >
        <var-step v-for="item in steps" :key="item.key">
          <div class="step-meta">
            <var-tooltip :content="item.desc">
              <div class="step-meta__title">
                {{ t('flPage.stepLabel', { num: item.key + 1, title: item.title }) }}
              </div>
            </var-tooltip>

          </div>
        </var-step>
      </var-steps>
    </var-card>

    <div v-if="step === -1" class="welcome-grid">
      <var-card class="welcome-card" :elevation="1" ripple @click="jumpTo(0)">
        <!-- <div class="welcome-card__title-row"> -->
          <div>
            <p class="welcome-card__eyebrow">{{ t('flPage.welcome.recommended') }}</p>
            <div class="welcome-card__title">{{ t('flPage.welcome.startMatch') }}</div>
          </div>
          <!-- <var-chip type="primary" size="small" class="welcome-card__chip">Step 1</var-chip> -->
        <!-- </div> -->
        <p class="welcome-card__desc">
          {{ t('flPage.welcome.startDesc') }}
        </p>
        <div class="welcome-card__footer">
          <span>{{ t('flPage.welcome.openMatch') }}</span>
          <var-icon name="chevron-right" size="18" />
        </div>
      </var-card>
      <var-card class="welcome-card" :elevation="1" ripple @click="jumpTo(2)">
        <!-- <div class="welcome-card__title-row"> -->
          <div>
            <p class="welcome-card__eyebrow">{{ t('flPage.welcome.haveMerged') }}</p>
            <div class="welcome-card__title">{{ t('flPage.welcome.goAnalyze') }}</div>
          </div>
        <!-- </div> -->
        <p class="welcome-card__desc">
          {{ t('flPage.welcome.skipDesc') }}
        </p>
        <div class="welcome-card__footer">
          <span>{{ t('flPage.welcome.openRegression') }}</span>
          <var-icon name="chevron-right" size="18" />
        </div>
      </var-card>
    </div>

    <section v-show="step === 0">
      <MatchAndCrop
        @processingStart="handleProcessingStart"
        @processingFinished="handleProcessingFinished"
        @tasksUpdated="handleTasksUpdated"
      />
    </section>

    <section v-show="step === 1" class="panel">
      <ImageMerge ref="imageMergeRef" :images="processedImages" @updateCanvases="handleUpdateCanvases" />
    </section>

    <section v-if="step === 2" class="panel">
      <ImageRegression :fullRes="fullRes" />
    </section>

    <div class="nav-bar" v-if="step >= 0">
      <var-button type="warning" text @click="goBackStep" :disabled="!hasBackHistory">
        {{ t('flPage.nav.back') }}
      </var-button>
      <div class="nav-actions">
        <var-button @click="prevStep" :disabled="step === 0">
          {{ t('flPage.nav.previous') }}
        </var-button>
        <var-button type="primary" @click="nextStep" :disabled="!canGoNext || step === maxStep">
          {{ t('flPage.nav.next') }}
        </var-button>
      </div>
    </div>
  <var-fab type="default" :drag="true" inactive-icon="help-circle-outline" @click="fabClick" />
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
  padding: 4px;
  background: var(--card-background)
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
  --card-border-radius: 20px;
  cursor: pointer;
}

.welcome-card {
  transform: translateY(0) scale(1);
  transition: transform 180ms cubic-bezier(.2, .8, .2, 1), box-shadow 180ms cubic-bezier(.2, .8, .2, 1);
  will-change: transform, box-shadow;
}

.welcome-card:hover {
  transform: translateY(-6px) scale(1.02);
  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.08), 0 2px 6px rgba(0, 0, 0, 0.04);
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
