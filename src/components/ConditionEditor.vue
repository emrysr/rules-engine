<script setup lang="ts">
import { computed, useId } from 'vue'
import jsonLogic from 'json-logic-js'
import { comparisonLogic, entryPaths } from '@/comparison'
import { hasItemLogic, parseHasItem } from '@/pipeline'
import type { Condition, HasItem } from '@/pipeline'
import ComparisonRow from './ComparisonRow.vue'

/**
 * A pipeline block's condition: rows joined all of / any of / none of. A row
 * is a comparison, or "has an item where": one of the item's list fields has
 * an item passing a condition of its own, edited by a nested editor.
 * Emits the whole updated condition.
 */
const props = defineProps<{
  condition: Condition
  /** The items being tested (a sample is enough), for field suggestions. */
  items: unknown[]
  /** Pipelines whose result the rows can read, by name. */
  pipelines: string[]
  label: string
}>()
const emit = defineEmits<{ update: [condition: Condition] }>()

const listId = useId()

function read(item: unknown, path: string): unknown {
  return jsonLogic.apply({ var: path }, item as Record<string, unknown>)
}

const objects = computed(
  () => props.items.filter((i) => i && typeof i === 'object' && !Array.isArray(i)) as Record<string, unknown>[],
)

const itemPaths = computed(() => entryPaths(objects.value))

/** Item fields holding lists, for "has an item where". */
const listPaths = computed(() =>
  itemPaths.value.filter((p) => objects.value.slice(0, 20).some((o) => Array.isArray(read(o, p)))),
)

/** The inner items of a list field across the items, for the nested editor's suggestions. */
function innerItems(path: string): unknown[] {
  return objects.value.slice(0, 20).flatMap((o) => {
    const list = read(o, path)
    return Array.isArray(list) ? list : []
  })
}

function setItems(items: unknown[]) {
  emit('update', { ...props.condition, items })
}

function setRow(i: number, row: unknown) {
  setItems(props.condition.items.map((r, j) => (j === i ? row : r)))
}

function setHasItem(i: number, has: HasItem) {
  setRow(i, hasItemLogic(has))
}

function addComparison() {
  const row = comparisonLogic({
    op: '==',
    left: { kind: 'entry', path: itemPaths.value[0] ?? '' },
    right: { kind: 'value', value: '' },
  })
  setItems([...props.condition.items, row])
}

function addHasItem() {
  setItems([...props.condition.items, hasItemLogic({ path: listPaths.value[0] ?? '', condition: { op: 'and', items: [] } })])
}
</script>

<template>
  <div class="condition-editor">
    <div class="field">
      <div class="control">
        <div class="select">
          <select :value="condition.op" :aria-label="`${label}: combine with`"
            @change="emit('update', { ...condition, op: ($event.target as HTMLSelectElement).value as Condition['op'] })">
            <option value="and">All of (AND)</option>
            <option value="or">Any of (OR)</option>
            <option value="none">None of (NOT)</option>
          </select>
        </div>
      </div>
    </div>

    <div v-for="(row, i) in condition.items" :key="i" class="condition-row">
      <button type="button" class="delete condition-row-remove" :aria-label="`Remove condition ${i + 1}`"
        title="Remove condition" @click="setItems(condition.items.filter((_, j) => j !== i))"></button>
      <template v-if="parseHasItem(row)">
        <div class="field">
          <label class="label" :for="`${listId}-${i}`">List field</label>
          <div class="control">
            <input :id="`${listId}-${i}`" class="input" type="text" :list="`${listId}-lists`"
              :value="parseHasItem(row)!.path" placeholder="e.g. products"
              @change="setHasItem(i, { ...parseHasItem(row)!, path: ($event.target as HTMLInputElement).value.trim() })" />
          </div>
          <p class="help">has an item where:</p>
        </div>
        <ConditionEditor :condition="parseHasItem(row)!.condition" :items="innerItems(parseHasItem(row)!.path)"
          :pipelines="pipelines" :label="`${label} condition ${i + 1}`"
          @update="(condition) => setHasItem(i, { ...parseHasItem(row)!, condition })" />
      </template>
      <ComparisonRow v-else :logic="row" :entry-paths="itemPaths" entry-label="Item field" :pipelines="pipelines"
        :label="`${label} condition ${i + 1}`" @update="(logic) => setRow(i, logic)" />
    </div>
    <p v-if="!condition.items.length" class="help mb-3">No conditions yet - every item passes.</p>
    <datalist :id="`${listId}-lists`">
      <option v-for="p in listPaths" :key="p" :value="p" />
    </datalist>

    <div class="field is-grouped is-grouped-multiline">
      <div class="control">
        <button type="button" class="button" @click="addComparison">Add condition</button>
      </div>
      <div class="control">
        <button type="button" class="button" title="Test a list on each item, e.g. an order's products"
          @click="addHasItem">Add "has an item where"</button>
      </div>
    </div>
  </div>
</template>
