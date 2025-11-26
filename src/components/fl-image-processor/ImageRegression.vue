<template >
  <div class="control-panel" >
    <el-card>
      <template v-if="(props.fullRes && props.fullRes !== 'data:,') || uploadedImg">
        <el-row class="control-elements" type="flex" align="middle" gutter="20">
          <el-col :span="12">
            <el-slider v-model="sampleSize" :min="1" :max="50"></el-slider>
          </el-col>
          <el-col :span="4">
            <div class="square-container">
              <div class="square-preview" :style="{ width: sampleSize + 'px', height: sampleSize + 'px', backgroundColor: 'red' }"></div>
            </div>
          </el-col>
          <el-col :span="8">
            <el-input v-model="randomSeed" placeholder="Random seed"></el-input>
          </el-col>
        </el-row>
      </template>
      <template v-else>
        <el-button type="primary" @click="uploadImage">Upload image</el-button>
        <input ref="fileInput" type="file" @change="handleUpload" accept="image/*" style="display:none" />
      </template>
    </el-card>
  </div>
  <div class="canvas-container" v-loading="isLoading">
    <canvas ref="visibleCanvas" @mousemove="handleMouseMove" @mouseleave="handleMouseLeave" @click="handleCanvasClick"></canvas>
  </div>
  <el-collapse>
    <el-collapse-item title="Samples" name="1">
      <el-table :data="squares" style="width:100%">
        <el-table-column prop="id" label="ID" width="80"></el-table-column>
        <el-table-column label="Number" width="120">
          <template #default="scope">
            <el-input v-model.number="scope.row.num" type="number"></el-input>
          </template>
        </el-table-column>
        <el-table-column label="Result" width="120">
          <template #default="scope">
            <span>{{ scope.row.result?.toFixed(4) || '-' }}</span>
          </template>
        </el-table-column>
        <el-table-column label="Actions" width="100">
          <template #default="scope">
            <el-button size="mini" type="danger" @click="removeSquare(scope.row.id)">Remove</el-button>
          </template>
        </el-table-column>
      </el-table>
    </el-collapse-item>
  </el-collapse>

  <div class="regression-control" style="padding-top: 10px;">
    <el-card>
      <el-row :gutter="20">
        <el-col :span="8">
          <el-input v-model="formula" placeholder="Formula (e.g. R/G)"></el-input>
        </el-col>
        <el-col :span="4">
          <el-select v-model="plotType" placeholder="Chart type">
            <el-option label="Scatter" value="scatter" />
            <el-option label="Bar" value="bar" />
          </el-select>
        </el-col>
        <el-col :span="4">
          <el-select v-model="weightMethod" placeholder="Weighting" :disabled="plotType === 'bar'">
            <el-option label="None" value="none" />
            <el-option label="Direct" value="direct" />
            <el-option label="Instrument" value="instrument" />
          </el-select>
        </el-col>
        <el-col :span="4">
          <el-button type="primary" @click="calculateFormula">Calculate</el-button>
        </el-col>
      </el-row>
    </el-card>
  </div>

  <div class="chart-container" style="padding-top: 20px;">
    <el-card>
      <div id="plotlyChart" class="chart"></div>
    </el-card>
  </div>
</template>

<script lang="ts">
import { defineComponent, ref, watch, onUnmounted, onMounted } from 'vue';
import seedrandom from 'seedrandom';
// @ts-ignore
import Plotly from 'plotly.js-dist-min';

