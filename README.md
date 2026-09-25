# Config-Driven Rules Engine

A schema-driven architecture demo: FormKit form schema + JSON Logic rules + external
API data sources, all editable as config, filtering live data with toggleable rules.

**Live:** https://emrysr.github.io/rules-engine/

Installable as a PWA and works offline from the last-fetched data.

## The idea

Nothing about *what* this filters is compiled in. Data sources, form fields and rules
are all JSON, editable at runtime:

| Config | Shape | Does |
| --- | --- | --- |
| **Data sources** | `{ key, url, listPath? }` | `key` is the namespace rules target, and the response field the array is auto-extracted from. `listPath` is a dotted path to the list when the API wraps it (`data`, `response.items`); without it the list is found automatically. Each source is a fieldset in the Data Sources panel - rename, move, add or delete it, set its URL, fetch it on its own and preview what came back. |
| **Form schema** | `{ key, label, type, options?, default?, group?, classes? }` | Rendered as real `<FormKit>` inputs in the Options Form panel; `group` is the fieldset it sits in. **Copy FormKit Schema** in that panel's title bar copies the form as a FormKit schema to paste into another FormKit project (`<FormKitSchema :schema="schema" />` inside a `<FormKit type="form">`). Each fieldset becomes a FormKit group, so the form's value is shaped the way the copied rules read `formData`. Fieldsets show in the order their groups first appear; the arrows under each one move it. |
| **Rules** | `{ key, source, enabled, logic }` | `logic` is JSON Logic. `source` says which data source it filters. Each rule is a fieldset in the JSON Rules panel - rename, move, add or delete it and edit its logic there, with a query builder or as raw JSON; the rules JSON is rebuilt on every change. **Copy JSON** in the panel's title bar copies the rules, with `enabled` set to each checkbox as it stands, to paste into another app. |

The point is the coupling between the last two: a rule reads an entry's fields
directly (`{"var": "rating"}`) *and* live form values via the `formData` namespace.
A form value's path is its fieldset legend and label, snake_cased: "Minimum product
rating" in the "Products" fieldset is `{"var": "formData.products.minimum_product_rating"}`
(an ungrouped field is just `formData.<label>`). Renaming a label or legend in the form
rewrites the rules that read it. Form inputs are rule inputs, not UI decoration -
change a field and every match count re-runs.

```json
{
  "key": "highRating",
  "source": "products",
  "enabled": true,
  "logic": { ">": [{ "var": "rating" }, { "var": "formData.products.minimum_product_rating" }] }
}
```

## Design decisions worth keeping

- **`enabled` is only a default.** Live toggle state lives separately in the store's
  `ruleToggles`, so editing the rules JSON never clobbers what the user switched off.
- **Config is held as text, not parsed objects.** A half-typed edit degrades to "no
  items" with an inline error rather than tearing down the app.
- **A rule that throws counts as no match.** A bad operator or missing field shouldn't
  break the whole evaluation pass.
- **Everything persists to `localStorage`**, including fetched data - so a cold start
  (or an offline one) renders immediately and refreshes in the background.
- **Presets are stored apart from the working state** (`cdre-presets-v1`), so loading a
  preset or importing a config never touches them. A preset saves each rule's `enabled`
  as its checkbox stood, so loading brings the exact combination back.

## Running it

```bash
npm install
npm run dev        # http://localhost:5173
npm run build      # type-check + production build
npm run preview
```

Commit the `package-lock.json` that `npm install` produces - then switch the workflow
to `npm ci` and re-enable `cache: npm` for faster, reproducible CI builds.

## Deployment

Pushing to `main` builds and publishes to GitHub Pages via
`.github/workflows/deploy.yml`. Set **Settings → Pages → Source** to **GitHub Actions**
once; nothing else is needed.

`base` in `vite.config.ts` is `/rules-engine/` because Pages serves from a subpath.
Change it to `/` if a custom domain is added.

## Icons

`assets/icon-master.png` (512×512) is the source of truth. Replace it and re-run:

```bash
pip install pillow
python3 scripts/make-icons.py
```

Outputs land in `public/`: the two manifest sizes, a maskable variant, an
`apple-touch-icon.png` and the favicons.

## Layout

```
src/
  stores/engine.ts     config parsing, fetching, evaluation, persistence
  components/          one panel per section of the UI
  config.ts            validation for whole-config import
  types.ts             Rule / DataSource / SchemaField / EngineConfig / persisted state
  defaults.ts          the seed config shipped on first load
```

## Roadmap

- [x] **JSON rules editor** - a query builder (field / operator / value pickers) with a
      raw JSON view per rule
- [x] **FormKit schema editor** - a field builder (add/rename/delete fields and
      fieldsets, pick type, set options)
- [x] **Data sources editor** - add, rename, reorder and delete sources, fetch each
      on its own or all at once, and preview what came back
- [x] **Import a complete config object** - one JSON blob covering sources + schema +
      rules + form defaults in a single action
- [x] **Named config presets** - save/recall e.g. "Desirable Campervan", "Holiday
      Activities" in the Configuration panel, kept in `localStorage`
- [ ] **AND / OR groups** in the rule builder, so one rule can hold several comparisons
- [ ] **Edit an existing choice field's options** (the options dialog only runs when
      adding)
- [ ] **A Bulma dialog** in place of the browser's confirm prompts

Known rough edge: the full Bulma stylesheet is ~710 KB uncompressed (72 KB gzipped)
and all of it is precached. Worth switching to a Sass build that imports only the
used components if the precache size starts to matter.
