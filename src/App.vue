<script setup lang="ts">
import { onMounted } from 'vue'
import { useEngineStore } from '@/stores/engine'
import ConfigPanel from '@/components/ConfigPanel.vue'
import FormPanel from '@/components/FormPanel.vue'
import RulePanel from '@/components/RulePanel.vue'
import ResultsPanel from '@/components/ResultsPanel.vue'
import SourcesPanel from '@/components/SourcesPanel.vue'
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
    <SourcesPanel />
    <FormPanel />
    <RulePanel />
    <ResultsPanel />
  </div>

  <footer class="footer">
    <div class="content">
      <p class="has-text-weight-semibold mb-2">Roadmap</p>
      <ul>
        <li>
          <s>JSON rules editor - replace the raw JSON textarea with a proper rule builder (field /
          operator / value pickers instead of hand-written JSON Logic)</s>
        </li>
        <li>
          <s>FormKit schema editor - replace the raw JSON textarea with a field builder (add/edit/
          reorder fields, pick type, set options)</s>
        </li>
        <li>
          <s>Data sources editor - add, rename, reorder and delete sources, fetch each on its own
          or all at once, and preview what came back</s>
        </li>
        <li>
          <s>One fieldset pattern for sources, options and rules - click-to-rename, move left /
          right, delete, and an Add cell in the next grid slot</s>
        </li>
        <li>
          <s>Renames carry through - renaming a form field, fieldset or source rewrites the rules
          that use it</s>
        </li>
        <li>
          <s>Per-rule raw JSON view, toggled from the query builder</s>
        </li>
        <li>
          <s>Hide the raw config JSON - the whole setup moves in and out through Import / Export</s>
        </li>
        <li>
          <s>Save / recall named config presets (e.g. "Desirable Campervan", "Holiday Activities")
          via local storage</s>
        </li>
        <li>
          Data sources from JSON or JS fragments - paste the data (or a script that returns it)
          as well as fetching it from a URL
        </li>
        <li>
          Edit form field options - change an existing choice field's options, not only when
          adding it
        </li>
        <li>
          <s>Rule combiner - build each source's result query from the rules with AND / OR
          groups, e.g. (highRating and inStock), or (bloodTypeMatch or adultUser)</s>
        </li>
        <li>
          List-aware rules - some / all / none over list fields (like a product's tags), and
          whether map / filter / reduce belong in the builder
        </li>
        <li>
          Replace the browser's confirm prompts with a Bulma dialog
        </li>
      </ul>
    </div>
  </footer>

  <ReloadPrompt />
</template>
