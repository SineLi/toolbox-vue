<template>
  <div class="image-regression">
    <var-card class="controls-card" :title="t('imageRegression.samplingTitle')">
      <template v-if="(props.fullRes && props.fullRes !== 'data:,') || uploadedImg">
        <var-cell :title="t('imageRegression.arrayMode.toggle')" border>
          <template #extra>
            <var-switch v-model="arrayMode" />
          </template>
        </var-cell>
        <div class="control-row" v-if="!arrayMode">
          <div class="control-item" style="gap: 16px;">
            <span class="label">{{ t('imageRegression.sampleSize') }}</span>
            <var-slider
              v-model="sampleSize"
              :min="1"
              :max="50"
              track-color="#e5e7eb"
              @change="handleSampleSizeChange"
              @input="handleSampleSizeChange"
            />
          </div>
          <div class="control-item">
            <span class="label">{{ t('imageRegression.randomSeed') }}</span>
            <var-input v-model="randomSeed" type="text" :placeholder="t('imageRegression.seedPlaceholder')" />
          </div>
        </div>
      </template>
      <template v-else>
        <var-button type="primary" @click="uploadImage">{{ t('imageRegression.uploadImage') }}</var-button>
        <input ref="fileInput" type="file" @change="handleUpload" accept="image/*" style="display:none" />
      </template>
    </var-card>

    <var-card v-if="arrayMode && ((props.fullRes && props.fullRes !== 'data:,') || uploadedImg)" class="controls-card" :title="t('imageRegression.arrayMode.batchList')">
      <div class="batch-actions">
        <var-button type="primary" size="small" @click="addBatch">{{ t('imageRegression.arrayMode.addBatch') }}</var-button>
        <var-tooltip :content="t('imageRegression.arrayMode.runAllTooltip')">
          <var-button type="success" size="small" @click="runAllBatches">{{ t('imageRegression.arrayMode.runAll') }}</var-button>
        </var-tooltip>
      </div>
      <div v-for="batch in batches" :key="batch.id" class="batch-item" :class="{ active: activeBatchId === batch.id }" @click="selectBatch(batch.id)">
        <div class="batch-header">
          <div class="batch-color-dot" :style="{ background: batch.color }"></div>
          <var-input v-model="batch.label" size="small" :placeholder="t('imageRegression.arrayMode.batchNamePlaceholder')" class="batch-name-input" />
          <var-button type="danger" size="mini" @click.stop="removeBatch(batch.id)">{{ t('imageRegression.arrayMode.removeBatch') }}</var-button>
        </div>
        <div class="batch-config">
          <div class="batch-config-row">
            <var-input v-model="batch.formula" size="small" :placeholder="t('imageRegression.arrayMode.batchFormulaPlaceholder')" class="batch-formula-input" />
            <div class="batch-field">
              <span class="label-sm">{{ t('imageRegression.arrayMode.sampleSize') }}</span>
              <var-input v-model.number="batch.sampleSize" type="number" size="small" />
            </div>
            <div class="batch-field">
              <span class="label-sm">{{ t('imageRegression.arrayMode.randomSeed') }}</span>
              <var-input v-model="batch.randomSeed" size="small" :placeholder="t('imageRegression.arrayMode.seedPlaceholder')" />
            </div>
          </div>
        </div>
      </div>
      <div v-if="batches.length === 0" class="batch-empty">{{ t('imageRegression.arrayMode.addBatch') }}</div>
    </var-card>

    <div class="canvas-container" :class="{ 'canvas-zoomed': arrayMode && canvasZoom !== 1 }">
      <div v-if="isLoading" class="loading-mask">
        <var-loading type="wave" />
      </div>
      <div v-if="arrayMode" class="zoom-controls">
        <var-button size="small" text @click="zoomOut" :disabled="canvasZoom <= 0.25">
          <var-icon name="minus" :size="14" />
        </var-button>
        <span class="zoom-label">{{ Math.round(canvasZoom * 100) }}%</span>
        <var-button size="small" text @click="zoomIn" :disabled="canvasZoom >= 5">
          <var-icon name="plus" :size="14" />
        </var-button>
        <div class="zoom-divider"></div>
        <var-button size="small" text @click="zoomReset">
          <var-icon name="aspect-ratio" :size="14" />
        </var-button>
      </div>
      <canvas
        ref="visibleCanvas"
        :style="arrayMode ? { width: visibleCanvas ? visibleCanvas.width * canvasZoom + 'px' : 'auto', height: visibleCanvas ? visibleCanvas.height * canvasZoom + 'px' : 'auto' } : {}"
        @mousemove="handleMouseMove"
        @mouseleave="handleMouseLeave"
        @click="handleCanvasClick"
      ></canvas>
    </div>

    <var-card v-if="!arrayMode" class="controls-card" :title="t('imageRegression.sampleListTitle')">
      <var-list>
        <var-cell
          v-for="square in squares"
          :key="square.id"
          border
          :title="t('imageRegression.sampleLabel', { id: square.id })"
        >
          <div class="sample-row">
            <var-input
              v-model="square.num"
              type="number"
              :placeholder="t('imageRegression.numberPlaceholder')"
              @keyup.enter="focusNextSample(square.id)"
              :ref="(el: any) => setSampleInputRef(el, square.id)"
            />
            <div class="sample-result">{{ square.result?.toFixed(4) || '-' }}</div>
            <var-button type="danger" size="small" @click="removeSquare(square.id)">
              {{ t('imageRegression.remove') }}
            </var-button>
          </div>
        </var-cell>
      </var-list>
    </var-card>

    <var-card v-if="arrayMode && hasArraySamples" class="controls-card" :title="t('imageRegression.arrayMode.resultsTitle')">
      <div class="batch-fill-toggle">
        <span class="label-sm">{{ t('imageRegression.arrayMode.batchFill') }}</span>
        <var-switch v-model="batchFillMode" />
      </div>
      <div v-for="batch in batches" :key="batch.id" class="batch-results-group">
        <div class="batch-results-header">
          <div class="batch-color-dot" :style="{ background: batch.color }"></div>
          <span>{{ batch.label }}</span>
          <span class="batch-formula-tag">{{ batch.formula }}</span>
        </div>
        <var-list v-if="batch.squares.length > 0">
          <var-cell
            v-for="square in batch.squares"
            :key="square.id"
            border
            :title="t('imageRegression.sampleLabel', { id: square.id })"
          >
            <div class="sample-row">
              <var-input
                v-model="square.num"
                type="number"
                :placeholder="t('imageRegression.numberPlaceholder')"
                @keyup.enter="focusNextSample(square.id)"
                :ref="(el: any) => setSampleInputRef(el, square.id)"
              />
              <div class="sample-result">{{ square.result?.toFixed(4) || '-' }}</div>
              <var-button type="danger" size="small" @click="removeSquareFromBatch(batch.id, square.id)">
                {{ t('imageRegression.remove') }}
              </var-button>
            </div>
          </var-cell>
        </var-list>
      </div>
    </var-card>

    <var-card v-if="!arrayMode" class="controls-card regression-card" :title="t('imageRegression.regressionTitle')">
      <div class="control-row regression-row" v-if="(props.fullRes && props.fullRes !== 'data:,') || uploadedImg">
        <var-input
          v-model="formula"
          :placeholder="t('imageRegression.formulaPlaceholder')"
          :rules="formulaRules"
          ref="formulaInputRef"
          class="formula-input"
          @change="isFormulaValid"
        />
        <var-select v-model="plotType" :options="plotOptions" :placeholder="t('imageRegression.chartType')" />
        <var-select
          v-model="weightMethod"
          :options="weightOptions"
          :placeholder="t('imageRegression.weighting')"
          :disabled="plotType === 'bar'"
        />
        <div class="regression-actions">
          <var-button type="primary" @click="calculateFormula">{{ t('imageRegression.calculate') }}</var-button>
          <var-button type="success" @click="downloadSamples">{{ t('imageRegression.download') }}</var-button>
        </div>
      </div>
    </var-card>

    <var-card v-if="arrayMode" class="controls-card" :title="t('imageRegression.arrayMode.mlAnalysis')">
      <div class="ml-config-row">
        <var-select v-model="mlConfig.dimReduction" :options="dimReductionOptions" :placeholder="t('imageRegression.arrayMode.dimReduction')" />
        <var-button type="primary" :loading="isMLRunning" :disabled="!hasArrayResults" @click="runMLAnalysis">
          {{ t('imageRegression.arrayMode.runAnalysis') }}
        </var-button>
        <var-button v-if="mlResult" type="success" @click="downloadMLResult">
          {{ t('imageRegression.arrayMode.downloadML') }}
        </var-button>
      </div>
    </var-card>

    <var-card class="controls-card" :title="t('imageRegression.chartTitle')">
      <div ref="chartRef" class="chart"></div>
    </var-card>
  </div>
