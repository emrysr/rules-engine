<script setup lang="ts">
import { computed, ref } from 'vue'
import type { SchemaField } from '@/types'
import { useEngineStore } from '@/stores/engine'
import CollapsibleBox from './CollapsibleBox.vue'
import CopyJsonButton from './CopyJsonButton.vue'
import EditableFieldset from './EditableFieldset.vue'
import FieldOptionsDialog from './FieldOptionsDialog.vue'
import FieldTypeMenu from './FieldTypeMenu.vue'
import FormFields from './FormFields.vue'
import GridAddCell from './GridAddCell.vue'

const store = useEngineStore()

/**
 * Fields bucketed by their `group`, in the store's group order. Ungrouped
 * fields form their own bucket (legend null) and render without a fieldset.
 * Grouping is presentation only — formData stays flat.
 */
const fieldGroups = computed(() =>
  store.groupOrder.map((legend) => ({
    legend,
    fields: store.schemaFields.filter((f) => (f.group || null) === legend),
  })),
)

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

// An empty group just goes; one with fields asks first, naming the rules that read them.
function deleteGroup(name: string, fields: SchemaField[]) {
  if (fields.length) {
    const rules = store.rulesReading(fields)
    const count = fields.length === 1 ? '1 field' : `${fields.length} fields`
    const reading = rules.length
      ? `\n\nThese rules read them and will no longer find their values: ${rules.join(', ')}.`
      : ''
    if (!confirm(`Delete "${name}" and its ${count}?${reading}`)) return
  }
  error.value = store.removeGroup(name)
}
</script>

<template>
  <CollapsibleBox section="form" title="Options Form">
    <template #actions>
      <CopyJsonButton :value="() => store.schemaFields" :disabled="!store.schemaFields.length"
        title="Copy the form's field definitions as JSON" />
    </template>
    <div class="mt-3">
      <p class="help block">
        These selections are live inputs into the rules below — every change here re-runs the
        filtering and updates the match counts and results in real time. Click a label or
        fieldset title to rename it; the path under each input is how rules read it, and
        renaming updates the rules to match.
      </p>

      <p v-if="error" class="help is-danger mb-3">{{ error }}</p>
      <p v-if="store.schemaError" class="help is-danger mb-3">
        The saved form schema is invalid JSON — import a config to replace it.
      </p>
      <p v-if="store.formPathError" class="help is-warning mb-3">{{ store.formPathError }}</p>

      <FormKit v-model="store.formData" type="group">
        <div class="fixed-grid has-1-cols-mobile has-2-cols-tablet has-3-cols-desktop">
          <div class="grid">
            <template v-for="(g, i) in fieldGroups" :key="g.legend ?? ''">
              <EditableFieldset v-if="g.legend" :legend="g.legend" noun="group" :auto-edit="g.legend === newGroup"
                :can-move-left="i > 0" :can-move-right="i < fieldGroups.length - 1"
                @rename="(t) => (error = store.renameGroup(g.legend!, t))"
                @delete="deleteGroup(g.legend!, g.fields)"
                @move="(step) => (error = store.moveGroup(g.legend!, step))">
                <FormFields :fields="g.fields" @error="(e) => (error = e)" />
                <template #actions>
                  <button type="button" class="button" commandfor="field-type-menu" command="toggle-popover"
                    :data-group="g.legend">
                    Add
                  </button>
                </template>
              </EditableFieldset>
              <div v-else class="cell">
                <FormFields :fields="g.fields" @error="(e) => (error = e)" />
              </div>
            </template>
            <GridAddCell label="Add group" @add="addGroup" />
          </div>
        </div>
      </FormKit>

      <FieldTypeMenu @pick="onPick" />
      <FieldOptionsDialog ref="optionsDialog" />
    </div>
  </CollapsibleBox>
</template>
