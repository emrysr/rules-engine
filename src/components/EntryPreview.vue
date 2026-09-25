<script setup lang="ts">
import { computed } from 'vue'
import type { Entry } from '@/types'

/** A collapsible look at the first few entries of a list, as JSON. */
const props = withDefaults(defineProps<{ entries: Entry[]; label?: string; count?: number }>(), {
  label: 'Preview',
  count: 3,
})

const json = computed(() => JSON.stringify(props.entries.slice(0, props.count), null, 2))
</script>

<template>
  <details v-if="entries.length">
    <summary class="is-clickable">{{ label }}</summary>
    <pre class="payload">{{ json }}</pre>
    <p class="help">
      Showing {{ Math.min(count, entries.length) === entries.length ? 'all' : `the first ${count} of` }}
      {{ entries.length }} {{ entries.length === 1 ? 'entry' : 'entries' }}.
    </p>
  </details>
</template>
