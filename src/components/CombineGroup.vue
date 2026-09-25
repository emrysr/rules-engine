<script setup lang="ts">
import { computed } from 'vue'
import type { Rule, RuleGroup } from '@/types'
import { isGroup } from '@/combine'
import { useEngineStore } from '@/stores/engine'

/**
 * One and/or group of a source's rule combination, and (recursively) the
 * groups inside it. Emits the whole updated group; the parent splices it in.
 */
const props = defineProps<{
  group: RuleGroup
  /** The rules on this group's source. */
  rules: Rule[]
  /** Rule keys already used anywhere in the source's combination. */
  used: string[]
  nested?: boolean
}>()
const emit = defineEmits<{ update: [group: RuleGroup]; remove: [] }>()

const store = useEngineStore()

/** Rules on the source not yet in its combination, to offer in "Add a rule". */
const available = computed(() => props.rules.filter((r) => !props.used.includes(r.key)))

function hasRule(key: string): boolean {
  return props.rules.some((r) => r.key === key)
}

function setItems(items: RuleGroup['items']) {
  emit('update', { ...props.group, items })
}

function replaceAt(i: number, item: RuleGroup) {
  setItems(props.group.items.map((it, j) => (j === i ? item : it)))
}

function removeAt(i: number) {
  setItems(props.group.items.filter((_, j) => j !== i))
}

function addRule(e: Event) {
  const select = e.target as HTMLSelectElement
  if (select.value) setItems([...props.group.items, select.value])
  select.value = ''
}

// A new group starts as the opposite of its parent: nesting the same op adds nothing.
function addGroup() {
  setItems([...props.group.items, { op: props.group.op === 'and' ? 'or' : 'and', items: [] }])
}
</script>

<template>
  <div class="combine-group" :class="{ 'is-nested': nested }">
    <div class="field is-grouped combine-group-head">
      <div class="control">
        <div class="select">
          <select :value="group.op" aria-label="Combine with"
            @change="emit('update', { ...group, op: ($event.target as HTMLSelectElement).value as RuleGroup['op'] })">
            <option value="and">All of (AND)</option>
            <option value="or">Any of (OR)</option>
          </select>
        </div>
      </div>
      <div v-if="nested" class="control">
        <button type="button" class="delete" title="Remove group" aria-label="Remove group" @click="emit('remove')"></button>
      </div>
    </div>

    <ul class="combine-items">
      <li v-for="(item, i) in group.items" :key="isGroup(item) ? `group-${i}` : item">
        <CombineGroup v-if="isGroup(item)" :group="item" :rules="rules" :used="used" nested
          @update="(g) => replaceAt(i, g)" @remove="removeAt(i)" />
        <div v-else class="combine-rule" :class="{ 'is-off': !store.ruleToggles[item] || !hasRule(item) }">
          <span class="combine-rule-name">{{ item }}</span>
          <span v-if="!hasRule(item)" class="tag is-warning">not a rule on this source</span>
          <template v-else>
            <span class="tag" :class="store.ruleMatchInfo[item]?.matches ? 'is-success' : 'is-danger'">
              {{ store.ruleMatchInfo[item]?.matches ?? 0 }} / {{ store.ruleMatchInfo[item]?.total ?? 0 }}
            </span>
            <span v-if="!store.ruleToggles[item]" class="tag">off - skipped</span>
          </template>
          <button type="button" class="delete" :title="`Take ${item} out of the combination`"
            :aria-label="`Remove ${item}`" @click="removeAt(i)"></button>
        </div>
      </li>
      <li v-if="!group.items.length" class="help">Empty - adds no condition.</li>
    </ul>

    <div class="field has-addons">
      <div class="control">
        <div class="select">
          <select aria-label="Add a rule" :disabled="!available.length" @change="addRule">
            <option value="">{{ available.length ? 'Add a rule…' : 'All rules added' }}</option>
            <option v-for="r in available" :key="r.key" :value="r.key">{{ r.key }}</option>
          </select>
        </div>
      </div>
      <div class="control">
        <button type="button" class="button" @click="addGroup">Add group</button>
      </div>
    </div>
  </div>
</template>
