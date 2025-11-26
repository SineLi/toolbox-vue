<template>
  <div class="match-crop">
    <div class="container">
      <el-row :gutter="24">
        <el-col :span="6">
          <el-card shadow="hover">
            <template #header>
              <span>Template image</span>
            </template>
            <el-upload
              class="upload-template"
              accept="image/*"
              :show-file-list="false"
              :before-upload="handleTemplateBeforeUpload"
            >
              <el-button type="primary" block>Upload template</el-button>
            </el-upload>
            <div v-if="templateDataUrl" class="preview">
              <img :src="templateDataUrl" alt="Template preview" class="template-img" />
            </div>
          </el-card>
        </el-col>

        <el-col :span="18">
          <el-card shadow="hover">
            <template #header>
              <span>Images to process</span>
            </template>
            <el-table :data="imageTasks" style="width: 100%; height: 70vh">
              <el-table-column prop="file.name" label="File name" width="140" />
              <el-table-column label="Original" width="260">
                <template #default="scope">
                  <img :src="scope.row.originalDataUrl" alt="Original image" class="list-img" />
                </template>
              </el-table-column>
              <el-table-column label="Result">
                <template #default="scope">
                  <div v-if="scope.row.processing" class="spinner-container">
                    <div class="spinner"></div>
                  </div>
                  <div v-else>
                    <img
                      v-if="scope.row.showCroppedURL"
                      :src="scope.row.showCroppedURL"
                      alt="Processed result"
                      class="list-img"
                    />
                    <span v-else>Failed</span>
                  </div>
                </template>
              </el-table-column>
            </el-table>
            <div class="footer-row">
              <el-progress :percentage="progress" status="active" class="progress"></el-progress>
              <el-upload
                class="upload-images"
                accept="image/*"
                multiple
                :show-file-list="false"
                :before-upload="handleImagesBeforeUpload"
              >
                <el-button type="primary">Upload images</el-button>
              </el-upload>
            </div>
          </el-card>
        </el-col>
      </el-row>
    </div>
  </div>
</template>

<script lang="ts">
import { defineComponent, ref, reactive, computed, watch } from 'vue'
import { ElMessage } from 'element-plus'
import cv, { Mat } from '@techstark/opencv-js'

interface ImageTask {
  id: number
  file: File
  originalDataUrl: string
  showCroppedURL: string | null
  processedDataUrl: string | null
  processing: boolean
}

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
    let pendingImages = 0

    const handleTemplateBeforeUpload = (file: File) => {
      const reader = new FileReader()
      reader.onload = (e) => {
        templateDataUrl.value = e.target?.result as string
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
        }
        img.src = templateDataUrl.value!
      }
      reader.readAsDataURL(file)
      return false
    }

    const handleImagesBeforeUpload = (file: File) => {
      pendingImages++
      const reader = new FileReader()
      reader.onload = (e) => {
        const originalDataUrl = e.target?.result as string
        const img = new Image()
        img.onload = () => {
          const task: ImageTask = {
            id: taskIdCounter++,
            file,
            originalDataUrl,
            showCroppedURL: null,
            processedDataUrl: null,
            processing: true,
          }
          imageTasks.push(task)
          pendingImages--
          if (pendingImages === 0) {
            processQueue()
          }
        }
        img.onerror = () => {
          const task: ImageTask = {
            id: taskIdCounter++,
            file,
            originalDataUrl,
            showCroppedURL: null,
            processedDataUrl: null,
            processing: false,
          }
          imageTasks.push(task)
          pendingImages--
          if (pendingImages === 0) {
            processQueue()
          }
          ElMessage.error('Failed to load image')
        }
        img.src = originalDataUrl
      }
      reader.readAsDataURL(file)
      return false
    }

    function processSingleImage(task: ImageTask): Promise<void> {
      return new Promise((resolve) => {
        if (!templateCannyMat) {
          ElMessage.error('Please upload a template image first')
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
            const mm = cv.minMaxLoc(result)
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
              const mmRot = cv.minMaxLoc(resultRot)
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
        ElMessage({
          message: 'All images processed',
          type: 'success',
        })
      }
    })

    return {
      templateDataUrl,
      imageTasks,
      handleTemplateBeforeUpload,
      handleImagesBeforeUpload,
      progress,
    }
  },
})
</script>

<style scoped>
.match-crop {
  width: 100%;
}

.container {
  padding: 15px;
}

.preview {
  margin-top: 10px;
  text-align: center;
}

.template-img {
  max-width: 300px;
  max-height: 150px;
  object-fit: contain;
  border: 1px solid #eee;
}

.list-img {
  max-height: 150px;
  object-fit: contain;
  border: 1px solid #eee;
}

.spinner-container {
  display: flex;
  justify-content: center;
  align-items: center;
  height: 100px;
}

.spinner {
  border: 4px solid #f3f3f3;
  border-top: 4px solid #409eff;
  border-radius: 50%;
  width: 30px;
  height: 30px;
  animation: spin 1s linear infinite;
}

@keyframes spin {
  0% {
    transform: rotate(0deg);
  }

  100% {
    transform: rotate(360deg);
  }
}

.footer-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-top: 10px;
}

.progress {
  flex: 1;
  margin-right: 10px;
}
</style>