</template>

<script  lang="ts">
import { defineComponent, ref, watch, onUnmounted, onMounted, nextTick, computed } from 'vue'
import seedrandom from 'seedrandom'
import * as echarts from 'echarts'
import { useDark } from '@vueuse/core'
import { useI18n } from 'vue-i18n'

export default defineComponent({
  name: 'ImageRegression',
  props: {
    fullRes: {
      type: String,
      default: '',
    },
  },
  setup(props) {
    const { t, locale } = useI18n()
    const visibleCanvas = ref<HTMLCanvasElement | null>(null)
    let offscreenCanvas: HTMLCanvasElement | null = null
    const sampleSize = ref<number>(20)
    const randomSeed = ref<string>('')
    const uploadedImg = ref<string>('')
    const fileInput = ref<HTMLInputElement | null>(null)
    type SamplePoint = {
      id: number
      x: number
      y: number
      size: number
      num?: string
      result?: number
      stdDev?: number
      avgRGB?: { r: number; g: number; b: number }
    }
    interface Batch {
      id: number
      label: string
      color: string
      sampleSize: number
      randomSeed: string
      formula: string
      squares: SamplePoint[]
    }
    type DimReductionMethod = 'pca' | 'lda'
    interface MLAnalysisConfig {
      dimReduction: DimReductionMethod
    }
    interface MLDataPoint {
      x: number
      y: number
      num: number
      batchResults: Record<number, number>
    }
    interface MLResult {
      points: MLDataPoint[]
      explainedVariance?: number[]
    }
    const squares = ref<SamplePoint[]>([])
    const squareIdCounter = ref<number>(1)
    const currentImg = ref<HTMLImageElement | null>(null)
    const scale = ref<number>(1)
    const previewX = ref<number | null>(null)
    const previewY = ref<number | null>(null)
    const isLoading = ref<boolean>(true)
    const formula = ref<string>('')
    const weightMethod = ref<'none' | 'direct' | 'instrument'>('none')
    const plotType = ref<'scatter' | 'bar'>('scatter')

    const plotOptions = computed(() => [
      { label: t('imageRegression.plotOptions.scatter'), value: 'scatter' },
      { label: t('imageRegression.plotOptions.bar'), value: 'bar' },
    ])
    const weightOptions = computed(() => [
      { label: t('imageRegression.weightOptions.none'), value: 'none' },
      { label: t('imageRegression.weightOptions.direct'), value: 'direct' },
      { label: t('imageRegression.weightOptions.instrument'), value: 'instrument' },
    ])
    const chartRef = ref<HTMLElement | null>(null)
    let chartInstance: echarts.ECharts | null = null
    let resizeObserver: ResizeObserver | null = null
    const isDark = useDark()
    let currentChartTheme: 'light' | 'dark' = isDark.value ? 'dark' : 'light'
    const sampleInputRefs = ref<Record<number, HTMLElement | null>>({})
    const formulaInputRef = ref<any>(null)

    const BATCH_COLORS = ['#409EFF', '#67C23A', '#E6A23C', '#F56C6C', '#909399', '#9B59B6', '#1ABC9C', '#E74C3C']
    const arrayMode = ref<boolean>(false)
    const batches = ref<Batch[]>([])
    const batchIdCounter = ref<number>(1)
    const activeBatchId = ref<number | null>(null)
    const mlConfig = ref<MLAnalysisConfig>({ dimReduction: 'pca' })
    const mlResult = ref<MLResult | null>(null)
    const isMLRunning = ref<boolean>(false)
    const batchFillMode = ref<boolean>(false)
    const canvasZoom = ref<number>(1)

    const activeBatch = computed(() => batches.value.find((b) => b.id === activeBatchId.value) || null)
    const hasArrayResults = computed(() => batches.value.some((b) => b.squares.some((s) => s.result !== undefined)))
    const hasArraySamples = computed(() => batches.value.some((b) => b.squares.length > 0))

    const dimReductionOptions = computed(() => [
      { label: t('imageRegression.arrayMode.dimReductionPCA'), value: 'pca' },
      { label: t('imageRegression.arrayMode.dimReductionLDA'), value: 'lda' },
    ])

    function addBatch() {
      const id = batchIdCounter.value++
      const batch: Batch = {
        id,
        label: `Batch ${id}`,
        color: BATCH_COLORS[(id - 1) % BATCH_COLORS.length],
        sampleSize: sampleSize.value,
        randomSeed: randomSeed.value || '42',
        formula: formula.value || '',
        squares: [],
      }
      batches.value.push(batch)
      activeBatchId.value = id
    }

    function removeBatch(id: number) {
      batches.value = batches.value.filter((b) => b.id !== id)
      if (activeBatchId.value === id) {
        activeBatchId.value = batches.value.length > 0 ? batches.value[0].id : null
      }
      redrawCanvas()
    }

    function selectBatch(id: number) {
      activeBatchId.value = id
    }

    function zoomIn() {
      canvasZoom.value = Math.min(5, +(canvasZoom.value + 0.25).toFixed(2))
    }
    function zoomOut() {
      canvasZoom.value = Math.max(0.25, +(canvasZoom.value - 0.25).toFixed(2))
    }
    function zoomReset() {
      canvasZoom.value = 1
    }

    function removeSquareFromBatch(batchId: number, squareId: number) {
      const batch = batches.value.find((b) => b.id === batchId)
      if (batch) {
        batch.squares = batch.squares.filter((sq) => sq.id !== squareId)
        redrawCanvas()
      }
    }

    function runAllBatches() {
      if (!offscreenCanvas || !currentImg.value) return
      const ctx = offscreenCanvas.getContext('2d')
      if (!ctx) return

      for (const batch of batches.value) {
        if (!batch.formula.trim() || batch.squares.length === 0) continue
        const seed = batch.randomSeed || '42'
        const random = seedrandom(seed)

        batch.squares = batch.squares.map((square) => {
          const half = square.size / 2
          const results: number[] = []
          let rgbSum = { r: 0, g: 0, b: 0, count: 0 }

          for (let i = 0; i < 10; i++) {
            const fullX = square.x / scale.value - half / scale.value + random() * (square.size / scale.value)
            const fullY = square.y / scale.value - half / scale.value + random() * (square.size / scale.value)
            const pixel = ctx.getImageData(Math.floor(fullX), Math.floor(fullY), 1, 1).data
            const [r = 0, g = 0, b = 0] = pixel
            rgbSum.r += r
            rgbSum.g += g
            rgbSum.b += b
            rgbSum.count += 1
            const R = r / 255
            const G = g / 255
            const B = b / 255
            try {
              const calculate = new Function('R', 'G', 'B', `return ${batch.formula}`)
              const result = calculate(R, G, B)
              if (isFinite(result)) results.push(result)
            } catch { /* skip invalid formula */ }
          }

          const mean = results.length > 0 ? results.reduce((a, b) => a + b) / results.length : undefined
          const stdDev = results.length > 0 ? Math.sqrt(results.reduce((acc, val) => acc + Math.pow(val - mean!, 2), 0) / results.length) : undefined
          const avgRGB = rgbSum.count > 0 ? { r: +(rgbSum.r / rgbSum.count).toFixed(2), g: +(rgbSum.g / rgbSum.count).toFixed(2), b: +(rgbSum.b / rgbSum.count).toFixed(2) } : undefined
          return { ...square, result: mean, stdDev, avgRGB }
        })
      }
      redrawCanvas()
    }

    async function runMLAnalysis() {
      isMLRunning.value = true
      try {
        const activeBatches = batches.value.filter((b) => b.squares.some((sq) => sq.result !== undefined && sq.num !== undefined))
        if (activeBatches.length < 1) {
          isMLRunning.value = false
          return
        }

        const batchIds = activeBatches.map((b) => b.id)
        const batchGroups = new Map<number, Map<number, number[]>>()
        for (const batch of activeBatches) {
          const groups = new Map<number, number[]>()
          for (const sq of batch.squares) {
            if (sq.result === undefined || sq.num === undefined || isNaN(Number(sq.num))) continue
            const num = Number(sq.num)
            if (!groups.has(num)) groups.set(num, [])
            groups.get(num)!.push(sq.result)
          }
          batchGroups.set(batch.id, groups)
        }

        const baseBatchId = batchIds[0]
        const baseGroups = batchGroups.get(baseBatchId)!
        const data: number[][] = []
        const pointNums: number[] = []
        const pointBatchResults: Record<number, number>[] = []

        for (const [num, results] of baseGroups) {
          for (let idx = 0; idx < results.length; idx++) {
            const features: number[] = []
            const batchResults: Record<number, number> = {}
            let valid = true
            for (const bid of batchIds) {
              const group = batchGroups.get(bid)?.get(num)
              if (!group || idx >= group.length) {
                valid = false
                break
              }
              features.push(group[idx])
              batchResults[bid] = group[idx]
            }
            if (!valid) continue
            data.push(features)
            pointNums.push(num)
            pointBatchResults.push(batchResults)
          }
        }

        if (data.length < 2) {
          isMLRunning.value = false
          return
        }

        let projected: number[][] = []

        if (mlConfig.value.dimReduction === 'pca') {
          const { PCA } = await import('ml-pca')
          const pca = new PCA(data)
          const nComp = Math.min(2, data[0].length)
          const raw = pca.predict(data, { nComponents: nComp })
          projected = Array.from({ length: raw.rows }, (_, i) =>
            Array.from({ length: raw.columns }, (_, j) => raw.get(i, j)),
          )
          const variance = pca.getExplainedVariance()
          mlResult.value = {
            points: pointNums.map((num, i) => ({
              x: projected[i][0] ?? 0,
              y: projected[i][1] ?? 0,
              num,
              batchResults: pointBatchResults[i],
            })),
            explainedVariance: variance,
          }
        } else {
          const labels = pointNums
          const uniqueLabels = [...new Set(labels)]
          if (uniqueLabels.length < 2) {
            projected = data.map((d) => [d[0], 0])
          } else {
            projected = ldaProject(data, labels)
          }
          mlResult.value = {
            points: pointNums.map((num, i) => ({
              x: projected[i][0] ?? 0,
              y: projected[i][1] ?? 0,
              num,
              batchResults: pointBatchResults[i],
            })),
          }
        }

        updateMLChart()
      } catch (e) {
        console.error('ML analysis failed:', e)
      } finally {
        isMLRunning.value = false
      }
    }

    function ldaProject(data: number[][], labels: number[]): number[][] {
      const n = data.length
      const dim = data[0].length
      const uniqueLabels = [...new Set(labels)]
      const nClasses = uniqueLabels.length
      if (nClasses < 2) return data.map((d) => [d[0], 0])

      const globalMean = new Array(dim).fill(0)
      for (const d of data) {
        for (let j = 0; j < dim; j++) globalMean[j] += d[j]
      }
      for (let j = 0; j < dim; j++) globalMean[j] /= n

      const classMeans = new Map<number, number[]>()
      const classCounts = new Map<number, number>()
      for (const label of uniqueLabels) {
        classMeans.set(label, new Array(dim).fill(0))
        classCounts.set(label, 0)
      }
      for (let i = 0; i < n; i++) {
        const label = labels[i]
        const cm = classMeans.get(label)!
        for (let j = 0; j < dim; j++) cm[j] += data[i][j]
        classCounts.set(label, classCounts.get(label)! + 1)
      }
      for (const label of uniqueLabels) {
        const cm = classMeans.get(label)!
        const cnt = classCounts.get(label)!
        for (let j = 0; j < dim; j++) cm[j] /= cnt
      }

      const Sw = Array.from({ length: dim }, () => new Array(dim).fill(0))
      const Sb = Array.from({ length: dim }, () => new Array(dim).fill(0))

      for (let i = 0; i < n; i++) {
        const label = labels[i]
        const cm = classMeans.get(label)!
        for (let r = 0; r < dim; r++) {
          for (let c = 0; c < dim; c++) {
            Sw[r][c] += (data[i][r] - cm[r]) * (data[i][c] - cm[c])
          }
        }
      }

      for (const label of uniqueLabels) {
        const cm = classMeans.get(label)!
        const cnt = classCounts.get(label)!
        for (let r = 0; r < dim; r++) {
          for (let c = 0; c < dim; c++) {
            Sb[r][c] += cnt * (cm[r] - globalMean[r]) * (cm[c] - globalMean[c])
          }
        }
      }

      const nProj = Math.min(nClasses - 1, dim, 2)
      const SwInv = invertMatrix(Sw)
      if (!SwInv) return data.map((d) => [d[0], 0])

      const M = multiplyMatrix(SwInv, Sb)
      const eigenvectors = powerIteration(M, nProj)

      return data.map((d) => {
        const point: number[] = []
        for (let k = 0; k < nProj; k++) {
          let val = 0
          for (let j = 0; j < dim; j++) val += d[j] * eigenvectors[k][j]
          point.push(val)
        }
        while (point.length < 2) point.push(0)
        return point
      })
    }

    function invertMatrix(mat: number[][]): number[][] | null {
      const n = mat.length
      const aug = mat.map((row, i) => [...row, ...Array.from({ length: n }, (_, j) => (i === j ? 1 : 0))])
      for (let i = 0; i < n; i++) {
        let maxRow = i
        for (let k = i + 1; k < n; k++) if (Math.abs(aug[k][i]) > Math.abs(aug[maxRow][i])) maxRow = k
        ;[aug[i], aug[maxRow]] = [aug[maxRow], aug[i]]
        if (Math.abs(aug[i][i]) < 1e-10) return null
        const pivot = aug[i][i]
        for (let j = 0; j < 2 * n; j++) aug[i][j] /= pivot
        for (let k = 0; k < n; k++) {
          if (k === i) continue
          const factor = aug[k][i]
          for (let j = 0; j < 2 * n; j++) aug[k][j] -= factor * aug[i][j]
        }
      }
      return aug.map((row) => row.slice(n))
    }

    function multiplyMatrix(a: number[][], b: number[][]): number[][] {
      const n = a.length
      const m = b[0].length
      const k = b.length
      const result = Array.from({ length: n }, () => new Array(m).fill(0))
      for (let i = 0; i < n; i++) for (let j = 0; j < m; j++) for (let p = 0; p < k; p++) result[i][j] += a[i][p] * b[p][j]
      return result
    }

    function powerIteration(mat: number[][], nVectors: number): number[][] {
      const n = mat.length
      const vectors: number[][] = []
      for (let v = 0; v < nVectors; v++) {
        let vec = Array.from({ length: n }, () => Math.random() - 0.5)
        for (let iter = 0; iter < 100; iter++) {
          const newVec = new Array(n).fill(0)
          for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) newVec[i] += mat[i][j] * vec[j]
          const norm = Math.sqrt(newVec.reduce((s, x) => s + x * x, 0))
          if (norm > 0) for (let i = 0; i < n; i++) newVec[i] /= norm
          vec = newVec
        }
        vectors.push(vec)
      }
      return vectors
    }

    function updateMLChart() {
      const inst = chartInstance ?? initChartWithRetry()
      if (!inst || !mlResult.value) return

      const colors = ['#409EFF', '#67C23A', '#E6A23C', '#F56C6C', '#909399', '#9B59B6', '#1ABC9C', '#E74C3C']
      const seriesMap = new Map<string, echarts.SeriesOption>()

      for (const pt of mlResult.value.points) {
        const seriesName = `num=${pt.num}`
        if (!seriesMap.has(seriesName)) {
          seriesMap.set(seriesName, {
            name: seriesName,
            type: 'scatter',
            data: [],
            symbolSize: 10,
            itemStyle: { color: colors[pt.num % colors.length] },
          })
        }
        const series = seriesMap.get(seriesName)! as any
        series.data.push([pt.x, pt.y, pt.num])
      }

      const titleText = mlConfig.value.dimReduction === 'pca'
        ? t('imageRegression.arrayMode.chart.mlScatter') + ' (PCA)'
        : t('imageRegression.arrayMode.chart.mlScatter') + ' (LDA)'

      const option: echarts.EChartsOption = {
        title: { text: titleText, left: 'center', top: 8 },
        legend: { top: 36 },
        tooltip: {
          trigger: 'item',
          formatter: (params: any) => {
            const d = params.data
            return `num=${d[2]} (${d[0]?.toFixed(3)}, ${d[1]?.toFixed(3)})`
          },
        },
        grid: { left: 60, right: 20, top: 70, bottom: 50 },
        xAxis: {
          type: 'value',
          name: mlConfig.value.dimReduction === 'pca'
            ? t('imageRegression.arrayMode.chart.pcAxis', { num: 1 })
            : t('imageRegression.arrayMode.chart.ldaAxis', { num: 1 }),
        },
        yAxis: {
          type: 'value',
          name: mlConfig.value.dimReduction === 'pca'
            ? t('imageRegression.arrayMode.chart.pcAxis', { num: 2 })
            : t('imageRegression.arrayMode.chart.ldaAxis', { num: 2 }),
        },
        series: Array.from(seriesMap.values()),
      }

      inst.setOption(option, true)
      inst.resize()
    }

    function downloadMLResult() {
      if (!mlResult.value) return
      const batchIds = batches.value.filter((b) => b.squares.some((sq) => sq.result !== undefined)).map((b) => b.id)
      const header = ['num', ...batchIds.map((bid) => `batch_${bid}`), 'x', 'y', 'cluster']
      const lines = [header.join(',')]
      for (const pt of mlResult.value.points) {
        const row = [pt.num]
        for (const bid of batchIds) row.push(pt.batchResults[bid]?.toFixed(6) ?? '')
        row.push(pt.x.toFixed(6), pt.y.toFixed(6), String(pt.clusterLabel))
        lines.push(row.join(','))
      }
      const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8;' })
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = t('imageRegression.arrayMode.mlCsvName')
      link.click()
      URL.revokeObjectURL(url)
    }
    const clamp = (val: number, min: number, max: number) => Math.min(max, Math.max(min, val))
    const handleSampleSizeChange = (val: number | number[]) => {
      const raw = Array.isArray(val) ? val[0] : val
      const next = clamp(Number(raw) || 1, 1, 50)
      sampleSize.value = next
      squares.value = squares.value.map((sq) => ({ ...sq, size: next }))
      redrawCanvas()
    }

    const formulaRules = [
      (val: string) => !!val?.trim() || t('imageRegression.messages.formulaRequired'),
      (val: string) => {
        const expr = (val || '').trim()
        if (!expr) return true
        try {
          // eslint-disable-next-line no-new-func
          new Function('R', 'G', 'B', `return ${expr}`)
          return true
        } catch (error) {
          console.error('Invalid formula', error)
          return t('imageRegression.messages.formulaInvalid')
        }
      },
    ]

    const isFormulaValid = async () => {
      if (formulaInputRef.value?.validate) {
        const passed = await formulaInputRef.value.validate()
        if (passed === false) return false
      }
      return formulaRules.every((rule) => rule(formula.value) === true)
    }

    watch(
      () => props.fullRes,
      async (newVal) => {
        if (newVal && newVal !== 'data:,') {
          if (uploadedImg.value && uploadedImg.value.startsWith('blob:')) {
            URL.revokeObjectURL(uploadedImg.value)
          }
          uploadedImg.value = newVal
          await processFullRes()
        }
      },
      { immediate: true },
    )

    async function processFullRes() {
      const src = uploadedImg.value
      if (!src) return
      isLoading.value = true
      try {
        const img = new Image()
        img.crossOrigin = 'anonymous'
        await new Promise<void>((resolve, reject) => {
          img.onload = () => resolve()
          img.onerror = reject
          img.src = src
        })
        currentImg.value = img

        if (visibleCanvas.value && currentImg.value) {
          scale.value = currentImg.value.height > 240 ? 240 / currentImg.value.height : 1
          const scaledWidth = currentImg.value.width * scale.value
          const scaledHeight = currentImg.value.height * scale.value
          visibleCanvas.value.width = scaledWidth
          visibleCanvas.value.height = scaledHeight

          if (!offscreenCanvas) {
            offscreenCanvas = document.createElement('canvas')
          }
          offscreenCanvas.width = currentImg.value.width
          offscreenCanvas.height = currentImg.value.height
          const offCtx = offscreenCanvas.getContext('2d')
          if (offCtx) {
            offCtx.clearRect(0, 0, offscreenCanvas.width, offscreenCanvas.height)
            offCtx.drawImage(currentImg.value, 0, 0, currentImg.value.width, currentImg.value.height)
          }
        }

        redrawCanvas()
      } catch (error) {
        console.error('Error processing image:', error)
      } finally {
        isLoading.value = false
      }
    }

    function redrawCanvas() {
      if (!visibleCanvas.value || !currentImg.value) return
      const ctx = visibleCanvas.value.getContext('2d')
      if (!ctx) return
      ctx.clearRect(0, 0, visibleCanvas.value.width, visibleCanvas.value.height)
      ctx.drawImage(currentImg.value, 0, 0, visibleCanvas.value.width, visibleCanvas.value.height)

      ctx.font = 'bold 12px sans-serif'
      ctx.textBaseline = 'bottom'

      if (arrayMode.value) {
        for (const batch of batches.value) {
          ctx.strokeStyle = batch.color
          ctx.fillStyle = batch.color
          ctx.lineWidth = 2
          for (const square of batch.squares) {
            const half = square.size / 2
            ctx.strokeRect(square.x - half, square.y - half, square.size, square.size)
            if (square.num) {
              ctx.fillText(square.num, square.x + half + 2, square.y - half)
            }
          }
        }
      } else {
        ctx.strokeStyle = 'blue'
        ctx.fillStyle = 'blue'
        ctx.lineWidth = 2
        squares.value.forEach((square) => {
          const half = square.size / 2
          ctx.strokeRect(square.x - half, square.y - half, square.size, square.size)
          if (square.num) {
            ctx.fillText(square.num, square.x + half + 2, square.y - half)
          }
        })
      }

      if (previewX.value !== null && previewY.value !== null) {
        ctx.strokeStyle = 'green'
        ctx.lineWidth = 2
        const half = sampleSize.value / 2
        ctx.strokeRect(previewX.value - half, previewY.value - half, sampleSize.value, sampleSize.value)
      }
    }

    function uploadImage() {
      fileInput.value?.click()
    }

    function handleUpload(evt: Event) {
      const target = evt.target as HTMLInputElement
      const file = target.files?.[0]
      if (!file) return
      const reader = new FileReader()
      reader.onload = (e) => {
        uploadedImg.value = e.target?.result as string
        processFullRes()
      }
      reader.readAsDataURL(file)
    }

    function handleMouseMove(event: MouseEvent) {
      if (!visibleCanvas.value || !currentImg.value) return
      const rect = visibleCanvas.value.getBoundingClientRect()
      previewX.value = ((event.clientX - rect.left) / rect.width) * visibleCanvas.value.width
      previewY.value = ((event.clientY - rect.top) / rect.height) * visibleCanvas.value.height
      redrawCanvas()
    }

    function handleMouseLeave() {
      previewX.value = null
      previewY.value = null
      redrawCanvas()
    }

    function handleCanvasClick(event: MouseEvent) {
      if (!visibleCanvas.value) return
      const rect = visibleCanvas.value.getBoundingClientRect()
      const x = ((event.clientX - rect.left) / rect.width) * visibleCanvas.value.width
      const y = ((event.clientY - rect.top) / rect.height) * visibleCanvas.value.height

      if (arrayMode.value) {
        const batch = activeBatch.value
        if (!batch) return
        batch.squares.push({
          id: squareIdCounter.value++,
          x,
          y,
          size: batch.sampleSize,
        })
        redrawCanvas()
        return
      }

      squares.value.push({
        id: squareIdCounter.value++,
        x,
        y,
        size: sampleSize.value,
      })
      redrawCanvas()
    }

    function removeSquare(id: number) {
      squares.value = squares.value.filter((sq) => sq.id !== id)
      redrawCanvas()
    }

    function setSampleInputRef(el: any, id: number) {
      sampleInputRefs.value[id] = el ? el.$el?.querySelector?.('input') ?? el.$el : null
    }

    function focusInput(id: number) {
      nextTick(() => {
        const el = sampleInputRefs.value[id]
        if (el) {
          ;(el as HTMLElement).focus()
          ;(el as HTMLInputElement).select?.()
        }
      })
    }

    function focusNextSample(id: number) {
      const idx = squares.value.findIndex((sq) => sq.id === id)
      if (idx !== -1) {
        const next = squares.value[idx + 1]?.id
        if (next) focusInput(next)
        return
      }
      for (let bi = 0; bi < batches.value.length; bi++) {
        const batch = batches.value[bi]
        const si = batch.squares.findIndex((sq) => sq.id === id)
        if (si === -1) continue
        if (si + 1 < batch.squares.length) {
          focusInput(batch.squares[si + 1].id)
          return
        }
        for (let bj = bi + 1; bj < batches.value.length; bj++) {
          if (batches.value[bj].squares.length > 0) {
            focusInput(batches.value[bj].squares[0].id)
            return
          }
        }
        return
      }
    }

    async function calculateFormula() {
      const valid = await isFormulaValid()
      if (!valid) return
      if (!offscreenCanvas || !currentImg.value) return
      const ctx = offscreenCanvas.getContext('2d')
      if (!ctx) return

      const seed = randomSeed.value || '42'
      const random = seedrandom(seed)

      squares.value = squares.value.map((square) => {
        const half = square.size / 2
        const results: number[] = []
        let rgbSum = { r: 0, g: 0, b: 0, count: 0 }

        for (let i = 0; i < 10; i++) {
          const fullX = square.x / scale.value - half / scale.value + random() * (square.size / scale.value)
          const fullY = square.y / scale.value - half / scale.value + random() * (square.size / scale.value)

          const pixel = ctx.getImageData(Math.floor(fullX), Math.floor(fullY), 1, 1).data
          const [r = 0, g = 0, b = 0] = pixel
          rgbSum.r += r
          rgbSum.g += g
          rgbSum.b += b
          rgbSum.count += 1
          const R = r / 255
          const G = g / 255
          const B = b / 255

          try {
            const calculate = new Function('R', 'G', 'B', `return ${formula.value}`)
            const result = calculate(R, G, B)
            if (!isFinite(result)) {
              continue
            }
            results.push(result)
          } catch (error) {
            console.error('Failed to evaluate formula:', error)
          }
        }

        const mean = results.length > 0 ? results.reduce((a, b) => a + b) / results.length : undefined
        const stdDev =
          results.length > 0 ? Math.sqrt(results.reduce((acc, val) => acc + Math.pow(val - mean!, 2), 0) / results.length) : undefined
        const avgRGB =
          rgbSum.count > 0
            ? {
                r: +(rgbSum.r / rgbSum.count).toFixed(2),
                g: +(rgbSum.g / rgbSum.count).toFixed(2),
                b: +(rgbSum.b / rgbSum.count).toFixed(2),
              }
            : undefined

        return {
          ...square,
          result: mean,
          stdDev: stdDev,
          avgRGB,
        }
      })

      updateChart()
    }

    function calculateRegression(data: Array<[number, number]>, weights: number[] = []) {
      const n = data.length
      if (n < 2) return null

      const weightArr = weights ?? []

      let sumW = 0
      let sumX = 0
      let sumY = 0
      let sumXY = 0
      let sumXX = 0

      for (let i = 0; i < n; i++) {
        const pair = data[i]
        if (!pair) continue
        const w = weightArr[i] ?? 1
        const [x, y] = pair

        sumW += w
        sumX += w * x
        sumY += w * y
        sumXY += w * x * y
        sumXX += w * x * x
      }

      const slope = (sumW * sumXY - sumX * sumY) / (sumW * sumXX - sumX * sumX)
      const intercept = (sumY - slope * sumX) / sumW

      // Compute goodness of fit R^2
      let SSres = 0 // residual sum of squares
      let SStot = 0 // total sum of squares
      const yMean = sumY / sumW

      for (let i = 0; i < n; i++) {
        const pair = data[i]
        if (!pair) continue
        const w = weightArr[i] ?? 1
        const [x, y] = pair
        const yFit = slope * x + intercept
        SSres += w * Math.pow(y - yFit, 2)
        SStot += w * Math.pow(y - yMean, 2)
      }

      const rSquared = 1 - SSres / SStot

      return { slope, intercept, rSquared }
    }

    function downloadSamples() {
      const rows = squares.value
        .filter((sq) => sq.result !== undefined)
        .map((sq) => ({
          id: sq.id,
          label: sq.num ?? '',
          r: sq.avgRGB?.r ?? '',
          g: sq.avgRGB?.g ?? '',
          b: sq.avgRGB?.b ?? '',
          result: sq.result ?? '',
          stdDev: sq.stdDev ?? '',
        }))
      if (!rows.length) {
        return
      }
      const header = ['id', 'label', 'R', 'G', 'B', 'result', 'stdDev']
      const lines = [header.join(',')]
      for (const row of rows) {
        lines.push(
          [
            row.id,
            row.label,
            row.r,
            row.g,
            row.b,
            typeof row.result === 'number' ? row.result.toFixed(6) : row.result,
            typeof row.stdDev === 'number' ? row.stdDev.toFixed(6) : row.stdDev,
          ].join(','),
        )
      }
      const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8;' })
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = t('imageRegression.csvName')
      link.click()
      URL.revokeObjectURL(url)
    }

    const initChartWithRetry = (attempt = 0): echarts.ECharts | null => {
      if (!chartRef.value) return null
      const { clientWidth, clientHeight } = chartRef.value
      if ((clientWidth === 0 || clientHeight === 0) && attempt < 8) {
        setTimeout(() => initChartWithRetry(attempt + 1), 120)
        return null
      }
      chartInstance = chartInstance ?? echarts.init(chartRef.value, currentChartTheme === 'dark' ? 'dark' : undefined)
      return chartInstance
    }

    function createErrorBarSeries(data: Array<[number | string, number, number]>) {
      return {
        name: t('imageRegression.chart.stdDev'),
        type: 'custom',
        renderItem: (_: any, api: any) => {
          const xValue = api.value(0)
          const yValue = api.value(1)
          const err = api.value(2) || 0
          const low = api.coord([xValue, yValue - err])
          const high = api.coord([xValue, yValue + err])
          const cap = 6
          return {
            type: 'group',
            children: [
              {
                type: 'line',
                shape: { x1: low[0], y1: low[1], x2: high[0], y2: high[1] },
                style: { stroke: '#909399', lineWidth: 1 },
              },
              {
                type: 'line',
                shape: { x1: low[0] - cap / 2, y1: low[1], x2: low[0] + cap / 2, y2: low[1] },
                style: { stroke: '#909399', lineWidth: 1 },
              },
              {
                type: 'line',
                shape: { x1: high[0] - cap / 2, y1: high[1], x2: high[0] + cap / 2, y2: high[1] },
                style: { stroke: '#909399', lineWidth: 1 },
              },
            ],
          }
        },
        encode: { x: 0, y: [1, 2] },
        data,
        z: 10,
        tooltip: {
          formatter: (params: any) => t('imageRegression.chart.tooltipStd', { value: params.value?.[2] ?? 0 }),
        },
      } as echarts.SeriesOption
    }

    function updateChart() {
      const inst = chartInstance ?? initChartWithRetry()
      if (!inst) {
        setTimeout(updateChart, 180)
        return
      }
      const isCompleteSample = (square: SamplePoint): square is SamplePoint & { num: number; result: number } =>
        square.num !== undefined &&
        square.result !== undefined &&
        !isNaN(Number(square.num)) &&
        !isNaN(Number(square.result))

      const validData = squares.value.filter(isCompleteSample)

      const pairs = validData.map((d) => [Number(d.num), Number(d.result)] as [number, number])
      const xVals = pairs.map(([val]) => val)
      const yVals = pairs.map(([, val]) => val)
      const errorVals = validData.map((d) => Number(d.stdDev) || 0)

      if (!validData.length) {
        inst.setOption({
          title: { text: t('imageRegression.chart.noData'), left: 'center' },
          xAxis: { type: 'value', name: t('imageRegression.chart.numberAxis') },
          yAxis: { type: 'value', name: t('imageRegression.chart.resultAxis') },
          series: [],
        })
        inst.resize()
        return
      }

      const series: echarts.SeriesOption[] = []

      if (plotType.value === 'scatter') {
        const scatterSeries: echarts.SeriesOption = {
          name: t('imageRegression.chart.dataPoints'),
          type: 'scatter',
          data: pairs.map((pair, idx) => ({
            value: pair,
            std: errorVals[idx],
          })),
          symbolSize: 10,
          itemStyle: { color: '#409EFF' },
        }
        series.push(scatterSeries)

        if (errorVals.some((v) => v > 0)) {
          series.push(
            createErrorBarSeries(pairs.map((pair, idx) => [pair[0], pair[1], errorVals[idx] ?? 0] as [number | string, number, number])),
          )
        }

        const weights = errorVals.map((sigma) => {
          if (weightMethod.value === 'direct') return sigma > 0 ? 1 / sigma : 1
          if (weightMethod.value === 'instrument') return sigma > 0 ? 1 / (sigma * sigma) : 1
          return 1
        })

        const regression = calculateRegression(pairs, weightMethod.value === 'none' ? [] : weights)
        if (regression && xVals.length >= 2) {
          const xMin = Math.min(...xVals)
          const xMax = Math.max(...xVals)
          series.push({
            name: t('imageRegression.chart.regression', { value: regression.rSquared.toFixed(4) }),
            type: 'line',
            symbol: 'none',
            data: [
              [xMin, regression.slope * xMin + regression.intercept],
              [xMax, regression.slope * xMax + regression.intercept],
            ],
            lineStyle: { color: '#F56C6C', width: 2 },
          })
        }
      } else {
        series.push({
          name: t('imageRegression.chart.values'),
          type: 'bar',
          data: yVals,
          itemStyle: { color: '#409EFF' },
        })
        if (errorVals.some((v) => v > 0)) {
          series.push(
            createErrorBarSeries(
              validData.map((_, idx) => [String(xVals[idx]), yVals[idx] ?? 0, errorVals[idx] ?? 0] as [string, number, number]),
            ),
          )
        }
      }

      const option: echarts.EChartsOption = {
        title: {
          text: plotType.value === 'scatter' ? t('imageRegression.chart.linearRegression') : t('imageRegression.chart.dataDistribution'),
          left: 'center',
          top: 8,
        },
        legend: { top: 36 },
        tooltip: { trigger: plotType.value === 'bar' ? 'axis' : 'item' },
        grid: { left: 60, right: 20, top: 70, bottom: 50 },
        xAxis:
          plotType.value === 'scatter'
            ? { type: 'value', name: t('imageRegression.chart.numberAxis') }
            : { type: 'category', name: t('imageRegression.chart.numberAxis'), data: xVals.map((v) => String(v)) },
        yAxis: { type: 'value', name: t('imageRegression.chart.resultAxis') },
        series,
      }

      inst.setOption(option, true)
      inst.resize()
    }

    onMounted(() => {
      nextTick(() => {
        if (chartRef.value) {
          initChartWithRetry()
          resizeObserver = new ResizeObserver(() => {
            chartInstance?.resize()
          })
          resizeObserver.observe(chartRef.value)
        }
      })
    })

    watch(
      isDark,
      (val) => {
        currentChartTheme = val ? 'dark' : 'light'
        if (chartInstance) {
          chartInstance.dispose()
          chartInstance = null
        }
        initChartWithRetry()
        updateChart()
      },
      { flush: 'post' },
    )

    watch(locale, () => {
      updateChart()
    })

    watch(squares, () => { redrawCanvas() }, { deep: true })
    let syncingNum = false
    watch(batches, () => {
      redrawCanvas()
      if (batchFillMode.value && !syncingNum) {
        syncingNum = true
        const src = batches.value[0]
        if (src) {
          for (let i = 0; i < src.squares.length; i++) {
            const val = src.squares[i].num
            for (let b = 1; b < batches.value.length; b++) {
              if (i < batches.value[b].squares.length) {
                batches.value[b].squares[i].num = val
              }
            }
          }
        }
        syncingNum = false
      }
    }, { deep: true })

    onUnmounted(() => {
      isLoading.value = true
      if (uploadedImg.value && uploadedImg.value.startsWith('blob:')) {
        URL.revokeObjectURL(uploadedImg.value)
      }
      if (chartInstance) {
        chartInstance.dispose()
        chartInstance = null
      }
      if (resizeObserver) {
        resizeObserver.disconnect()
        resizeObserver = null
      }
    })

    return {
      visibleCanvas,
      sampleSize,
      randomSeed,
      uploadedImg,
      fileInput,
      uploadImage,
      handleUpload,
      props,
      processFullRes,
      squares,
      handleMouseMove,
      handleMouseLeave,
      handleCanvasClick,
      removeSquare,
      setSampleInputRef,
      focusNextSample,
      isLoading,
      formula,
      formulaInputRef,
      calculateFormula,
      weightMethod,
      plotType,
      plotOptions,
      weightOptions,
      handleSampleSizeChange,
      chartRef,
      downloadSamples,
      t,
      formulaRules,
      isFormulaValid,
      arrayMode,
      batches,
      activeBatchId,
      activeBatch,
      mlConfig,
      mlResult,
      isMLRunning,
      hasArrayResults,
      hasArraySamples,
      batchFillMode,
      canvasZoom,
      dimReductionOptions,
      addBatch,
      removeBatch,
      selectBatch,
      removeSquareFromBatch,
      zoomIn,
      zoomOut,
      zoomReset,
      runAllBatches,
      runMLAnalysis,
      downloadMLResult,
    }
  },
})
</script>

