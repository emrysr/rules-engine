<script setup lang="ts">
import { ref } from 'vue'
import { examples } from '@/examples'
import type { Example } from '@/examples'
import { useEngineStore } from '@/stores/engine'

/**
 * The built-in examples, in order, each with what it shows and a Load
 * button. Loading replaces the setup, as an import does.
 */
const store = useEngineStore()

const error = ref('')
const notice = ref('')

function plural(n: number, word: string): string {
  return `${n} ${word}${n === 1 ? '' : 's'}`
}

function summary(e: Example): string {
  const c = e.config
  return [
    plural(c.sources.length, 'source'),
    plural(c.schema.length, 'field'),
    plural(c.rules.length, 'rule'),
    plural(c.pipelines?.length ?? 0, 'pipeline'),
  ].join(', ')
}

function load(e: Example) {
  if (!confirm(`Load the "${e.name}" example? It replaces the current data sources, form, rules and pipelines.`)) return
  error.value = store.importConfig(JSON.stringify(e.config))
  notice.value = error.value ? '' : `Loaded "${e.name}" - fetching its data sources.`
}
</script>

<template>
  <p v-if="error" class="help is-danger mb-3">{{ error }}</p>
  <p v-else-if="notice" class="help is-success mb-3">{{ notice }}</p>

  <div class="fixed-grid has-1-cols-mobile has-2-cols-tablet has-3-cols-desktop">
    <div class="grid">
      <fieldset v-for="e in examples" :key="e.name" class="cell form-group">
        <legend class="label">{{ e.name }}</legend>
        <div class="content mt-2 mb-0">
          <p class="mb-1">{{ e.description }}</p>
          <p class="help mt-0">{{ summary(e) }}</p>
        </div>
        <div class="form-group-actions">
          <span></span>
          <div class="field">
            <div class="control">
              <button type="button" class="button is-link" @click="load(e)">Load</button>
            </div>
          </div>
        </div>
      </fieldset>
    </div>
  </div>
</template>
