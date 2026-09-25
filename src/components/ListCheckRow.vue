<script setup lang="ts">
import { computed } from 'vue'
import { HAS_ITEM_MODES } from '@/pipeline'
import type { HasItem } from '@/pipeline'
import { innerItems, itemsAreLists, listPaths } from '@/items'
import ConditionEditor from './ConditionEditor.vue'

/**
 * A "check a list" row, read as a sentence: [products] [has at least one
 * item] where: …, with the condition on the list's items nested beneath.
 * Only fields that hold lists are offered, or "each item" when the items
 * are lists themselves.
 */
const props = withDefaults(defineProps<{
  check: HasItem
  /** The items being tested (a sample is enough), for the pickers. */
  items: unknown[]
  /** Pipelines whose result the conditions can read, by name. */
  pipelines: string[]
  label: string
  /** Show the "Check a list" tag; off where a picker above already says so. */
  tagged?: boolean
}>(), { tagged: true })
const emit = defineEmits<{ update: [check: HasItem] }>()

const lists = computed(() => listPaths(props.items))

/** "each item" when the items are lists (or the row already reads the item itself). */
const offerItself = computed(() => itemsAreLists(props.items) || !props.check.path)

/** The list fields to offer, plus the row's own if the items no longer have it. */
const pathOptions = computed(() => {
  const own = props.check.path
  return own && !lists.value.includes(own) ? [...lists.value, own] : lists.value
})

const inner = computed(() => innerItems(props.items, props.check.path))

function patch(changes: Partial<HasItem>) {
  emit('update', { ...props.check, ...changes })
}

function value(e: Event): string {
  return (e.target as HTMLSelectElement).value
}
</script>

<template>
  <div class="list-check">
    <p v-if="tagged" class="mb-2"><span class="tag">Check a list</span></p>
    <div class="field is-grouped is-grouped-multiline list-check-head">
      <div class="control">
        <div class="select">
          <select :value="check.path" :aria-label="`${label}: list`" @change="patch({ path: value($event) })">
            <option v-if="offerItself" value="">each item</option>
            <option v-for="p in pathOptions" :key="p" :value="p">{{ p }}</option>
          </select>
        </div>
      </div>
      <div class="control">
        <div class="select">
          <select :value="check.mode" :aria-label="`${label}: how many`"
            @change="patch({ mode: value($event) as HasItem['mode'] })">
            <option v-for="m in HAS_ITEM_MODES" :key="m.mode" :value="m.mode">{{ m.label }}</option>
          </select>
        </div>
      </div>
      <div class="control">
        <span class="list-check-where">where:</span>
      </div>
    </div>
    <ConditionEditor :condition="check.condition" :items="inner" :pipelines="pipelines" :label="label"
      @update="(condition) => patch({ condition })" />
  </div>
</template>
