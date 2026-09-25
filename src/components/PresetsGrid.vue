<script setup lang="ts">
import { computed, ref } from 'vue'
import { usePresetsStore } from '@/stores/presets'
import type { Preset } from '@/stores/presets'
import EditableFieldset from './EditableFieldset.vue'
import GridAddCell from './GridAddCell.vue'

const presets = usePresetsStore()

const error = ref('')
const notice = ref('')
/** The preset just saved, so its legend opens straight into editing. */
const newPreset = ref('')

const lastIndex = computed(() => presets.presets.length - 1)

const dateFormat = new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' })

function plural(n: number, word: string): string {
  return `${n} ${word}${n === 1 ? '' : 's'}`
}

function summary(p: Preset): string {
  const c = p.config
  return [plural(c.sources.length, 'source'), plural(c.schema.length, 'field'), plural(c.rules.length, 'rule')].join(', ')
}

function saveAsNew() {
  notice.value = ''
  const result = presets.saveAsNew()
  error.value = 'error' in result ? result.error : ''
  if ('name' in result) newPreset.value = result.name
}

function load(p: Preset) {
  if (!presets.matchesCurrent(p) && !confirm(`Load "${p.name}"? It replaces the current data sources, form and rules.`)) {
    return
  }
  error.value = presets.load(p.name)
  notice.value = error.value ? '' : `Loaded "${p.name}" - refetching data sources.`
}

function overwrite(p: Preset) {
  if (!confirm(`Save the current setup over "${p.name}"?`)) return
  error.value = presets.overwrite(p.name)
  notice.value = error.value ? '' : `Saved the current setup as "${p.name}".`
}

function remove(p: Preset) {
  if (!confirm(`Delete the "${p.name}" preset?`)) return
  presets.remove(p.name)
  notice.value = ''
}
</script>

<template>
  <p v-if="error" class="help is-danger mb-3">{{ error }}</p>
  <p v-else-if="notice" class="help is-success mb-3">{{ notice }}</p>

  <div class="fixed-grid has-1-cols-mobile has-2-cols-tablet has-3-cols-desktop">
    <div class="grid">
      <EditableFieldset v-for="(p, i) in presets.presets" :key="p.name" :legend="p.name" noun="preset"
        :auto-edit="p.name === newPreset" :can-move-left="i > 0" :can-move-right="i < lastIndex"
        @rename="(t) => (error = presets.rename(p.name, t))" @delete="remove(p)"
        @move="(step) => presets.move(p.name, step)">
        <div class="content mt-2 mb-0">
          <p class="mb-1">{{ summary(p) }}</p>
          <p class="help mt-0">Saved {{ dateFormat.format(new Date(p.savedAt)) }}</p>
          <span v-if="presets.matchesCurrent(p)" class="tag is-info">Current setup</span>
        </div>

        <template #actions>
          <div class="field is-grouped">
            <div class="control">
              <button type="button" class="button" title="Overwrite this preset with the current setup"
                @click="overwrite(p)">
                Save current
              </button>
            </div>
            <div class="control">
              <button type="button" class="button is-link" @click="load(p)">Load</button>
            </div>
          </div>
        </template>
      </EditableFieldset>
      <GridAddCell label="Save current as preset" @add="saveAsNew" />
    </div>
  </div>
</template>
