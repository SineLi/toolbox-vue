<template>
  <div class="image-regression">
    <var-card class="controls-card" title="Sampling">
      <template v-if="(props.fullRes && props.fullRes !== 'data:,') || uploadedImg">
        <div class="control-row">
          <div class="control-item" style="gap: 16px;">
            <span class="label">Sample size</span>
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
            <span class="label">Random seed</span>
            <var-input v-model="randomSeed" type="text" placeholder="Seed" />
          </div>
        </div>
      </template>
      <template v-else>
        <var-button type="primary" @click="uploadImage">Upload image</var-button>
        <input ref="fileInput" type="file" @change="handleUpload" accept="image/*" style="display:none" />
      </template>
    </var-card>

    <div class="canvas-container">
      <div v-if="isLoading" class="loading-mask">Loading...</div>
      <canvas
        ref="visibleCanvas"
        @mousemove="handleMouseMove"
        @mouseleave="handleMouseLeave"
        @click="handleCanvasClick"
      ></canvas>
    </div>

    <var-card class="controls-card" title="Sample list">
      <var-list>
        <var-cell v-for="square in squares" :key="square.id" border :title="`Sample ${square.id}`">
          <div class="sample-row">
            <var-input v-model="square.num" type="number" placeholder="Number" />
            <div class="sample-result">{{ square.result?.toFixed(4) || '-' }}</div>
            <var-button type="danger" size="small" @click="removeSquare(square.id)">Remove</var-button>
          </div>
        </var-cell>
      </var-list>
    </var-card>

    <var-card class="controls-card" title="Regression">
      <div class="control-row">
        <var-input v-model="formula" placeholder="Formula (e.g. R/G)" />
        <var-select v-model="plotType" :options="plotOptions" placeholder="Chart type" />
        <var-select v-model="weightMethod" :options="weightOptions" placeholder="Weighting" :disabled="plotType === 'bar'" />
        <var-button type="primary" @click="calculateFormula">Calculate</var-button>
        <var-button type="success" @click="downloadSamples">Download CSV</var-button>
      </div>
    </var-card>

    <var-card class="controls-card" title="Chart">
      <div ref="chartRef" class="chart"></div>
    </var-card>
  </div>
</template>

<script  lang="ts">
import { defineComponent, ref, watch, onUnmounted, onMounted, nextTick } from 'vue'
import seedrandom from 'seedrandom'
import * as echarts from 'echarts'
import { useDark } from '@vueuse/core'

export default defineComponent({
  name: 'ImageRegression',
  props: {
    fullRes: {
      type: String,
      default: '',
    },
  },
  setup(props) {
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

    const plotOptions = [
      { label: 'Scatter', value: 'scatter' },
      { label: 'Bar', value: 'bar' },
    ]
    const weightOptions = [
      { label: 'None', value: 'none' },
      { label: 'Direct', value: 'direct' },
      { label: 'Instrument', value: 'instrument' },
    ]
    const chartRef = ref<HTMLElement | null>(null)
    let chartInstance: echarts.ECharts | null = null
    let resizeObserver: ResizeObserver | null = null
    const isDark = useDark()
    let currentChartTheme: 'light' | 'dark' = isDark.value ? 'dark' : 'light'
    const clamp = (val: number, min: number, max: number) => Math.min(max, Math.max(min, val))
    const handleSampleSizeChange = (val: number | number[]) => {
      const raw = Array.isArray(val) ? val[0] : val
      const next = clamp(Number(raw) || 1, 1, 50)
      sampleSize.value = next
      squares.value = squares.value.map((sq) => ({ ...sq, size: next }))
      redrawCanvas()
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
      squares.value.forEach((square) => {
        ctx.strokeStyle = 'blue'
        ctx.lineWidth = 2
        const half = square.size / 2
        ctx.strokeRect(square.x - half, square.y - half, square.size, square.size)
      })
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

    function calculateFormula() {
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
      link.download = 'sample_data.csv'
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
        name: 'Std dev',
        type: 'custom',
        renderItem: (params: any, api: any) => {
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
          formatter: (params: any) => `±${params.value?.[2] ?? 0}`,
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
          title: { text: 'No data', left: 'center' },
          xAxis: { type: 'value', name: 'Number' },
          yAxis: { type: 'value', name: 'Result' },
          series: [],
        })
        inst.resize()
        return
      }

      const series: echarts.SeriesOption[] = []

      if (plotType.value === 'scatter') {
        const scatterSeries: echarts.SeriesOption = {
          name: 'Data points',
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
          series.push(createErrorBarSeries(pairs.map((pair, idx) => [pair[0], pair[1], errorVals[idx]])))
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
            name: `Regression (R² = ${regression.rSquared.toFixed(4)})`,
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
          name: 'Values',
          type: 'bar',
          data: yVals,
          itemStyle: { color: '#409EFF' },
        })
        if (errorVals.some((v) => v > 0)) {
          series.push(createErrorBarSeries(validData.map((d, idx) => [String(xVals[idx]), yVals[idx], errorVals[idx]])))
        }
      }

      const option: echarts.EChartsOption = {
        title: {
          text: plotType.value === 'scatter' ? 'Linear regression' : 'Data distribution',
          left: 'center',
          top: 8,
        },
        legend: { top: 36 },
        tooltip: { trigger: plotType.value === 'bar' ? 'axis' : 'item' },
        grid: { left: 60, right: 20, top: 70, bottom: 50 },
        xAxis:
          plotType.value === 'scatter'
            ? { type: 'value', name: 'Number' }
            : { type: 'category', name: 'Number', data: xVals.map((v) => String(v)) },
        yAxis: { type: 'value', name: 'Result' },
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
      isLoading,
      formula,
      calculateFormula,
      weightMethod,
      plotType,
      plotOptions,
      weightOptions,
      handleSampleSizeChange,
      chartRef,
      downloadSamples,
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

.control-item {
  display: flex;
  flex-direction: column;
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

canvas {
  display: block;
  min-height: 300px;
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
</style>
