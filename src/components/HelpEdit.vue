<script setup lang="ts">
import { nextTick, ref } from 'vue'

/**
 * A field's help text, edited in place: click it (or "Add help text") to
 * open a text box. Leaving the box or Ctrl+Enter saves, Escape cancels, and
 * saving it empty removes the help. Unlike InlineEdit, it can be several
 * lines and can be cleared.
 */
const props = defineProps<{ text: string; label: string }>()
const emit = defineEmits<{ save: [text: string] }>()

const editing = ref(false)
const draft = ref('')
const box = ref<HTMLTextAreaElement>()

async function start() {
  draft.value = props.text
  editing.value = true
  await nextTick()
  box.value?.focus()
}

function commit() {
  if (!editing.value) return
  editing.value = false
  const text = draft.value.trim()
  if (text !== props.text) emit('save', text)
}
</script>

<template>
  <textarea v-if="editing" ref="box" v-model="draft" class="textarea help-edit-input" rows="2"
    :aria-label="`${label}: help text`" placeholder="What this option is for, e.g. used by hasProduct to pick carts"
    @keydown.ctrl.enter.prevent="commit" @keydown.meta.enter.prevent="commit"
    @keydown.escape.prevent="editing = false" @blur="commit"></textarea>
  <button v-else-if="text" type="button" class="help-edit" title="Click to edit the help text" @click="start">
    {{ text }}
  </button>
  <button v-else type="button" class="help-edit is-empty" @click="start">Add help text</button>
</template>
