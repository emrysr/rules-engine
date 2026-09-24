<script setup lang="ts">
import { useEngineStore } from '@/stores/engine'
import CollapsibleBox from './CollapsibleBox.vue'

const store = useEngineStore()

function preview(key: string): string {
  return JSON.stringify((store.rawData[key] ?? []).slice(0, 3), null, 2)
}
</script>

<template>
  <CollapsibleBox section="fetched" title="Fetched Data">
    <details v-for="src in store.dataSources" :key="src.key">
      <summary class="is-clickable has-text-weight-semibold is-size-7">
        {{ src.key }} ({{ (store.rawData[src.key] ?? []).length }} items)
        <a class="is-size-7" :href="src.url" target="_blank" rel="noopener">{{ src.url }} ↗</a>
      </summary>
      <span v-if="store.loading[src.key]" class="tag is-warning">fetching…</span>
      <span v-else-if="store.errors[src.key]" class="tag is-danger">error</span>
      <p v-if="store.errors[src.key]" class="help is-danger">{{ store.errors[src.key] }}</p>
      <pre v-if="store.rawData[src.key]" class="payload">{{ preview(src.key) }}</pre>
      <p v-if="store.rawData[src.key]" class="help">
        Showing first 3 of {{ store.rawData[src.key].length }} fetched entries.
      </p>
    </details>
  </CollapsibleBox>
</template>