<style scoped>
.image-regression {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.controls-card {
  /* padding: 12px; */
    border-radius: 16px;
}

.control-row {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  gap: 12px;
  align-items: center;
}
.regression-row {
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  align-items: center;
}
.regression-card :deep(.var-input__placeholder) {
  color: color-mix(in srgb, currentColor 46%, transparent);
  opacity: 1;
}
.regression-actions {
  display: flex;
  gap: 8px;
  justify-content: flex-end;
  flex-wrap: wrap;
}
.formula-input {
  min-width: 240px;
}

.control-item {
  border: 1px solid #e5e7eb;
  border-radius: 12px;
  display: flex;
  flex-direction: column;
  padding :12px
}

.label {
  font-size: 13px;
  /* color: #4b5563; */
}

.canvas-container {
  width: 100%;
  max-height: 500px;
  overflow-x: auto;
  overflow-y: auto;
  border: 1px dashed #ccc;
  margin: 0 auto 20px;
  border-radius: 12px;
  padding: 10px;
  position: relative;
}

.canvas-zoomed {
  max-height: none;
}

canvas {
  display: block;
  min-height: 300px;
}

.zoom-controls {
  display: inline-flex;
  align-items: center;
  gap: 2px;
  background: color-mix(in srgb, var(--color-body, #fff) 90%, transparent);
  backdrop-filter: blur(8px);
  border: 1px solid color-mix(in srgb, currentColor 12%, transparent);
  border-radius: 8px;
  padding: 2px 4px;
  position: absolute;
  top: 10px;
  right: 10px;
  z-index: 2;
}

.zoom-label {
  font-size: 12px;
  font-weight: 600;
  min-width: 44px;
  text-align: center;
  user-select: none;
}

.zoom-divider {
  width: 1px;
  height: 16px;
  background: color-mix(in srgb, currentColor 16%, transparent);
  margin: 0 2px;
}

.loading-mask {
  position: absolute;
  inset: 0;
  display: grid;
  place-items: center;
  background: color-mix(in srgb, var(--color-body, #fff) 70%, transparent);
  z-index: 1;
  pointer-events: none;
}

.sample-row {
  display: grid;
  grid-template-columns: 1fr 120px auto;
  gap: 10px;
  align-items: center;
}

.sample-result {
  font-weight: 600;
}

.chart {
  height: 400px;
  width: 100%;
}

.batch-actions {
  display: flex;
  gap: 8px;
  margin-bottom: 12px;
}

.batch-item {
  border: 1px solid #e5e7eb;
  border-radius: 12px;
  padding: 14px 16px;
  margin-bottom: 10px;
  cursor: pointer;
  transition: border-color 0.2s;
}

.batch-item.active {
  border-color: var(--color-primary, #2563eb);
}

.batch-header {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 10px;
}

.batch-color-dot {
  width: 18px;
  height: 18px;
  border-radius: 50%;
  flex-shrink: 0;
}

.batch-name-input {
  flex: 1;
}

.batch-config {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.batch-config-row {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(130px, 1fr));
  gap: 10px;
  align-items: end;
}

.batch-formula-input {
  min-width: 130px;
}

.batch-field {
  display: flex;
  flex-direction: column;
  gap: 3px;
}

.label-sm {
  font-size: 11px;
  color: #6b7280;
}

.batch-empty {
  text-align: center;
  color: #9ca3af;
  padding: 16px;
}

.batch-fill-toggle {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 12px;
  padding-bottom: 10px;
  border-bottom: 1px solid #e5e7eb;
}

.batch-results-group {
  margin-bottom: 12px;
}

.batch-results-header {
  display: flex;
  align-items: center;
  gap: 8px;
  font-weight: 600;
  margin-bottom: 4px;
}

.batch-formula-tag {
  font-size: 12px;
  color: #6b7280;
  background: #f3f4f6;
  padding: 2px 6px;
  border-radius: 4px;
}

.ml-config-row {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
  gap: 12px;
  align-items: center;
}
</style>
