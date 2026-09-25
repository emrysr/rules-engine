<script setup lang="ts">
import { computed } from 'vue'
import { describe, finalResult } from '@/pipeline'
import { useEngineStore } from '@/stores/engine'
import CollapsibleBox from './CollapsibleBox.vue'

/**
 * The one answer the setup builds towards: the result of the last pipeline
 * switched on. The Data Filters' per-source counts are inputs to the
 * pipelines, so they stay in that panel.
 */
const store = useEngineStore()

const result = computed(() => (store.resultOf ? finalResult(store.pipelineResults[store.resultOf.name]) : undefined))

/** The result as JSON, trimmed to the first 20 items of a long list. */
const json = computed(() => {
  const r = result.value
  if (!r?.ok) return ''
  return JSON.stringify(Array.isArray(r.value) && r.value.length > 20 ? r.value.slice(0, 20) : r.value, null, 2)
})
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
