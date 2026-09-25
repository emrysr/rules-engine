<script setup lang="ts">
import { computed } from 'vue'
import type { Rule } from '@/types'
import { comparisonLogic, entryPaths, parseComparison } from '@/comparison'
import { hasItemLogic, parseHasItem } from '@/pipeline'
import { canCheckList, listPaths } from '@/items'
import { useEngineStore } from '@/stores/engine'
import ComparisonRow from './ComparisonRow.vue'
import ListCheckRow from './ListCheckRow.vue'

/**
 * Rule builder for a rule whose logic is a single comparison, or a check of
 * a list on each entry (a cart's products has an item where id = 100).
 * Anything else (and/or, nested logic, the match-everything `true`) is left
 * to the rule's raw JSON view, with an offer to start over as a comparison.
 */
const props = defineProps<{ rule: Rule }>()
const emit = defineEmits<{ update: [logic: Rule['logic']] }>()

const store = useEngineStore()

const entries = computed(() => store.rawData[props.rule.source] ?? [])
const paths = computed(() => entryPaths(entries.value))

const check = computed(() => parseHasItem(props.rule.logic))
const kind = computed(() =>
  check.value ? 'list' : parseComparison(props.rule.logic, store.valueSources.map((s) => s.key)) ? 'compare' : null,
)

/** Check a list is only offered when the entries have a list field (or the rule already checks one). */
const canList = computed(() => canCheckList(entries.value) || kind.value === 'list')

function update(logic: unknown) {
  emit('update', logic as Rule['logic'])
}

function startComparison() {
  update(
    comparisonLogic({
      op: '==',
      left: { kind: 'entry', path: paths.value[0] ?? '' },
      right: { kind: 'value', value: '' },
    }),
  )
}

function startListCheck() {
  update(hasItemLogic({ path: listPaths(entries.value)[0] ?? '', mode: 'some', condition: { op: 'and', items: [] } }))
}

function switchKind(e: Event) {
  const value = (e.target as HTMLSelectElement).value
  if (value === kind.value) return
  if (value === 'list') startListCheck()
  else startComparison()
}
</script>

<template>
  <div class="rule-builder">
    <div v-if="kind && canList" class="field">
      <div class="control">
        <div class="select">
          <select :value="kind" :aria-label="`${rule.key}: kind of rule`" @change="switchKind">
            <option value="compare">Compare a field</option>
            <option value="list">Check a list</option>
          </select>
        </div>
      </div>
    </div>

    <ComparisonRow v-if="kind === 'compare'" :logic="rule.logic" :entry-paths="paths" :label="rule.key"
      @update="update" />

    <ListCheckRow v-else-if="kind === 'list'" :check="check!" :items="entries" :pipelines="[]" :label="rule.key"
      :tagged="!canList"
      @update="(c) => update(hasItemLogic(c))" />

    <div v-else class="field">
      <p class="help mb-2">This rule's logic isn't a single comparison - use Edit JSON to change it.</p>
      <div class="control">
        <button type="button" class="button" @click="startComparison">Replace with a comparison</button>
      </div>
    </div>
  </div>
</template>
