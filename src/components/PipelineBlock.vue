<script setup lang="ts">
import { computed, ref } from 'vue'
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

/** The items coming in, for field suggestions. */
const items = computed(() => (Array.isArray(props.input) ? props.input : []))

/** Field paths of the items coming in, for the map block's pickers. */
const itemPaths = computed(() => {
  const objects = items.value.filter((i) => i && typeof i === 'object' && !Array.isArray(i))
  return entryPaths(objects as Record<string, unknown>[])
})

/**
 * The map block's pickers: one per field, and one to start with. A picker
 * still unset stays on screen but isn't saved, so the block keeps its
 * picked fields.
 */
const mapDraft = ref<string[] | null>(null)
const mapPicks = computed(() => {
  if (mapDraft.value) return mapDraft.value
  const fields = props.block.type === 'map' ? mapFields(props.block.path) : []
  return fields.length ? fields : ['']
})

/** The fields to offer a picker: the items' fields, plus its own if they no longer have it. */
function fieldOptions(current: string): string[] {
  return current && !itemPaths.value.includes(current) ? [...itemPaths.value, current] : itemPaths.value
}

function setMapFields(fields: string[]) {
  mapDraft.value = fields.some((f) => !f) ? fields : null
  emit('update', { type: 'map', path: fields.filter(Boolean).join(', ') })
}

function setMapField(i: number, field: string) {
  setMapFields(mapPicks.value.map((f, j) => (j === i ? field : f)))
}

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
      <div class="control">
        <div class="select is-fullwidth">
          <select :value="block.source" :aria-label="`${label}: data source`" @change="patch({ source: value($event) })">
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
      <p class="label">Map each item to</p>
      <div v-for="(f, i) in mapPicks" :key="i" class="field has-addons">
        <div class="control is-expanded">
          <div class="select is-fullwidth">
            <select :value="f" :aria-label="`${label}: field ${i + 1}`" @change="setMapField(i, value($event))">
              <option value="" disabled>Choose a field</option>
              <option v-for="p in fieldOptions(f)" :key="p" :value="p">{{ p }}</option>
            </select>
          </div>
        </div>
        <div v-if="mapPicks.length > 1" class="control">
          <button type="button" class="button" :aria-label="`Remove field ${i + 1}`" title="Remove field"
            @click="setMapFields(mapPicks.filter((_, j) => j !== i))">Remove</button>
        </div>
      </div>
      <div class="field">
        <div class="control">
          <button type="button" class="button" @click="setMapFields([...mapPicks, ''])">Add field</button>
        </div>
        <p v-if="mapPicks.length > 1" class="help">Several fields give a list per item.</p>
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
