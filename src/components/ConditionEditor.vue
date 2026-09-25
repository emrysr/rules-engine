<script setup lang="ts">
import { comparisonLogic } from '@/comparison'
import type { Condition } from '@/pipeline'
import ComparisonRow from './ComparisonRow.vue'

/**
 * A pipeline block's condition: comparison rows joined all of / any of /
 * none of. Emits the whole updated condition.
 */
const props = defineProps<{
  condition: Condition
  /** Field paths of the items being tested, for suggestions. */
  itemPaths: string[]
  label: string
}>()
const emit = defineEmits<{ update: [condition: Condition] }>()

function setItems(items: unknown[]) {
  emit('update', { ...props.condition, items })
}

function addRow() {
  const row = comparisonLogic({
    op: '==',
    left: { kind: 'entry', path: props.itemPaths[0] ?? '' },
    right: { kind: 'value', value: '' },
  })
  setItems([...props.condition.items, row])
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
      <ComparisonRow :logic="row" :entry-paths="itemPaths" entry-label="Item field" :label="`${label} condition ${i + 1}`"
        @update="(logic) => setItems(condition.items.map((r, j) => (j === i ? logic : r)))" />
    </div>
    <p v-if="!condition.items.length" class="help mb-3">No conditions yet - every item passes.</p>

    <div class="field">
      <div class="control">
        <button type="button" class="button" @click="addRow">Add condition</button>
      </div>
    </div>
  </div>
</template>
