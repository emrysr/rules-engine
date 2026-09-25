<script setup lang="ts">
import { computed, useId } from 'vue'
import { literalText, parseLiteral } from '@/comparison'
import type { Operand, OperandKind } from '@/comparison'

/**
 * One side of a comparison: pick what it reads (an entry field, a form field,
 * a values source's value, or a value hard-coded into the rule), then which one. Text inputs commit on
 * change (Enter or leaving the box), not per keystroke.
 */
const props = defineProps<{
  operand: Operand
  /** Field paths seen in the rule's source data. */
  entryPaths: string[]
  /** Form fields as rules read them: full `formData.…` path and a readable name. */
  formFields: { path: string; name: string }[]
  /** Values sources' value paths, e.g. teetime.target_day. */
  sourcePaths: string[]
  label: string
}>()
const emit = defineEmits<{ update: [operand: Operand] }>()

const listId = useId()

/** Source value is only offered when there's a values source to read (or the side already reads one). */
const kinds = computed(() => {
  const all: { kind: OperandKind; label: string }[] = [
    { kind: 'entry', label: 'Entry field' },
    { kind: 'form', label: 'Form field' },
    { kind: 'source', label: 'Source value' },
    { kind: 'value', label: 'Value' },
  ]
  return all.filter((k) => k.kind !== 'source' || props.sourcePaths.length || props.operand.kind === 'source')
})

/** Form fields to offer, plus the current path if no field has it any more. */
const formOptions = computed(() => {
  const o = props.operand
  if (o.kind !== 'form' || props.formFields.some((f) => f.path === o.path)) return props.formFields
  return [...props.formFields, { path: o.path, name: `${o.path} (no such field)` }]
})

/** Source values to offer, plus the current path if its source no longer has it. */
const sourceOptions = computed(() => {
  const o = props.operand
  if (o.kind !== 'source' || props.sourcePaths.includes(o.path)) return props.sourcePaths
  return [...props.sourcePaths, o.path]
})

// Switching kind starts on the first field there is, so the side is usable
// straight away (and a form path is never blank, which would read as an entry field).
function switchKind(kind: OperandKind) {
  if (kind === 'value') emit('update', { kind, value: '' })
  else if (kind === 'form') emit('update', { kind, path: props.formFields[0]?.path ?? 'formData.' })
  else if (kind === 'source') emit('update', { kind, path: props.sourcePaths[0] ?? '' })
  else emit('update', { kind, path: props.entryPaths[0] ?? '' })
}

function inputValue(e: Event): string {
  return (e.target as HTMLInputElement | HTMLSelectElement).value
}
</script>

<template>
  <div class="field has-addons operand">
    <div class="control">
      <div class="select">
        <select :value="operand.kind" :aria-label="`${label}: compare with`"
          @change="switchKind(inputValue($event) as OperandKind)">
          <option v-for="k in kinds" :key="k.kind" :value="k.kind">{{ k.label }}</option>
        </select>
      </div>
    </div>

    <div v-if="operand.kind === 'entry'" class="control is-expanded">
      <input class="input" type="text" :list="listId" :value="operand.path" placeholder="e.g. rating"
        :aria-label="`${label}: entry field`"
        @change="emit('update', { kind: 'entry', path: inputValue($event).trim() })" />
      <datalist :id="listId">
        <option v-for="p in entryPaths" :key="p" :value="p" />
      </datalist>
    </div>

    <div v-else-if="operand.kind === 'form'" class="control is-expanded">
      <div class="select is-fullwidth">
        <select :value="operand.path" :aria-label="`${label}: form field`"
          @change="emit('update', { kind: 'form', path: inputValue($event) })">
          <option v-for="f in formOptions" :key="f.path" :value="f.path">{{ f.name }}</option>
        </select>
      </div>
    </div>

    <div v-else-if="operand.kind === 'source'" class="control is-expanded">
      <div class="select is-fullwidth">
        <select :value="operand.path" :aria-label="`${label}: source value`"
          @change="emit('update', { kind: 'source', path: inputValue($event) })">
          <option v-for="p in sourceOptions" :key="p" :value="p">{{ p }}</option>
        </select>
      </div>
    </div>

    <div v-else class="control is-expanded">
      <input class="input" type="text" :value="literalText(operand.value)" placeholder='e.g. 4, true, "text"'
        :aria-label="`${label}: value`"
        title='Numbers, true, false and null are read as such; quote a number to keep it text, e.g. "4"'
        @change="emit('update', { kind: 'value', value: parseLiteral(inputValue($event)) })" />
    </div>
  </div>
</template>
