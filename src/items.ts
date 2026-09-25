import jsonLogic from 'json-logic-js'
import { entryPaths } from '@/comparison'

/**
 * What the condition editors know about the items they test, from a sample
 * of them: their fields, which fields hold lists, and whether the items are
 * lists or plain values themselves (a map to several fields, or to one).
 */

const SAMPLE = 20

export function read(item: unknown, path: string): unknown {
  return jsonLogic.apply({ var: path }, item as Record<string, unknown>)
}

export function objectsOf(items: unknown[]): Record<string, unknown>[] {
  return items.filter((i) => i && typeof i === 'object' && !Array.isArray(i)) as Record<string, unknown>[]
}

/** The items' field paths, e.g. `rating`, `dimensions.width`. */
export function fieldPaths(items: unknown[]): string[] {
  return entryPaths(objectsOf(items))
}

/** The items' fields that hold lists, e.g. a cart's `products`. */
export function listPaths(items: unknown[]): string[] {
  const objects = objectsOf(items).slice(0, SAMPLE)
  return fieldPaths(items).filter((p) => objects.some((o) => Array.isArray(read(o, p))))
}

/** The items are lists themselves, so a list check reads each item as its list. */
export function itemsAreLists(items: unknown[]): boolean {
  return items.length > 0 && items.slice(0, SAMPLE).every(Array.isArray)
}

/** The items are plain values ("Sofia", 4) with no fields: an empty field reads the value itself. */
export function itemsArePlain(items: unknown[]): boolean {
  return items.length > 0 && items.slice(0, SAMPLE).every((i) => i === null || typeof i !== 'object')
}

/** The items inside a list field (the item itself when `path` is empty), across the sample. */
export function innerItems(items: unknown[], path: string): unknown[] {
  return items.slice(0, SAMPLE).flatMap((item) => {
    const list = path ? (objectsOf([item]).length ? read(item, path) : undefined) : item
    return Array.isArray(list) ? list : []
  })
}

/** Whether there's any list to check on these items: a list field, or the items themselves. */
export function canCheckList(items: unknown[]): boolean {
  return itemsAreLists(items) || listPaths(items).length > 0
}
