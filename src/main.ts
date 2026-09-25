import { createApp } from 'vue'
import { createPinia } from 'pinia'
import { plugin as formKitPlugin, defaultConfig } from '@formkit/vue'

import 'bulma/css/bulma.min.css'
import '@/styles.css'

import App from '@/App.vue'

// No FormKit theme CSS: Bulma styles every input. These map FormKit's sections
// onto Bulma's form markup (div.field > label.label + div.control > input.input).
const bulmaSections: Record<string, string> = {
  outer: 'field',
  label: 'label',
  inner: 'control',
  help: 'help',
  message: 'help is-danger',
}

// Native controls Bulma leaves unstyled - `.input` would give them a text box.
const plainInputs = new Set(['color', 'range', 'file'])

function bulmaClasses(section: string, type: unknown): string {
  // Bulma wraps a <select> in div.select rather than classing the element itself.
  if (type === 'select') {
    if (section === 'inner') return 'control select'
    if (section === 'input') return ''
  }
  // Checkboxes and radios sit inline inside a label.checkbox / label.radio;
  // multi-option ones get a fieldset whose legend acts as the field label.
  if (type === 'checkbox' || type === 'radio') {
    if (section === 'wrapper') return type
    if (section === 'legend') return 'label'
    if (section === 'input' || section === 'inner' || section === 'label') return ''
  }
  if (section === 'input') {
    if (type === 'textarea') return 'textarea'
    if (plainInputs.has(type as string)) return ''
    return 'input'
  }
  return bulmaSections[section] ?? ''
}

const formKitConfig = defaultConfig({
  config: {
    rootClasses: (section, node) =>
      Object.fromEntries(
        bulmaClasses(section, node.props.type)
          .split(' ')
          .filter(Boolean)
          .map((c) => [c, true]),
      ),
  },
})

createApp(App).use(createPinia()).use(formKitPlugin, formKitConfig).mount('#app')
