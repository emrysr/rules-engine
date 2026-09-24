<script setup lang="ts">
import { useRegisterSW } from 'virtual:pwa-register/vue'

/**
 * The service worker updates itself (registerType: 'autoUpdate'), but a silent
 * swap mid-session is disorienting — this surfaces it and lets the user choose
 * when to take the new build.
 */
const { offlineReady, needRefresh, updateServiceWorker } = useRegisterSW()

function close() {
  offlineReady.value = false
  needRefresh.value = false
}
</script>

<template>
  <div v-if="offlineReady || needRefresh" class="reload-prompt">
    <div class="notification is-link is-light mb-0">
      <button class="delete" aria-label="Dismiss" @click="close"></button>
      <span v-if="needRefresh">A new version is available.</span>
      <span v-else>Ready to work offline.</span>
      <button
        v-if="needRefresh"
        class="button is-small is-link ml-3"
        @click="updateServiceWorker(true)"
      >
        Reload
      </button>
    </div>
  </div>
</template>

<style scoped>
.reload-prompt {
  position: fixed;
  right: 1rem;
  bottom: 1rem;
  z-index: 50;
  max-width: 22rem;
}
</style>
