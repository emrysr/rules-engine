import type { SchemaField } from '@/types'

/**
 * How rules address form values. A field's rule path is built from what the
 * user sees - its group's legend and its label, snake_cased - so a field
 * labelled "Minimum product rating" in the "Products" fieldset is read as
 * `formData.products.minimum_product_rating`. Values themselves stay stored
 * under the field's stable `key`, so renaming never loses one.
 */

export const FORM_NAMESPACE = 'formData'

/** Where a pipeline's conditions read other pipelines' results: `pipelines.<name>`. */
export const PIPELINE_NAMESPACE = 'pipelines'

/** "Minimum product rating" → "minimum_product_rating". */
export function snakeCase(text: string): string {
  return text
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
}

/** Path below `formData`; the key stands in for a label that snake_cases to nothing. */
export function fieldPath(f: SchemaField): string {
  const name = snakeCase(f.label ?? '') || snakeCase(f.key)
  const group = f.group ? snakeCase(f.group) : ''
  return group ? `${group}.${name}` : name
}

/** The full `var` path a rule uses to read this field. */
export function rulePath(f: SchemaField): string {
  return `${FORM_NAMESPACE}.${fieldPath(f)}`
}

function overlaps(a: string, b: string): boolean {
  return a === b || a.startsWith(b + '.') || b.startsWith(a + '.')
}

/** The first of `others` whose path collides with `field`'s, if any. */
export function pathClash(field: SchemaField, others: SchemaField[]): SchemaField | undefined {
  const p = fieldPath(field)
  return others.find((o) => o.key !== field.key && overlaps(p, fieldPath(o)))
}

/**
 * Describe the first pair of fields whose paths collide - the same path, or
 * one nested under the other (an ungrouped "Products" field vs the Products
 * group). '' when every path is distinct.
 */
export function findPathClash(fields: SchemaField[]): string {
  for (const [i, f] of fields.entries()) {
    const other = pathClash(f, fields.slice(0, i))
    if (other) {
      return `"${f.label || f.key}" (${rulePath(f)}) clashes with "${other.label || other.key}" (${rulePath(other)}).`
    }
  }
  return ''
}

/** Reshape the flat, key-indexed values into the nested object rules read. */
export function buildRuleData(
  fields: SchemaField[],
  values: Record<string, unknown>,
): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  for (const f of fields) {
    const parts = fieldPath(f).split('.')
    const last = parts.pop()!
    let node = out
    for (const part of parts) {
      const child = node[part]
      node = (child && typeof child === 'object' ? child : (node[part] = {})) as Record<
        string,
        unknown
      >
    }
    node[last] = values[f.key]
  }
  return out
}

/** Every literal `var` path in a JSON Logic tree (computed paths are skipped). */
export function varPaths(logic: unknown): string[] {
  if (Array.isArray(logic)) return logic.flatMap(varPaths)
  if (!logic || typeof logic !== 'object') return []
  return Object.entries(logic).flatMap(([op, arg]) => {
    if (op !== 'var') return varPaths(arg)
    if (typeof arg === 'string') return [arg]
    if (Array.isArray(arg) && typeof arg[0] === 'string') return [arg[0]]
    return []
  })
}

function swapPath(path: string, from: string, to: string): string {
  if (path === from) return to
  if (path.startsWith(from + '.')) return to + path.slice(from.length)
  return path
}

/**
 * Rewrite every `var` in a JSON Logic tree that reads `from` (or anything
 * under it) to read `to` instead. Handles both `{"var": "a.b"}` and the
 * default-value form `{"var": ["a.b", 0]}`; computed paths are left alone.
 */
export function renameVar(logic: unknown, from: string, to: string): unknown {
  if (Array.isArray(logic)) return logic.map((l) => renameVar(l, from, to))
  if (!logic || typeof logic !== 'object') return logic
  return Object.fromEntries(
    Object.entries(logic).map(([op, arg]) => {
      if (op !== 'var') return [op, renameVar(arg, from, to)]
      if (typeof arg === 'string') return [op, swapPath(arg, from, to)]
      if (Array.isArray(arg) && typeof arg[0] === 'string') {
        return [op, [swapPath(arg[0], from, to), ...arg.slice(1)]]
      }
      return [op, arg]
    }),
  )
}
