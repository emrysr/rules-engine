<script setup lang="ts">
import type { SectionName } from '@/types'
import { useEngineStore } from '@/stores/engine'

/**
 * A collapsible part of a panel, e.g. Filter Blocks in Data Filters. Like
 * CollapsibleBox its open state is stored against a section name, but it
 * sits inside a panel, so it's a titled <details> rather than a box.
 */
const props = defineProps<{ section: SectionName; title: string }>()

const store = useEngineStore()

function onToggle(event: Event) {
  store.sectionOpen[props.section] = (event.target as HTMLDetailsElement).open
}
</script>

<template>
  <details class="sub-section" :open="store.sectionOpen[props.section]" @toggle="onToggle">
    <summary class="is-clickable label">{{ title }}</summary>
    <slot />
  </details>
</template>
