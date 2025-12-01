<template>
  <div class="image-merge">
    <var-card class="controls-card" title="Layout settings">
      <div class="control-sections">
        <div class="control-section">
          <div class="section-title">Canvas</div>
          <div class="controls-grid">
            <div class="control-item slider-field">
              <span class="label">Spacing</span>
              <var-slider
                v-model="localSpacing"
                :min="0"
                :max="120"
                :step="1"
                track-color="#e5e7eb"
              />
            </div>
            <div class="control-item slider-field">
              <span class="label">Frame size</span>
              <var-slider
                v-model="localFrameWidth"
                :min="0"
                :max="120"
                :step="1"
                track-color="#e5e7eb"
              />
            </div>
            <div class="control-item">
              <span class="label">Background</span>
              <div class="color-row">
                <input class="color-input" type="color" v-model="localBackgroundColor" @change="markNeedsRedraw" />
                <span class="color-value">{{ localBackgroundColor }}</span>
              </div>
            </div>
          </div>
        </div>

        <div class="control-section">
          <div class="section-title">Text & captions</div>
          <div class="controls-grid">
            <div class="control-item">
              <span class="label">Font size</span>
              <var-input v-model="localFontSize" type="number" :min="10" @change="handleFontSizeChange" />
            </div>
            <div class="control-item">
              <span class="label">Font family</span>
              <var-select v-model="localFontFamily" :options="fontOptions" placeholder="Choose" @change="markNeedsRedraw" />
            </div>
            <div class="control-item">
              <span class="label">Font color</span>
              <div class="color-row">
                <input class="color-input" type="color" v-model="localFontColor" @change="markNeedsRedraw" />
                <span class="color-value">{{ localFontColor }}</span>
              </div>
            </div>
          </div>
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
            @input="markNeedsRedraw"
            :ref="(el: any) => setInputRef(el, index)"
          />
          <div class="row-actions">
            <var-button type="danger" size="small" text @click="removeImage(index)">Delete</var-button>
          </div>
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
    const localFontColor = ref('#ffffff')

    const fontOptions = [
      { label: 'Arial', value: 'Arial' },
      { label: 'Times New Roman', value: 'Times New Roman' },
      { label: 'sans-serif', value: 'sans-serif' },
    ]

    const orderedImages = ref<ImageData[]>([...props.images])
    const scaledImgsCache = ref<{ img: HTMLImageElement; width: number; height: number }[]>([])
    const sortableRef = ref<HTMLElement | null>(null)

    const revokeFullResObjectUrl = () => {
      if (fullResCanvas.value && (fullResCanvas.value as any).objectUrl) {
        URL.revokeObjectURL((fullResCanvas.value as any).objectUrl)
        delete (fullResCanvas.value as any).objectUrl
      }
    }

    const markNeedsRedraw = () => {
      revokeFullResObjectUrl()
      fullResCanvas.value = null
      emit('updateCanvases', { fullRes: '' })
    }

    const clamp = (val: number, min: number, max: number) => Math.min(max, Math.max(min, val))
    const normalizeHex = (val: string) => {
      const trimmed = (val || '').trim()
      if (/^#[0-9a-fA-F]{6}$/.test(trimmed)) return trimmed.toLowerCase()
      if (/^#[0-9a-fA-F]{3}$/.test(trimmed)) {
        return (
          '#' +
          trimmed[1] +
          trimmed[1] +
          trimmed[2] +
          trimmed[2] +
          trimmed[3] +
          trimmed[3]
        ).toLowerCase()
      }
      return '#000000'
    }

    watch(
      () => props.images,
      (newVal) => {
        orderedImages.value = [...newVal]
        scaledImgsCache.value = []
        markNeedsRedraw()
      },
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

          revokeFullResObjectUrl()

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
      const raw = Array.isArray(val) ? val[0] : val
      const next = clamp(Number(raw) || 0, 0, 120)
      localSpacing.value = next
      markNeedsRedraw()
    }

    const handleFrameChange = (val: number | number[]) => {
      const raw = Array.isArray(val) ? val[0] : val
      const next = clamp(Number(raw) || 0, 0, 120)
      localFrameWidth.value = next
      markNeedsRedraw()
    }

    const handleFontSizeChange = (val: any) => {
      const num = Number(val?.target?.value ?? localFontSize.value)
      if (!Number.isNaN(num)) {
        localFontSize.value = String(num)
        markNeedsRedraw()
      }
    }

    watch(localFontColor, (val) => {
      localFontColor.value = normalizeHex(val)
    })

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
          markNeedsRedraw()
        },
      })
      return sortable
    }

    onMounted(() => {
      nextTick(() => {
        initSortable()
      })
    })

    onUnmounted(() => {
      revokeFullResObjectUrl()
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

    async function removeImage(index: number) {
      if (index < 0 || index >= orderedImages.value.length) return
      orderedImages.value.splice(index, 1)
      if (scaledImgsCache.value.length > index) {
        scaledImgsCache.value.splice(index, 1)
      }
      inputRefs.value.splice(index, 1)
      markNeedsRedraw()
      await nextTick()
      if (!orderedImages.value.length && canvas.value) {
        const ctx = canvas.value.getContext('2d')
        ctx?.clearRect(0, 0, canvas.value.width, canvas.value.height)
        return
      }
      await drawCompositeImage()
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
      handleFontSizeChange,
      markNeedsRedraw,
      handleSpacingChange,
      handleFrameChange,
      removeImage,
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
  /* padding: 12px; */
  border-radius: 16px;
}

.control-sections {
  padding: 10px;
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(320px, 1fr));
  gap: 10px;
}

.control-section {
  border: 1px solid #e5e7eb;
  border-radius: 12px;
  padding: 16px;
  /* background: color-mix(in srgb, var(--color-surface, #fff) 90%, var(--color-body, #f7f8fb) 10%); */
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.section-title {
  font-weight: 700;
  font-size: 14px;
  color: var(--color-on-surface-variant, #4b5563);
}

.controls-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  gap: 10px;
  align-items: start;
}

.control-item {
  display: flex;
  flex-direction: column;
  /* gap: 4px; */
  min-height: 75px;
}

.slider-field :deep(.var-slider) {
  display: flex;
  align-items: center;
  height: 36px;
  padding: 4px 0;
}

.slider-field{
  gap:16px;
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

.color-row {
  display: grid;
  grid-template-columns: 60px 1fr;
  gap: 6px;
  align-items: center;
}

.color-value {
  font-size: 12px;
  color: #4b5563;
  font-family: ui-monospace, SFMono-Regular, SFMono, Consolas, 'Liberation Mono', Menlo, monospace;
}

.control-actions {
  display: flex;
  gap: 10px;
  margin-top: 12px;
  justify-content: flex-end;
  flex-wrap: wrap;
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
  grid-template-columns: 32px 1fr 220px auto;
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

.row-actions {
  display: flex;
  justify-content: flex-end;
}

@media (max-width: 720px) {
  .data-row {
    grid-template-columns: 1fr;
    align-items: stretch;
  }

  .drag-handle {
    justify-self: flex-start;
  }

  .row-actions {
    justify-content: flex-start;
  }
}

</style>
