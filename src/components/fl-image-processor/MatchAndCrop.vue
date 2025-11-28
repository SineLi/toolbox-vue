<template>
  <div class="match-crop">
    <div class="panel-grid">
      <var-card class="panel-card" title="Template image">
        <var-uploader accept="image/*" :multiple="false" @after-read="handleTemplateAfterRead" :readonly="false" :deletable="false">
          <var-button type="primary" block>Upload template</var-button>
        </var-uploader>
        <div v-if="templateDataUrl" class="preview">
          <img :src="templateDataUrl" alt="Template preview" class="template-img" />
        </div>
      </var-card>

      <var-card class="panel-card" title="Images to process">
        <div class="actions">
          <var-uploader
            accept="image/*"
            :multiple="true"
            @after-read="handleImagesAfterRead"
            :readonly="false"
            :deletable="false"
          >
            <var-button type="primary">Upload images</var-button>
          </var-uploader>
          <var-progress :value="progress" track-color="#e5e7eb" />
        </div>

        <var-list>
          <template v-if="imageTasks.length">
            <var-cell v-for="task in imageTasks" :key="task.id" class="task-row" border>
              <template #icon>
                <var-avatar color="#e5e7eb" text-color="#111" size="32">{{ task.id + 1 }}</var-avatar>
              </template>
              <div class="task-body">
                <div class="task-title" :title="task.file.name">{{ task.file.name }}</div>
                <div class="task-meta">{{ formatSize(task.file.size) }}</div>
                <div class="task-preview">
                  <img v-if="task.showCroppedURL" :src="task.showCroppedURL" alt="Cropped" />
                  <span v-else-if="task.processing">Processing…</span>
                  <span v-else>Failed</span>
                </div>
              </div>
            </var-cell>
          </template>
          <div v-else class="empty">Drop images to start processing.</div>
        </var-list>
      </var-card>
    </div>
  </div>
</template>

<script lang="ts">
import { defineComponent, ref, reactive, computed, watch } from 'vue'
import { Snackbar } from '@varlet/ui'
import cv, { Mat } from '@techstark/opencv-js'

interface ImageTask {
  id: number
  file: File
  originalDataUrl: string
  showCroppedURL: string | null
  processedDataUrl: string | null
  processing: boolean
}

type UploaderFile = { file?: File }

