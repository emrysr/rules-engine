<script setup lang="ts">
import InlineEdit from './InlineEdit.vue'

/**
 * A grid-cell fieldset the user manages in place: click the legend to
 * rename it, delete it, move it left or right. The parent owns the data and
 * acts on the events. The body goes in the default slot; the `actions` slot
 * sits at the bottom right, opposite the move arrows.
 */
const props = defineProps<{
  legend: string
  /** What it is, for button titles: "group", "rule". */
  noun: string
  canMoveLeft: boolean
  canMoveRight: boolean
  /** Open the legend for editing on mount, e.g. just after it was created. */
  autoEdit?: boolean
}>()

const emit = defineEmits<{
  rename: [text: string]
  delete: []
  move: [step: -1 | 1]
}>()
</script>

<template>
  <fieldset class="cell form-group">
    <legend class="label field-label">
      <InlineEdit :text="props.legend" :auto-edit="autoEdit" @save="(t) => emit('rename', t)" />
      <button type="button" class="delete" :title="`Delete ${noun}`" :aria-label="`Delete ${legend}`"
        @click="emit('delete')"></button>
    </legend>

    <slot />

    <div class="form-group-actions">
      <nav class="pagination" :aria-label="`Move ${legend}`">
        <button type="button" class="pagination-previous" :title="`Move ${noun} left`"
          :aria-label="`Move ${legend} left`" :disabled="!canMoveLeft" @click="emit('move', -1)">
          <svg class="move-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M15 6l-6 6 6 6" /></svg>
        </button>
        <button type="button" class="pagination-next" :title="`Move ${noun} right`"
          :aria-label="`Move ${legend} right`" :disabled="!canMoveRight" @click="emit('move', 1)">
          <svg class="move-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M9 6l6 6-6 6" /></svg>
        </button>
      </nav>
      <slot name="actions" />
    </div>
  </fieldset>
</template>
