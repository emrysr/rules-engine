<script setup lang="ts">
import { nextTick, onMounted, ref } from 'vue'

/**
 * Text that turns into an input when clicked. Enter or blur saves, Escape
 * cancels; an empty or unchanged value saves nothing. The click is
 * preventDefault-ed so inside a <label> it doesn't focus or toggle the input.
 */
const props = defineProps<{ text: string; autoEdit?: boolean }>()
const emit = defineEmits<{ save: [text: string] }>()

const editing = ref(false)
const draft = ref('')
const input = ref<HTMLInputElement>()

async function start() {
  draft.value = props.text
  editing.value = true
  await nextTick()
  input.value?.focus()
  input.value?.select()
}

function commit() {
  if (!editing.value) return
  editing.value = false
  const text = draft.value.trim()
  if (text && text !== props.text) emit('save', text)
}

onMounted(() => {
  if (props.autoEdit) start()
})
</script>

<template>
  <input
    v-if="editing"
    ref="input"
    v-model="draft"
    class="input inline-edit-input"
    type="text"
    @click.prevent
    @keydown.enter.prevent="commit"
    @keydown.escape.prevent="editing = false"
    @blur="commit"
  />
  <span v-else class="inline-edit" title="Click to rename" @click.prevent="start">{{ text }}</span>
</template>
