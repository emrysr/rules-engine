import { computed, nextTick, reactive, ref, watch } from 'vue'
import { defineStore } from 'pinia'
import { parseConfig } from '@/config'
import { typeNoun } from '@/fieldTypes'
import { compileGroup, evaluateGroup, isRuleGroup, mapKeys } from '@/combine'
import { entryPaths } from '@/comparison'
import { compilePipeline, isPipeline, renamePipelineRefs, rowPasses, runPipelines } from '@/pipeline'
import type { Block, Pipeline } from '@/pipeline'
import {
  FORM_NAMESPACE,
  PIPELINE_NAMESPACE,
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
  RuleGroup,
  SourceResult,
} from '@/types'
import {
  STORAGE_KEY,
  defaultPipelines,
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
    // Quota or private-mode failures are non-fatal - the app works without cache.
  }
}

/**
 * Data sources return either a bare array or an object wrapping one. Prefer the
 * field named after the source key, then fall back to the first array found.
 */
function findList(resp: unknown, key: string): Entry[] | null {
  if (Array.isArray(resp)) return resp as Entry[]
  if (resp && typeof resp === 'object') {
    const obj = resp as Record<string, unknown>
    if (Array.isArray(obj[key])) return obj[key] as Entry[]
    for (const k in obj) {
      if (Array.isArray(obj[k])) return obj[k] as Entry[]
    }
  }
  return null
}

/**
 * The source's list from its response. With a `listPath`, walk down to it
 * first (then find the list there, if the path stops at an object holding
 * one); a path that isn't in the response, or leads to no list, is an error
 * rather than an empty source. Without one, an unrecognised response is
 * just empty, as before.
 */
function extractList(resp: unknown, src: DataSource): Entry[] {
  if (!src.listPath) return findList(resp, src.key) ?? []
  const list = findList(drill(resp, src.listPath), src.key)
  if (!list) throw new Error(`"${src.listPath}" isn't a list`)
  return list
}

/** Walk a dotted path down into the data; a step that isn't there is an error. */
function drill(data: unknown, path: string): unknown {
  let node = data
  for (const part of path.split('.')) {
    if (!node || typeof node !== 'object' || !(part in node)) throw new Error(`no "${path}" in the data`)
    node = (node as Record<string, unknown>)[part]
  }
  return node
}

/** A values source's object: at its path if it has one, and an object, not a list. */
function extractValues(data: unknown, src: DataSource): Record<string, unknown> {
  const node = src.listPath ? drill(data, src.listPath) : data
  if (!node || typeof node !== 'object' || Array.isArray(node)) {
    throw new Error('values need to be an object, e.g. { "target_day": 3 }')
  }
  return node as Record<string, unknown>
}

/** Whether a source's data is pasted in rather than fetched. */
export function isPasted(src: DataSource): boolean {
  return src.data !== undefined
}

/** Keep only well-formed combinations from cached or imported data. */
function validCombine(value: unknown): Record<string, RuleGroup> {
  if (!value || typeof value !== 'object') return {}
  return Object.fromEntries(Object.entries(value).filter(([, g]) => isRuleGroup(g)))
}

