<script setup lang="ts">
import { computed } from 'vue'
import { OPERATORS, comparisonLogic, parseComparison } from '@/comparison'
import type { Comparison, Operand, Operator } from '@/comparison'
import { useEngineStore } from '@/stores/engine'
import OperandPicker from './OperandPicker.vue'

/**
 * One comparison: left side, operator, right side, read from and written
 * back as plain JSON Logic. Renders nothing for logic that isn't a single
 * comparison; callers check `parseComparison` first.
 */
const props = withDefaults(
  defineProps<{
    logic: unknown
    /** Field paths of whatever is being tested: a source's entries, or a pipeline's items. */
    entryPaths: string[]
    /** What those fields are called here: "Entry field", "Item field". */
    entryLabel?: string
    /** Pipelines whose result this comparison can read, by name. */
    pipelines?: string[]
    /** Hint in an empty entry field box, when the default doesn't fit the data. */
    entryPlaceholder?: string
    label: string
  }>(),
  { entryLabel: 'Entry field', pipelines: () => [] },
)
const emit = defineEmits<{ update: [logic: unknown] }>()

const store = useEngineStore()

const comparison = computed(() =>
  parseComparison(
    props.logic,
    store.valueSources.map((s) => s.key),
  ),
)

function save(c: Comparison) {
  emit('update', comparisonLogic(c))
}

function setSide(side: 'left' | 'right', operand: Operand) {
  save({ ...comparison.value!, [side]: operand })
}

function setOp(op: string) {
  save({ ...comparison.value!, op: op as Operator })
}
</script>

<template>
  <template v-if="comparison">
    <OperandPicker :operand="comparison.left" :entry-paths="entryPaths" :entry-label="entryLabel"
      :form-fields="store.formFieldOptions" :source-paths="store.valuePaths" :pipelines="pipelines"
      :entry-placeholder="entryPlaceholder" :label="`${label} left side`"
      @update="(o) => setSide('left', o)" />
    <div class="field">
      <div class="control">
        <div class="select">
          <select :value="comparison.op" :aria-label="`${label} comparison`"
            @change="setOp(($event.target as HTMLSelectElement).value)">
            <option v-for="o in OPERATORS" :key="o.op" :value="o.op">{{ o.label }} ({{ o.op }})</option>
          </select>
        </div>
      </div>
    </div>
    <OperandPicker :operand="comparison.right" :entry-paths="entryPaths" :entry-label="entryLabel"
      :form-fields="store.formFieldOptions" :source-paths="store.valuePaths" :pipelines="pipelines"
      :entry-placeholder="entryPlaceholder" :label="`${label} right side`"
      @update="(o) => setSide('right', o)" />
  </template>
</template>
