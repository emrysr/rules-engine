<script setup lang="ts">
import { useEngineStore } from '@/stores/engine'
import { ref } from 'vue'
import CollapsibleBox from './CollapsibleBox.vue'

const store = useEngineStore()

// The blob is scratch space, not config — it isn't persisted, and editing it
// changes nothing until Import is pressed.
const configText = ref('')
const configError = ref('')
const configNotice = ref('')

function importConfig(): void {
  configError.value = store.importConfig(configText.value)
  configNotice.value = configError.value ? '' : 'Imported — refetching data sources.'
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
  configNotice.value = 'Current config exported — copy it, or edit and re-import.'
}
</script>

<template>
  <CollapsibleBox section="config" title="Configuration">
    <details open>
      <summary class="is-clickable has-text-weight-semibold is-size-7">
        Data Sources <span class="tag ml-1">list endpoints</span>
      </summary>
      <p class="help mt-2 mb-2">
        Each entry: <code>key</code> (namespace used in rules, and the response field the list
        is auto-extracted from), <code>url</code> (a list endpoint).
      </p>
      <textarea
        v-model="store.sourcesText"
        class="textarea code is-size-7"
        rows="6"
        spellcheck="false"
        aria-label="Data sources JSON"
      ></textarea>
      <p v-if="store.sourcesError" class="help is-danger">{{ store.sourcesError }}</p>
      <button
        class="button is-small is-link mt-2"
        :class="{ 'is-loading': store.anyLoading }"
        @click="store.fetchAll()"
      >
        Fetch All
      </button>
    </details>

    <details>
      <summary class="is-clickable has-text-weight-semibold is-size-7">
        Form Schema <span class="tag ml-1">FormKit field definitions</span>
      </summary>
      <p class="help mt-2 mb-2">
        Rendered below as real <code>&lt;FormKit&gt;</code> inputs. Rules read their live
        values as <code>formData.&lt;group&gt;.&lt;label&gt;</code>, both snake_cased.
      </p>
      <textarea
        v-model="store.schemaText"
        class="textarea code is-size-7"
        rows="8"
        spellcheck="false"
        aria-label="Form schema JSON"
      ></textarea>
      <p v-if="store.schemaError" class="help is-danger">{{ store.schemaError }}</p>
    </details>

    <details open>
      <summary class="is-clickable has-text-weight-semibold is-size-7">
        Rules <span class="tag ml-1">JSON Logic</span>
      </summary>
      <p class="help mt-2 mb-2">
        Each rule: <code>source</code> (which data source it filters), <code>enabled</code>
        (default toggle state), <code>logic</code> (JSON Logic — entry fields directly, form
        fields via <code>formData.&lt;group&gt;.&lt;label&gt;</code>). Rebuilt from the Rule
        Evaluation editor on every change there; edits here show up there too.
      </p>
      <textarea
        v-model="store.rulesText"
        class="textarea code is-size-7"
        rows="10"
        spellcheck="false"
        aria-label="Rules JSON"
      ></textarea>
      <p v-if="store.rulesError" class="help is-danger">{{ store.rulesError }}</p>
    </details>

    <details>
      <summary class="is-clickable has-text-weight-semibold is-size-7">
        Import / Export <span class="tag ml-1">whole config</span>
      </summary>
      <p class="help mt-2 mb-2">
        One object: <code>sources</code>, <code>schema</code> and <code>rules</code> (each as
        above), plus optional <code>formData</code> values. Importing replaces everything —
        toggles reset to each rule's <code>enabled</code>, and form fields not in
        <code>formData</code> take their defaults.
      </p>
      <textarea
        v-model="configText"
        class="textarea code is-size-7"
        rows="10"
        spellcheck="false"
        placeholder='{ "sources": [], "schema": [], "rules": [], "formData": {} }'
        aria-label="Complete config JSON"
      ></textarea>
      <p v-if="configError" class="help is-danger">{{ configError }}</p>
      <p v-else-if="configNotice" class="help is-success">{{ configNotice }}</p>
      <div class="buttons mt-2">
        <button class="button is-small is-link" :disabled="!configText.trim()" @click="importConfig">
          Import
        </button>
        <button class="button is-small" @click="exportConfig">Export current</button>
      </div>
    </details>
  </CollapsibleBox>
</template>
