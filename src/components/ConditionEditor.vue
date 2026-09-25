<script setup lang="ts">
import { computed } from 'vue'
import { comparisonLogic } from '@/comparison'
import { hasItemLogic, parseHasItem } from '@/pipeline'
import type { Condition } from '@/pipeline'
import { canCheckList, fieldPaths, itemsAreLists, itemsArePlain, listPaths } from '@/items'
import ComparisonRow from './ComparisonRow.vue'
import ListCheckRow from './ListCheckRow.vue'

/**
 * A condition: rows joined all of / any of / none of. A row compares a
 * field, or checks a list on the item (see ListCheckRow), which nests a
 * condition of its own. Emits the whole updated condition.
 */
const props = defineProps<{
  condition: Condition
  /** The items being tested (a sample is enough), for the pickers. */
  items: unknown[]
  /** Pipelines whose result the rows can read, by name. */
  pipelines: string[]
  label: string
}>()
const emit = defineEmits<{ update: [condition: Condition] }>()

const itemPaths = computed(() => fieldPaths(props.items))
const plain = computed(() => itemsArePlain(props.items))
const canList = computed(() => canCheckList(props.items))

/** How the rows join only matters with two or more (or when it's "none of", which flips one). */
const showJoin = computed(() => props.condition.items.length > 1 || props.condition.op === 'none')

function setItems(items: unknown[]) {
  emit('update', { ...props.condition, items })
}

function setRow(i: number, row: unknown) {
  setItems(props.condition.items.map((r, j) => (j === i ? row : r)))
}

function addRow(e: Event) {
  const select = e.target as HTMLSelectElement
  if (select.value === 'compare') {
    setItems([
      ...props.condition.items,
      comparisonLogic({
        op: '==',
        left: { kind: 'entry', path: itemPaths.value[0] ?? '' },
        right: { kind: 'value', value: '' },
      }),
    ])
  } else if (select.value === 'list') {
    const path = itemsAreLists(props.items) ? '' : (listPaths(props.items)[0] ?? '')
    setItems([...props.condition.items, hasItemLogic({ path, mode: 'some', condition: { op: 'and', items: [] } })])
  }
  select.value = ''
}
</script>

<template>
  <div class="condition-editor" :class="{ 'has-join': showJoin }">
    <div v-if="showJoin" class="field">
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
      <ListCheckRow v-if="parseHasItem(row)" :check="parseHasItem(row)!" :items="items" :pipelines="pipelines"
        :label="`${label} condition ${i + 1}`" @update="(check) => setRow(i, hasItemLogic(check))" />
      <ComparisonRow v-else :logic="row" :entry-paths="itemPaths" entry-label="Item field" :pipelines="pipelines"
        :entry-placeholder="plain ? 'Empty: the value itself' : undefined"
        :label="`${label} condition ${i + 1}`" @update="(logic) => setRow(i, logic)" />
    </div>
    <p v-if="!condition.items.length" class="help mb-3">No conditions yet - everything passes.</p>

    <div class="field">
      <div class="control">
        <div class="select">
          <select :aria-label="`${label}: add a condition`" @change="addRow">
            <option value="">Add condition…</option>
            <option value="compare">Compare a field (e.g. price is at least 10)</option>
            <option v-if="canList" value="list">Check a list (e.g. products has an item where id = 100)</option>
          </select>
        </div>
      </div>
    </div>
  </div>
</template>
