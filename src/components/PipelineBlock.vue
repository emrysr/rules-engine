<script setup lang="ts">
import { computed, ref, useId, watch } from 'vue'
import { entryPaths } from '@/comparison'
import { BLOCK_LABELS, describe, mapFields } from '@/pipeline'
import type { Block, StepResult } from '@/pipeline'
import { useEngineStore } from '@/stores/engine'
import ConditionEditor from './ConditionEditor.vue'

/**
 * One block of a pipeline: its settings, and underneath, what it output.
 * `input` is the previous block's output, used to suggest field names.
 */
const props = defineProps<{
  block: Block
  input: unknown
  result: StepResult | undefined
  /** Pipelines whose result this block's conditions can read, by name. */
  pipelines: string[]
  label: string
  canMoveUp: boolean
  canMoveDown: boolean
}>()
const emit = defineEmits<{ update: [block: Block]; remove: []; move: [step: -1 | 1] }>()

const store = useEngineStore()
const listId = useId()

/** The items coming in, for field suggestions. */
const items = computed(() => (Array.isArray(props.input) ? props.input : []))

/** Field paths of the items coming in, for the map block's suggestions. */
const itemPaths = computed(() => {
  const objects = items.value.filter((i) => i && typeof i === 'object' && !Array.isArray(i))
  return entryPaths(objects as Record<string, unknown>[])
})

/** What's typed in the map block's fields box, for suggesting the field after the last comma. */
const mapDraft = ref(props.block.type === 'map' ? props.block.path : '')
watch(
  () => (props.block.type === 'map' ? props.block.path : ''),
  (path) => (mapDraft.value = path),
)

/** Suggestions for the map box: each field, after whatever comes before the last comma. */
const mapSuggestions = computed(() => {
  const cut = mapDraft.value.lastIndexOf(',')
  const before = cut < 0 ? '' : mapDraft.value.slice(0, cut + 1) + ' '
  return itemPaths.value.map((p) => before + p)
})

const mapsSeveral = computed(() => props.block.type === 'map' && mapFields(props.block.path).length > 1)

/** The list sources a pipeline can start from, plus the block's own if it's gone. */
const sourceOptions = computed(() => {
  const keys = store.listSources.map((s) => s.key)
  const own = props.block.type === 'source' ? props.block.source : ''
  return own && !keys.includes(own) ? [...keys, own] : keys
})

/** The output as JSON, trimmed to the first few items of a long list. */
const outputJson = computed(() => {
  if (!props.result?.ok) return ''
  const v = props.result.value
  return JSON.stringify(Array.isArray(v) && v.length > 5 ? v.slice(0, 5) : v, null, 2)
})

function patch(changes: Record<string, unknown>) {
  emit('update', { ...props.block, ...changes } as Block)
}

function value(e: Event): string {
  return (e.target as HTMLInputElement | HTMLSelectElement).value
}
</script>

<template>
  <div class="pipeline-block">
    <div class="pipeline-block-head">
      <strong class="pipeline-block-title">{{ BLOCK_LABELS[block.type] }}</strong>
      <span v-if="result?.ok" class="tag is-info">{{ describe(result.value) }}</span>
      <span v-else-if="result" class="tag is-danger">Stopped</span>
      <div v-if="block.type !== 'source'" class="buttons pipeline-block-tools">
        <button type="button" class="button" :disabled="!canMoveUp" :aria-label="`Move ${label} up`" title="Move up"
          @click="emit('move', -1)">
          <svg class="move-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M6 15l6-6 6 6" /></svg>
        </button>
        <button type="button" class="button" :disabled="!canMoveDown" :aria-label="`Move ${label} down`"
          title="Move down" @click="emit('move', 1)">
          <svg class="move-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M6 9l6 6 6-6" /></svg>
        </button>
        <button type="button" class="delete" :aria-label="`Remove ${label}`" title="Remove block"
          @click="emit('remove')"></button>
      </div>
    </div>

    <div v-if="block.type === 'source'" class="field">
      <label class="label" :for="`${listId}-source`">Source</label>
      <div class="control">
        <div class="select is-fullwidth">
          <select :id="`${listId}-source`" :value="block.source" @change="patch({ source: value($event) })">
            <option value="" disabled>Choose a source</option>
            <option v-for="s in sourceOptions" :key="s" :value="s">{{ s }}</option>
          </select>
        </div>
      </div>
      <p class="help">As its Source Filter leaves it.</p>
    </div>

    <ConditionEditor v-else-if="block.type === 'filter'" :condition="block.condition" :items="items"
      :pipelines="pipelines" :label="label" @update="(condition) => patch({ condition })" />

    <template v-else-if="block.type === 'map'">
      <div class="field">
        <label class="label" :for="`${listId}-map`">Pick fields</label>
        <div class="control">
          <input :id="`${listId}-map`" class="input" type="text" :list="`${listId}-map-list`" :value="block.path"
            placeholder="e.g. firstName, lastName" @input="mapDraft = value($event)"
            @change="patch({ path: mapFields(value($event)).join(', ') })" />
          <datalist :id="`${listId}-map-list`">
            <option v-for="p in mapSuggestions" :key="p" :value="p" />
          </datalist>
        </div>
        <p class="help">One field, or several separated by commas for a list per item.</p>
      </div>
      <div v-if="mapsSeveral" class="field">
        <label class="label" :for="`${listId}-join`">Join with</label>
        <div class="control">
          <input :id="`${listId}-join`" class="input" type="text" :value="block.join ?? ''"
            placeholder="Leave empty for a list" @change="patch({ join: value($event) || undefined })" />
        </div>
        <p class="help">Text between the fields, e.g. a space, to make one string per item.</p>
      </div>
    </template>

    <template v-else-if="block.type === 'test'">
      <div class="field">
        <div class="control">
          <div class="select">
            <select :value="block.mode" :aria-label="`${label}: test`" @change="patch({ mode: value($event) })">
              <option value="some">Any item passes</option>
              <option value="all">Every item passes</option>
              <option value="none">No item passes</option>
            </select>
          </div>
        </div>
      </div>
      <ConditionEditor :condition="block.condition" :items="items" :pipelines="pipelines" :label="label"
        @update="(condition) => patch({ condition })" />
    </template>

    <p v-else-if="block.type === 'count'" class="help">Counts the items coming in.</p>

    <p v-if="result && !result.ok" class="help is-danger">{{ result.error }}</p>
    <details v-else-if="result?.ok" class="pipeline-output">
      <summary class="is-clickable">Output</summary>
      <pre class="payload">{{ outputJson }}</pre>
      <p v-if="Array.isArray(result.value) && result.value.length > 5" class="help">
        Showing the first 5 of {{ result.value.length }} items.
      </p>
    </details>
  </div>
</template>
