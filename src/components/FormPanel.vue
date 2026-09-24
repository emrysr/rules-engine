<script setup lang="ts">
import { useEngineStore } from '@/stores/engine'
import CollapsibleBox from './CollapsibleBox.vue'

const store = useEngineStore()
</script>

<template>
  <CollapsibleBox section="form" title="Form">
    <div class="mt-3">
      <p class="help mb-3">
        These selections are live inputs into the rules below — every change here re-runs the
        filtering and updates the match counts and results in real time.
      </p>
      <FormKit v-model="store.formData" type="group">
        <FormKit
          v-for="f in store.schemaFields"
          :key="f.key"
          :type="f.type"
          :name="f.key"
          :label="f.label"
          :options="f.options"
        />
      </FormKit>
    </div>
  </CollapsibleBox>
</template>
