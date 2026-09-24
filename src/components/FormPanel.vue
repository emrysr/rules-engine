<script setup lang="ts">
import { computed, ref } from 'vue'
import type { SchemaField } from '@/types'
import { rulePath } from '@/paths'
import { useEngineStore } from '@/stores/engine'
import CollapsibleBox from './CollapsibleBox.vue'
import FieldOptionsDialog from './FieldOptionsDialog.vue'
import FieldTypeMenu from './FieldTypeMenu.vue'
import InlineEdit from './InlineEdit.vue'

const store = useEngineStore()

/**
 * Fields bucketed by their `group`, in the order each group first appears,
 * then any empty groups. Ungrouped fields form their own bucket (legend null)
 * and render without a fieldset. Grouping is presentation only — formData
 * stays flat.
 */
const fieldGroups = computed(() => {
  const groups = new Map<string | null, SchemaField[]>()
  for (const f of store.schemaFields) {
    const legend = f.group || null
    if (!groups.has(legend)) groups.set(legend, [])
    groups.get(legend)!.push(f)
  }
  for (const g of store.emptyGroups) if (!groups.has(g)) groups.set(g, [])
  return [...groups].map(([legend, fields]) => ({ legend, fields }))
})

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

const error = ref('')
/** The group just created, so its legend opens straight into editing. */
const newGroup = ref('')

const optionsDialog = ref<InstanceType<typeof FieldOptionsDialog>>()

// Choice fields need their options spelled out first; everything else is added as is.
function onPick(type: string, group: string, withOptions: boolean) {
  error.value = ''
  if (withOptions) optionsDialog.value?.open(type, group)
  else error.value = store.addField(type, group)
}

function addGroup() {
  error.value = ''
  newGroup.value = store.addGroup()
}
</script>

<template>
  <CollapsibleBox section="form" title="Form">
    <div class="mt-3">
      <div class="block content">

        <p class="help level-left">
          These selections are live inputs into the rules below — every change here re-runs the
          filtering and updates the match counts and results in real time. Click a label or
          fieldset title to rename it; the path under each input is how rules read it, and
          renaming updates the rules to match.
        </p>
        <button type="button" class="button" @click="addGroup">Add group</button>
      </div>

      <p v-if="error" class="help is-danger mb-3">{{ error }}</p>
      <p v-if="store.formPathError" class="help is-warning mb-3">{{ store.formPathError }}</p>

      <!--
        `options` is bound only when set: FormKit reads an explicit
        `options: undefined` as "has options" and a checkbox then crashes.
        `preserve` keeps a value when its input remounts (e.g. a group rename).
      -->
      <FormKit v-model="store.formData" type="group">
        <div class="fixed-grid has-1-cols-mobile has-2-cols-tablet has-3-cols-desktop">
          <div class="grid">
            <component :is="g.legend ? 'fieldset' : 'div'" v-for="g in fieldGroups" :key="g.legend ?? ''" class="cell"
              :class="{ 'form-group': g.legend }">
              <legend v-if="g.legend" class="label">
                <InlineEdit :text="g.legend" :auto-edit="g.legend === newGroup"
                  @save="(t) => (error = store.renameGroup(g.legend!, t))" />
              </legend>
              <FormKit v-for="f in g.fields" :key="f.key" :type="f.type" :name="f.key" :label="f.label || f.key"
                v-bind="f.options ? { options: f.options } : {}" :help="rulePath(f)"
                :inner-class="f.type === 'select' ? f.classes : undefined"
                :input-class="f.type === 'select' ? undefined : f.classes" preserve>
                <template #[labelSection(f)]="context">
                  <component :is="labelTag(f)" :for="labelTag(f) === 'label' ? context.id : undefined"
                    class="field-label" :class="{ label: labelTag(f) !== 'span' }">
                    <InlineEdit :text="f.label || f.key" @save="(t) => (error = store.renameField(f.key, t))" />
                    <button type="button" class="delete" title="Delete field" :aria-label="`Delete ${f.label || f.key}`"
                      @click.prevent="error = store.removeField(f.key)"></button>
                  </component>
                </template>
              </FormKit>
              <p v-if="!g.fields.length" class="help">No fields yet.</p>
              <div v-if="g.legend" class="form-group-actions">
                <button type="button" class="button" commandfor="field-type-menu" command="toggle-popover"
                  :data-group="g.legend">
                  Add
                </button>
              </div>
            </component>
          </div>
        </div>
      </FormKit>

      <FieldTypeMenu @pick="onPick" />
      <FieldOptionsDialog ref="optionsDialog" />
    </div>
  </CollapsibleBox>
</template>
