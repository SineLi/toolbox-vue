<template>
  <div class="image-merge">
    <var-card class="controls-card" title="Layout settings">
      <div class="controls-grid">
        <div class="control-item">
          <span class="label">Spacing</span>
          <var-slider
            v-model="localSpacing"
            :min="0"
            :max="120"
            :step="1"
            track-color="#e5e7eb"
            @change=""
          />
        </div>
        <div class="control-item">
          <span class="label">Frame size</span>
          <var-slider
            v-model="localFrameWidth"
            :min="0"
            :max="120"
            :step="1"
            track-color="#e5e7eb"
            @change=""
          />
        </div>
        <div class="control-item">
          <span class="label">Background</span>
          <input class="color-input" type="color" v-model="localBackgroundColor" @change="drawCompositeImage" />
        </div>
        <div class="control-item">
          <span class="label">Font size</span>
          <var-input v-model="localFontSize" type="number" :min="10" @change="handleFontSizeChange" />
        </div>
        <div class="control-item">
          <span class="label">Font family</span>
          <var-select v-model="localFontFamily" :options="fontOptions" placeholder="Choose" @change="drawCompositeImage" />
        </div>
        <div class="control-item">
          <span class="label">Font color</span>
          <input class="color-input" type="color" v-model="localFontColor" @change="drawCompositeImage" />
        </div>
      </div>
      <div class="control-actions">
        <var-button type="primary" @click="drawCompositeImage">Regenerate</var-button>
        <var-button type="success" @click="downloadCompositeImage">Download PNG</var-button>
      </div>
    </var-card>

    <div class="canvas-container">
      <canvas ref="canvas" class="composite-canvas"></canvas>
    </div>

    <var-card class="controls-card" title="Order & captions">
      <div class="data-list" ref="sortableRef">
        <div class="data-row" v-for="(img, index) in orderedImages" :key="img.url">
          <span class="drag-handle">↕</span>
          <div class="file-name" :title="img.fileName">{{ img.fileName }}</div>
          <var-input
            class="caption-input"
            size="small"
            v-model="orderedImages[index]!.text"
            placeholder="Enter caption"
            @keyup.enter="focusNextInput(index)"
            :ref="(el: any) => setInputRef(el, index)"
          />
        </div>
      </div>
    </var-card>
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
    const localSpacing = ref<number>(10)
    const localFrameWidth = ref<number>(50)
    const localBackgroundColor = ref('#000000')
    const localFontSize = ref<string>('16')
    const localFontFamily = ref('sans-serif')
    const localFontColor = ref('#fff')

    const fontOptions = [
      { label: 'Arial', value: 'Arial' },
      { label: 'Times New Roman', value: 'Times New Roman' },
      { label: 'sans-serif', value: 'sans-serif' },
    ]

    const orderedImages = ref<ImageData[]>([...props.images])
    const scaledImgsCache = ref<{ img: HTMLImageElement; width: number; height: number }[]>([])
    const sortableRef = ref<HTMLElement | null>(null)

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
        ctx?.clearRect(0, 0, canvas.value.width, canvas.value.height)
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
          const item = scaledImgs[i]
          if (!item) continue
          const { img, width, height } = item
          ctx.drawImage(img, currentX + frameWidth, frameWidth, width, height)
          const caption = orderedImages.value[i]?.text || ''
          if (caption) {
            ctx.font = `${Number(localFontSize.value)}px ${localFontFamily.value}`
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
          if (!img) continue
          ctx.drawImage(img, currentX + frameWidthDownload, frameWidthDownload)
          const caption = orderedImages.value[i]?.text || ''
          if (caption) {
            ctx.font = `${Number(localFontSize.value) * downloadScale}px ${localFontFamily.value}`
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

    const handleSpacingChange = (val: number | number[]) => {
      const value = Array.isArray(val) ? (val[0] ?? 0) : val ?? 0
      localSpacing.value = Number(value) || 0
      drawCompositeImage()
    }

    const handleFrameChange = (val: number | number[]) => {
      const value = Array.isArray(val) ? (val[0] ?? 0) : val ?? 0
      localFrameWidth.value = Number(value) || 0
      drawCompositeImage()
    }

    const handleFontSizeChange = (val: any) => {
      const num = Number(val?.target?.value ?? localFontSize.value)
      if (!Number.isNaN(num)) {
        localFontSize.value = String(num)
        drawCompositeImage()
      }
    }

    function initSortable() {
      if (!sortableRef.value) return
      const sortable = new Sortable(sortableRef.value, {
        animation: 150,
        handle: '.drag-handle',
        draggable: '.data-row',
        onEnd: async ({ oldIndex, newIndex }) => {
          if (oldIndex === undefined || newIndex === undefined) return
          const newOrderedImages = [...orderedImages.value]
          const [movedItem] = newOrderedImages.splice(oldIndex, 1)
          if (!movedItem) return
          newOrderedImages.splice(newIndex, 0, movedItem)

          if (scaledImgsCache.value.length === orderedImages.value.length) {
            const cacheArr = [...scaledImgsCache.value]
            const [movedCache] = cacheArr.splice(oldIndex, 1)
            if (!movedCache) return
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
      inputRefs.value[index] = el ? el.$el?.querySelector?.('input') ?? el.$el : null
    }
    function focusNextInput(index: number) {
      const next = index + 1
      nextTick(() => {
        if (inputRefs.value[next]) {
          ;(inputRefs.value[next] as HTMLElement).focus()
          ;(inputRefs.value[next] as HTMLInputElement).select?.()
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
      fontOptions,
      sortableRef,
      handleSpacingChange,
      handleFrameChange,
      handleFontSizeChange,
    }
  },
})
</script>

<style scoped>
.image-merge {
  width: 100%;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.controls-card {
  padding: 12px;
}

.controls-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  gap: 12px;
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

.color-input {
  height: 40px;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  padding: 4px;
  width: 100%;
}

.control-actions {
  display: flex;
  gap: 10px;
  margin-top: 12px;
}

.canvas-container {
  width: 100%;
  max-height: 500px;
  overflow-x: auto;
  overflow-y: auto;
  border: 1px dashed #ccc;
  border-radius: 10px;
  padding: 10px;
}

.data-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.data-row {
  display: grid;
  grid-template-columns: 32px 1fr 220px;
  gap: 10px;
  align-items: center;
  padding: 10px;
  border: 1px solid #e5e7eb;
  border-radius: 10px;
}

.drag-handle {
  cursor: grab;
  user-select: none;
}

.file-name {
  font-weight: 600;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.caption-input {
  width: 100%;
}
</style>
