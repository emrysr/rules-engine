<script setup lang="ts">
import { computed, ref } from 'vue'
import { useEngineStore } from '@/stores/engine'
import CollapsibleBox from './CollapsibleBox.vue'
import EditableFieldset from './EditableFieldset.vue'
import GridAddCell from './GridAddCell.vue'

const store = useEngineStore()

const error = ref('')
/** The source just created, so its legend opens straight into editing. */
const newSource = ref('')

const lastIndex = computed(() => store.dataSources.length - 1)

function preview(key: string): string {
  return JSON.stringify((store.rawData[key] ?? []).slice(0, 3), null, 2)
}

function addSource() {
  const result = store.addSource()
  error.value = 'error' in result ? result.error : ''
  if ('key' in result) newSource.value = result.key
}

// Rules filtering a deleted source match nothing, so say which ones first.
function removeSource(key: string) {
  const rules = store.rulesConfig.filter((r) => r.source === key).map((r) => r.key)
  if (rules.length && !confirm(`Delete "${key}"?\n\nThese rules filter it and will match nothing: ${rules.join(', ')}.`)) {
    return
  }
  error.value = store.removeSource(key)
}
</script>

<template>
  <CollapsibleBox section="sources" title="Data Sources">
    <div class="mt-3">
      <p class="help block">
        List endpoints the rules filter. A source's name is how rules pick it, and the response
        field its list is read from (falling back to the first list in the response). Click a
        name to rename it; rules follow.
      </p>
      <div class="field">
        <div class="control">
          <button type="button" class="button is-link" :class="{ 'is-loading': store.anyLoading }"
            @click="store.fetchAll()">
            Fetch all
          </button>
        </div>
      </div>

      <p v-if="error" class="help is-danger mb-3">{{ error }}</p>
      <p v-if="store.sourcesError" class="help is-danger mb-3">
        The sources JSON is invalid — re-import a config to edit sources here.
      </p>

      <div class="fixed-grid has-1-cols-mobile has-2-cols-tablet has-3-cols-desktop">
        <div class="grid">
          <EditableFieldset v-for="(s, i) in store.dataSources" :key="s.key" :legend="s.key" noun="source"
            :auto-edit="s.key === newSource" :can-move-left="i > 0" :can-move-right="i < lastIndex"
            @rename="(t) => (error = store.renameSource(s.key, t))" @delete="removeSource(s.key)"
            @move="(step) => (error = store.moveSource(s.key, step))">
            <div class="field mt-2">
              <label class="label" :for="`source-url-${s.key}`">URL</label>
              <div class="control">
                <input :id="`source-url-${s.key}`" class="input" type="url" :value="s.url"
                  placeholder="https://example.com/api/items"
                  @change="error = store.setSourceUrl(s.key, ($event.target as HTMLInputElement).value.trim())" />
              </div>
              <p v-if="store.errors[s.key]" class="help is-danger">{{ store.errors[s.key] }}</p>
            </div>

            <div class="field is-grouped is-grouped-multiline source-status">
              <div class="control">
                <span v-if="store.loading[s.key]" class="tag is-warning">Fetching…</span>
                <span v-else-if="store.errors[s.key]" class="tag is-danger">Error</span>
                <span v-else-if="store.rawData[s.key]" class="tag is-success">
                  {{ store.rawData[s.key].length }} entries
                </span>
                <span v-else class="tag">Not fetched</span>
              </div>
              <div v-if="s.url" class="control">
                <a :href="s.url" target="_blank" rel="noopener">Open ↗</a>
              </div>
            </div>

            <details v-if="store.rawData[s.key]?.length">
              <summary class="is-clickable">Preview</summary>
              <pre class="payload">{{ preview(s.key) }}</pre>
              <p class="help">Showing the first 3 of {{ store.rawData[s.key].length }} entries.</p>
            </details>

            <template #actions>
              <button type="button" class="button" :class="{ 'is-loading': store.loading[s.key] }"
                :disabled="!s.url" @click="store.fetchOne(s)">
                Fetch
              </button>
            </template>
          </EditableFieldset>
          <GridAddCell label="Add source" @add="addSource" />
        </div>
      </div>
    </div>
  </CollapsibleBox>
</template>
