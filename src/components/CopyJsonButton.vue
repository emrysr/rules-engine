<script setup lang="ts">
import { ref } from 'vue'

/**
 * Copies `value()` to the clipboard as pretty JSON, then shows Copied or
 * Copy failed for a moment. `value` is a function so the copy is taken at
 * click time, not when the button renders.
 */
const props = defineProps<{ value: () => unknown; title: string; disabled?: boolean }>()

const state = ref<'idle' | 'copied' | 'failed'>('idle')
let timer: ReturnType<typeof setTimeout> | undefined

async function copy() {
  try {
    await navigator.clipboard.writeText(JSON.stringify(props.value(), null, 2))
    state.value = 'copied'
  } catch {
    state.value = 'failed'
  }
  clearTimeout(timer)
  timer = setTimeout(() => (state.value = 'idle'), 2000)
}
</script>

<template>
  <button type="button" class="button" :class="{ 'is-success': state === 'copied', 'is-danger': state === 'failed' }"
    :disabled="disabled" :title="title" @click="copy">
    {{ state === 'copied' ? 'Copied' : state === 'failed' ? 'Copy failed' : 'Copy JSON' }}
  </button>
</template>
