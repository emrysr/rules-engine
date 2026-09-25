import jsonLogic from 'json-logic-js'

/**
 * A pipeline: a stack of blocks, each taking the previous block's output,
 * that compiles to one nested JSON Logic expression. The first block is
 * always a source; the rest map to JSON Logic's list operations:
 *
 *   source "fairway", path "ruleset.rules"  → {"var": "fairway.ruleset.rules"}
 *   filter (all of …)                        → {"filter": [<prev>, <condition>]}
 *   map category.id                          → {"map": [<prev>, {"var": "category.id"}]}
 *   test any / every / no item               → {"some" | "all" | "none": [<prev>, <condition>]}
 *   count                                    → {"reduce": [<prev>, {"+": [acc, 1]}, 0]}
 *
 * Inside filter / map / test, each item's own fields are read directly, and
 * the pipeline's inputs (sources and form values) are in scope too, with the
 * item's fields winning a clash. Standard JSON Logic engines only show the
 * item there, so the host app has to supply the inputs inside list
 * operations for conditions that read them.
 */

/** A list of comparison rules (each plain JSON Logic) joined all / any / none. */
export interface Condition {
  op: 'and' | 'or' | 'none'
  items: unknown[]
}

export type Block =
  | { type: 'source'; source: string; path?: string }
  | { type: 'filter'; condition: Condition }
  | { type: 'map'; path: string }
  | { type: 'test'; mode: 'some' | 'all' | 'none'; condition: Condition }
  | { type: 'count' }

export type BlockType = Block['type']

export interface Pipeline {
  name: string
  blocks: Block[]
}

export const BLOCK_LABELS: Record<BlockType, string> = {
  source: 'Source',
  filter: 'Filter',
  map: 'Map',
  test: 'Test',
  count: 'Count',
}

/** A new block of the given type, empty but usable. */
export function newBlock(type: Exclude<BlockType, 'source'>): Block {
  switch (type) {
    case 'filter':
      return { type, condition: { op: 'and', items: [] } }
    case 'map':
      return { type, path: '' }
    case 'test':
      return { type, mode: 'some', condition: { op: 'and', items: [] } }
    case 'count':
      return { type }
  }
}

/** The condition as one JSON Logic expression; nothing in it matches everything. */
export function compileCondition(c: Condition): unknown {
  if (!c.items.length) return true
  if (c.op === 'none') return { '!': c.items.length === 1 ? c.items[0] : { or: c.items } }
  return c.items.length === 1 ? c.items[0] : { [c.op]: c.items }
}

/** The whole pipeline as one JSON Logic expression, ready to paste into another app. */
export function compilePipeline(p: Pipeline): unknown {
  let expr: unknown = true
  for (const b of p.blocks) {
    switch (b.type) {
      case 'source':
        expr = { var: b.path ? `${b.source}.${b.path}` : b.source }
        break
      case 'filter':
        expr = { filter: [expr, compileCondition(b.condition)] }
        break
      case 'map':
        expr = { map: [expr, { var: b.path }] }
        break
      case 'test':
        expr = { [b.mode]: [expr, compileCondition(b.condition)] }
        break
      case 'count':
        expr = { reduce: [expr, { '+': [{ var: 'accumulator' }, 1] }, 0] }
        break
    }
  }
  return expr
}

/** What one block produced: its output, or why it couldn't run. */
export type StepResult = { ok: true; value: unknown } | { ok: false; error: string }

function readPath(data: unknown, path: string): unknown {
  return jsonLogic.apply({ var: path }, data as Record<string, unknown>)
}

function asList(value: unknown, block: string): unknown[] {
  if (Array.isArray(value)) return value
  throw new Error(`${block} needs a list, but got ${value === null ? 'nothing' : typeof value === 'object' ? 'an object' : `a ${typeof value}`}.`)
}

/**
 * An item as conditions see it: the inputs, overlaid with the item's own
 * fields. A plain value (a number, a string) is the data itself, as JSON
 * Logic has it, so `{"var": ""}` reads it.
 */
function itemScope(scope: Record<string, unknown>, item: unknown): unknown {
  return item && typeof item === 'object' && !Array.isArray(item) ? { ...scope, ...(item as object) } : item
}

function passes(condition: Condition, scope: Record<string, unknown>, item: unknown): boolean {
  return jsonLogic.truthy(jsonLogic.apply(compileCondition(condition) as never, itemScope(scope, item) as never))
}

/**
 * Run the pipeline block by block against `scope` (every source and the
 * form values, by key), keeping each block's output for its preview. A block
 * that can't run stops the ones after it.
 */
export function runPipeline(p: Pipeline, scope: Record<string, unknown>): StepResult[] {
  const results: StepResult[] = []
  let value: unknown
  for (const b of p.blocks) {
    if (results.length && !results[results.length - 1].ok) {
      results.push({ ok: false, error: 'Waiting on the block above.' })
      continue
    }
    try {
      switch (b.type) {
        case 'source':
          if (!b.source) throw new Error('Pick a source.')
          value = readPath(scope, b.path ? `${b.source}.${b.path}` : b.source)
          if (value === null || value === undefined) {
            throw new Error(b.path ? `No "${b.path}" in ${b.source}.` : `${b.source} hasn't loaded.`)
          }
          break
        case 'filter':
          value = asList(value, 'Filter').filter((item) => passes(b.condition, scope, item))
          break
        case 'map':
          if (!b.path) throw new Error('Pick a field to map to.')
          value = asList(value, 'Map').map((item) => readPath(item, b.path))
          break
        case 'test': {
          const items = asList(value, 'Test')
          const hits = items.filter((item) => passes(b.condition, scope, item)).length
          // As JSON Logic: "every" of an empty list is false.
          value = b.mode === 'some' ? hits > 0 : b.mode === 'all' ? items.length > 0 && hits === items.length : hits === 0
          break
        }
        case 'count':
          value = asList(value, 'Count').length
          break
      }
      results.push({ ok: true, value })
    } catch (e) {
      results.push({ ok: false, error: (e as Error).message })
    }
  }
  return results
}

/** A short description of a block's output, for its header: "3 items", "true", "12". */
export function describe(value: unknown): string {
  if (Array.isArray(value)) return `${value.length} ${value.length === 1 ? 'item' : 'items'}`
  if (value && typeof value === 'object') return `object, ${Object.keys(value).length} fields`
  return JSON.stringify(value)
}

/** Loose check for imported or cached pipelines. */
export function isPipeline(value: unknown): value is Pipeline {
  if (!value || typeof value !== 'object') return false
  const p = value as Partial<Pipeline>
  return (
    typeof p.name === 'string' &&
    Array.isArray(p.blocks) &&
    p.blocks.length > 0 &&
    p.blocks[0]?.type === 'source' &&
    p.blocks.every((b) => b && typeof b === 'object' && b.type in BLOCK_LABELS)
  )
}
