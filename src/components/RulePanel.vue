<script setup lang="ts">
import { computed, reactive, ref } from 'vue'
import type { Rule } from '@/types'
import { useEngineStore } from '@/stores/engine'
import CollapsibleBox from './CollapsibleBox.vue'
import EditableFieldset from './EditableFieldset.vue'
import GridAddCell from './GridAddCell.vue'
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

/** Rules showing their raw JSON instead of the query builder, by key. Session-only. */
const rawView = reactive<Record<string, boolean>>({})

// Back to the builder, a draft that never parsed is dropped: the builder
// shows the stored logic, and the draft would otherwise resurface later.
function toggleRaw(key: string) {
  if (rawView[key]) {
    delete drafts[key]
    delete draftErrors[key]
  }
  rawView[key] = !rawView[key]
}

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
  for (const map of [drafts, draftErrors, rawView] as Record<string, unknown>[]) {
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
    delete rawView[key]
  }
}

const lastIndex = computed(() => store.rulesConfig.length - 1)

/** Label on the copy button: its result for a moment after a click. */
const copyState = ref<'idle' | 'copied' | 'failed'>('idle')
let copyTimer: ReturnType<typeof setTimeout> | undefined

/**
 * Copy the rules as JSON to paste into another app. Each rule's `enabled`
 * is its checkbox as it stands now, so the copy is the combination the user
 * has been trying out rather than each rule's starting state.
 */
async function copyRules() {
  const rules = store.rulesConfig.map((r) => ({ ...r, enabled: !!store.ruleToggles[r.key] }))
  try {
    await navigator.clipboard.writeText(JSON.stringify(rules, null, 2))
    copyState.value = 'copied'
  } catch {
    copyState.value = 'failed'
  }
  clearTimeout(copyTimer)
  copyTimer = setTimeout(() => (copyState.value = 'idle'), 2000)
}
</script>

<template>
  <CollapsibleBox section="rules" title="Rules">
    <template #actions>
      <button type="button" class="button" :class="{ 'is-success': copyState === 'copied', 'is-danger': copyState === 'failed' }"
        :disabled="!store.rulesConfig.length" title="Copy the rules as JSON, with their current on/off state"
        @click="copyRules">
        {{ copyState === 'copied' ? 'Copied' : copyState === 'failed' ? 'Copy failed' : 'Copy JSON' }}
      </button>
    </template>
    <div class="mt-3">
      <p class="help block">
        Each rule filters one data source; an entry is a result when it passes every enabled
        rule for its source. Click a rule's name to rename it. Its logic is JSON Logic — entry
        fields directly, form fields via <code>formData.&lt;group&gt;.&lt;label&gt;</code> — and
        every edit here rebuilds the combined rules JSON that Export includes.
      </p>

      <p v-if="error" class="help is-danger mb-3">{{ error }}</p>
      <p v-if="store.rulesError" class="help is-danger mb-3">
        The saved rules are invalid JSON — import a config to replace them.
      </p>

      <div class="fixed-grid has-1-cols-mobile has-2-cols-tablet has-3-cols-desktop">
        <div class="grid">
          <EditableFieldset v-for="(r, i) in store.rulesConfig" :key="r.key" :legend="r.key" noun="rule"
            :auto-edit="r.key === newRule" :can-move-left="i > 0" :can-move-right="i < lastIndex"
            @rename="(t) => renameRule(r.key, t)" @delete="removeRule(r.key)"
            @move="(step) => (error = store.moveRule(r.key, step))">
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

            <div v-if="rawView[r.key]" class="field">
              <div class="control">
                <textarea class="textarea code" :rows="rows(r)" spellcheck="false"
                  :aria-label="`${r.key} logic JSON`" :value="logicText(r)"
                  @input="onLogicInput(r, ($event.target as HTMLTextAreaElement).value)"
                  @blur="onLogicBlur(r)"></textarea>
              </div>
              <p v-if="draftErrors[r.key]" class="help is-danger">{{ draftErrors[r.key] }}</p>
            </div>
            <RuleBuilder v-else :rule="r" @update="(logic) => setLogic(r, logic)" />

            <template #actions>
              <button type="button" class="button" :aria-pressed="!!rawView[r.key]"
                :title="rawView[r.key] ? 'Back to the query builder' : 'Edit this rule\'s logic as raw JSON'"
                @click="toggleRaw(r.key)">
                {{ rawView[r.key] ? 'Use builder' : 'Edit JSON' }}
              </button>
            </template>
          </EditableFieldset>
          <GridAddCell label="Add rule" @add="addRule" />
        </div>
      </div>
    </div>
  </CollapsibleBox>
</template>
