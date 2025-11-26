<template>
  <div class="image-regression">
    <var-card class="controls-card" title="Sampling">
      <template v-if="(props.fullRes && props.fullRes !== 'data:,') || uploadedImg">
        <div class="control-row">
          <div class="control-item">
            <span class="label">Sample size</span>
            <var-slider v-model="sampleSize" :min="1" :max="50" track-color="#e5e7eb" />
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
      </div>
    </var-card>

    <var-card class="controls-card" title="Chart">
      <div id="plotlyChart" class="chart"></div>
    </var-card>
  </div>
</template>

<script lang="ts">
import { defineComponent, ref, watch, onUnmounted, onMounted } from 'vue'
import seedrandom from 'seedrandom'
// @ts-ignore
import Plotly from 'plotly.js-dist-min'

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
    type SamplePoint = { id: number; x: number; y: number; size: number; num?: string; result?: number; stdDev?: number }
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

        for (let i = 0; i < 10; i++) {
          const fullX = square.x / scale.value - half / scale.value + random() * (square.size / scale.value)
          const fullY = square.y / scale.value - half / scale.value + random() * (square.size / scale.value)

          const pixel = ctx.getImageData(Math.floor(fullX), Math.floor(fullY), 1, 1).data
          const [r = 0, g = 0, b = 0] = pixel
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

        return {
          ...square,
          result: mean,
          stdDev: stdDev,
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

    function updateChart() {
      const isCompleteSample = (square: SamplePoint): square is SamplePoint & { num: number; result: number } =>
        square.num !== undefined &&
        square.result !== undefined &&
        !isNaN(Number(square.num)) &&
        !isNaN(Number(square.result))

      const validData = squares.value.filter(isCompleteSample)

      const pairs = validData.map((d) => [Number(d.num), Number(d.result)] as [number, number])
      const x = pairs.map(([val]) => val)
      const y = pairs.map(([, val]) => val)
      const error_y = validData.map((d) => Number(d.stdDev) || 0)

      let traces: any[] = []

      if (plotType.value === 'scatter') {
        const scatterTrace = {
          x,
          y,
          error_y: {
            type: 'data',
            array: error_y,
            visible: true,
            color: '#409EFF',
          },
          mode: 'markers',
          type: 'scatter',
          name: 'Data points',
          marker: {
            color: '#409EFF',
            size: 10,
          },
        }
        traces.push(scatterTrace)

        const weights = error_y.map((sigma) => {
          if (weightMethod.value === 'direct') return sigma > 0 ? 1 / sigma : 1
          if (weightMethod.value === 'instrument') return sigma > 0 ? 1 / (sigma * sigma) : 1
          return 1
        })

        const regression = calculateRegression(pairs, weightMethod.value === 'none' ? [] : weights)
        if (regression && x.length >= 2) {
          const xMin = Math.min(...x)
          const xMax = Math.max(...x)
          traces.push({
            x: [xMin, xMax],
            y: [regression.slope * xMin + regression.intercept, regression.slope * xMax + regression.intercept],
            mode: 'lines',
            type: 'scatter',
            name: `Regression (R^2 = ${regression.rSquared.toFixed(4)})`,
            line: { color: '#F56C6C', width: 2 },
          })
        }
      } else {
        traces.push({
          x,
          y,
          type: 'bar',
          name: 'Values',
          error_y: {
            type: 'data',
            array: error_y,
            visible: true,
            color: '#409EFF',
          },
          marker: {
            color: '#409EFF',
          },
        })
      }

      const layout = {
        title: plotType.value === 'scatter' ? 'Linear regression' : 'Data distribution',
        xaxis: { title: 'Number' },
        yaxis: { title: 'Result' },
        showlegend: true,
        hovermode: 'closest',
        barmode: 'relative',
      }

      Plotly.newPlot('plotlyChart', traces, layout)
    }

    onMounted(() => {
      Plotly.newPlot('plotlyChart', [], {})
    })

    onUnmounted(() => {
      isLoading.value = true
      if (uploadedImg.value && uploadedImg.value.startsWith('blob:')) {
        URL.revokeObjectURL(uploadedImg.value)
      }
      Plotly.purge('plotlyChart')
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
  padding: 12px;
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
  gap: 6px;
}

.label {
  font-size: 13px;
  color: #4b5563;
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
