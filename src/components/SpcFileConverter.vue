
<template>
  <div class="container">
    <div class="setting-card-wrap" ref="settingCardWrap">
      <var-card class="setting-card">
        <var-row :gutter="12">
          <var-col :span="24">
            <el-upload
              class="upload-area"
              drag
              multiple
              :on-change="handleChange"
              :auto-upload="false"
              :file-list="fileList"
              :show-file-list="false"
              accept=".spd"
            >
              <div class="upload-text">
                <var-icon name="cloud-upload" size="28" />
                <div class="upload-title">Drag .spd files here</div>
                <div class="upload-sub">or <em>click to choose</em></div>
              </div>
            </el-upload>
          </var-col>

          <var-col :span="24">
            <div class="setting-tools">
              <div class="tools-left">
                <var-button type="primary" @click="downloadSelected" :disabled="!hasSelection">Download selected</var-button>
                <var-button type="primary" @click="downloadAll" :disabled="!fileList.length">Download all</var-button>
              </div>
              <div class="tools-left">
                <var-button type="warning" @click="deleteSelected" :disabled="!hasSelection">Remove selected</var-button>
                <var-button type="danger" @click="deleteAll" :disabled="!fileList.length">Remove all</var-button>
              </div>
            </div>
          </var-col>
        </var-row>
        <div class="settings-fab">
          <var-button round text @click="showSettings = true">
            <var-icon name="cog" />
          </var-button>
        </div>
      </var-card>
    </div>

    <transition name="list-card" appear>
      <var-card v-if="hasFiles" class="file-list-card" ref="fileListCard">
        <div class="file-list-header">
          <h3>Uploaded files</h3>
          <div class="file-count" v-if="fileList.length">Total {{ fileList.length }}</div>
        </div>

        <var-list class="file-list" :finished="true" finished-text="">
          <template v-if="fileList.length">
            <var-cell v-for="file in fileList" :key="file.uid" class="file-item" border>
              <template #icon>
                <div class="cell-leading">
                  <var-checkbox
                    :model-value="!!selectedMap[String(file.uid)]"
                    @update:modelValue="(val: boolean) => toggleSelect(String(file.uid), val)"
                    size="18"
                  />
                  <var-icon name="file" />
                </div>
              </template>

              <div class="file-meta">
                <div class="file-name" :title="file.name">{{ file.name }}</div>
                <div class="file-size">{{ formatFileSize(file.size) }}</div>
              </div>

              <template #extra>
                <var-button text type="danger" size="small" @click="removeFile(String(file.uid))">Remove</var-button>
              </template>
            </var-cell>
          </template>

          <div v-else class="empty-state">
            <var-icon name="file-question-outline" size="36" />
            <p>No files yet. Drag .spd files or click above.</p>
          </div>
        </var-list>
      </var-card>
    </transition>
  </div>

  <var-dialog
    v-model:show="showSettings"
    title="Settings"
    :close-on-click-overlay="true"
    :cancel-button="false"
    confirm-button-text="Confirm"
    @confirm="onConfirmSettings"
  >
    <div class="settings-list">
      <var-cell title="Zip download" description="When multi-select, zip files and download" border>
        <template #extra>
          <var-switch v-model="packDownload" />
        </template>
      </var-cell>
      <var-cell title="Auto download" description="Parse and download immediately after upload" border>
        <template #extra>
          <var-switch v-model="autoDownload" />
        </template>
      </var-cell>
    </div>
  </var-dialog>
  <var-snackbar :show="false"></var-snackbar>
</template>

<script lang="ts">
import { defineComponent, ref, computed, nextTick, watch } from 'vue'
import type { UploadFile } from 'element-plus'
import { Snackbar } from '@varlet/ui'
import JSZip from 'jszip'

