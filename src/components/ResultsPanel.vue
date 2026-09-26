<script setup lang="ts">
import { computed } from 'vue'
import { titleCase } from '@/paths'
import { describe, finalResult } from '@/pipeline'
import { useEngineStore } from '@/stores/engine'
import CollapsibleBox from './CollapsibleBox.vue'
import EntryPreview from './EntryPreview.vue'

/**
 * The one answer the setup builds towards: the result of the last pipeline
 * switched on. With no pipelines, it's the sources as their Data Filters
 * leave them.
 */
const store = useEngineStore()

const result = computed(() => (store.resultOf ? finalResult(store.pipelineResults[store.resultOf.name]) : undefined))

/** Entries kept across the sources, for the bar when there are no pipelines. */
const keptTotal = computed(() => Object.values(store.sourceResults).reduce((n, r) => n + r.matched, 0))

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
      <span v-else class="tag is-success ml-2">{{ keptTotal }} {{ keptTotal === 1 ? 'entry' : 'entries' }}</span>
    </template>
    <div class="mt-3">
      <template v-if="!store.pipelines.length">
        <p class="help block">
          No pipelines yet, so this is each source as its Data Filter leaves it. Add a pipeline
          to combine them into one result.
        </p>
        <div v-for="s in store.listSources" :key="s.key" class="block">
          <p>
            <strong>{{ titleCase(s.key) }}</strong>:
            {{ store.sourceResults[s.key]?.matched ?? 0 }} / {{ store.sourceResults[s.key]?.total ?? 0 }} kept
          </p>
          <EntryPreview :entries="store.matchedEntries[s.key] ?? []" label="Preview" />
        </div>
      </template>
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
