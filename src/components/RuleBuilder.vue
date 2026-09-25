<script setup lang="ts">
import { computed } from 'vue'
import type { Rule } from '@/types'
import { rulePath } from '@/paths'
import { OPERATORS, comparisonLogic, entryPaths, parseComparison } from '@/comparison'
import type { Comparison, Operand, Operator } from '@/comparison'
import { useEngineStore } from '@/stores/engine'
import OperandPicker from './OperandPicker.vue'

/**
 * Query builder for a rule whose logic is a single comparison. Anything
 * else (and/or, nested logic, the match-everything `true`) is left to the
 * rule's raw JSON view, with an offer to start over as a comparison.
 */
const props = defineProps<{ rule: Rule }>()
const emit = defineEmits<{ update: [logic: Rule['logic']] }>()

const store = useEngineStore()

const comparison = computed(() => parseComparison(props.rule.logic))

const paths = computed(() => entryPaths(store.rawData[props.rule.source] ?? []))

const formFields = computed(() =>
  store.schemaFields.map((f) => {
    const label = f.label || f.key
    return { path: rulePath(f), name: f.group ? `${f.group} › ${label}` : label }
  }),
)

function save(c: Comparison) {
  emit('update', comparisonLogic(c) as Rule['logic'])
}

function setSide(side: 'left' | 'right', operand: Operand) {
  save({ ...comparison.value!, [side]: operand })
}

function setOp(op: string) {
  save({ ...comparison.value!, op: op as Operator })
}

function startComparison() {
  save({ op: '==', left: { kind: 'entry', path: paths.value[0] ?? '' }, right: { kind: 'value', value: '' } })
}
</script>

<template>
  <div class="rule-builder">
    <template v-if="comparison">
      <OperandPicker :operand="comparison.left" :entry-paths="paths" :form-fields="formFields"
        :label="`${rule.key} left side`" @update="(o) => setSide('left', o)" />
      <div class="field">
        <div class="control">
          <div class="select">
            <select :value="comparison.op" :aria-label="`${rule.key} comparison`"
              @change="setOp(($event.target as HTMLSelectElement).value)">
              <option v-for="o in OPERATORS" :key="o.op" :value="o.op">{{ o.label }} ({{ o.op }})</option>
            </select>
          </div>
        </div>
      </div>
      <OperandPicker :operand="comparison.right" :entry-paths="paths" :form-fields="formFields"
        :label="`${rule.key} right side`" @update="(o) => setSide('right', o)" />
    </template>

    <div v-else class="field">
      <p class="help mb-2">This rule's logic isn't a single comparison - use Edit JSON to change it.</p>
      <div class="control">
        <button type="button" class="button" @click="startComparison">Replace with a comparison</button>
      </div>
    </div>
  </div>
</template>
