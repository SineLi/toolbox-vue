<template>
  <div class="image-merge">
    <el-card class="controls-container" shadow="hover">
      <el-row :gutter="24">
        <el-col :span="9" style="margin-bottom: 20px;">
          <div style="display: flex; align-items: center;">
            <span class="form-span">Spacing&nbsp;</span>
            <el-slider class="slider" v-model="localSpacing" />
          </div>
        </el-col>
        <el-col :span="9" style="margin-bottom: 20px;">
          <div style="display: flex; align-items: center;">
            <span class="form-span">Frame size&nbsp;</span>
            <el-slider class="slider" v-model="localFrameWidth" />
          </div>
        </el-col>
        <el-col :span="6" style="margin-bottom: 20px;">
          <div style="display: flex; align-items: center;">
            <span class="form-span">Background&nbsp;</span>
            <el-color-picker v-model="localBackgroundColor" />
          </div>
        </el-col>

        <el-col :span="9" style="margin-bottom: 20px;">
          <div style="display: flex; align-items: center;">
            <span class="form-span">Font size&nbsp;</span>
            <el-input-number v-model="localFontSize" :min="10" style="width: 100%;" />
          </div>
        </el-col>
        <el-col :span="9" style="margin-bottom: 20px;">
          <div style="display: flex; align-items: center">
            <span class="form-span">Font family&nbsp;</span>
            <el-select v-model="localFontFamily" placeholder="Select font">
              <el-option label="Arial" value="Arial"></el-option>
              <el-option label="Times New Roman" value="Times New Roman"></el-option>
              <el-option label="sans-serif" value="sans-serif"></el-option>
            </el-select>
          </div>
        </el-col>
        <el-col :span="6" style="margin-bottom: 20px;">
          <div style="display: flex; align-items: center">
            <span class="form-span">Font color&nbsp;</span>
            <el-color-picker v-model="localFontColor" />
          </div>
        </el-col>
        <el-col :span="12" style="margin-bottom: 20px;">
          <el-button type="primary" @click="drawCompositeImage">Regenerate</el-button>
        </el-col>
        <el-col :span="12" style="margin-bottom: 20px;">
          <el-button type="success" @click="downloadCompositeImage">Download PNG</el-button>
        </el-col>
      </el-row>
    </el-card>

    <div class="canvas-container">
      <canvas ref="canvas" class="composite-canvas"></canvas>
    </div>

    <el-card class="controls-container list-card" style="margin-top: 20px;" shadow="hover">
      <el-table :data="orderedImages" style="width: 100%;" class="dataTable">
        <el-table-column width="40">
          <template #default>
            <el-icon class="drag-handle" style="cursor: move;">
              <svg viewBox="0 0 24 24" width="1em" height="1em">
                <path
                  fill="currentColor"
                  d="M9,3H11V5H9V3M13,3H15V5H13V3M9,7H11V9H9V7M13,7H15V9H13V7M9,11H11V13H9V11M13,11H15V13H13V11M9,15H11V17H9V15M13,15H15V17H13V15M9,19H11V21H9V19M13,19H15V21H13V19Z"
                />
              </svg>
            </el-icon>
          </template>
        </el-table-column>
        <el-table-column prop="fileName" label="File name"></el-table-column>
        <el-table-column label="Caption">
          <template #default="scope">
            <el-input
              size="small"
              v-model="orderedImages[scope.$index].text"
              placeholder="Enter caption"
              @keyup.enter="focusNextInput(scope.$index)"
              :ref="(el) => setInputRef(el, scope.$index)"
            />
          </template>
        </el-table-column>
      </el-table>
    </el-card>
  </div>
</template>

<script lang="ts">
import { defineComponent, ref, watch, onMounted, nextTick, onUnmounted, type PropType } from 'vue'
import Sortable from 'sortablejs'

interface ImageData {
  url: string
  fileName: string
  text?: string
}

