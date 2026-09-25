import type { RuleGroup } from '@/types'

/**
 * A source's rules combined into one query: an and/or tree whose leaves are
 * rule keys. Leaves that don't resolve (a rule switched off, deleted, or on
 * another source) are skipped, as are groups left with nothing in them, so
 * the tree never has to be tidied before it's evaluated or compiled.
 */

export function isGroup(item: string | RuleGroup): item is RuleGroup {
  return typeof item === 'object'
}

/** Every rule key in the tree, nested groups included. */
export function keysIn(group: RuleGroup): string[] {
  return group.items.flatMap((i) => (isGroup(i) ? keysIn(i) : [i]))
}

/** Rewrite each rule key (return null to drop it), keeping the tree's shape. */
export function mapKeys(group: RuleGroup, fn: (key: string) => string | null): RuleGroup {
  const items: (string | RuleGroup)[] = []
  for (const i of group.items) {
    if (isGroup(i)) items.push(mapKeys(i, fn))
    else {
      const next = fn(i)
      if (next !== null) items.push(next)
    }
  }
  return { ...group, items }
}

/**
 * Evaluate the tree. `test` says whether a rule passes, or undefined when it
 * shouldn't count (switched off, gone). With nothing left to test, a group
 * passes: it adds no condition.
 */
export function evaluateGroup(group: RuleGroup, test: (key: string) => boolean | undefined): boolean {
  const results: boolean[] = []
  for (const i of group.items) {
    if (isGroup(i)) {
      if (hasLive(i, test)) results.push(evaluateGroup(i, test))
    } else {
      const r = test(i)
      if (r !== undefined) results.push(r)
    }
  }
  if (!results.length) return true
  return group.op === 'and' ? results.every(Boolean) : results.some(Boolean)
}

function hasLive(group: RuleGroup, test: (key: string) => boolean | undefined): boolean {
  return group.items.some((i) => (isGroup(i) ? hasLive(i, test) : test(i) !== undefined))
}

/**
 * The tree as one JSON Logic expression, each rule's logic inlined. `logicOf`
 * gives a rule's logic, or undefined to leave it out. Matches evaluateGroup:
 * a group with nothing left adds no condition, so the whole tree compiles to
 * `true` (matches everything) when nothing at all is left.
 */
export function compileGroup(group: RuleGroup, logicOf: (key: string) => unknown): unknown {
  return compileParts(group, logicOf) ?? true
}

// undefined = nothing live in this group, so its parent leaves it out.
function compileParts(group: RuleGroup, logicOf: (key: string) => unknown): unknown {
  let parts = group.items
    .map((i) => (isGroup(i) ? compileParts(i, logicOf) : logicOf(i)))
    .filter((p) => p !== undefined)
  if (!parts.length) return undefined
  // A literal `true` settles an "any of", and is a no-op in an "all of".
  if (group.op === 'or') {
    if (parts.includes(true)) return true
  } else {
    parts = parts.filter((p) => p !== true)
    if (!parts.length) return true
  }
  return parts.length === 1 ? parts[0] : { [group.op]: parts }
}

/** Loose check for imported or cached data: an and/or group of strings and groups. */
export function isRuleGroup(value: unknown): value is RuleGroup {
  if (!value || typeof value !== 'object') return false
  const g = value as Partial<RuleGroup>
  return (
    (g.op === 'and' || g.op === 'or') &&
    Array.isArray(g.items) &&
    g.items.every((i) => typeof i === 'string' || isRuleGroup(i))
  )
}
