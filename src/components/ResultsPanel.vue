<script setup lang="ts">
import { useEngineStore } from '@/stores/engine'
import CollapsibleBox from './CollapsibleBox.vue'
import EntryPreview from './EntryPreview.vue'

const store = useEngineStore()
</script>

<template>
  <CollapsibleBox section="results" title="Results">
    <p class="title is-4 mt-3">
      {{ store.grandTotal.matched }} / {{ store.grandTotal.total }}
      <span class="has-text-grey-light is-size-6">total entries match all enabled rules</span>
    </p>
    <div v-for="(res, key) in store.sourceResults" :key="key" class="block">
      <p><strong>{{ key }}</strong>: {{ res.matched }} / {{ res.total }}</p>
      <EntryPreview :entries="store.matchedEntries[key] ?? []" label="Preview matches" />
    </div>
  </CollapsibleBox>
</template>
