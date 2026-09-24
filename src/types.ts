import type { RulesLogic } from 'json-logic-js'

/**
 * A list endpoint. `key` is both the namespace rules target via `source` and
 * the response field the array is auto-extracted from (see extractList).
 */
export interface DataSource {
  key: string
  url: string
}

/** A FormKit field definition, rendered as a real <FormKit> input. */
export interface SchemaField {
  key: string
  label: string
  type: string
  options?: string[] | Record<string, string>
  default?: unknown
}

/**
 * A single filter. `enabled` is only the *default* toggle state — live toggle
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

export type SectionName = 'config' | 'form' | 'rules' | 'results' | 'fetched'
