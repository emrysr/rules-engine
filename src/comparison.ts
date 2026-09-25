import type { Entry } from '@/types'
import { FORM_NAMESPACE, PIPELINE_NAMESPACE } from '@/paths'

/**
 * The single comparison the rule builder edits: `left <op> right`,
 * stored as plain JSON Logic (`{"<op>": [left, right]}`). Each side is an
 * entry field (`{"var": "rating"}`), a form field
 * (`{"var": "formData.products.minimum_product_rating"}`), a values
 * source's value, another pipeline's result (`{"var": "pipelines.Buyers"}`,
 * in pipelines only) or a value hard-coded into the rule (`4`, `"smartphones"`).
 */

export const OPERATORS = [
  { op: '==', label: 'equals' },
  { op: '!=', label: 'does not equal' },
  { op: '>', label: 'is greater than' },
  { op: '>=', label: 'is at least' },
  { op: '<', label: 'is less than' },
  { op: '<=', label: 'is at most' },
  { op: 'in', label: 'is one of' },
] as const

export type Operator = (typeof OPERATORS)[number]['op']

export type OperandKind = 'entry' | 'form' | 'source' | 'pipeline' | 'value'

export type Literal = string | number | boolean | null

/** `source`: a values source's value, read as `{"var": "<source key>.<field>"}`. */
export type Operand =
  | { kind: 'entry'; path: string }
  | { kind: 'form'; path: string }
  | { kind: 'source'; path: string }
  | { kind: 'pipeline'; name: string }
  | { kind: 'value'; value: Literal }

export interface Comparison {
  op: Operator
  left: Operand
  right: Operand
}

const FORM_PREFIX = FORM_NAMESPACE + '.'
const PIPELINE_PREFIX = PIPELINE_NAMESPACE + '.'

function isLiteral(x: unknown): x is Literal {
  return x === null || ['string', 'number', 'boolean'].includes(typeof x)
}

function parseOperand(x: unknown, valueKeys: string[]): Operand | null {
  if (isLiteral(x)) return { kind: 'value', value: x }
  if (!x || typeof x !== 'object' || Array.isArray(x)) return null
  const keys = Object.keys(x)
  const path = (x as { var?: unknown }).var
  if (keys.length !== 1 || typeof path !== 'string') return null
  if (path.startsWith(FORM_PREFIX)) return { kind: 'form', path }
  if (path.startsWith(PIPELINE_PREFIX)) return { kind: 'pipeline', name: path.slice(PIPELINE_PREFIX.length) }
  if (valueKeys.includes(path.split('.')[0])) return { kind: 'source', path }
  return { kind: 'entry', path }
}

/**
 * The comparison a rule's logic spells out, or null if it's anything else.
 * `valueKeys` are the values sources' keys, so their vars read as source values.
 */
export function parseComparison(logic: unknown, valueKeys: string[] = []): Comparison | null {
  if (!logic || typeof logic !== 'object' || Array.isArray(logic)) return null
  const entries = Object.entries(logic)
  if (entries.length !== 1) return null
  const [op, args] = entries[0]
  if (!OPERATORS.some((o) => o.op === op) || !Array.isArray(args) || args.length !== 2) return null
  const left = parseOperand(args[0], valueKeys)
  const right = parseOperand(args[1], valueKeys)
  return left && right ? { op: op as Operator, left, right } : null
}

function operandLogic(o: Operand): unknown {
  if (o.kind === 'value') return o.value
  return { var: o.kind === 'pipeline' ? PIPELINE_PREFIX + o.name : o.path }
}

export function comparisonLogic(c: Comparison): Record<string, unknown> {
  return { [c.op]: [operandLogic(c.left), operandLogic(c.right)] }
}

/**
 * Read typed text as the value it looks like: numbers, true/false and null
 * become those; anything else stays a string. Quote it ("4") to keep a
 * number-like string a string.
 */
export function parseLiteral(text: string): Literal {
  const t = text.trim()
  if (t === 'true') return true
  if (t === 'false') return false
  if (t === 'null') return null
  if (t !== '' && Number.isFinite(Number(t))) return Number(t)
  const quoted = /^"(.*)"$/.exec(t)
  return quoted ? quoted[1] : text
}

/** Inverse of parseLiteral, so a value survives a round trip through the input. */
export function literalText(v: Literal): string {
  if (typeof v !== 'string') return String(v)
  return parseLiteral(v) === v ? v : `"${v}"`
}

/**
 * Field paths found in fetched entries, dotted for nested objects
 * (`dimensions.width`). Samples the first few entries; lists count as fields
 * themselves rather than being walked into.
 */
export function entryPaths(entries: Entry[], sample = 20): string[] {
  const paths = new Set<string>()
  const walk = (obj: Record<string, unknown>, prefix: string, depth: number) => {
    for (const [k, v] of Object.entries(obj)) {
      const path = prefix + k
      if (v && typeof v === 'object' && !Array.isArray(v) && depth < 2) {
        walk(v as Record<string, unknown>, path + '.', depth + 1)
      } else {
        paths.add(path)
      }
    }
  }
  for (const e of entries.slice(0, sample)) walk(e, '', 0)
  return [...paths]
}
