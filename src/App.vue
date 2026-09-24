<script setup lang="ts">
import { onMounted } from 'vue'
import { useEngineStore } from '@/stores/engine'
import ConfigPanel from '@/components/ConfigPanel.vue'
import FormPanel from '@/components/FormPanel.vue'
import RulePanel from '@/components/RulePanel.vue'
import ResultsPanel from '@/components/ResultsPanel.vue'
import FetchedDataPanel from '@/components/FetchedDataPanel.vue'
import ReloadPrompt from '@/components/ReloadPrompt.vue'

const store = useEngineStore()

// Cached data renders immediately; this refreshes it in the background.
onMounted(() => store.fetchAll())
</script>

<template>
  <section class="hero is-link">
    <div class="hero-body py-5">
      <p class="title is-4">Config-Driven Rules Engine</p>
      <p class="subtitle is-6">
        Real FormKit inputs, live over multiple API list endpoints, filtered by toggleable JSON
        Logic rules.
      </p>
    </div>
  </section>

  <div class="container mt-4 mb-6 px-4">
    <ConfigPanel />
    <FormPanel />
    <RulePanel />
    <ResultsPanel />
    <FetchedDataPanel />
  </div>

  <footer class="footer">
    <div class="content">
      <p class="has-text-weight-semibold mb-2">Todo</p>
      <ul>
        <li>
          JSON rules editor — replace the raw JSON textarea with a proper rule builder (field /
          operator / value pickers instead of hand-written JSON Logic)
        </li>
        <li>
          FormKit schema editor — replace the raw JSON textarea with a field builder (add/edit/
          reorder fields, pick type, set options)
        </li>
        <li>
          Save / recall named config presets (e.g. "Desirable Campervan", "Holiday Activities")
          via local storage
        </li>
      </ul>
    </div>
  </footer>

  <ReloadPrompt />
</template>