export default defineComponent({
  name: 'SpcFileConverter',
  setup() {
    const fileList = ref<UploadFile[]>([])
    const selectedMap = ref<Record<string, boolean>>({})
    const autoDownload = ref(false)
    const packDownload = ref(false)
    const showSettings = ref(false)
    const csvMap = ref<Record<string, { url: string; name: string }>>({})
    const settingCardWrap = ref<HTMLElement | null>(null)

    const getCookie = (name: string): string | null => {
      const escapedName = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
      const match = document.cookie.match(new RegExp('(?:^|; )' + escapedName + '=([^;]*)'))
      return match && typeof match[1] === 'string' ? decodeURIComponent(match[1]) : null
    }

    const setCookie = (name: string, value: string) => {
      document.cookie = `${name}=${encodeURIComponent(value)}; path=/; max-age=31536000`
    }

    const initFromCookie = () => {
      const ad = getCookie('autoDownload')
      const pd = getCookie('packDownload')
      if (ad != null) autoDownload.value = ad === '1' || ad === 'true'
      if (pd != null) packDownload.value = pd === '1' || pd === 'true'
      if (autoDownload.value && packDownload.value) {
        packDownload.value = false
      }
    }
    initFromCookie()

    const handleChange = async (file: UploadFile, fileListValue: UploadFile[]) => {
      fileList.value = fileListValue
      if (autoDownload.value) {
        try {
          const rec = await ensureCsvForFile(file)
          if (rec) triggerDownload(rec.url, rec.name, true)
        } catch (e: any) {
          Snackbar.error(`Parse failed: ${file.name}\n${e?.message || e}`)
        }
      }
    }

    const removeFile = (uid: string) => {
      fileList.value = fileList.value.filter((file) => String(file.uid) !== uid)
      delete selectedMap.value[uid]
      const rec = csvMap.value[uid]
      if (rec) {
        URL.revokeObjectURL(rec.url)
        delete csvMap.value[uid]
      }
    }

    const formatFileSize = (size: number | undefined): string => {
      if (!size) return '0 B'
      const units = ['B', 'KB', 'MB', 'GB']
      let unitIndex = 0
      let fileSize = size
      while (fileSize >= 1024 && unitIndex < units.length - 1) {
        fileSize /= 1024
        unitIndex++
      }
      return `${fileSize.toFixed(1)} ${units[unitIndex]}`
    }

    const toggleSelect = (uid: string, checked: boolean) => {
      selectedMap.value[uid] = checked
    }

    const selectedIds = computed(() => Object.keys(selectedMap.value).filter((id) => selectedMap.value[id]))
    const hasSelection = computed(() => selectedIds.value.length > 0)
    const hasFiles = computed(() => fileList.value.length > 0)

    const getFileByUid = (uid: string) => fileList.value.find((f) => String(f.uid) === uid)

    const triggerDownload = (url: string, name: string, isBlob: boolean) => {
      const a = document.createElement('a')
      a.href = url
      a.download = name || 'download'
      document.body.appendChild(a)
      a.click()
      a.remove()
      if (isBlob) {
        setTimeout(() => URL.revokeObjectURL(url), 1000)
      }
    }

    const toCsvName = (name: string | undefined) => {
      const base = (name || 'file').replace(/\.[^/.]+$/, '')
      return `${base}.csv`
    }

    const ensureCsvForFile = async (file: UploadFile) => {
      const uid = String(file.uid)
      if (csvMap.value[uid]) return csvMap.value[uid]
      const rec = await parseSpdToCsv(file)
      if (rec) csvMap.value[uid] = rec
      return rec
    }

    const animateSettingCardShift = async () => {
      const el = settingCardWrap.value
      if (!el) return
      const first = el.getBoundingClientRect()
      await nextTick()
      const last = el.getBoundingClientRect()
      const dy = first.top - last.top
      if (Math.abs(dy) < 1) return
      el.style.transform = `translateY(${dy}px)`
      void el.getBoundingClientRect()
      el.style.transition = 'transform 360ms cubic-bezier(0.22, 1, 0.36, 1)'
      requestAnimationFrame(() => {
        el.style.transform = ''
      })
      const onEnd = () => {
        el.style.transition = ''
        el.removeEventListener('transitionend', onEnd)
      }
      el.addEventListener('transitionend', onEnd)
    }

    watch(
      () => fileList.value.length,
      async (len, prev) => {
        if (prev === 0 && len > 0) {
          await animateSettingCardShift()
        }
      },
    )

    watch(autoDownload, (v) => {
      if (v) packDownload.value = false
      setCookie('autoDownload', v ? '1' : '0')
    })
    watch(packDownload, (v) => {
      if (v) autoDownload.value = false
      setCookie('packDownload', v ? '1' : '0')
    })

    const onConfirmSettings = () => {
      showSettings.value = false
    }

    const zipAndDownload = async (recs: { url: string; name: string }[], zipName = 'files.zip') => {
      const zip = new JSZip()
      for (const rec of recs) {
        const blob = await (await fetch(rec.url)).blob()
        zip.file(rec.name, blob)
      }
      const content = await zip.generateAsync({ type: 'blob' })
      const url = URL.createObjectURL(content)
      triggerDownload(url, zipName, true)
    }

    const downloadSelected = async () => {
      const ids = selectedIds.value
      if (packDownload.value && ids.length > 1) {
        try {
          const recs: { url: string; name: string }[] = []
          for (const id of ids) {
            const f = getFileByUid(id)
            if (!f) continue
            const rec = await ensureCsvForFile(f)
            if (rec) recs.push(rec)
          }
          if (recs.length > 1) {
            await zipAndDownload(recs, `selected-${recs.length}.zip`)
          } else if (recs.length === 1) {
            const first = recs[0]
            if (first) triggerDownload(first.url, first.name, true)
          }
        } catch (e: any) {
          Snackbar.error(`Zip failed\n${e?.message || e}`)
        }
        return
      }
      for (const id of ids) {
        const f = getFileByUid(id)
        if (!f) continue
        try {
          const rec = await ensureCsvForFile(f)
          if (rec) triggerDownload(rec.url, rec.name, true)
        } catch (e: any) {
          Snackbar.error(`Parse failed: ${f.name}\n${e?.message || e}`)
        }
      }
    }

    const downloadAll = async () => {
      if (packDownload.value && fileList.value.length > 1) {
        try {
          const recs: { url: string; name: string }[] = []
          for (const f of fileList.value) {
            const rec = await ensureCsvForFile(f)
            if (rec) recs.push(rec)
          if (recs.length > 1) {
            await zipAndDownload(recs, `all-${recs.length}.zip`)
          } else if (recs.length === 1) {
            const first = recs[0]
            if (first) triggerDownload(first.url, first.name, true)
          }
          }
        } catch (e: any) {
          Snackbar.error(`Zip failed\n${e?.message || e}`)
        }
        return
      }
      for (const f of fileList.value) {
        try {
          const rec = await ensureCsvForFile(f)
          if (rec) triggerDownload(rec.url, rec.name, true)
        } catch (e: any) {
          Snackbar.error(`Parse failed: ${f.name}\n${e?.message || e}`)
        }
      }
    }

    const deleteSelected = () => {
      const keep = new Set(selectedIds.value)
      fileList.value = fileList.value.filter((f) => {
        const remove = keep.has(String(f.uid))
        if (remove) {
          const rec = csvMap.value[String(f.uid)]
          if (rec) URL.revokeObjectURL(rec.url)
          delete csvMap.value[String(f.uid)]
          delete selectedMap.value[String(f.uid)]
        }
        return !remove
      })
    }

    const deleteAll = () => {
      Object.values(csvMap.value).forEach((rec) => URL.revokeObjectURL(rec.url))
      fileList.value = []
      selectedMap.value = {}
      csvMap.value = {}
    }

    const parseSpdToCsv = async (file: UploadFile): Promise<{ url: string; name: string } | null> => {
      if (!(file.raw instanceof Blob)) throw new Error('Missing raw file data')
      const buf = await file.raw.arrayBuffer()
      const dv = new DataView(buf)
      const headerBytes: number[] = []
      for (let i = 0; i < 5 && i < dv.byteLength; i++) headerBytes.push(dv.getUint8(i))
      const header = String.fromCharCode(...headerBytes)
      if (header !== 'UVWIN') throw new Error('Unexpected file type')

      const start = 1029
      const pairs: string[] = []
      const typeByte: number[] = []
      for (let i = 20; i < 32 && i < dv.byteLength; i++) typeByte.push(dv.getUint8(i))
      pairs.push(`Wavelength,${String.fromCharCode(...typeByte)}`)
      for (let i = start; i + 16 <= dv.byteLength; i += 16) {
        const a = dv.getFloat64(i, true)
        const b = dv.getFloat64(i + 8, true)
        pairs.push(`${a},${b}`)
      }
      const csvText = pairs.join('\n')
      const blob = new Blob([csvText], { type: 'text/csv;charset=utf-8' })
      const url = URL.createObjectURL(blob)
      const nameCsv = toCsvName(file.name)
      return { url, name: nameCsv }
    }

    return {
      fileList,
      handleChange,
      removeFile,
      formatFileSize,
      selectedMap,
      toggleSelect,
      selectedIds,
      hasSelection,
      hasFiles,
      downloadSelected,
      downloadAll,
      deleteSelected,
      deleteAll,
      autoDownload,
      csvMap,
      parseSpdToCsv,
      ensureCsvForFile,
      settingCardWrap,
      packDownload,
      showSettings,
      onConfirmSettings,
      zipAndDownload,
    }
  },
})
</script>

