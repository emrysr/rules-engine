<script setup lang="ts">
import { computed, reactive, ref } from 'vue'
import type { Rule } from '@/types'
import { useEngineStore } from '@/stores/engine'
import CollapsibleBox from './CollapsibleBox.vue'
import InlineEdit from './InlineEdit.vue'
import RuleBuilder from './RuleBuilder.vue'

const store = useEngineStore()

const error = ref('')
/** The rule just created, so its legend opens straight into editing. */
const newRule = ref('')

/**
 * What's typed in each logic textarea, by rule key, while it differs from the
 * stored logic. A draft that parses is written through on every keystroke;
 * one that doesn't stays here, with its error, until it's fixed. Without a
 * draft the textarea shows the stored logic, so outside changes (a form
 * rename rewriting a var, an edit to the combined JSON) show up.
 */
const drafts = reactive<Record<string, string>>({})
const draftErrors = reactive<Record<string, string>>({})

function logicText(r: Rule): string {
  return drafts[r.key] ?? JSON.stringify(r.logic, null, 2)
}

function onLogicInput(r: Rule, text: string) {
  drafts[r.key] = text
  try {
    const logic = JSON.parse(text) as Rule['logic']
    draftErrors[r.key] = store.updateRule(r.key, { logic })
  } catch (e) {
    draftErrors[r.key] = 'Invalid JSON: ' + (e as Error).message
  }
}

// From the query builder: it replaces whatever the textarea held.
function setLogic(r: Rule, logic: Rule['logic']) {
  error.value = store.updateRule(r.key, { logic })
  if (error.value) return
  delete drafts[r.key]
  delete draftErrors[r.key]
}

// Once the textarea is left with valid JSON, drop the draft so it reformats.
function onLogicBlur(r: Rule) {
  if (draftErrors[r.key]) return
  delete drafts[r.key]
  delete draftErrors[r.key]
}

function rows(r: Rule): number {
  return Math.min(12, Math.max(4, logicText(r).split('\n').length))
}

/** Every data source, plus a rule's own source if it names one that's gone. */
function sourceOptions(r: Rule): string[] {
  const keys = store.dataSources.map((s) => s.key)
  return r.source && !keys.includes(r.source) ? [...keys, r.source] : keys
}

function addRule() {
  const result = store.addRule()
  error.value = 'error' in result ? result.error : ''
  if ('key' in result) newRule.value = result.key
}

function renameRule(from: string, to: string) {
  error.value = store.renameRule(from, to)
  if (error.value) return
  for (const map of [drafts, draftErrors]) {
    if (from in map) {
      map[to] = map[from]
      delete map[from]
    }
  }
}

function removeRule(key: string) {
  error.value = store.removeRule(key)
  if (!error.value) {
    delete drafts[key]
    delete draftErrors[key]
  }
}

const lastIndex = computed(() => store.rulesConfig.length - 1)
</script>

<template>
  <CollapsibleBox section="rules" title="Rule Evaluation">
    <div class="mt-3">
      <div class="block content">
        <p class="help">
          Each rule filters one data source; an entry is a result when it passes every enabled
          rule for its source. Click a rule's name to rename it. Its logic is JSON Logic — entry
          fields directly, form fields via <code>formData.&lt;group&gt;.&lt;label&gt;</code> — and
          every edit here rebuilds the combined rules JSON in the Config panel.
        </p>
        <button type="button" class="button" @click="addRule">Add rule</button>
      </div>

      <p v-if="error" class="help is-danger mb-3">{{ error }}</p>
      <p v-if="store.rulesError" class="help is-danger mb-3">
        The combined rules JSON is invalid — fix it in the Config panel to edit rules here.
      </p>

      <div class="fixed-grid has-1-cols-mobile has-2-cols-tablet has-3-cols-desktop">
        <div class="grid">
          <fieldset v-for="(r, i) in store.rulesConfig" :key="r.key" class="cell form-group">
            <legend class="label field-label">
              <InlineEdit :text="r.key" :auto-edit="r.key === newRule" @save="(t) => renameRule(r.key, t)" />
              <button type="button" class="delete" title="Delete rule" :aria-label="`Delete ${r.key}`"
                @click="removeRule(r.key)"></button>
            </legend>

            <div class="field is-grouped is-grouped-multiline rule-meta">
              <div class="control">
                <label class="checkbox">
                  <input v-model="store.ruleToggles[r.key]" type="checkbox" />
                  <span>Enabled</span>
                </label>
              </div>
              <div class="control">
                <div class="select">
                  <select :value="r.source" :aria-label="`${r.key} data source`"
                    @change="error = store.updateRule(r.key, { source: ($event.target as HTMLSelectElement).value })">
                    <option v-for="s in sourceOptions(r)" :key="s" :value="s">{{ s }}</option>
                  </select>
                </div>
              </div>
              <div class="control">
                <span class="tag" :class="store.ruleMatchInfo[r.key]?.matches ? 'is-success' : 'is-danger'">
                  {{ store.ruleMatchInfo[r.key]?.matches ?? 0 }} /
                  {{ store.ruleMatchInfo[r.key]?.total ?? 0 }}
                </span>
              </div>
            </div>

            <RuleBuilder :rule="r" @update="(logic) => setLogic(r, logic)" />

            <div class="field">
              <div class="control">
                <textarea class="textarea code" :rows="rows(r)" spellcheck="false"
                  :aria-label="`${r.key} logic JSON`" :value="logicText(r)"
                  @input="onLogicInput(r, ($event.target as HTMLTextAreaElement).value)"
                  @blur="onLogicBlur(r)"></textarea>
              </div>
              <p v-if="draftErrors[r.key]" class="help is-danger">{{ draftErrors[r.key] }}</p>
            </div>

            <div class="form-group-actions">
              <nav class="pagination" :aria-label="`Move ${r.key}`">
                <button type="button" class="pagination-previous" title="Move rule left"
                  :aria-label="`Move ${r.key} left`" :disabled="i === 0"
                  @click="error = store.moveRule(r.key, -1)">
                  <svg class="move-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M15 6l-6 6 6 6" /></svg>
                </button>
                <button type="button" class="pagination-next" title="Move rule right"
                  :aria-label="`Move ${r.key} right`" :disabled="i === lastIndex"
                  @click="error = store.moveRule(r.key, 1)">
                  <svg class="move-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M9 6l6 6-6 6" /></svg>
                </button>
              </nav>
            </div>
          </fieldset>
        </div>
      </div>
      <p v-if="!store.rulesConfig.length && !store.rulesError" class="help">No rules defined.</p>
    </div>
  </CollapsibleBox>
</template>
