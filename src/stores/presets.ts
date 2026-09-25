import { computed, ref, watch } from 'vue'
import { defineStore } from 'pinia'
import type { EngineConfig } from '@/types'
import { useEngineStore } from '@/stores/engine'

/**
 * Named snapshots of the whole setup ("Desirable Campervan", "Holiday
 * Activities") saved in the browser. Kept under their own storage key, apart
 * from the working state, so loading or importing a config never touches
 * them.
 */

export interface Preset {
  name: string
  /** ISO timestamp of the last save. */
  savedAt: string
  config: EngineConfig
}

const PRESETS_KEY = 'cdre-presets-v1'

function loadPresets(): Preset[] {
  try {
    const raw = localStorage.getItem(PRESETS_KEY)
    const value = raw ? JSON.parse(raw) : []
    return Array.isArray(value) ? (value as Preset[]) : []
  } catch {
    return []
  }
}

export const usePresetsStore = defineStore('presets', () => {
  const engine = useEngineStore()
  const presets = ref<Preset[]>(loadPresets())

  watch(
    presets,
    (list) => {
      try {
        localStorage.setItem(PRESETS_KEY, JSON.stringify(list))
      } catch {
        // Quota or private-mode failures are non-fatal; presets just won't survive a reload.
      }
    },
    { deep: true },
  )

  /**
   * The setup as it stands, as a preset holds it: Export's config, with each
   * rule's `enabled` set to its checkbox so the combination comes back on load.
   */
  function snapshot(): { config: EngineConfig } | { error: string } {
    const result = engine.exportConfig()
    if ('error' in result) return result
    const rules = result.config.rules.map((r) => ({ ...r, enabled: !!engine.ruleToggles[r.key] }))
    return { config: { ...result.config, rules } }
  }

  /** The current snapshot as JSON, to tell which preset (if any) it matches. */
  const currentJson = computed(() => {
    const s = snapshot()
    return 'config' in s ? JSON.stringify(s.config) : ''
  })

  function matchesCurrent(p: Preset): boolean {
    return JSON.stringify(p.config) === currentJson.value
  }

  function find(name: string): Preset | undefined {
    return presets.value.find((p) => p.name === name)
  }

  /** Save the current setup as a new preset with a unique placeholder name, returned for editing. */
  function saveAsNew(): { name: string } | { error: string } {
    const s = snapshot()
    if ('error' in s) return s
    let name = 'New preset'
    for (let n = 2; find(name); n++) name = `New preset ${n}`
    presets.value = [...presets.value, { name, savedAt: new Date().toISOString(), config: s.config }]
    return { name }
  }

  /** Overwrite a preset with the current setup. */
  function overwrite(name: string): string {
    const s = snapshot()
    if ('error' in s) return s.error
    presets.value = presets.value.map((p) =>
      p.name === name ? { ...p, savedAt: new Date().toISOString(), config: s.config } : p,
    )
    return ''
  }

  /** Replace the whole setup with a preset's, as an import does. */
  function load(name: string): string {
    const p = find(name)
    if (!p) return `There's no preset called "${name}".`
    return engine.importConfig(JSON.stringify(p.config))
  }

  function rename(from: string, to: string): string {
    if (find(to)) return `There's already a preset called "${to}".`
    presets.value = presets.value.map((p) => (p.name === from ? { ...p, name: to } : p))
    return ''
  }

  function remove(name: string): void {
    presets.value = presets.value.filter((p) => p.name !== name)
  }

  /** Swap a preset with its neighbour: `step` -1 moves it earlier, 1 later. */
  function move(name: string, step: -1 | 1): void {
    const i = presets.value.findIndex((p) => p.name === name)
    const j = i + step
    if (i < 0 || j < 0 || j >= presets.value.length) return
    const next = [...presets.value]
    ;[next[i], next[j]] = [next[j], next[i]]
    presets.value = next
  }

  return { presets, matchesCurrent, saveAsNew, overwrite, load, rename, remove, move }
})
