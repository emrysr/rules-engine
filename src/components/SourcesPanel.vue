<script setup lang="ts">
import { computed, reactive, ref } from 'vue'
import type { DataSource } from '@/types'
import { isPasted, useEngineStore } from '@/stores/engine'
import CollapsibleBox from './CollapsibleBox.vue'
import EditableFieldset from './EditableFieldset.vue'
import EntryPreview from './EntryPreview.vue'
import GridAddCell from './GridAddCell.vue'

const store = useEngineStore()

const error = ref('')
/** The source just created, so its legend opens straight into editing. */
const newSource = ref('')

const lastIndex = computed(() => store.dataSources.length - 1)

/**
 * What's typed in each pasted-JSON box, by source key, while it hasn't been
 * applied: it's applied when the box is left, if it parses; otherwise it
 * stays here with its error so nothing typed is lost.
 */
const drafts = reactive<Record<string, string>>({})
const draftErrors = reactive<Record<string, string>>({})

function pastedText(s: DataSource): string {
  return drafts[s.key] ?? JSON.stringify(s.data, null, 2)
}

function applyPasted(s: DataSource, text: string) {
  drafts[s.key] = text
  try {
    const data = JSON.parse(text)
    draftErrors[s.key] = ''
    error.value = store.updateSource(s.key, { data })
    if (!error.value) delete drafts[s.key]
  } catch (e) {
    draftErrors[s.key] = 'Invalid JSON: ' + (e as Error).message
  }
}

function jsonRows(s: DataSource): number {
  return Math.min(12, Math.max(4, pastedText(s).split('\n').length))
}

// Switching where the data comes from starts it empty: no URL, or an empty
// list (or object, for values) to paste over.
function setFrom(s: DataSource, from: string) {
  delete drafts[s.key]
  delete draftErrors[s.key]
  error.value =
    from === 'pasted'
      ? store.updateSource(s.key, { url: undefined, data: s.use === 'values' ? {} : [] })
      : store.updateSource(s.key, { data: undefined, url: '' })
}

function setUse(s: DataSource, use: string) {
  const values = use === 'values'
  const patch: Partial<DataSource> = { use: values ? 'values' : undefined }
  // Pasted data still at its empty start becomes the empty shape the new use needs.
  const empty = JSON.stringify(s.data)
  if (isPasted(s) && (empty === '[]' || empty === '{}')) patch.data = values ? {} : []
  error.value = store.updateSource(s.key, patch)
}

function valueCount(key: string): number {
  const v = store.sourceValues[key]
  return v && typeof v === 'object' ? Object.keys(v).length : 0
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
  delete drafts[key]
  delete draftErrors[key]
}
</script>

