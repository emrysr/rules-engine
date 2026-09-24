<script setup lang="ts">
import { useEngineStore } from '@/stores/engine'
import CollapsibleBox from './CollapsibleBox.vue'

const store = useEngineStore()
</script>

<template>
  <CollapsibleBox section="rules" title="Rule Evaluation">
    <div class="mt-3">
      <div v-for="r in store.rulesConfig" :key="r.key" class="rule-row">
        <label class="checkbox">
          <input v-model="store.ruleToggles[r.key]" type="checkbox" />
          <strong class="ml-1">{{ r.key }}</strong>
        </label>
        <span class="tag ml-2">{{ r.source }}</span>
        <span
          class="tag ml-2"
          :class="store.ruleMatchInfo[r.key]?.matches ? 'is-success' : 'is-danger'"
        >
          {{ store.ruleMatchInfo[r.key]?.matches ?? 0 }} /
          {{ store.ruleMatchInfo[r.key]?.total ?? 0 }}
        </span>
      </div>
      <p v-if="!store.rulesConfig.length" class="help mt-2">No rules defined.</p>
    </div>
  </CollapsibleBox>
</template>
