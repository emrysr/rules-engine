import { computed, reactive, ref, watch } from 'vue'
import { defineStore } from 'pinia'
import jsonLogic from 'json-logic-js'
import type {
  DataSource,
  Entry,
  MatchInfo,
  PersistedState,
  Rule,
  SchemaField,
  SectionName,
  SourceResult,
} from '@/types'
import {
  STORAGE_KEY,
  defaultRules,
  defaultSchema,
  defaultSectionOpen,
  defaultSources,
} from '@/defaults'

function loadCache(): Partial<PersistedState> | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? (JSON.parse(raw) as Partial<PersistedState>) : null
  } catch {
    return null
  }
}

function saveCache(data: PersistedState): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
  } catch {
    // Quota or private-mode failures are non-fatal — the app works without cache.
  }
}

/**
 * Data sources return either a bare array or an object wrapping one. Prefer the
 * field named after the source key, then fall back to the first array found.
 */
function extractList(resp: unknown, key: string): Entry[] {
  if (Array.isArray(resp)) return resp as Entry[]
  if (resp && typeof resp === 'object') {
    const obj = resp as Record<string, unknown>
    if (Array.isArray(obj[key])) return obj[key] as Entry[]
    for (const k in obj) {
      if (Array.isArray(obj[k])) return obj[k] as Entry[]
    }
  }
  return []
}

export const useEngineStore = defineStore('engine', () => {
  const cached = loadCache()

  // --- Config, held as raw text so invalid JSON is an editable state ---------
  const sourcesText = ref(cached?.sourcesText ?? JSON.stringify(defaultSources, null, 2))
  const schemaText = ref(cached?.schemaText ?? JSON.stringify(defaultSchema, null, 2))
  const rulesText = ref(cached?.rulesText ?? JSON.stringify(defaultRules, null, 2))

  const sourcesError = ref('')
  const schemaError = ref('')
  const rulesError = ref('')

  // --- Runtime state --------------------------------------------------------
  const rawData = reactive<Record<string, Entry[]>>(cached?.rawData ?? {})
  const loading = reactive<Record<string, boolean>>({})
  const errors = reactive<Record<string, string>>({})
  const formData = ref<Record<string, unknown>>(cached?.formData ?? {})
  const ruleToggles = reactive<Record<string, boolean>>(cached?.ruleToggles ?? {})
  const sectionOpen = reactive<Record<SectionName, boolean>>({
    ...defaultSectionOpen,
    ...cached?.sectionOpen,
  })

  /**
   * Parse a config textarea, recording the error rather than throwing so a
   * half-typed edit degrades to "no items" instead of tearing down the app.
   */
  function parsed<T>(text: string, errorRef: { value: string }): T[] {
    try {
      const value = JSON.parse(text)
      errorRef.value = ''
      return Array.isArray(value) ? (value as T[]) : []
    } catch (e) {
      errorRef.value = 'Invalid JSON: ' + (e as Error).message
      return []
    }
  }

  const dataSources = computed(() => parsed<DataSource>(sourcesText.value, sourcesError))
  const schemaFields = computed(() => parsed<SchemaField>(schemaText.value, schemaError))
  const rulesConfig = computed(() => parsed<Rule>(rulesText.value, rulesError))

  // Seed form values for newly added fields without disturbing existing input.
  watch(
    schemaFields,
    (fields) => {
      const next = { ...formData.value }
      for (const f of fields) {
        if (!(f.key in next)) {
          next[f.key] =
            f.default ?? (f.type === 'checkbox' ? false : f.type === 'number' ? 0 : '')
        }
      }
      formData.value = next
    },
    { immediate: true },
  )

  // Same for toggles: `enabled` only seeds a rule the user has never seen.
  watch(
    rulesConfig,
    (rules) => {
      for (const r of rules) {
        if (!(r.key in ruleToggles)) ruleToggles[r.key] = r.enabled !== false
      }
    },
    { immediate: true },
  )

  // --- Fetching -------------------------------------------------------------
  async function fetchOne(src: DataSource): Promise<void> {
    loading[src.key] = true
    errors[src.key] = ''
    try {
      const res = await fetch(src.url, {
        mode: 'cors',
        cache: 'no-store',
        headers: { Accept: 'application/json' },
      })
      if (!res.ok) throw new Error('HTTP ' + res.status)
      rawData[src.key] = extractList(await res.json(), src.key)
    } catch (e) {
      const message = (e as Error).message
      errors[src.key] =
        message === 'Failed to fetch' ? 'Network/CORS error.' : 'Fetch failed: ' + message
      delete rawData[src.key]
    } finally {
      loading[src.key] = false
      persist()
    }
  }

  function fetchAll(): void {
    for (const src of dataSources.value) void fetchOne(src)
  }

  const anyLoading = computed(() => Object.values(loading).some(Boolean))

  // --- Evaluation -----------------------------------------------------------
  /**
   * Entry fields are spread at the top level so rules read them directly;
   * live form values are namespaced under `formData` so form inputs ARE rule
   * inputs. A rule that throws (bad operator, missing field) counts as no match
   * rather than breaking the whole pass.
   */
  function evaluate(rule: Rule, entry: Entry): boolean {
    try {
      return !!jsonLogic.apply(rule.logic, { ...entry, formData: formData.value })
    } catch {
      return false
    }
  }

  const ruleMatchInfo = computed<Record<string, MatchInfo>>(() => {
    const out: Record<string, MatchInfo> = {}
    for (const r of rulesConfig.value) {
      const entries = rawData[r.source] ?? []
      out[r.key] = {
        total: entries.length,
        matches: entries.reduce((n, e) => n + (evaluate(r, e) ? 1 : 0), 0),
      }
    }
    return out
  })

  const sourceResults = computed<Record<string, SourceResult>>(() => {
    const out: Record<string, SourceResult> = {}
    for (const src of dataSources.value) {
      const entries = rawData[src.key] ?? []
      const active = rulesConfig.value.filter(
        (r) => r.source === src.key && ruleToggles[r.key],
      )
      out[src.key] = {
        total: entries.length,
        matched: entries.filter((e) => active.every((r) => evaluate(r, e))).length,
      }
    }
    return out
  })

  const grandTotal = computed(() =>
    Object.values(sourceResults.value).reduce(
      (acc, r) => ({ total: acc.total + r.total, matched: acc.matched + r.matched }),
      { total: 0, matched: 0 },
    ),
  )

  // --- Persistence ----------------------------------------------------------
  function persist(): void {
    saveCache({
      sourcesText: sourcesText.value,
      schemaText: schemaText.value,
      rulesText: rulesText.value,
      formData: formData.value,
      ruleToggles: { ...ruleToggles },
      rawData: { ...rawData },
      sectionOpen: { ...sectionOpen },
    })
  }

  watch([sourcesText, schemaText, rulesText, formData, ruleToggles, sectionOpen], persist, {
    deep: true,
  })

  return {
    sourcesText,
    schemaText,
    rulesText,
    sourcesError,
    schemaError,
    rulesError,
    rawData,
    loading,
    errors,
    formData,
    ruleToggles,
    sectionOpen,
    dataSources,
    schemaFields,
    rulesConfig,
    ruleMatchInfo,
    sourceResults,
    grandTotal,
    anyLoading,
    fetchAll,
    fetchOne,
  }
})