<style scoped>
.container {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 16px;
  width: 100%;
  max-width: 1000px;
  margin: 0 auto;
  padding: 24px 16px 40px;
}

.setting-card,
.file-list-card {
  width: 100%;
  border-radius: 16px;
  animation: file-list-lift-in 0.28s ease-out both;
}

.setting-card {
  --dropzone-min-height: 140px;
  position: relative;
}

.settings-fab {
  position: absolute;
  right: 12px;
  bottom: 12px;
}

.settings-list {
  min-width: 260px;
}

.upload-area {
  width: 100%;
  min-height: var(--dropzone-min-height);
}

::v-deep .el-upload-dragger {
  background-color: transparent !important;
  border: 2px dashed var(--el-border-color, #e5e7eb) !important;
  border-radius: 12px !important;
  transition: border-color 0.2s, background-color 0.2s;
  padding: 24px !important;
  display: flex;
  align-items: center;
  justify-content: center;
  height: 100%;
}

::v-deep .el-upload-dragger:hover {
  border-color: #3b82f6 !important;
  background-color: rgba(59, 130, 246, 0.06) !important;
}

.upload-text {
  display: grid;
  place-items: center;
  row-gap: 8px;
  text-align: center;
}

.upload-title {
  font-weight: 600;
}

.upload-sub {
  font-size: 13px;
  color: #6b7280;
}

.upload-sub em {
  color: #3b82f6;
  font-style: normal;
}

.setting-tools {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-wrap: wrap;
  gap: 6px 8px;
}

.tools-left {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.file-list-card {
  min-height: 250px;
  max-height: 55vh;
  will-change: transform, opacity;
}

.file-list-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 6px 16px;
  border-bottom: 1px solid rgba(0, 0, 0, 0.06);
}

.file-list-header h3 {
  margin: 0;
  font-size: 16px;
}

.file-count {
  font-size: 12px;
  color: #6b7280;
}

.file-list {
  padding: 4px 0;
  max-height: 45vh;
  overflow-y: auto;
}

.file-item {
  align-items: center;
}

.cell-leading {
  display: inline-flex;
  align-items: center;
  gap: 8px;
}

.file-meta {
  display: flex;
  flex-direction: column;
  min-width: 0;
}

.file-name {
  font-size: 14px;
  line-height: 1.3;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.file-size {
  color: #6b7280;
  font-size: 12px;
}

.empty-state {
  display: grid;
  place-items: center;
  text-align: center;
  color: #9ca3af;
  padding: 28px 12px;
}

@media (max-width: 768px) {
  .container {
    padding: 16px 12px 28px;
  }

  .file-list {
    max-height: 50vh;
  }
}

@keyframes file-list-lift-in {
  from {
    opacity: 0;
    transform: translateY(10px) scale(0.98);
  }
  to {
    opacity: 1;
    transform: translateY(0) scale(1);
  }
}
</style>
