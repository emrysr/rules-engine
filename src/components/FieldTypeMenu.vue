<script setup lang="ts">
import { fieldTypeSections } from '@/fieldTypes'

/**
 * The one popover menu of field types, shared by every fieldset's Add button.
 * Invokers open it with `commandfor="field-type-menu"` and say which group
 * they belong to with `data-group`; the `command` event hands us the invoker.
 */
const emit = defineEmits<{ pick: [type: string, group: string, withOptions: boolean] }>()

let group = ''
let anchor: HTMLElement | null = null

// Only the Add buttons carry data-group; the menu's own hide commands don't.
// The invoker also becomes the CSS anchor: commandfor, unlike popovertarget,
// doesn't make it the popover's implicit anchor.
function onCommand(event: Event) {
  const source = (event as Event & { source?: Element | null }).source
  if (!(source instanceof HTMLElement) || source.dataset.group === undefined) return
  group = source.dataset.group
  anchor?.style.removeProperty('anchor-name')
  source.style.setProperty('anchor-name', '--field-type-menu')
  anchor = source
}
</script>

<template>
  <aside id="field-type-menu" popover class="menu box p-3 field-type-menu" @command="onCommand">
    <template v-for="s in fieldTypeSections" :key="s.label">
      <p class="menu-label">{{ s.label }}</p>
      <ul class="menu-list">
        <li v-for="item in s.items" :key="item.label ?? item.type">
          <button
            type="button"
            commandfor="field-type-menu"
            command="hide-popover"
            @click="emit('pick', item.type, group, !!item.withOptions)"
          >
            {{ item.label ?? item.type }}
          </button>
        </li>
      </ul>
    </template>
  </aside>
</template>
