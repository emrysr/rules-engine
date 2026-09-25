import type { EngineConfig } from '@/types'
import { isRuleGroup } from '@/combine'

function isObject(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value)
}

/** Check that `value` is an array of objects each carrying the given string fields. */
function checkList(value: unknown, name: string, stringFields: string[]): string | null {
  if (!Array.isArray(value)) return `"${name}" must be an array.`
  for (const [i, item] of value.entries()) {
    if (!isObject(item)) return `${name}[${i}] must be an object.`
    for (const field of stringFields) {
      if (typeof item[field] !== 'string' || item[field] === '') {
        return `${name}[${i}] is missing a "${field}" string.`
      }
    }
  }
  return null
}

/**
 * Parse and validate a complete config blob. Validation is structural only -
 * enough that an import can't leave the app holding a shape it can't render.
 * Whether a rule's JSON Logic makes sense is still decided at evaluation time.
 */
export function parseConfig(text: string): { config: EngineConfig } | { error: string } {
  let value: unknown
  try {
    value = JSON.parse(text)
  } catch (e) {
    return { error: 'Invalid JSON: ' + (e as Error).message }
  }
  if (!isObject(value)) {
    return { error: 'Config must be an object with "sources", "schema" and "rules".' }
  }

  const problem =
    checkList(value.sources, 'sources', ['key']) ??
    checkList(value.schema, 'schema', ['key', 'type']) ??
    checkList(value.rules, 'rules', ['key', 'source'])
  if (problem) return { error: problem }

  const sources = value.sources as Record<string, unknown>[]
  for (const [i, s] of sources.entries()) {
    if (s.data === undefined && typeof s.url !== 'string') {
      return { error: `sources[${i}] needs a "url" string or pasted "data".` }
    }
    if (s.listPath !== undefined && typeof s.listPath !== 'string') {
      return { error: `sources[${i}].listPath must be a string when present.` }
    }
    if (s.use !== undefined && s.use !== 'values') {
      return { error: `sources[${i}].use must be "values" when present.` }
    }
  }

  const rules = value.rules as Record<string, unknown>[]
  const badLogic = rules.findIndex((r) => !('logic' in r))
  if (badLogic !== -1) return { error: `rules[${badLogic}] is missing "logic".` }

  if (value.combine !== undefined) {
    if (!isObject(value.combine)) return { error: '"combine" must be an object when present.' }
    const bad = Object.entries(value.combine).find(([, g]) => !isRuleGroup(g))
    if (bad) {
      return { error: `combine.${bad[0]} must be { "op": "and" | "or", "items": [rule keys or groups] }.` }
    }
  }

  if (value.formData !== undefined && !isObject(value.formData)) {
    return { error: '"formData" must be an object when present.' }
  }

  return { config: value as unknown as EngineConfig }
}
