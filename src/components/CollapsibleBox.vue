<script setup lang="ts">
import type { SectionName } from '@/types'
import { useEngineStore } from '@/stores/engine'

/**
 * A <details> box whose open state is stored (and persisted) against a section
 * name, so the layout survives a reload.
 */
const props = defineProps<{ section: SectionName; title: string }>()

const store = useEngineStore()

function onToggle(event: Event) {
  store.sectionOpen[props.section] = (event.target as HTMLDetailsElement).open
}
</script>

<template>
  <details class="box" :open="store.sectionOpen[props.section]" @toggle="onToggle">
    <summary class="is-clickable has-text-weight-semibold is-size-6">{{ title }}</summary>
    <slot />
  </details>
</template>