export default defineComponent({
  name: 'ImageComposer',
  props: {
    images: {
      type: Array as PropType<ImageData[]>,
      default: () => [],
    },
  },
  emits: ['updateCanvases'],
  setup(props, { emit }) {
    const canvas = ref<HTMLCanvasElement | null>(null)
    const fullResCanvas = ref<HTMLCanvasElement | null>(null)
    const localSpacing = ref(10)
    const localFrameWidth = ref(50)
    const localBackgroundColor = ref('#000000')
    const localFontSize = ref(16)
    const localFontFamily = ref('sans-serif')
    const localFontColor = ref('#fff')

    const orderedImages = ref<ImageData[]>([...props.images])
    const scaledImgsCache = ref<{ img: HTMLImageElement; width: number; height: number }[]>([])

    watch(
      () => props.images,
      (newVal) => {
        orderedImages.value = [...newVal]
        scaledImgsCache.value = []
        drawCompositeImage()
      },
    )

    watch(
      orderedImages,
      () => {
        drawCompositeImage()
      },
      { deep: true },
    )

    async function loadImages(urls: string[]): Promise<HTMLImageElement[]> {
      return Promise.all(
        urls.map(
          (url) =>
            new Promise<HTMLImageElement>((resolve, reject) => {
              const img = new Image()
              img.onload = () => resolve(img)
              img.onerror = (err) => reject(err)
              img.src = url
            }),
        ),
      )
    }

    async function updateScaledCache() {
      const displayHeight = 150
      const urls = orderedImages.value.map((item) => item.url)
      const imgs = await loadImages(urls)
      const scaledImgs = imgs.map((img) => {
        const scale = displayHeight / img.height
        return {
          img,
          width: img.width * scale,
          height: displayHeight,
        }
      })
      scaledImgsCache.value = scaledImgs
    }

    async function drawCompositeImage() {
      if (!canvas.value) return
      if (!orderedImages.value.length) {
        const ctx = canvas.value.getContext('2d')
        if (ctx) {
          ctx.clearRect(0, 0, canvas.value.width, canvas.value.height)
        }
        return
      }
      try {
        if (scaledImgsCache.value.length === 0) {
          await updateScaledCache()
        }
        const scaledImgs = scaledImgsCache.value
        const spacing = localSpacing.value
        const frameWidth = localFrameWidth.value * 0.2
        const captionHeight = 30
        const totalWidth =
          scaledImgs.reduce((sum, obj, index) => sum + obj.width + (index > 0 ? spacing : 0), 0) +
          2 * frameWidth
        const canvasHeight = 150 + 2 * frameWidth + captionHeight
        const ctx = canvas.value.getContext('2d')
        if (!ctx) return
        canvas.value.width = totalWidth
        canvas.value.height = canvasHeight
        ctx.fillStyle = localBackgroundColor.value
        ctx.fillRect(0, 0, totalWidth, canvasHeight)
        let currentX = 0
        for (let i = 0; i < scaledImgs.length; i++) {
          const { img, width, height } = scaledImgs[i]
          ctx.drawImage(img, currentX + frameWidth, frameWidth, width, height)
          const caption = orderedImages.value[i].text || ''
          if (caption) {
            ctx.font = `${localFontSize.value}px ${localFontFamily.value}`
            ctx.textAlign = 'center'
            ctx.fillStyle = localFontColor.value
            ctx.fillText(caption, currentX + frameWidth + width / 2, frameWidth + height + captionHeight / 1.5)
          }
          currentX += width + spacing
        }
        const fullCanvas = await generateFullResCanvas()
        if (fullCanvas) {
          const blob = await new Promise<Blob>((resolve, reject) => {
            fullCanvas.toBlob((b) => {
              if (b) resolve(b)
              else reject(new Error('Failed to create blob'))
            }, 'image/png', 1.0)
          })

          if (fullResCanvas.value && (fullResCanvas.value as any).objectUrl) {
            URL.revokeObjectURL((fullResCanvas.value as any).objectUrl)
          }

          const objectUrl = URL.createObjectURL(blob)
          fullResCanvas.value = fullCanvas
          ;(fullCanvas as any).objectUrl = objectUrl
          emit('updateCanvases', { fullRes: objectUrl })
        }
      } catch (error) {
        console.error('Failed to render preview canvas', error)
      }
    }

    async function generateFullResCanvas(): Promise<HTMLCanvasElement | null> {
      if (!orderedImages.value.length) return null
      try {
        const urls = orderedImages.value.map((item) => item.url)
        const imgs = await loadImages(urls)
        const maxOriginalHeight = Math.max(...imgs.map((img) => img.height))
        const downloadScale = maxOriginalHeight / 150
        const spacingDownload = localSpacing.value * downloadScale
        const frameWidthDownload = localFrameWidth.value * 0.2 * downloadScale
        const captionHeightDownload = 30 * downloadScale
        const totalWidth =
          imgs.reduce((sum, img, index) => sum + img.width + (index > 0 ? spacingDownload : 0), 0) +
          2 * frameWidthDownload
        const canvasEl = document.createElement('canvas')
        canvasEl.width = totalWidth
        canvasEl.height = maxOriginalHeight + 2 * frameWidthDownload + captionHeightDownload
        const ctx = canvasEl.getContext('2d')
        if (!ctx) return null
        ctx.fillStyle = localBackgroundColor.value
        ctx.fillRect(0, 0, totalWidth, canvasEl.height)
        let currentX = 0
        for (let i = 0; i < imgs.length; i++) {
          const img = imgs[i]
          ctx.drawImage(img, currentX + frameWidthDownload, frameWidthDownload)
          const caption = orderedImages.value[i].text || ''
          if (caption) {
            ctx.font = `${localFontSize.value * downloadScale}px ${localFontFamily.value}`
            ctx.textAlign = 'center'
            ctx.fillStyle = localFontColor.value
            ctx.fillText(
              caption,
              currentX + frameWidthDownload + img.width / 2,
              frameWidthDownload + img.height + captionHeightDownload / 1.5,
            )
          }
          currentX += img.width + spacingDownload
        }
        return canvasEl
      } catch (error) {
        console.error('Failed to generate full resolution canvas', error)
        return null
      }
    }

    async function downloadCompositeImage() {
      try {
        const fullCanvas = await generateFullResCanvas()
        if (!fullCanvas) return
        fullCanvas.toBlob((blob) => {
          if (blob) {
            const link = document.createElement('a')
            link.href = URL.createObjectURL(blob)
            link.download = 'composite_image.png'
            link.click()
          }
        })
      } catch (error) {
        console.error('Failed to download image', error)
      }
    }

    function initSortable() {
      const tbody = document.querySelector('.dataTable .el-table__body-wrapper tbody')
      if (!tbody) return

      const sortable = new Sortable(tbody, {
        animation: 150,
        handle: '.drag-handle',
        onEnd: async ({ oldIndex, newIndex }) => {
          if (oldIndex === undefined || newIndex === undefined) return

          const newOrderedImages = [...orderedImages.value]
          const [movedItem] = newOrderedImages.splice(oldIndex, 1)
          newOrderedImages.splice(newIndex, 0, movedItem)

          if (scaledImgsCache.value.length === orderedImages.value.length) {
            const cacheArr = [...scaledImgsCache.value]
            const [movedCache] = cacheArr.splice(oldIndex, 1)
            cacheArr.splice(newIndex, 0, movedCache)
            scaledImgsCache.value = cacheArr
          }

          orderedImages.value = []
          await nextTick()
          orderedImages.value = newOrderedImages
          drawCompositeImage()
        },
      })

      return sortable
    }

    onMounted(() => {
      drawCompositeImage()
      nextTick(() => {
        initSortable()
      })
    })

    onUnmounted(() => {
      if (fullResCanvas.value && (fullResCanvas.value as any).objectUrl) {
        URL.revokeObjectURL((fullResCanvas.value as any).objectUrl)
      }
    })

    const inputRefs = ref<(HTMLElement | null)[]>([])
    function setInputRef(el: any, index: number) {
      inputRefs.value[index] = el ? el.$el.querySelector('input') : null
    }
    function focusNextInput(index: number) {
      const next = index + 1
      nextTick(() => {
        if (inputRefs.value[next]) {
          ;(inputRefs.value[next] as HTMLElement).focus()
          ;(inputRefs.value[next] as HTMLInputElement).select()
        }
      })
    }

    return {
      canvas,
      localSpacing,
      localFrameWidth,
      localBackgroundColor,
      localFontSize,
      localFontFamily,
      localFontColor,
      drawCompositeImage,
      orderedImages,
      setInputRef,
      focusNextInput,
      downloadCompositeImage,
      initSortable,
    }
  },
})
</script>

<style scoped>
.image-merge {
  width: 100%;
}

.slider {
  width: 100%;
}
.form-span {
  flex: 0 0 auto;
}
.controls-container {
  padding: 15px;
  border: 1px solid #ccc;
  border-radius: 4px;
  margin-bottom: 20px;
}
.canvas-container {
  width: 100%;
  max-height: 500px;
  overflow-x: auto;
  overflow-y: auto;
  border: 1px dashed #ccc;
  margin: 0 auto 20px;
}
.drag-handle {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  color: #909399;
}

.sortable-ghost {
  opacity: 0.5;
  background: #c8ebfb;
}

.sortable-chosen {
  background: #e6f1f9;
}
</style>
