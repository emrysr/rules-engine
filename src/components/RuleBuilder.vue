<script setup lang="ts">
import { computed } from 'vue'
import type { Rule } from '@/types'
import { comparisonLogic, entryPaths, parseComparison } from '@/comparison'
import { useEngineStore } from '@/stores/engine'
import ComparisonRow from './ComparisonRow.vue'

/**
 * Query builder for a rule whose logic is a single comparison. Anything
 * else (and/or, nested logic, the match-everything `true`) is left to the
 * rule's raw JSON view, with an offer to start over as a comparison.
 */
const props = defineProps<{ rule: Rule }>()
const emit = defineEmits<{ update: [logic: Rule['logic']] }>()

const store = useEngineStore()

const isComparison = computed(
  () => !!parseComparison(props.rule.logic, store.valueSources.map((s) => s.key)),
)

const paths = computed(() => entryPaths(store.rawData[props.rule.source] ?? []))

function startComparison() {
  emit(
    'update',
    comparisonLogic({
      op: '==',
      left: { kind: 'entry', path: paths.value[0] ?? '' },
      right: { kind: 'value', value: '' },
    }) as Rule['logic'],
  )
}
</script>

<template>
  <div class="rule-builder">
    <ComparisonRow v-if="isComparison" :logic="rule.logic" :entry-paths="paths" :label="rule.key"
      @update="(logic) => emit('update', logic as Rule['logic'])" />

    <div v-else class="field">
      <p class="help mb-2">This rule's logic isn't a single comparison - use Edit JSON to change it.</p>
      <div class="control">
        <button type="button" class="button" @click="startComparison">Replace with a comparison</button>
      </div>
    </div>
  </div>
</template>
