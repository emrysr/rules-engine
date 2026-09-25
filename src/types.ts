import type { RulesLogic } from 'json-logic-js'
import type { Pipeline } from './pipeline'

/**
 * A list endpoint. `key` is both the namespace rules target via `source` and
 * the response field the array is auto-extracted from (see extractList).
 */
export interface DataSource {
  key: string
  /** Where the data is fetched from. A source has a `url` or pasted `data`. */
  url?: string
  /** Data pasted in instead of fetched: any JSON value. Present means pasted. */
  data?: unknown
  /**
   * Dotted path from the top of the data to what the source uses, for data
   * that wraps it (`data`, `response.items`). For a list source, without it
   * the list is found automatically.
   */
  listPath?: string
  /**
   * `values`: the data is an object of values put into every rule's scope
   * under the source's key (`{"var": "teetime.target_day"}`), rather than a
   * list of entries for rules to filter.
   */
  use?: 'values'
}

/** One choice of a select, radio or checkbox group: what's shown, what's stored. */
export interface FieldOption {
  label: string
  value: string
}

/** A FormKit field definition, rendered as a real <FormKit> input. */
export interface SchemaField {
  key: string
  label: string
  type: string
  /** Any shape FormKit accepts; the form editor writes FieldOption pairs. */
  options?: string[] | Record<string, string> | FieldOption[]
  default?: unknown
  /**
   * Extra Bulma classes, e.g. "is-primary is-rounded is-small". Added to the
   * element Bulma expects them on: the div.select wrapper for selects, the
   * input itself for everything else.
   */
  classes?: string
  /**
   * Fieldset legend. Fields sharing a group render together in one fieldset;
   * ungrouped fields render without one. Doesn't affect formData's shape.
   */
  group?: string
}

/**
 * A single filter. `enabled` is only the *default* toggle state - live toggle
 * state lives in the store's `ruleToggles` so editing the rules JSON never
 * clobbers what the user has switched on or off.
 */
export interface Rule {
  key: string
  source: string
  enabled?: boolean
  logic: RulesLogic
}

/**
 * How a source's rules combine into its result query: all of (`and`) or any
 * of (`or`) its items, each a rule key or a nested group.
 */
export interface RuleGroup {
  op: 'and' | 'or'
  items: (string | RuleGroup)[]
}

/** An arbitrary record from a data source. Shape is only known at runtime. */
export type Entry = Record<string, unknown>

/** Per-rule hit count, independent of whether the rule is toggled on. */
export interface MatchInfo {
  total: number
  matches: number
}

/** Per-source count after its Source Filter (its enabled rules, combined) is applied. */
export interface SourceResult {
  total: number
  matched: number
}

/**
 * A complete, portable config: everything needed to reproduce a setup in one
 * blob. `formData` is optional; fields it omits fall back to schema defaults.
 */
export interface EngineConfig {
  sources: DataSource[]
  schema: SchemaField[]
  rules: Rule[]
  /** How each source's rules combine, by source key; a source without one ANDs all its rules. */
  combine?: Record<string, RuleGroup>
  /** Pipelines built in the Filter Pipeline panel (see pipeline.ts). */
  pipelines?: Pipeline[]
  /** The pipeline whose result is the Results panel's, by name; without one, the last pipeline. */
  result?: string
  formData?: Record<string, unknown>
}

/** Everything restored from localStorage between visits. */
export interface PersistedState {
  sourcesText: string
  schemaText: string
  rulesText: string
  formData: Record<string, unknown>
  ruleToggles: Record<string, boolean>
  combine?: Record<string, RuleGroup>
  pipelines?: Pipeline[]
  resultPipeline?: string
  rawData: Record<string, Entry[]>
  /** What each values source last loaded, by source key. */
  sourceValues?: Record<string, unknown>
  sectionOpen: Record<SectionName, boolean>
}

export type SectionName = 'config' | 'sources' | 'form' | 'rules' | 'pipelines' | 'results'
