<template>
  <div class="match-crop">
    <div class="panel-grid">
      <var-card class="panel-card template-card" title="Template image">
        <var-uploader accept="image/*" :multiple="false" @after-read="handleTemplateAfterRead" :readonly="false" :deletable="false">
          <var-button type="primary" block>Upload template</var-button>
        </var-uploader>
        <div v-if="templateDataUrl" class="preview">
          <img :src="templateDataUrl" alt="Template preview" class="template-img" />
        </div>
      </var-card>

      <var-card class="panel-card process-card" title="Images to process">
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
          <div class="progress-wrap" v-if="imageTasks.length">
            <div class="progress-label">Processed {{ processedCount }}/{{ imageTasks.length }}</div>
            <var-progress :value="progress" track-color="#e5e7eb" />
          </div>
        </div>

        <var-list class="tasks-list">
          <template v-if="imageTasks.length">
            <var-cell v-for="task in imageTasks" :key="task.id" class="task-row" border>
              <div class="task-row__content">
                <div class="task-text">
                  <div class="task-title" :title="task.file.name">{{ task.file.name }}</div>
                  <div class="task-meta">#{{ task.id + 1 }} · {{ formatSize(task.file.size) }}</div>
                  <div class="task-status" v-if="task.processing">Processing...</div>
                  <div class="task-status task-status--error" v-else-if="!task.showCroppedURL">Failed</div>
                </div>
                <div class="task-preview">
                  <img v-if="task.showCroppedURL" :src="task.showCroppedURL" alt="Cropped" />
                  <div v-else class="task-preview__placeholder">
                    <span>{{ task.processing ? 'Processing' : 'No preview' }}</span>
                  </div>
                </div>
                <div class="task-actions">
                  <var-button type="danger" size="small" text @click="removeTask(task.id)">Delete</var-button>
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
  emits: ['imageProcessed', 'processingStart', 'processingFinished', 'tasksUpdated'],
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

    const emitTasksUpdated = () => {
      emit('tasksUpdated', imageTasks)
    }

    const removeTask = (taskId: number) => {
      const idx = imageTasks.findIndex((task) => task.id === taskId)
      if (idx === -1) return
      imageTasks.splice(idx, 1)
      emitTasksUpdated()
      emit('imageProcessed', imageTasks)
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
    const processedCount = computed(() => imageTasks.filter((task) => !task.processing).length)

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
      removeTask,
      progress,
      processedCount,
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
  gap: 18px;
  grid-template-columns: minmax(240px, 340px) minmax(480px, 1fr);
  align-items: start;
}

.panel-card {
  height: 100%;
  --card-border-radius: 20px;
}

.card-title {
  display: inline-flex;
  align-items: center;
  gap: 6px;
}

.card-eyebrow {
  font-size: 11px;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--color-on-surface-variant, #6b7280);
  padding: 2px 8px;
  border-radius: 999px;
  background: color-mix(in srgb, currentColor 10%, transparent);
}

.card-heading {
  font-weight: 700;
  font-size: 16px;
  /* padding: 10x; */
  margin-top: 16px;
  margin-left: 18px;
}

.template-card .var-card__content,
.process-card .var-card__content {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.tasks-list :deep(.var-cell__content) {
  width: 100%;
}

.tasks-list {
  max-height: 520px;
  overflow-y: auto;
  padding-right: 4px;
}

.preview {
  margin-top: 12px;
  text-align: center;
}

.template-img {
  max-width: 260px;
  max-height: 160px;
  object-fit: contain;
  border: 1px solid #eee;
  border-radius: 8px;
  margin: 0 auto;
}

.actions {
  display: flex;
  gap: 12px;
  align-items: flex-start;
  flex-wrap: wrap;
  justify-content: space-between;
}

.progress-wrap {
  flex: 1;
  min-width: 220px;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.progress-label {
  font-size: 13px;
  color: var(--color-on-surface-variant, #4b5563);
}

.task-row {
  align-items: stretch;
}

.task-row__content {
  display: grid;
  grid-template-columns: 1fr 230px auto;
  gap: 12px;
  align-items: center;
}

.task-text {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.task-title {
  font-weight: 600;
  word-break: break-word;
}

.task-meta {
  color: #6b7280;
  font-size: 12px;
}

.task-status {
  font-size: 13px;
  color: var(--color-primary, #2563eb);
}

.task-status--error {
  color: var(--color-danger, #f43f5e);
}

.task-preview {
  display: flex;
  justify-content: flex-end;
}

.task-preview img {
  width: 100%;
  max-height: 160px;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  object-fit: contain;
  background: #f8fafc;
}

.task-preview__placeholder {
  min-height: 120px;
  border: 1px dashed #e5e7eb;
  border-radius: 10px;
  display: grid;
  place-items: center;
  color: #9ca3af;
  font-size: 13px;
}

.task-actions {
  display: flex;
  justify-content: flex-end;
}

.empty {
  padding: 24px;
  text-align: center;
  color: #6b7280;
}

@media (max-width: 960px) {
  .panel-grid {
    grid-template-columns: 1fr;
  }

  .task-row__content {
    grid-template-columns: 1fr;
  }
}
</style>


