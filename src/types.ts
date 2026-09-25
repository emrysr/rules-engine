import type { RulesLogic } from 'json-logic-js'

/**
 * A list endpoint. `key` is both the namespace rules target via `source` and
 * the response field the array is auto-extracted from (see extractList).
 */
export interface DataSource {
  key: string
  url: string
  /**
   * Dotted path from the top of the response to the list, for APIs that wrap
   * it (`data`, `response.items`). Without it the list is found automatically.
   */
  listPath?: string
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

/** An arbitrary record from a data source. Shape is only known at runtime. */
export type Entry = Record<string, unknown>

/** Per-rule hit count, independent of whether the rule is toggled on. */
export interface MatchInfo {
  total: number
  matches: number
}

/** Per-source count after every *enabled* rule for that source is applied. */
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
  formData?: Record<string, unknown>
}

/** Everything restored from localStorage between visits. */
export interface PersistedState {
  sourcesText: string
  schemaText: string
  rulesText: string
  formData: Record<string, unknown>
  ruleToggles: Record<string, boolean>
  rawData: Record<string, Entry[]>
  sectionOpen: Record<SectionName, boolean>
}

export type SectionName = 'config' | 'sources' | 'form' | 'rules' | 'results'
