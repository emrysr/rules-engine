import { createApp } from 'vue'
import { createPinia } from 'pinia'
import { plugin as formKitPlugin, defaultConfig } from '@formkit/vue'

import 'bulma/css/bulma.min.css'
import '@formkit/themes/genesis'
import '@/styles.css'

import App from '@/App.vue'

createApp(App).use(createPinia()).use(formKitPlugin, defaultConfig()).mount('#app')
