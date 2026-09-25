<script setup lang="ts">
import { computed, useId } from 'vue'
import { entryPaths } from '@/comparison'
import { BLOCK_LABELS, describe } from '@/pipeline'
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

    <div v-else-if="block.type === 'map'" class="field">
      <label class="label" :for="`${listId}-map`">Pick field</label>
      <div class="control">
        <input :id="`${listId}-map`" class="input" type="text" :list="`${listId}-map-list`" :value="block.path"
          placeholder="e.g. category.id" @change="patch({ path: value($event).trim() })" />
        <datalist :id="`${listId}-map-list`">
          <option v-for="p in itemPaths" :key="p" :value="p" />
        </datalist>
      </div>
    </div>

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
