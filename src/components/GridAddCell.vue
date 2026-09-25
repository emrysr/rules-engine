<script setup lang="ts">
/**
 * The grid's last cell: an Add button in the slot the next fieldset will
 * take, so the new one appears where the user is already looking and this
 * cell moves on to the next free slot.
 */
defineProps<{ label: string }>()
const emit = defineEmits<{ add: [] }>()
</script>

<template>
  <div class="cell grid-add-cell">
    <button type="button" class="button" @click="emit('add')">{{ label }}</button>
  </div>
</template>