export default defineComponent({
  name: 'MatchAndCrop',
  emits: ['imageProcessed', 'processingStart', 'processingFinished'],
  setup(_, { emit }) {
    const templateDataUrl = ref<string | null>(null)
    let templateCannyMat: cv.Mat | null = null
    let templateWidth = 0
    let templateHeight = 0

    const imageTasks = reactive<ImageTask[]>([])
    let taskIdCounter = 0
    let isProcessingQueue = false

    const readAsDataURL = (file: File) =>
      new Promise<string>((resolve, reject) => {
        const reader = new FileReader()
        reader.onload = () => resolve(reader.result as string)
        reader.onerror = () => reject(new Error('read failed'))
        reader.readAsDataURL(file)
      })

    const handleTemplateAfterRead = async (payload: UploaderFile | UploaderFile[]) => {
      const entry = Array.isArray(payload) ? payload[0] : payload
      const file = entry?.file
      if (!file) return
      const dataUrl = await readAsDataURL(file)
      templateDataUrl.value = dataUrl
      await prepareTemplate(dataUrl)
    }

    const prepareTemplate = async (dataUrl: string) =>
      new Promise<void>((resolve) => {
        const img = new Image()
        img.onload = () => {
          const mat = cv.imread(img)
          const gray = new cv.Mat()
          cv.cvtColor(mat, gray, cv.COLOR_RGBA2GRAY, 0)
          const canny = new cv.Mat()
          cv.Canny(gray, canny, 64, 255)
          templateCannyMat = canny
          templateWidth = canny.cols
          templateHeight = canny.rows
          mat.delete()
          gray.delete()
          resolve()
        }
        img.onerror = () => {
          Snackbar.error('Failed to load template')
          resolve()
        }
        img.src = dataUrl
      })

    const handleImagesAfterRead = async (payload: UploaderFile | UploaderFile[]) => {
      const files = Array.isArray(payload) ? payload : [payload]
      for (const entry of files) {
        const file = entry?.file
        if (!file) continue
        const originalDataUrl = await readAsDataURL(file)
        await addTask(file, originalDataUrl)
      }
      if (imageTasks.some((task) => task.processing)) {
        processQueue()
      }
    }

    const addTask = async (file: File, originalDataUrl: string) =>
      new Promise<void>((resolve) => {
        const img = new Image()
        img.onload = () => {
          imageTasks.push({
            id: taskIdCounter++,
            file,
            originalDataUrl,
            showCroppedURL: null,
            processedDataUrl: null,
            processing: true,
          })
          resolve()
        }
        img.onerror = () => {
          imageTasks.push({
            id: taskIdCounter++,
            file,
            originalDataUrl,
            showCroppedURL: null,
            processedDataUrl: null,
            processing: false,
          })
          Snackbar.error('Image load failed')
          resolve()
        }
        img.src = originalDataUrl
      })

    function processSingleImage(task: ImageTask): Promise<void> {
      return new Promise((resolve) => {
        if (!templateCannyMat) {
          Snackbar.error('Please upload a template image first')
          task.processing = false
          resolve()
          return
        }

        const inputImage = new Image()
        inputImage.onload = () => {
          try {
            const inputMat = cv.imread(inputImage)
            const grayInput = new cv.Mat()
            cv.cvtColor(inputMat, grayInput, cv.COLOR_RGBA2GRAY, 0)
            const cannyInput = new cv.Mat()
            cv.Canny(grayInput, cannyInput, 64, 255)
            grayInput.delete()

            const result = new cv.Mat()
            const resultCols = cannyInput.cols - templateWidth + 1
            const resultRows = cannyInput.rows - templateHeight + 1
            result.create(resultRows, resultCols, cv.CV_32FC1)
            cv.matchTemplate(cannyInput, templateCannyMat as Mat, result, cv.TM_CCOEFF_NORMED)
            const mm = (cv as any).minMaxLoc(result)
            const maxLoc = mm.maxLoc
            result.delete()

            const margin = Math.floor(Math.max(templateWidth, templateHeight) * 0.2)
            const x1 = Math.max(maxLoc.x - margin, 0)
            const y1 = Math.max(maxLoc.y - margin, 0)
            const x2 = Math.min(maxLoc.x + templateWidth + margin, cannyInput.cols)
            const y2 = Math.min(maxLoc.y + templateHeight + margin, cannyInput.rows)
            const roiRect = new cv.Rect(x1, y1, x2 - x1, y2 - y1)
            const roi = cannyInput.roi(roiRect)

            const roiSmall = new cv.Mat()
            const templateSmall = new cv.Mat()
            cv.resize(roi, roiSmall, new cv.Size(0, 0), 0.25, 0.25, cv.INTER_AREA)
            cv.resize(templateCannyMat as Mat, templateSmall, new cv.Size(0, 0), 0.25, 0.25, cv.INTER_AREA)
            roi.delete()

            let bestAngle = 0
            let bestMaxVal = -Infinity
            let bestPt = { x: 0, y: 0 }
            for (let angle = -5; angle <= 5; angle += 0.1) {
              const rows = templateSmall.rows
              const cols = templateSmall.cols
              const center = new cv.Point(Math.floor(cols / 2), Math.floor(rows / 2))
              const M = cv.getRotationMatrix2D(center, angle, 1.0)
              const rotatedTpl = new cv.Mat()
              cv.warpAffine(templateSmall, rotatedTpl, M, new cv.Size(cols, rows), cv.INTER_LINEAR, cv.BORDER_CONSTANT, new cv.Scalar(0))
              const resultRot = new cv.Mat()
              const resultRotCols = roiSmall.cols - rotatedTpl.cols + 1
              const resultRotRows = roiSmall.rows - rotatedTpl.rows + 1
              resultRot.create(resultRotRows, resultRotCols, cv.CV_32FC1)
              cv.matchTemplate(roiSmall, rotatedTpl, resultRot, cv.TM_CCOEFF_NORMED)
              const mmRot = (cv as any).minMaxLoc(resultRot)
              if (mmRot.maxVal > bestMaxVal) {
                bestMaxVal = mmRot.maxVal
                bestAngle = angle
                bestPt = { x: mmRot.maxLoc.x, y: mmRot.maxLoc.y }
              }
              M.delete()
              rotatedTpl.delete()
              resultRot.delete()
            }
            roiSmall.delete()
            templateSmall.delete()

            const targetPt = {
              x: Math.floor(bestPt.x * 4 + x1),
              y: Math.floor(bestPt.y * 4 + y1),
            }

            const centerPoint = new cv.Point(targetPt.x, targetPt.y)
            const rotMat = cv.getRotationMatrix2D(centerPoint, -bestAngle, 1.0)
            const rotated = new cv.Mat()
            cv.warpAffine(
              inputMat,
              rotated,
              rotMat,
              new cv.Size(inputMat.cols, inputMat.rows),
              cv.INTER_LINEAR,
              cv.BORDER_CONSTANT,
              new cv.Scalar(),
            )
            const cropRect = new cv.Rect(targetPt.x, targetPt.y, templateWidth, templateHeight)
            const cropped = rotated.roi(cropRect)

            let displayMat = new cv.Mat()
            let dsize = new cv.Size(cropped.cols, cropped.rows)
            if (cropped.rows > 150) {
              const scale = 150 / cropped.rows
              dsize = new cv.Size(Math.round(cropped.cols * scale), 150)
              cv.resize(cropped, displayMat, dsize, 0, 0, cv.INTER_AREA)
            } else {
              displayMat = cropped.clone()
            }

            const previewCanvas = document.createElement('canvas')
            previewCanvas.width = displayMat.cols
            previewCanvas.height = displayMat.rows
            cv.imshow(previewCanvas, displayMat)
            const showCroppedUrl = previewCanvas.toDataURL()

            const cropImgCanvas = document.createElement('canvas')
            cropImgCanvas.width = cropped.cols
            cropImgCanvas.height = cropped.rows
            cv.imshow(cropImgCanvas, cropped)
            const processedDataUrl = cropImgCanvas.toDataURL()

            inputMat.delete()
            cannyInput.delete()
            rotated.delete()
            cropped.delete()
            displayMat.delete()
            rotMat.delete()

            task.showCroppedURL = showCroppedUrl
            task.processedDataUrl = processedDataUrl
            task.processing = false
          } catch (err) {
            console.error('Processing failed', err)
            task.processing = false
            task.showCroppedURL = null
            task.processedDataUrl = null
          }
          resolve()
        }
        inputImage.onerror = () => {
          task.processing = false
          task.showCroppedURL = null
          task.processedDataUrl = null
          resolve()
        }
        inputImage.src = URL.createObjectURL(task.file)
      })
    }

    async function processQueue() {
      if (isProcessingQueue) return
      isProcessingQueue = true
      emit('processingStart', imageTasks)
      for (const task of imageTasks) {
        if (task.processing) {
          await processSingleImage(task)
        }
      }
      isProcessingQueue = false
      emit('processingFinished', imageTasks)
      emit('imageProcessed', imageTasks)
    }

    const progress = computed(() => {
      if (imageTasks.length === 0) return 0
      const finished = imageTasks.filter((task) => !task.processing).length
      return Math.round((finished / imageTasks.length) * 100)
    })

    watch(progress, (newVal) => {
      if (newVal === 100 && imageTasks.length > 0) {
        Snackbar.success('All images processed')
      }
    })

    const formatSize = (size?: number) => {
      if (!size) return '0 B'
      const units = ['B', 'KB', 'MB', 'GB']
      let v = size
      let idx = 0
      while (v >= 1024 && idx < units.length - 1) {
        v /= 1024
        idx++
      }
      return `${v.toFixed(1)} ${units[idx]}`
    }

    return {
      templateDataUrl,
      imageTasks,
      handleTemplateAfterRead,
      handleImagesAfterRead,
      progress,
      formatSize,
    }
  },
})
</script>

<style scoped>
.match-crop {
  width: 100%;
}

.panel-grid {
  display: grid;
  gap: 16px;
  grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
}

.panel-card {
  height: 100%;
}

.preview {
  margin-top: 12px;
  text-align: center;
}

.template-img {
  max-width: 320px;
  max-height: 180px;
  object-fit: contain;
  border: 1px solid #eee;
  border-radius: 8px;
}

.actions {
  display: flex;
  gap: 12px;
  align-items: center;
  margin-bottom: 12px;
}

.task-row {
  align-items: flex-start;
}

.task-body {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.task-title {
  font-weight: 600;
}

.task-meta {
  color: #6b7280;
  font-size: 12px;
}

.task-preview img {
  max-height: 140px;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  object-fit: contain;
}

.empty {
  padding: 24px;
  text-align: center;
  color: #6b7280;
}
</style>
