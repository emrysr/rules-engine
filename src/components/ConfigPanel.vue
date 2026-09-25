<script setup lang="ts">
import { useEngineStore } from '@/stores/engine'
import { ref } from 'vue'
import CollapsibleBox from './CollapsibleBox.vue'
import PresetsGrid from './PresetsGrid.vue'

const store = useEngineStore()

// The blob is scratch space, not config - it isn't persisted, and editing it
// changes nothing until Import is pressed.
const configText = ref('')
const configError = ref('')
const configNotice = ref('')

function importConfig(): void {
  configError.value = store.importConfig(configText.value)
  configNotice.value = configError.value ? '' : 'Imported - refetching data sources.'
}

function exportConfig(): void {
  const result = store.exportConfig()
  if ('error' in result) {
    configError.value = result.error
    configNotice.value = ''
    return
  }
  configText.value = JSON.stringify(result.config, null, 2)
  configError.value = ''
  configNotice.value = 'Current config exported - copy it, or edit and re-import.'
}
</script>

<template>
  <CollapsibleBox section="config" title="Configuration">
    <div class="mt-3">
      <p class="label">Presets</p>
      <p class="help block">
        Save the whole setup - data sources, form, rules, form values and which rules are on -
        under a name, and load it back later. Presets are kept in this browser.
      </p>
      <PresetsGrid />

      <p class="label mt-5">Import / Export</p>
      <p class="help block">
        Import or export the whole setup as one JSON object: <code>sources</code> (each
        <code>{ key, url?, data?, listPath?, use? }</code>), <code>schema</code> (the Options Form fields), <code>rules</code>
        (each <code>{ key, source, enabled, logic }</code>), plus optional <code>combine</code>
        (each source's rule combination) and <code>formData</code> values. Importing replaces everything - toggles reset to each rule's <code>enabled</code>,
        and fields not in <code>formData</code> take their defaults.
      </p>
      <div class="field">
        <div class="control">
          <textarea v-model="configText" class="textarea code" rows="10" spellcheck="false"
            placeholder='{ "sources": [], "schema": [], "rules": [], "formData": {} }'
            aria-label="Complete config JSON"></textarea>
        </div>
        <p v-if="configError" class="help is-danger">{{ configError }}</p>
        <p v-else-if="configNotice" class="help is-success">{{ configNotice }}</p>
      </div>
      <div class="field is-grouped">
        <div class="control">
          <button type="button" class="button is-link" :disabled="!configText.trim()" @click="importConfig">
            Import
          </button>
        </div>
        <div class="control">
          <button type="button" class="button" @click="exportConfig">Export current</button>
        </div>
      </div>
    </div>
  </CollapsibleBox>
</template>
