<script setup lang="ts">
import type { SectionName } from '@/types'
import { useEngineStore } from '@/stores/engine'

/**
 * A <details> box whose open state is stored (and persisted) against a section
 * name, so the layout survives a reload. The `actions` slot sits at the right
 * of the title bar; clicks there don't open or close the box. The `meta`
 * slot follows the title, e.g. a count.
 */
const props = defineProps<{ section: SectionName; title: string }>()

const store = useEngineStore()

function onToggle(event: Event) {
  store.sectionOpen[props.section] = (event.target as HTMLDetailsElement).open
}
</script>

<template>
  <details class="box" :open="store.sectionOpen[props.section]" @toggle="onToggle">
    <summary class="is-clickable has-text-weight-semibold is-size-6">
      {{ title }}
      <slot name="meta" />
      <!-- preventDefault stops the summary toggling; the buttons' own handlers still run. -->
      <span v-if="$slots.actions" class="box-actions" @click.prevent>
        <slot name="actions" />
      </span>
    </summary>
    <slot />
  </details>
</template>