export default defineComponent({
  name: 'ImageRegression',
  props: {
    fullRes: {
      type: String,
      default: ''
    }
  },
  setup(props) {
    const visibleCanvas = ref<HTMLCanvasElement | null>(null);
    let offscreenCanvas: HTMLCanvasElement | null = null;
    const sampleSize = ref<number>(20);
    const randomSeed = ref<number>();
    const uploadedImg = ref<string>('');
    const fileInput = ref<HTMLInputElement | null>(null);
    const squares = ref<{ 
      id: number, 
      x: number, 
      y: number, 
      size: number, 
      num?: number,
      result?: number,
      stdDev?: number
    }[]>([]);
    const squareIdCounter = ref<number>(1);
    const currentImg = ref<HTMLImageElement | null>(null);
    const scale = ref<number>(1);
    const previewX = ref<number | null>(null);
    const previewY = ref<number | null>(null);
    const isLoading = ref<boolean>(true);
    const formula = ref<string>('');
    const plotData = ref<any[]>([]);
    const weightMethod = ref<'none' | 'direct' | 'instrument'>('none');
    const plotType = ref<'scatter' | 'bar'>('scatter');

    watch(() => props.fullRes, async (newVal) => {
      if (newVal && newVal !== 'data:,') {
        console.log('Received new image:', newVal);
        // Clear previously attached blob URL if any
        if (uploadedImg.value && uploadedImg.value.startsWith('blob:')) {
          URL.revokeObjectURL(uploadedImg.value);
        }
        uploadedImg.value = newVal;
        await processFullRes();
      }
    }, { immediate: true });

    async function processFullRes() {
      const src = uploadedImg.value;
      if (!src) return;
      
      console.log('Processing image:', src);
      isLoading.value = true;
      
      try {
        const img = new Image();
        img.crossOrigin = 'anonymous'; // allow cross-origin images
        await new Promise<void>((resolve, reject) => {
          img.onload = () => resolve();
          img.onerror = reject;
          img.src = src;
        });
        currentImg.value = img;
        
        if (visibleCanvas.value && currentImg.value) {
          scale.value = currentImg.value.height > 240 ? 240 / currentImg.value.height : 1;
          const scaledWidth = currentImg.value.width * scale.value;
          const scaledHeight = currentImg.value.height * scale.value;
          visibleCanvas.value.width = scaledWidth;
          visibleCanvas.value.height = scaledHeight;
          
          if (!offscreenCanvas) {
            offscreenCanvas = document.createElement('canvas');
          }
          offscreenCanvas.width = currentImg.value.width;
          offscreenCanvas.height = currentImg.value.height;
          const offCtx = offscreenCanvas.getContext('2d');
          if (offCtx) {
            offCtx.clearRect(0, 0, offscreenCanvas.width, offscreenCanvas.height);
            offCtx.drawImage(currentImg.value, 0, 0, currentImg.value.width, currentImg.value.height);
          }
        }
        
        redrawCanvas();
      } catch (error) {
        console.error('Error processing image:', error);
      } finally {
        isLoading.value = false;
      }
    }

    function redrawCanvas() {
      if (!visibleCanvas.value || !currentImg.value) return;
      const ctx = visibleCanvas.value.getContext('2d');
      if (!ctx) return;
      ctx.clearRect(0, 0, visibleCanvas.value.width, visibleCanvas.value.height);
      ctx.drawImage(currentImg.value, 0, 0, visibleCanvas.value.width, visibleCanvas.value.height);
      squares.value.forEach(square => {
        ctx.strokeStyle = 'blue';
        ctx.lineWidth = 2;
        const half = square.size / 2;
        ctx.strokeRect(square.x - half, square.y - half, square.size, square.size);
      });
      if (previewX.value !== null && previewY.value !== null) {
        ctx.strokeStyle = 'green';
        ctx.lineWidth = 2;
        const half = sampleSize.value / 2;
        ctx.strokeRect(previewX.value - half, previewY.value - half, sampleSize.value, sampleSize.value);
      }
    }

    function handleMouseMove(e: MouseEvent) {
      if (!visibleCanvas.value) return;
      const rect = visibleCanvas.value.getBoundingClientRect();
      previewX.value = e.clientX - rect.left;
      previewY.value = e.clientY - rect.top;
      redrawCanvas();
    }

    function handleMouseLeave() {
      previewX.value = null;
      previewY.value = null;
      redrawCanvas();
    }

    function handleCanvasClick() {
      if (previewX.value === null || previewY.value === null) return;
      squares.value.push({ 
        id: squareIdCounter.value++, 
        x: previewX.value, 
        y: previewY.value, 
        size: sampleSize.value,
        num: 0,
        result: undefined
      });
      redrawCanvas();
    }

    function removeSquare(id: number) {
      squares.value = squares.value.filter(s => s.id !== id);
      redrawCanvas();
    }
    
    function handleUpload(e: Event) {
      const target = e.target as HTMLInputElement;
      if (target.files && target.files[0]) {
        const file = target.files[0];
        const reader = new FileReader();
        reader.onload = (evt) => {
          uploadedImg.value = evt.target?.result as string;
          processFullRes();
        };
        reader.readAsDataURL(file);
      }
    }
    
    function uploadImage() {
      fileInput.value?.click();
    }

    function calculateFormula() {
      if (!offscreenCanvas || !currentImg.value) return;
      const ctx = offscreenCanvas.getContext('2d');
      if (!ctx) return;
      
      const seed = randomSeed.value || 42;
      const random = seedrandom(seed.toString());
      
      squares.value = squares.value.map(square => {
        const half = square.size / 2;
        const results: number[] = [];
        
        for (let i = 0; i < 10; i++) {
          const fullX = ((square.x - half) / scale.value) + random() * (square.size / scale.value);
          const fullY = ((square.y - half) / scale.value) + random() * (square.size / scale.value);
          
          const pixel = ctx.getImageData(Math.floor(fullX), Math.floor(fullY), 1, 1).data;
          const R = pixel[0] / 255;
          const G = pixel[1] / 255;
          const B = pixel[2] / 255;
          
          try {
            const calculate = new Function('R', 'G', 'B', `return ${formula.value}`);
            const result = calculate(R, G, B);
            if (!isFinite(result)) {
              continue;
            }
            results.push(result);
          } catch (error) {
            console.error('Failed to evaluate formula:', error)
          }
        }
        
        const mean = results.length > 0 ? results.reduce((a, b) => a + b) / results.length : undefined;
        const stdDev = results.length > 0 ? Math.sqrt(results.reduce((acc, val) => acc + Math.pow(val - mean!, 2), 0) / results.length) : undefined;
        
        return {
          ...square,
          result: mean,
          stdDev: stdDev
        };
      });
      
      updateChart();
    }

    function calculateRegression(data: number[][], weights?: number[]) {
      const n = data.length;
      if (n < 2) return null;

      let sumW = 0;
      let sumX = 0;
      let sumY = 0;
      let sumXY = 0;
      let sumXX = 0;

      for (let i = 0; i < n; i++) {
        const w = weights ? weights[i] : 1;
        const [x, y] = data[i];
        
        sumW += w;
        sumX += w * x;
        sumY += w * y;
        sumXY += w * x * y;
        sumXX += w * x * x;
      }

      const slope = (sumW * sumXY - sumX * sumY) / (sumW * sumXX - sumX * sumX);
      const intercept = (sumY - slope * sumX) / sumW;

      // Compute goodness of fit R^2
      let SSres = 0;  // residual sum of squares
      let SStot = 0;  // total sum of squares
      const yMean = sumY / sumW;

      for (let i = 0; i < n; i++) {
        const w = weights ? weights[i] : 1;
        const [x, y] = data[i];
        const yFit = slope * x + intercept;
        SSres += w * Math.pow(y - yFit, 2);
        SStot += w * Math.pow(y - yMean, 2);
      }

      const rSquared = 1 - SSres / SStot;

      return { slope, intercept, rSquared };
    }

    function updateChart() {
      const validData = squares.value
        .filter(square => 
          square.num !== undefined && 
          square.result !== undefined && 
          !isNaN(Number(square.num)) && 
          !isNaN(Number(square.result))
        );

      const x = validData.map(d => Number(d.num));
      const y = validData.map(d => Number(d.result));
      const error_y = validData.map(d => Number(d.stdDev) || 0);

      let traces = [];
      
      if (plotType.value === 'scatter') {
        // Scatter plot config
        const scatterTrace = {
          x: x,
          y: y,
          error_y: {
            type: 'data',
            array: error_y,
            visible: true,
            color: '#409EFF'
          },
          mode: 'markers',
          type: 'scatter',
          name: 'Data points',
          marker: {
            color: '#409EFF',
            size: 10
          }
        };
        traces.push(scatterTrace);

        // Calculate weights and regression line
        let weights: number[] | undefined;
        switch (weightMethod.value) {
          case 'direct':
            weights = error_y.map(sigma => sigma > 0 ? 1 / sigma : 1);
            break;
          case 'instrument':
            weights = error_y.map(sigma => sigma > 0 ? 1 / (sigma * sigma) : 1);
            break;
          default:
            weights = undefined;
        }

        const regression = calculateRegression(x.map((x, i) => [x, y[i]]), weights);
        if (regression && x.length >= 2) {
          const xMin = Math.min(...x);
          const xMax = Math.max(...x);
          traces.push({
            x: [xMin, xMax],
            y: [
              regression.slope * xMin + regression.intercept,
              regression.slope * xMax + regression.intercept
            ],
            mode: 'lines',
            type: 'scatter',
            name: `Regression (R^2 = ${regression.rSquared.toFixed(4)})`,
            line: { color: '#F56C6C', width: 2 }
          });
        }
      } else {
        // Bar chart config
        traces.push({
          x: x,
          y: y,
          type: 'bar',
          name: 'Values',
          error_y: {
            type: 'data',
            array: error_y,
            visible: true,
            color: '#409EFF'
          },
          marker: {
            color: '#409EFF'
          }
        });
      }

      const layout = {
        title: plotType.value === 'scatter' ? 'Linear regression' : 'Data distribution',
        xaxis: { title: 'Number' },
        yaxis: { title: 'Result' },
        showlegend: true,
        hovermode: 'closest',
        barmode: 'relative'
      };

      Plotly.newPlot('plotlyChart', traces, layout);
    }

    onMounted(() => {
      Plotly.newPlot('plotlyChart', [], {});
    });

    onUnmounted(() => {
      isLoading.value = true;
      if (uploadedImg.value && uploadedImg.value.startsWith('blob:')) {
        URL.revokeObjectURL(uploadedImg.value);
      }
      Plotly.purge('plotlyChart');
    });

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
      plotType
    };
  }
});
</script>

<style scoped>
.control-panel {
  width: 100%;
  padding-bottom: 10px;
}
.square-container {
  position: relative;
  height: 50px;
}
.square-preview {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
}
.canvas-container {
  width: 70vw;
  max-height: 500px;
  overflow-x: auto;
  overflow-y: auto;
  border: 1px dashed #ccc;
  margin: 0 auto 20px;
}
canvas {
  display: block;
  min-height: 300;
}
.chart-container {
  width: 100%;
}
.chart {
  height: 400px;
  width: 100%;
}
</style>
