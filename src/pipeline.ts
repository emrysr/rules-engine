import jsonLogic from 'json-logic-js'
import { PIPELINE_NAMESPACE, renameVar, varPaths } from '@/paths'

/**
 * A pipeline: a stack of blocks, each taking the previous block's output,
 * that compiles to one nested JSON Logic expression. The first block is
 * always a source; the rest map to JSON Logic's list operations:
 *
 *   source "carts"                           → {"filter": [{"var": "carts"}, <carts Source Filter>]}
 *   filter (all of …)                        → {"filter": [<prev>, <condition>]}
 *   map category.id                          → {"map": [<prev>, {"var": "category.id"}]}
 *   map firstName, lastName                  → {"map": [<prev>, [{"var": "firstName"}, {"var": "lastName"}]]}
 *   test any / every / no item               → {"some" | "all" | "none": [<prev>, <condition>]}
 *   count                                    → {"reduce": [<prev>, {"+": [acc, 1]}, 0]}
 *
 * A pipeline starts from a list source, as its Source Filter leaves it. A
 * values source isn't a starting point, but conditions can read it. A condition can read the result of the pipeline directly
 * above as `{"var": "pipelines.<name>"}`, which Copy JSON replaces with that
 * pipeline's own expression, and can ask whether an item's list field has
 * an item passing a condition of its own (`some`).
 *
 * Inside filter / map / test, each item's own fields are read directly, and
 * the pipeline's inputs (sources and form values) are in scope too, with the
 * item's fields winning a clash. Standard JSON Logic engines only show the
 * item there, so the host app has to supply the inputs inside list
 * operations for conditions that read them.
 */

/** A list of rows (each plain JSON Logic) joined all / any / none. */
export interface Condition {
  op: 'and' | 'or' | 'none'
  items: unknown[]
}

export type Block =
  | { type: 'source'; source: string }
  | { type: 'filter'; condition: Condition }
  /** `path`: the field each item becomes, or several separated by commas for a list per item. */
  | { type: 'map'; path: string }
  | { type: 'test'; mode: 'some' | 'all' | 'none'; condition: Condition }
  | { type: 'count' }

export type BlockType = Block['type']

