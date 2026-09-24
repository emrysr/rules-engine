<script setup lang="ts">
import { nextTick, ref } from 'vue'
import { typeNoun } from '@/fieldTypes'
import { snakeCase } from '@/paths'
import { useEngineStore } from '@/stores/engine'

/**
 * Modal for adding a field built from a list of choices (select, radio,
 * checkbox group): its label plus each option's label and stored value.
 * A value follows its label, snake_cased, until the user edits it directly.
 * Opened with open(); Cancel, Escape and a click outside close it.
 */
interface OptionRow {
  id: number
  label: string
  value: string
  valueEdited: boolean
}

const store = useEngineStore()

const dialog = ref<HTMLDialogElement>()
const list = ref<HTMLElement>()
const type = ref('')
const group = ref('')
const label = ref('')
const rows = ref<OptionRow[]>([])
const error = ref('')

let nextId = 0
function makeRow(text: string): OptionRow {
  return { id: nextId++, label: text, value: snakeCase(text), valueEdited: false }
}

function open(fieldType: string, fieldGroup: string) {
  type.value = fieldType
  group.value = fieldGroup
  label.value = store.placeholderLabel(fieldType, fieldGroup)
  rows.value = [makeRow('Option 1'), makeRow('Option 2')]
  error.value = ''
  dialog.value?.showModal()
}

defineExpose({ open })

function onLabelInput(row: OptionRow) {
  if (!row.valueEdited) row.value = snakeCase(row.label)
}

async function addRow() {
  rows.value.push(makeRow(`Option ${rows.value.length + 1}`))
  await nextTick()
  list.value?.querySelector<HTMLInputElement>('.field:last-child input')?.select()
}

function removeRow(id: number) {
  rows.value = rows.value.filter((r) => r.id !== id)
}

function problem(): string {
  if (!label.value.trim()) return 'The field needs a label.'
  if (!rows.value.length) return 'Add at least one option.'
  const values = new Set<string>()
  for (const [i, r] of rows.value.entries()) {
    if (!r.label.trim() || !r.value.trim()) return `Option ${i + 1} needs both a label and a value.`
    if (values.has(r.value.trim())) return `Two options share the value "${r.value.trim()}".`
    values.add(r.value.trim())
  }
  return ''
}

function submit() {
  error.value =
    problem() ||
    store.addField(type.value, group.value, {
      label: label.value.trim(),
      options: rows.value.map((r) => ({ label: r.label.trim(), value: r.value.trim() })),
    })
  if (!error.value) dialog.value?.close()
}

/**
 * Soft dismiss: `closedby="any"` has the browser close the dialog on Escape or
 * a click on the backdrop. Where closedby isn't supported yet (Escape still
 * works there), a backdrop click is caught by hand — only when the press also
 * began on the backdrop, so a text selection dragged out of the card doesn't
 * close it. The card fills the dialog, so only the backdrop targets the dialog.
 */
const supportsClosedBy = 'closedBy' in HTMLDialogElement.prototype
let pressedBackdrop = false

function onPointerDown(event: PointerEvent) {
  pressedBackdrop = event.target === dialog.value
}

function onClick(event: MouseEvent) {
  if (!supportsClosedBy && pressedBackdrop && event.target === dialog.value) dialog.value?.close()
}

</script>

<template>
  <dialog
    id="field-options-dialog"
    ref="dialog"
    class="options-dialog"
    closedby="any"
    @pointerdown="onPointerDown"
    @click="onClick"
  >
    <form class="card" @submit.prevent="submit">
      <header class="card-header">
        <p class="card-header-title">
          Add {{ type === 'checkbox' ? typeNoun(type, true) : `${typeNoun(type)} field` }}
        </p>
        <button
          type="button"
          class="card-header-icon"
          aria-label="Close"
          commandfor="field-options-dialog"
          command="close"
        >
          <span class="delete" aria-hidden="true"></span>
        </button>
      </header>

      <div class="card-content">
        <div class="field">
          <label class="label" for="options-dialog-label">Label</label>
          <div class="control">
            <input id="options-dialog-label" v-model="label" class="input" type="text" />
          </div>
          <p class="help">
            {{ group ? `In the “${group}” fieldset.` : 'Not in a fieldset.' }}
          </p>
        </div>

        <p class="label mb-1">Options</p>
        <p class="help mt-0 mb-2">Each option's label is what's shown; its value is what rules see.</p>
        <div ref="list">
          <div v-for="r in rows" :key="r.id" class="field has-addons mb-2">
            <div class="control is-expanded">
              <input
                v-model="r.label"
                class="input"
                type="text"
                placeholder="Label"
                aria-label="Option label"
                @input="onLabelInput(r)"
              />
            </div>
            <div class="control is-expanded">
              <input
                v-model="r.value"
                class="input"
                type="text"
                placeholder="Value"
                aria-label="Option value"
                @input="r.valueEdited = true"
              />
            </div>
            <div class="control">
              <button
                type="button"
                class="button option-remove"
                :aria-label="`Remove ${r.label || 'option'}`"
                title="Remove option"
                @click="removeRow(r.id)"
              >
                <span class="delete" aria-hidden="true"></span>
              </button>
            </div>
          </div>
        </div>
        <button type="button" class="button" @click="addRow">Add option</button>

        <p v-if="error" class="help is-danger mt-3">{{ error }}</p>
      </div>

      <footer class="card-footer buttons is-right p-3">
        <button type="button" class="button" commandfor="field-options-dialog" command="close">
          Cancel
        </button>
        <button type="submit" class="button is-primary">Add field</button>
      </footer>
    </form>
  </dialog>
</template>
