<script setup lang="ts">
import { computed, useId } from 'vue'
import { describe, finalResult } from '@/pipeline'
import { useEngineStore } from '@/stores/engine'
import CollapsibleBox from './CollapsibleBox.vue'
import CopyJsonButton from './CopyJsonButton.vue'

/**
 * The one answer the setup builds towards: a pipeline's result, the last
 * pipeline's unless another is picked. The Source Filters' per-source
 * counts are inputs to the pipelines, so they stay in that panel.
 */
const store = useEngineStore()
const id = useId()

const result = computed(() => (store.resultOf ? finalResult(store.pipelineResults[store.resultOf.name]) : undefined))

/** The result as JSON, trimmed to the first 20 items of a long list. */
const json = computed(() => {
  const r = result.value
  if (!r?.ok) return ''
  return JSON.stringify(Array.isArray(r.value) && r.value.length > 20 ? r.value.slice(0, 20) : r.value, null, 2)
})

const lastName = computed(() => store.pipelines[store.pipelines.length - 1]?.name ?? '')
</script>

<template>
  <CollapsibleBox section="results" title="Results" class="results-panel">
    <template #meta>
      <span v-if="result?.ok" class="tag is-success ml-2">{{ describe(result.value) }}</span>
      <span v-else-if="store.pipelines.length" class="tag is-danger ml-2">No result</span>
    </template>
    <div class="mt-3">
      <p v-if="!store.pipelines.length" class="help">
        Add a pipeline to build a result from the sources.
      </p>
      <template v-else>
        <div class="field">
          <label class="label" :for="id">Result from</label>
          <div class="field is-grouped is-grouped-multiline">
            <div class="control">
              <div class="select">
                <select :id="id" v-model="store.resultPipeline">
                  <option value="">The last pipeline ({{ lastName }})</option>
                  <option v-for="p in store.pipelines" :key="p.name" :value="p.name">{{ p.name }}</option>
                </select>
              </div>
            </div>
            <div class="control">
              <CopyJsonButton :value="() => store.compiledPipeline(store.resultOf!)" :disabled="!store.resultOf"
                title="Copy the result's pipeline as one JSON Logic expression" />
            </div>
          </div>
        </div>

        <template v-if="result?.ok">
          <pre class="payload">{{ json }}</pre>
          <p v-if="Array.isArray(result.value) && result.value.length > 20" class="help">
            Showing the first 20 of {{ result.value.length }} items.
          </p>
        </template>
        <p v-else class="help is-danger">
          {{ store.resultOf?.name }} has no result yet{{ result ? `: ${result.error}` : '.' }}
        </p>
      </template>
    </div>
  </CollapsibleBox>
</template>