export interface Pipeline {
  name: string
  blocks: Block[]
  /** Switched off: still runs for its previews, but Results and the pipeline below skip it. */
  off?: boolean
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

/**
 * Inverse of compileCondition, for the condition inside a "has an item
 * where" row. Rows are never `and` / `or` / `!` themselves, so the shapes
 * don't overlap.
 */
export function parseCondition(logic: unknown): Condition {
  if (logic === true) return { op: 'and', items: [] }
  if (logic && typeof logic === 'object' && !Array.isArray(logic)) {
    const [op, arg] = Object.entries(logic)[0] ?? []
    if ((op === 'and' || op === 'or') && Array.isArray(arg)) return { op, items: arg }
    if (op === '!') {
      const inner = arg as Record<string, unknown>
      return { op: 'none', items: Array.isArray(inner?.or) ? inner.or : [arg] }
    }
  }
  return { op: 'and', items: [logic] }
}

/**
 * A "check a list" row: `path`, a list on the item (or the item itself when
 * empty), has at least one / every / no item passing `condition`. Compiles
 * to JSON Logic's `some` / `all` / `none`.
 */
export interface HasItem {
  path: string
  mode: 'some' | 'all' | 'none'
  condition: Condition
}

export const HAS_ITEM_MODES: { mode: HasItem['mode']; label: string }[] = [
  { mode: 'some', label: 'has at least one item' },
  { mode: 'all', label: 'has every item' },
  { mode: 'none', label: 'has no item' },
]

/** The row as a HasItem, or null for any other row (a comparison). */
export function parseHasItem(row: unknown): HasItem | null {
  if (!row || typeof row !== 'object' || Array.isArray(row) || Object.keys(row).length !== 1) return null
  const [mode, args] = Object.entries(row)[0]
  if (!HAS_ITEM_MODES.some((m) => m.mode === mode) || !Array.isArray(args) || args.length !== 2) return null
  const path = (args[0] as { var?: unknown } | null)?.var
  return typeof path === 'string' ? { path, mode: mode as HasItem['mode'], condition: parseCondition(args[1]) } : null
}

export function hasItemLogic(h: HasItem): unknown {
  return { [h.mode]: [{ var: h.path }, compileCondition(h.condition)] }
}

/** A map block's fields: its path split on commas. */
export function mapFields(path: string): string[] {
  return path
    .split(',')
    .map((f) => f.trim())
    .filter(Boolean)
}

/** What a map block turns each item into: one field, or a list of several. */
function mapExpr(path: string): unknown {
  const vars = mapFields(path).map((f) => ({ var: f }))
  return vars.length === 1 ? vars[0] : vars
}

// --- References between pipelines -------------------------------------------

const PIPELINE_PREFIX = PIPELINE_NAMESPACE + '.'

/** The pipelines a block's conditions read, by name. */
function blockRefs(b: Block): string[] {
  if (b.type !== 'filter' && b.type !== 'test') return []
  return varPaths(b.condition.items)
    .filter((p) => p.startsWith(PIPELINE_PREFIX))
    .map((p) => p.slice(PIPELINE_PREFIX.length))
}

/** A pipeline with every read of pipeline `from`'s result reading `to` instead. */
export function renamePipelineRefs(p: Pipeline, from: string, to: string): Pipeline {
  const swap = (c: Condition): Condition => ({
    ...c,
    items: renameVar(c.items, PIPELINE_PREFIX + from, PIPELINE_PREFIX + to) as unknown[],
  })
  return {
    ...p,
    blocks: p.blocks.map((b) => (b.type === 'filter' || b.type === 'test' ? { ...b, condition: swap(b.condition) } : b)),
  }
}

/** Replace each read of a pipeline's result with that pipeline's expression. */
function inlineRefs(logic: unknown, expr: (name: string) => unknown): unknown {
  if (Array.isArray(logic)) return logic.map((l) => inlineRefs(l, expr))
  if (!logic || typeof logic !== 'object') return logic
  const path = (logic as { var?: unknown }).var
  if (Object.keys(logic).length === 1 && typeof path === 'string' && path.startsWith(PIPELINE_PREFIX)) {
    return expr(path.slice(PIPELINE_PREFIX.length))
  }
  return Object.fromEntries(Object.entries(logic).map(([k, v]) => [k, inlineRefs(v, expr)]))
}

// --- Compiling --------------------------------------------------------------

/** What compiling needs from the rest of the setup. */
export interface CompileContext {
  /** A list source's Source Filter as JSON Logic. */
  sourceFilter(key: string): unknown
  /** Every pipeline in order, to inline the one above when it's read. */
  pipelines: Pipeline[]
}

/**
 * The whole pipeline as one JSON Logic expression, ready to paste into
 * another app: its Source Filters and the pipeline above it (if read)
 * written in. A read of any other pipeline, which can't run, is left as a var.
 */
export function compilePipeline(p: Pipeline, ctx: CompileContext): unknown {
  const prev = ctx.pipelines[ctx.pipelines.findIndex((q) => q.name === p.name) - 1]
  const expr = (name: string): unknown =>
    prev && name === prev.name ? compilePipeline(prev, ctx) : { var: PIPELINE_PREFIX + name }
  const cond = (c: Condition) => inlineRefs(compileCondition(c), expr)

  let out: unknown = true
  for (const b of p.blocks) {
    switch (b.type) {
      case 'source': {
        out = { var: b.source }
        const filter = ctx.sourceFilter(b.source)
        if (filter !== undefined && filter !== true) out = { filter: [out, filter] }
        break
      }
      case 'filter':
        out = { filter: [out, cond(b.condition)] }
        break
      case 'map':
        out = { map: [out, mapExpr(b.path)] }
        break
      case 'test':
        out = { [b.mode]: [out, cond(b.condition)] }
        break
      case 'count':
        out = { reduce: [out, { '+': [{ var: 'accumulator' }, 1] }, 0] }
        break
    }
  }
  return out
}

// --- Running ----------------------------------------------------------------

/** What one block produced: its output, or why it couldn't run. */
export type StepResult = { ok: true; value: unknown } | { ok: false; error: string }

/** What running needs from the rest of the setup. */
export interface RunContext {
  /** Every input by name: list sources after their Source Filters, values sources, form values. */
  scope: Record<string, unknown>
  /** The list sources' keys: what a pipeline can start from. */
  listSources: string[]
  /** The results this pipeline can read, by pipeline name: the one above's, once it's run. */
  results: Record<string, unknown>
  /** Why a pipeline's result can't be read, by name, for blocks reading it. */
  problems: Record<string, string>
}

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

/**
 * Whether one row passes for the item. "Check a list" rows are run here
 * rather than by json-logic-js, so the inputs (form values, sources) stay in
 * scope for the list's items too. As JSON Logic, "every" of an empty list
 * is false. Used by Source Filter rules as well as pipeline conditions.
 */
export function rowPasses(row: unknown, scope: Record<string, unknown>, item: unknown): boolean {
  const has = parseHasItem(row)
  const data = itemScope(scope, item)
  if (!has) return jsonLogic.truthy(jsonLogic.apply(row as never, data as never))
  const list = readPath(data, has.path)
  if (!Array.isArray(list)) return false
  const hits = list.filter((inner) => passes(has.condition, scope, inner)).length
  return has.mode === 'some' ? hits > 0 : has.mode === 'all' ? list.length > 0 && hits === list.length : hits === 0
}

/** Whether the item passes the condition's rows, joined all / any / none. */
function passes(condition: Condition, scope: Record<string, unknown>, item: unknown): boolean {
  const check = (row: unknown) => rowPasses(row, scope, item)
  if (!condition.items.length) return true
  if (condition.op === 'and') return condition.items.every(check)
  if (condition.op === 'or') return condition.items.some(check)
  return !condition.items.some(check)
}

/** Stop a block that reads a pipeline with no result, saying why. */
function checkRefs(b: Block, ctx: RunContext): void {
  for (const name of blockRefs(b)) {
    if (name in ctx.results) continue
    throw new Error(ctx.problems[name] ?? `There's no pipeline called "${name}".`)
  }
}

/**
 * Run the pipeline block by block, keeping each block's output for its
 * preview. A block that can't run stops the ones after it.
 */
export function runPipeline(p: Pipeline, ctx: RunContext): StepResult[] {
  const scope: Record<string, unknown> = { ...ctx.scope, [PIPELINE_NAMESPACE]: ctx.results }
  const results: StepResult[] = []
  let value: unknown
  for (const b of p.blocks) {
    if (results.length && !results[results.length - 1].ok) {
      results.push({ ok: false, error: 'Waiting on the block above.' })
      continue
    }
    try {
      checkRefs(b, ctx)
      switch (b.type) {
        case 'source': {
          if (!b.source) throw new Error('Pick a source.')
          if (!ctx.listSources.includes(b.source)) {
            throw new Error(`"${b.source}" isn't a list source - a pipeline starts from a filtered list.`)
          }
          value = scope[b.source]
          if (value === null || value === undefined) throw new Error(`${b.source} hasn't loaded.`)
          break
        }
        case 'filter':
          value = asList(value, 'Filter').filter((item) => passes(b.condition, scope, item))
          break
        case 'map':
          if (!mapFields(b.path).length) throw new Error('Pick a field to map to.')
          const expr = mapExpr(b.path)
          value = asList(value, 'Map').map((item) => jsonLogic.apply(expr as never, item as never))
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

/**
 * Run every pipeline in order. Each can read only the result of the
 * pipeline directly above it, so the stack reads top to bottom and the
 * last one's result is where it ends up.
 */
export function runPipelines(
  pipelines: Pipeline[],
  ctx: Omit<RunContext, 'results' | 'problems'>,
): Record<string, StepResult[]> {
  const out: Record<string, StepResult[]> = {}
  pipelines.forEach((p, i) => {
    const prev = pipelines[i - 1]
    const results: Record<string, unknown> = {}
    const problems: Record<string, string> = {}
    for (const other of pipelines) {
      if (other !== prev) problems[other.name] = `"${p.name}" can only read the pipeline directly above it.`
    }
    if (prev?.off) {
      problems[prev.name] = `"${prev.name}" is switched off - tick it to use its result here.`
    } else if (prev) {
      const last = finalResult(out[prev.name])
      if (last?.ok) results[prev.name] = last.value
      else problems[prev.name] = `"${prev.name}" has no result yet.`
    }
    out[p.name] = runPipeline(p, { ...ctx, results, problems })
  })
  return out
}

/** The pipeline's result: its last block's output, if it ran. */
export function finalResult(steps: StepResult[] | undefined): StepResult | undefined {
  return steps?.[steps.length - 1]
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