/** Keep only well-formed pipelines from cached or imported data. */
function validPipelines(value: unknown): Pipeline[] {
  return Array.isArray(value) ? value.filter(isPipeline) : []
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
  const sourceValues = reactive<Record<string, unknown>>(cached?.sourceValues ?? {})
  const loading = reactive<Record<string, boolean>>({})
  const errors = reactive<Record<string, string>>({})
  const formData = ref<Record<string, unknown>>(cached?.formData ?? {})
  const ruleToggles = reactive<Record<string, boolean>>(cached?.ruleToggles ?? {})
  /**
   * Each source's rule combination, by source key. A source without one uses
   * all of its rules, ANDed (see combinationFor), so it's only stored once
   * the user edits it.
   */
  const combine = ref<Record<string, RuleGroup>>(validCombine(cached?.combine))
  /** Pipelines: stacks of blocks that each compile to one JSON Logic expression. */
  const pipelines = ref<Pipeline[]>(cached ? validPipelines(cached.pipelines) : defaultPipelines)
  /** The pipeline the Results panel shows, by name; '' (or a name that's gone) means the last one. */
  const resultPipeline = ref(cached?.resultPipeline ?? '')
  // Results always starts collapsed: it sticks to the foot of the screen,
  // where open it would cover what's being edited.
  const sectionOpen = reactive<Record<SectionName, boolean>>({
    ...defaultSectionOpen,
    ...cached?.sectionOpen,
    results: false,
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
  /** Sources whose entries rules filter: each gets a query and a result. */
  const listSources = computed(() => dataSources.value.filter((s) => s.use !== 'values'))
  /** Sources whose values are in every rule's scope, under the source's key. */
  const valueSources = computed(() => dataSources.value.filter((s) => s.use === 'values'))
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

  // --- Loading --------------------------------------------------------------
  /**
   * Load a source from its URL or its pasted data, then keep it as a list of
   * entries or, for a values source, as the object of values rules read.
   */
  async function fetchOne(src: DataSource): Promise<void> {
    const pasted = isPasted(src)
    if (!pasted && !src.url) {
      errors[src.key] = 'No URL yet.'
      delete rawData[src.key]
      delete sourceValues[src.key]
      return
    }
    loading[src.key] = !pasted
    errors[src.key] = ''
    try {
      let data = src.data
      if (!pasted) {
        const res = await fetch(src.url!, {
          mode: 'cors',
          cache: 'no-store',
          headers: { Accept: 'application/json' },
        })
        if (!res.ok) throw new Error('HTTP ' + res.status)
        data = await res.json()
      }
      if (src.use === 'values') {
        sourceValues[src.key] = extractValues(data, src)
        delete rawData[src.key]
      } else {
        rawData[src.key] = extractList(data, src)
        delete sourceValues[src.key]
      }
    } catch (e) {
      const message = (e as Error).message
      errors[src.key] =
        message === 'Failed to fetch'
          ? 'Network/CORS error.'
          : (pasted ? "Can't use it: " : 'Fetch failed: ') + message
      delete rawData[src.key]
      delete sourceValues[src.key]
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

  /** Each values source's values, by source key: in every rule's scope. */
  const valueScope = computed<Record<string, unknown>>(() =>
    Object.fromEntries(valueSources.value.map((s) => [s.key, sourceValues[s.key]])),
  )

  /**
   * Entry fields are spread at the top level so rules read them directly;
   * values sources sit under their keys and live form values under `formData`,
   * so every input is in the rule's scope - inside a check of a list on the
   * entry too, as in pipelines (see rowPasses). A rule that throws (bad
   * operator, missing field) counts as no match rather than breaking the
   * whole pass. The result is judged by JSON Logic's truthiness, where an
   * empty list is false (JavaScript's `!!` would call it true).
   */
  function evaluate(rule: Rule, entry: Entry): boolean {
    try {
      return rowPasses(rule.logic, { ...valueScope.value, [FORM_NAMESPACE]: ruleFormData.value }, entry)
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

  /** Form fields as rules read them, for pickers: full `formData.…` path and a readable name. */
  const formFieldOptions = computed(() =>
    schemaFields.value.map((f) => {
      const label = f.label || f.key
      return { path: rulePath(f), name: f.group ? `${f.group} › ${label}` : label }
    }),
  )

  /** Every values source's value paths, for pickers, e.g. teetime.target_day. */
  const valuePaths = computed(() =>
    valueSources.value.flatMap((s) => {
      const values = sourceValues[s.key]
      return values && typeof values === 'object'
        ? entryPaths([values as Record<string, unknown>]).map((p) => `${s.key}.${p}`)
        : []
    }),
  )

  /**
   * Everything a pipeline can read, by name: each list source's entries
   * after its Source Filter, each values source's values, and the form
   * values under `formData`.
   */
  const pipelineScope = computed<Record<string, unknown>>(() => ({
    ...Object.fromEntries(listSources.value.map((s) => [s.key, matchedEntries.value[s.key]])),
    ...valueScope.value,
    [FORM_NAMESPACE]: ruleFormData.value,
  }))

  /** Each pipeline's block-by-block results, by pipeline name. */
  const pipelineResults = computed(() =>
    runPipelines(pipelines.value, {
      scope: pipelineScope.value,
      listSources: listSources.value.map((s) => s.key),
    }),
  )

  /** The pipeline as one JSON Logic expression, Source Filters and the pipelines it reads written in. */
  function compiledPipeline(p: Pipeline): unknown {
    return compilePipeline(p, {
      sourceFilter: (key) => compiledQueries.value[key],
      pipelines: pipelines.value,
    })
  }

  /** The pipeline whose result is the Results panel's: the chosen one, else the last. */
  const resultOf = computed<Pipeline | undefined>(
    () => pipelines.value.find((p) => p.name === resultPipeline.value) ?? pipelines.value[pipelines.value.length - 1],
  )

  /** A source's rule combination: the stored one, or all its rules ANDed. */
  function combinationFor(source: string): RuleGroup {
    return (
      combine.value[source] ?? {
        op: 'and',
        items: rulesConfig.value.filter((r) => r.source === source).map((r) => r.key),
      }
    )
  }

  /** The source's rules that count in its combination: on its source and switched on. */
  function liveRules(source: string): Map<string, Rule> {
    return new Map(
      rulesConfig.value.filter((r) => r.source === source && ruleToggles[r.key]).map((r) => [r.key, r]),
    )
  }

  /** Each source's entries that pass its rule combination: the results. */
  const matchedEntries = computed<Record<string, Entry[]>>(() => {
    const out: Record<string, Entry[]> = {}
    for (const src of listSources.value) {
      const group = combinationFor(src.key)
      const live = liveRules(src.key)
      out[src.key] = (rawData[src.key] ?? []).filter((e) =>
        evaluateGroup(group, (key) => {
          const rule = live.get(key)
          return rule ? evaluate(rule, e) : undefined
        }),
      )
    }
    return out
  })

  /**
   * Each source's combination as one JSON Logic expression, with its live
   * rules' logic inlined: the query to paste into another app.
   */
  const compiledQueries = computed<Record<string, unknown>>(() => {
    const out: Record<string, unknown> = {}
    for (const src of listSources.value) {
      const live = liveRules(src.key)
      out[src.key] = compileGroup(combinationFor(src.key), (key) => live.get(key)?.logic)
    }
    return out
  })

  const sourceResults = computed<Record<string, SourceResult>>(() => {
    const out: Record<string, SourceResult> = {}
    for (const src of listSources.value) {
      out[src.key] = {
        total: (rawData[src.key] ?? []).length,
        matched: matchedEntries.value[src.key].length,
      }
    }
    return out
  })

  // --- Whole-config import / export -----------------------------------------
  /**
   * Snapshot the current setup as one blob. Refuses while any section holds
   * invalid JSON - exporting it as `[]` would silently lose that section.
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
      return { error: `The saved ${invalid[0]} can't be read (invalid JSON), so export would lose them - import a config to replace them.` }
    }
    return {
      config: {
        sources: dataSources.value,
        schema: schemaFields.value,
        rules: rulesConfig.value,
        combine: Object.fromEntries(listSources.value.map((s) => [s.key, combinationFor(s.key)])),
        pipelines: pipelines.value,
        ...(resultPipeline.value && resultOf.value?.name === resultPipeline.value ? { result: resultPipeline.value } : {}),
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
    combine.value = validCombine(config.combine)
    pipelines.value = validPipelines(config.pipelines)
    resultPipeline.value = config.result ?? ''
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
    if (schemaError.value) return 'The saved form schema is invalid JSON - import a config to replace it.'
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
      return "The saved rules are invalid JSON, so the rules reading this field can't be updated - import a config to replace them."
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

  /** Set a field's help text; empty removes it. */
  function setFieldHelp(key: string, help: string): string {
    return editSchema((fs) =>
      fs.map((f) => {
        if (f.key !== key) return f
        const { help: _, ...rest } = f
        return help ? { ...rest, help } : rest
      }),
    )
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
   * those fields are left as they are - see rulesReading for warning first.
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
    if (sourcesError.value) return 'The saved data sources are invalid JSON - import a config to replace them.'
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

  /**
   * Change a source and reload it straight away. A property patched to
   * undefined is removed (how a source switches between a URL and pasted
   * data, or back from values to a list), and a blank list path is dropped
   * rather than stored as "".
   */
  function updateSource(
    key: string,
    patch: Partial<Pick<DataSource, 'url' | 'data' | 'listPath' | 'use'>>,
  ): string {
    let updated: DataSource | undefined
    const error = editSources((ss) =>
      ss.map((s) => {
        if (s.key !== key) return s
        const next: DataSource = { ...s, ...patch }
        for (const k of Object.keys(patch) as (keyof DataSource)[]) {
          if (next[k] === undefined) delete next[k]
        }
        if (!next.listPath) delete next.listPath
        return (updated = next)
      }),
    )
    if (error) return error
    if (updated) void fetchOne(updated)
    return ''
  }

  /**
   * Rename a source. Rules name a list source by key and read a values
   * source's values by it (`{"var": "teetime.target_day"}`), so either way
   * they're updated to match, and its loaded data and status move with it.
   */
  function renameSource(from: string, to: string): string {
    if (dataSources.value.some((s) => s.key === to)) return `There's already a source called "${to}".`
    if (to === FORM_NAMESPACE || to === PIPELINE_NAMESPACE) return `"${to}" is taken: rules read form values and pipelines under it.`
    if (rulesError.value) {
      return "The saved rules are invalid JSON, so the rules using this source can't be updated - import a config to replace them."
    }
    const isValues = dataSources.value.find((s) => s.key === from)?.use === 'values'
    const error = editSources((ss) => ss.map((s) => (s.key === from ? { ...s, key: to } : s)))
    if (error) return error
    editRules((rs) =>
      rs.map((r) => ({
        ...r,
        source: r.source === from ? to : r.source,
        // Only a values source is read through vars; a list source's key could
        // just as well be the name of one of its entries' own fields.
        logic: isValues ? (renameVar(r.logic, from, to) as Rule['logic']) : r.logic,
      })),
    )
    pipelines.value = pipelines.value.map((p) => ({
      ...p,
      blocks: p.blocks.map((b) => (b.type === 'source' && b.source === from ? { ...b, source: to } : b)),
    }))
    for (const map of [rawData, sourceValues, loading, errors, combine.value] as Record<string, unknown>[]) {
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
    delete sourceValues[key]
    delete loading[key]
    delete errors[key]
    delete combine.value[key]
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
    if (rulesError.value) return 'The saved rules are invalid JSON - import a config to replace them.'
    rulesText.value = JSON.stringify(edit(rulesConfig.value), null, 2)
    return ''
  }

  // --- Rule combinations ----------------------------------------------------
  function setCombination(source: string, group: RuleGroup): void {
    combine.value = { ...combine.value, [source]: group }
  }

  /** Rewrite rule keys across every stored combination (null drops the key). */
  function mapCombinationKeys(fn: (key: string) => string | null): void {
    combine.value = Object.fromEntries(Object.entries(combine.value).map(([s, g]) => [s, mapKeys(g, fn)]))
  }

  /** Add a rule to the end of its source's stored combination, if it has one. */
  function joinCombination(source: string, key: string): void {
    const group = combine.value[source]
    if (group) setCombination(source, { ...group, items: [...group.items, key] })
  }

  /** Append a match-everything rule on the first source, with a unique key. */
  function addRule(): { key: string } | { error: string } {
    let key = 'newRule'
    for (let n = 2; rulesConfig.value.some((r) => r.key === key); n++) key = `newRule${n}`
    const rule: Rule = { key, source: listSources.value[0]?.key ?? '', enabled: true, logic: true }
    const error = editRules((rs) => [...rs, rule])
    if (error) return { error }
    joinCombination(rule.source, key)
    return { key }
  }

  /** Update a rule. Moving it to another source moves it between their combinations too. */
  function updateRule(key: string, patch: Partial<Omit<Rule, 'key'>>): string {
    const from = rulesConfig.value.find((r) => r.key === key)?.source
    const error = editRules((rs) => rs.map((r) => (r.key === key ? { ...r, ...patch } : r)))
    if (error || patch.source === undefined || patch.source === from) return error
    if (from && combine.value[from]) setCombination(from, mapKeys(combine.value[from], (k) => (k === key ? null : k)))
    joinCombination(patch.source, key)
    return ''
  }

  /** Rename a rule, carrying its live toggle state and combination places over to the new key. */
  function renameRule(from: string, to: string): string {
    if (rulesConfig.value.some((r) => r.key === to)) return `There's already a rule called "${to}".`
    const error = editRules((rs) => rs.map((r) => (r.key === from ? { ...r, key: to } : r)))
    if (error) return error
    ruleToggles[to] = ruleToggles[from]
    delete ruleToggles[from]
    mapCombinationKeys((k) => (k === from ? to : k))
    return ''
  }

  function removeRule(key: string): string {
    const error = editRules((rs) => rs.filter((r) => r.key !== key))
    if (error) return error
    delete ruleToggles[key]
    mapCombinationKeys((k) => (k === key ? null : k))
    return ''
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

  // --- Pipelines ------------------------------------------------------------
  function findPipeline(name: string): Pipeline | undefined {
    return pipelines.value.find((p) => p.name === name)
  }

  /** Add a pipeline starting from the first source, with a unique placeholder name, returned for editing. */
  function addPipeline(): string {
    let name = 'New pipeline'
    for (let n = 2; findPipeline(name); n++) name = `New pipeline ${n}`
    const first = listSources.value[0]?.key ?? ''
    pipelines.value = [...pipelines.value, { name, blocks: [{ type: 'source', source: first }] }]
    return name
  }

  /** Rename a pipeline; pipelines reading its result, and the Results panel's pick, follow. */
  function renamePipeline(from: string, to: string): string {
    if (findPipeline(to)) return `There's already a pipeline called "${to}".`
    // Other pipelines read its result as pipelines.<name>, where a dot would split the name.
    if (to.includes('.')) return "A pipeline's name can't contain a dot."
    pipelines.value = pipelines.value.map((p) => renamePipelineRefs(p.name === from ? { ...p, name: to } : p, from, to))
    if (resultPipeline.value === from) resultPipeline.value = to
    return ''
  }

  function removePipeline(name: string): void {
    pipelines.value = pipelines.value.filter((p) => p.name !== name)
  }

  function setPipelineBlocks(name: string, blocks: Block[]): void {
    pipelines.value = pipelines.value.map((p) => (p.name === name ? { ...p, blocks } : p))
  }

  // --- Persistence ----------------------------------------------------------
  function persist(): void {
    saveCache({
      sourcesText: sourcesText.value,
      schemaText: schemaText.value,
      rulesText: rulesText.value,
      formData: formData.value,
      ruleToggles: { ...ruleToggles },
      combine: combine.value,
      pipelines: pipelines.value,
      resultPipeline: resultPipeline.value,
      rawData: { ...rawData },
      sourceValues: { ...sourceValues },
      sectionOpen: { ...sectionOpen },
    })
  }

  watch(
    [sourcesText, schemaText, rulesText, formData, ruleToggles, combine, pipelines, resultPipeline, sectionOpen],
    persist,
    { deep: true },
  )

  return {
    sourcesText,
    schemaText,
    rulesText,
    sourcesError,
    schemaError,
    rulesError,
    rawData,
    sourceValues,
    loading,
    errors,
    formData,
    ruleToggles,
    sectionOpen,
    dataSources,
    listSources,
    valueSources,
    schemaFields,
    rulesConfig,
    ruleFormData,
    formPathError,
    ruleMatchInfo,
    combine,
    pipelines,
    pipelineResults,
    compiledPipeline,
    resultPipeline,
    resultOf,
    formFieldOptions,
    valuePaths,
    addPipeline,
    renamePipeline,
    removePipeline,
    setPipelineBlocks,
    combinationFor,
    setCombination,
    compiledQueries,
    matchedEntries,
    sourceResults,
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
    setFieldHelp,
    removeField,
    addGroup,
    renameGroup,
    removeGroup,
    rulesReading,
    moveGroup,
    addSource,
    updateSource,
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
