<script setup lang="ts">
import type { SchemaField } from '@/types'
import { rulePath } from '@/paths'
import { useEngineStore } from '@/stores/engine'
import InlineEdit from './InlineEdit.vue'

/**
 * One group's fields as real <FormKit> inputs, each with a click-to-rename
 * label and a delete button. Must sit inside the form's FormKit group.
 * `options` is bound only when set: FormKit reads an explicit
 * `options: undefined` as "has options" and a checkbox then crashes.
 * `preserve` keeps a value when its input remounts (e.g. a group rename).
 */
defineProps<{ fields: SchemaField[] }>()
const emit = defineEmits<{ error: [message: string] }>()

const store = useEngineStore()

// Radios and multi-option checkboxes put the field's label in a fieldset
// legend; their `label` section is each option's text, which stays as is.
function labelSection(f: SchemaField): 'legend' | 'label' {
  return f.type === 'radio' || (f.type === 'checkbox' && f.options) ? 'legend' : 'label'
}

// A single checkbox's label sits inside label.checkbox, so it can't be a label itself.
function labelTag(f: SchemaField): string {
  if (labelSection(f) === 'legend') return 'legend'
  return f.type === 'checkbox' ? 'span' : 'label'
}
</script>

<template>
  <FormKit v-for="f in fields" :key="f.key" :type="f.type" :name="f.key" :label="f.label || f.key"
    v-bind="f.options ? { options: f.options } : {}" :help="rulePath(f)"
    :inner-class="f.type === 'select' ? f.classes : undefined"
    :input-class="f.type === 'select' ? undefined : f.classes" preserve>
    <template #[labelSection(f)]="context">
      <component :is="labelTag(f)" :for="labelTag(f) === 'label' ? context.id : undefined"
        class="field-label" :class="{ label: labelTag(f) !== 'span' }">
        <InlineEdit :text="f.label || f.key" @save="(t) => emit('error', store.renameField(f.key, t))" />
        <button type="button" class="delete" title="Delete field" :aria-label="`Delete ${f.label || f.key}`"
          @click.prevent="emit('error', store.removeField(f.key))"></button>
      </component>
    </template>
  </FormKit>
  <p v-if="!fields.length" class="help">No fields yet.</p>
</template>
