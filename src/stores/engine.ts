import { computed, nextTick, reactive, ref, watch } from 'vue'
import { defineStore } from 'pinia'
import jsonLogic from 'json-logic-js'
import { parseConfig } from '@/config'
import { typeNoun } from '@/fieldTypes'
import {
  FORM_NAMESPACE,
  buildRuleData,
  findPathClash,
  pathClash,
  renameVar,
  rulePath,
  varPaths,
} from '@/paths'
import type {
  DataSource,
  EngineConfig,
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
  function seedFormData(fields: SchemaField[]): void {
    const next = { ...formData.value }
    for (const f of fields) {
      if (!(f.key in next)) {
        next[f.key] = f.default ?? (f.type === 'checkbox' ? false : f.type === 'number' ? 0 : '')
      }
    }
    formData.value = next
  }

  // Same for toggles: `enabled` only seeds a rule the user has never seen.
  function seedToggles(rules: Rule[]): void {
    for (const r of rules) {
      if (!(r.key in ruleToggles)) ruleToggles[r.key] = r.enabled !== false
    }
  }

  watch(schemaFields, seedFormData, { immediate: true })
  watch(rulesConfig, seedToggles, { immediate: true })

  // --- Fetching -------------------------------------------------------------
  async function fetchOne(src: DataSource): Promise<void> {
    if (!src.url) {
      errors[src.key] = 'No URL yet.'
      delete rawData[src.key]
      return
    }
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
   * Form values as rules see them: nested by snake_cased legend and label
   * (formData.products.minimum_product_rating) rather than the storage keys.
   */
  const ruleFormData = computed(() => buildRuleData(schemaFields.value, formData.value))

  /** Set when hand-edited schema JSON gives two fields the same rule path. */
  const formPathError = computed(() => findPathClash(schemaFields.value))

  /**
   * Entry fields are spread at the top level so rules read them directly;
   * live form values are namespaced under `formData` so form inputs ARE rule
   * inputs. A rule that throws (bad operator, missing field) counts as no match
   * rather than breaking the whole pass.
   */
  function evaluate(rule: Rule, entry: Entry): boolean {
    try {
      return !!jsonLogic.apply(rule.logic, { ...entry, [FORM_NAMESPACE]: ruleFormData.value })
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

  // --- Whole-config import / export -----------------------------------------
  /**
   * Snapshot the current setup as one blob. Refuses while any section holds
   * invalid JSON — exporting it as `[]` would silently lose that section.
   */
  function exportConfig(): { config: EngineConfig } | { error: string } {
    const invalid = (
      [
        ['data sources', sourcesError],
        ['form schema', schemaError],
        ['rules', rulesError],
      ] as const
    ).find(([, err]) => err.value)
    if (invalid) {
      return { error: `The saved ${invalid[0]} can't be read (invalid JSON), so export would lose them — import a config to replace them.` }
    }
    return {
      config: {
        sources: dataSources.value,
        schema: schemaFields.value,
        rules: rulesConfig.value,
        formData: { ...formData.value },
      },
    }
  }

  /**
   * Replace the whole setup from one blob. This is a clean slate, not a merge:
   * toggles reset so each imported rule's `enabled` applies, and form values
   * reset so fields the blob omits take their schema defaults. Seeding is
   * called directly rather than left to the watchers: if a section's text is
   * unchanged the ref never triggers, and the reset state would stay empty.
   * Returns an error message, or '' on success.
   */
  function importConfig(text: string): string {
    const result = parseConfig(text)
    if ('error' in result) return result.error
    const { config } = result

    sourcesText.value = JSON.stringify(config.sources, null, 2)
    schemaText.value = JSON.stringify(config.schema, null, 2)
    rulesText.value = JSON.stringify(config.rules, null, 2)
    formData.value = { ...config.formData }
    for (const key in ruleToggles) delete ruleToggles[key]
    emptyGroups.value = []
    seedFormData(config.schema)
    seedToggles(config.rules)

    // Drop cached data for sources that no longer exist, then refresh the rest.
    const keep = new Set(config.sources.map((s) => s.key))
    for (const key in rawData) if (!keep.has(key)) delete rawData[key]
    fetchAll()
    return ''
  }

  // --- Form editing ---------------------------------------------------------
  /**
   * Groups with no fields yet. A group otherwise only exists through its
   * fields' `group` value, so a freshly added one is held here until a field
   * joins it, along with the slot it sits in. Session-only: an empty fieldset
   * isn't worth persisting.
   */
  const emptyGroups = ref<{ name: string; at: number }[]>([])

  /**
   * Groups in display order: the order each first appears in the schema, with
   * empty groups slotted in at their positions. `null` is the ungrouped bucket.
   */
  const groupOrder = computed(() => {
    const order: (string | null)[] = []
    for (const f of schemaFields.value) {
      const g = f.group || null
      if (!order.includes(g)) order.push(g)
    }
    for (const e of [...emptyGroups.value].sort((a, b) => a.at - b.at)) {
      if (!order.includes(e.name)) order.splice(Math.min(e.at, order.length), 0, e.name)
    }
    return order
  })

  /** Fields sorted so their groups appear in `order`, keeping order within each group. */
  function sortByGroup(fields: SchemaField[], order: (string | null)[]): SchemaField[] {
    const rank = (f: SchemaField) => {
      const i = order.indexOf(f.group || null)
      return i < 0 ? order.length : i
    }
    return [...fields].sort((a, b) => rank(a) - rank(b))
  }

  /**
   * Rewrite the schema through `edit`, keeping the rules in step: any field
   * whose rule path changes (a label or group rename) has every rule `var`
   * that read the old path rewritten to the new one. Refuses while the schema
   * JSON is invalid (rewriting from the parsed, empty list would wipe the
   * user's half-finished edit), while a rename can't update invalid rules
   * JSON, and when a changed field's path would collide with another's.
   * Returns an error message, or '' on success.
   */
  function editSchema(edit: (fields: SchemaField[]) => SchemaField[]): string {
    if (schemaError.value) return 'The saved form schema is invalid JSON — import a config to replace it.'
    const before = schemaFields.value
    const after = edit(before)

    const renames: [string, string][] = []
    for (const f of after) {
      const old = before.find((o) => o.key === f.key)
      if (old && rulePath(old) === rulePath(f)) continue
      const clash = pathClash(f, after)
      if (clash) {
        return `"${f.label || f.key}" would read as ${rulePath(f)}, which "${clash.label || clash.key}" already uses.`
      }
      if (old) renames.push([rulePath(old), rulePath(f)])
    }
    if (renames.length && rulesError.value) {
      return "The saved rules are invalid JSON, so the rules reading this field can't be updated — import a config to replace them."
    }

    schemaText.value = JSON.stringify(after, null, 2)
    if (renames.length) {
      const rules = rulesConfig.value.map((r) => ({
        ...r,
        logic: renames.reduce(
          (l, [from, to]) => renameVar(l, from, to),
          r.logic as unknown,
        ) as Rule['logic'],
      }))
      rulesText.value = JSON.stringify(rules, null, 2)
    }
    return ''
  }

  /** "New radio field", numbered if needed so its rule path is free in `group`. */
  function placeholderLabel(type: string, group = ''): string {
    const noun = typeNoun(type)
    const probe: SchemaField = { key: '', label: `New ${noun} field`, type, group }
    for (let i = 2; pathClash(probe, schemaFields.value); i++) probe.label = `New ${noun} field ${i}`
    return probe.label
  }

  /**
   * Append a field of the given FormKit type with a unique key. Without a
   * `label` it gets a free placeholder one; a given label that clashes is
   * refused rather than silently renumbered.
   */
  function addField(
    type: string,
    group = '',
    extra: Pick<Partial<SchemaField>, 'label' | 'options'> = {},
  ): string {
    const fields = schemaFields.value
    const base = type.replace(/-(\w)/g, (_, c: string) => c.toUpperCase())
    let n = 1
    while (fields.some((f) => f.key === `${base}${n}`)) n++
    const field: SchemaField = {
      key: `${base}${n}`,
      label: extra.label || placeholderLabel(type, group),
      type,
    }
    if (extra.options) field.options = extra.options
    else if (type === 'select' || type === 'radio') field.options = ['Option 1', 'Option 2']
    if (group) field.group = group
    // Sorted so a field joining an empty group lands in that group's slot.
    const order = groupOrder.value
    const error = editSchema((fs) => sortByGroup([...fs, field], order))
    if (!error) emptyGroups.value = emptyGroups.value.filter((e) => e.name !== group)
    return error
  }

  function renameField(key: string, label: string): string {
    return editSchema((fs) => fs.map((f) => (f.key === key ? { ...f, label } : f)))
  }

  /** Remove a field. Its fieldset stays on screen, empty, if it was the last one. */
  function removeField(key: string): string {
    const group = schemaFields.value.find((f) => f.key === key)?.group
    const at = groupOrder.value.indexOf(group || null)
    const error = editSchema((fs) => fs.filter((f) => f.key !== key))
    if (error) return error
    // Drop the value once the input has unmounted: its `preserve` prop would
    // write the value straight back if it were removed while still mounted.
    nextTick(() => {
      const next = { ...formData.value }
      delete next[key]
      formData.value = next
    })
    if (group && !schemaFields.value.some((f) => f.group === group)) {
      emptyGroups.value = [...emptyGroups.value, { name: group, at }]
    }
    return ''
  }

  /** Add an empty group with a unique placeholder name, returned for editing. */
  function addGroup(): string {
    const taken = new Set(groupOrder.value)
    let name = 'New group'
    for (let n = 2; taken.has(name); n++) name = `New group ${n}`
    emptyGroups.value = [...emptyGroups.value, { name, at: groupOrder.value.length }]
    return name
  }

  /** Rename a group across its fields. Renaming onto an existing group merges them. */
  function renameGroup(from: string, to: string): string {
    const error = editSchema((fs) => fs.map((f) => (f.group === from ? { ...f, group: to } : f)))
    if (error) return error
    const seen = new Set<string>()
    emptyGroups.value = emptyGroups.value
      .map((e) => (e.name === from ? { ...e, name: to } : e))
      .filter((e) => {
        if (seen.has(e.name) || schemaFields.value.some((f) => f.group === e.name)) return false
        seen.add(e.name)
        return true
      })
    return ''
  }

  /**
   * Delete a group along with its fields and their values. Rules reading
   * those fields are left as they are — see rulesReading for warning first.
   */
  function removeGroup(name: string): string {
    const keys = schemaFields.value.filter((f) => f.group === name).map((f) => f.key)
    const error = editSchema((fs) => fs.filter((f) => f.group !== name))
    if (error) return error
    emptyGroups.value = emptyGroups.value.filter((e) => e.name !== name)
    // As in removeField: drop values only once their inputs have unmounted.
    nextTick(() => {
      const next = { ...formData.value }
      for (const key of keys) delete next[key]
      formData.value = next
    })
    return ''
  }

  /** Keys of the rules that read any of these form fields. */
  function rulesReading(fields: SchemaField[]): string[] {
    const paths = fields.map(rulePath)
    return rulesConfig.value
      .filter((r) => varPaths(r.logic).some((v) => paths.some((p) => v === p || v.startsWith(p + '.'))))
      .map((r) => r.key)
  }

  /** Swap a group with its neighbour: `step` -1 moves it earlier, 1 later. */
  function moveGroup(name: string, step: -1 | 1): string {
    const order = [...groupOrder.value]
    const i = order.indexOf(name)
    const j = i + step
    if (i < 0 || j < 0 || j >= order.length) return ''
    ;[order[i], order[j]] = [order[j], order[i]]
    const error = editSchema((fs) => sortByGroup(fs, order))
    if (error) return error
    emptyGroups.value = emptyGroups.value.map((e) => ({ ...e, at: order.indexOf(e.name) }))
    return ''
  }

  // --- Source editing -------------------------------------------------------
  /**
   * Rewrite the sources through `edit`, keeping the sources JSON the one
   * combined list. Refuses while that JSON is invalid, as editRules does.
   */
  function editSources(edit: (sources: DataSource[]) => DataSource[]): string {
    if (sourcesError.value) return 'The saved data sources are invalid JSON — import a config to replace them.'
    sourcesText.value = JSON.stringify(edit(dataSources.value), null, 2)
    return ''
  }

  /** Append a source with a unique key and no URL yet. */
  function addSource(): { key: string } | { error: string } {
    let key = 'newSource'
    for (let n = 2; dataSources.value.some((s) => s.key === key); n++) key = `newSource${n}`
    const error = editSources((ss) => [...ss, { key, url: '' }])
    return error ? { error } : { key }
  }

  /** Change a source's URL and fetch from it straight away. */
  function setSourceUrl(key: string, url: string): string {
    const error = editSources((ss) => ss.map((s) => (s.key === key ? { ...s, url } : s)))
    if (error) return error
    void fetchOne({ key, url })
    return ''
  }

  /**
   * Rename a source. Rules name their source by key, so they're updated to
   * match, and its fetched data and status move with it.
   */
  function renameSource(from: string, to: string): string {
    if (dataSources.value.some((s) => s.key === to)) return `There's already a source called "${to}".`
    if (rulesError.value) {
      return "The saved rules are invalid JSON, so the rules filtering this source can't be updated — import a config to replace them."
    }
    const error = editSources((ss) => ss.map((s) => (s.key === from ? { ...s, key: to } : s)))
    if (error) return error
    editRules((rs) => rs.map((r) => (r.source === from ? { ...r, source: to } : r)))
    for (const map of [rawData, loading, errors] as Record<string, unknown>[]) {
      if (from in map) {
        map[to] = map[from]
        delete map[from]
      }
    }
    return ''
  }

  /** Delete a source and its fetched data. Rules filtering it are left as they are. */
  function removeSource(key: string): string {
    const error = editSources((ss) => ss.filter((s) => s.key !== key))
    if (error) return error
    delete rawData[key]
    delete loading[key]
    delete errors[key]
    return ''
  }

  /** Swap a source with its neighbour: `step` -1 moves it earlier, 1 later. */
  function moveSource(key: string, step: -1 | 1): string {
    return editSources((ss) => {
      const i = ss.findIndex((s) => s.key === key)
      const j = i + step
      if (i < 0 || j < 0 || j >= ss.length) return ss
      const next = [...ss]
      ;[next[i], next[j]] = [next[j], next[i]]
      return next
    })
  }

  // --- Rule editing ---------------------------------------------------------
  /**
   * Rewrite the rules through `edit`, so the rules JSON stays the one combined
   * definition. Refuses while that JSON is invalid: rewriting from the parsed,
   * empty list would wipe the user's half-finished edit.
   * Returns an error message, or '' on success.
   */
  function editRules(edit: (rules: Rule[]) => Rule[]): string {
    if (rulesError.value) return 'The saved rules are invalid JSON — import a config to replace them.'
    rulesText.value = JSON.stringify(edit(rulesConfig.value), null, 2)
    return ''
  }

  /** Append a match-everything rule on the first source, with a unique key. */
  function addRule(): { key: string } | { error: string } {
    let key = 'newRule'
    for (let n = 2; rulesConfig.value.some((r) => r.key === key); n++) key = `newRule${n}`
    const rule: Rule = { key, source: dataSources.value[0]?.key ?? '', enabled: true, logic: true }
    const error = editRules((rs) => [...rs, rule])
    return error ? { error } : { key }
  }

  function updateRule(key: string, patch: Partial<Omit<Rule, 'key'>>): string {
    return editRules((rs) => rs.map((r) => (r.key === key ? { ...r, ...patch } : r)))
  }

  /** Rename a rule, carrying its live toggle state over to the new key. */
  function renameRule(from: string, to: string): string {
    if (rulesConfig.value.some((r) => r.key === to)) return `There's already a rule called "${to}".`
    const error = editRules((rs) => rs.map((r) => (r.key === from ? { ...r, key: to } : r)))
    if (error) return error
    ruleToggles[to] = ruleToggles[from]
    delete ruleToggles[from]
    return ''
  }

  function removeRule(key: string): string {
    const error = editRules((rs) => rs.filter((r) => r.key !== key))
    if (!error) delete ruleToggles[key]
    return error
  }

  /** Swap a rule with its neighbour: `step` -1 moves it earlier, 1 later. */
  function moveRule(key: string, step: -1 | 1): string {
    return editRules((rs) => {
      const i = rs.findIndex((r) => r.key === key)
      const j = i + step
      if (i < 0 || j < 0 || j >= rs.length) return rs
      const next = [...rs]
      ;[next[i], next[j]] = [next[j], next[i]]
      return next
    })
  }

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
    ruleFormData,
    formPathError,
    ruleMatchInfo,
    sourceResults,
    grandTotal,
    anyLoading,
    fetchAll,
    fetchOne,
    exportConfig,
    importConfig,
    emptyGroups,
    groupOrder,
    placeholderLabel,
    addField,
    renameField,
    removeField,
    addGroup,
    renameGroup,
    removeGroup,
    rulesReading,
    moveGroup,
    addSource,
    setSourceUrl,
    renameSource,
    removeSource,
    moveSource,
    addRule,
    updateRule,
    renameRule,
    removeRule,
    moveRule,
  }
})
