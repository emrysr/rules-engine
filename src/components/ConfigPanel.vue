<script setup lang="ts">
import { useEngineStore } from '@/stores/engine'
import CollapsibleBox from './CollapsibleBox.vue'

const store = useEngineStore()
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
        Rendered below as real <code>&lt;FormKit&gt;</code> inputs. Their live values become
        <code>formData.&lt;key&gt;</code> inside any rule.
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
        fields via <code>formData.*</code>).
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
  </CollapsibleBox>
</template>