<template>
  <CollapsibleBox section="sources" title="Data Sources">
    <div class="mt-3">
      <p class="help block">
        The data the rules work with, fetched from a URL or pasted in as JSON. A
        <strong>list</strong> source is filtered by its rules and gets a query and a result; its
        name is also the response field its list is read from (falling back to the first list).
        A <strong>values</strong> source is an object of values every rule can read, e.g.
        <code>{"var": "teetime.target_day"}</code> - in a real app these would be the inputs in
        the rules' scope. Click a name to rename it; rules follow.
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
        The saved data sources are invalid JSON - import a config to replace them.
      </p>

      <div class="fixed-grid has-1-cols-mobile has-2-cols-tablet has-3-cols-desktop">
        <div class="grid">
          <EditableFieldset v-for="(s, i) in store.dataSources" :key="s.key" :legend="s.key" noun="source"
            :auto-edit="s.key === newSource" :can-move-left="i > 0" :can-move-right="i < lastIndex"
            @rename="(t) => (error = store.renameSource(s.key, t))" @delete="removeSource(s.key)"
            @move="(step) => (error = store.moveSource(s.key, step))">
            <div class="field is-grouped is-grouped-multiline mt-2">
              <div class="control">
                <label class="label" :for="`source-from-${s.key}`">From</label>
                <div class="select">
                  <select :id="`source-from-${s.key}`" :value="isPasted(s) ? 'pasted' : 'url'"
                    @change="setFrom(s, ($event.target as HTMLSelectElement).value)">
                    <option value="url">URL</option>
                    <option value="pasted">Pasted JSON</option>
                  </select>
                </div>
              </div>
              <div class="control">
                <label class="label" :for="`source-use-${s.key}`">Use as</label>
                <div class="select">
                  <select :id="`source-use-${s.key}`" :value="s.use ?? 'list'"
                    @change="setUse(s, ($event.target as HTMLSelectElement).value)">
                    <option value="list">List of entries</option>
                    <option value="values">Values</option>
                  </select>
                </div>
              </div>
            </div>

            <div v-if="isPasted(s)" class="field">
              <label class="label" :for="`source-json-${s.key}`">JSON</label>
              <div class="control">
                <textarea :id="`source-json-${s.key}`" class="textarea code" :rows="jsonRows(s)"
                  spellcheck="false" :value="pastedText(s)"
                  :placeholder="s.use === 'values' ? '{ &quot;target_day&quot;: 3 }' : '[ { &quot;id&quot;: 1 } ]'"
                  @input="drafts[s.key] = ($event.target as HTMLTextAreaElement).value"
                  @change="applyPasted(s, ($event.target as HTMLTextAreaElement).value)"></textarea>
              </div>
              <p v-if="draftErrors[s.key]" class="help is-danger">{{ draftErrors[s.key] }}</p>
              <p v-else-if="drafts[s.key] !== undefined" class="help">Applied when you leave the box.</p>
            </div>
            <div v-else class="field">
              <label class="label" :for="`source-url-${s.key}`">URL</label>
              <div class="control">
                <input :id="`source-url-${s.key}`" class="input" type="url" :value="s.url"
                  placeholder="https://example.com/api/items"
                  @change="error = store.updateSource(s.key, { url: ($event.target as HTMLInputElement).value.trim() })" />
              </div>
            </div>

            <div class="field">
              <label class="label" :for="`source-list-path-${s.key}`">
                {{ s.use === 'values' ? 'Values path' : 'List path' }}
              </label>
              <div class="control">
                <input :id="`source-list-path-${s.key}`" class="input" type="text" :value="s.listPath ?? ''"
                  :placeholder="s.use === 'values' ? 'The top level' : 'Found automatically'"
                  @change="error = store.updateSource(s.key, { listPath: ($event.target as HTMLInputElement).value.trim() })" />
              </div>
              <p class="help">
                Where the {{ s.use === 'values' ? 'values object' : 'list' }} sits when it's wrapped,
                e.g. <code>data</code> or <code>response.items</code>.
              </p>
              <p v-if="store.errors[s.key]" class="help is-danger">{{ store.errors[s.key] }}</p>
            </div>

            <div class="field is-grouped is-grouped-multiline source-status">
              <div class="control">
                <span v-if="store.loading[s.key]" class="tag is-warning">Fetching…</span>
                <span v-else-if="store.errors[s.key]" class="tag is-danger">Error</span>
                <span v-else-if="s.use === 'values' && store.sourceValues[s.key]" class="tag is-success">
                  {{ valueCount(s.key) }} {{ valueCount(s.key) === 1 ? 'value' : 'values' }}
                </span>
                <span v-else-if="s.use !== 'values' && store.rawData[s.key]" class="tag is-success">
                  {{ store.rawData[s.key].length }} entries
                </span>
                <span v-else class="tag">Not loaded</span>
              </div>
              <div v-if="!isPasted(s) && s.url" class="control">
                <a :href="s.url" target="_blank" rel="noopener">Open ↗</a>
              </div>
            </div>

            <details v-if="s.use === 'values' && store.sourceValues[s.key]">
              <summary class="is-clickable">Preview</summary>
              <pre class="payload">{{ JSON.stringify(store.sourceValues[s.key], null, 2) }}</pre>
            </details>
            <EntryPreview v-else-if="s.use !== 'values'" :entries="store.rawData[s.key] ?? []" />

            <template v-if="!isPasted(s)" #actions>
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
