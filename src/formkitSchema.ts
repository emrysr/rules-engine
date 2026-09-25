import type { SchemaField } from '@/types'
import { fieldPath, snakeCase } from '@/paths'

/**
 * The form as a FormKit schema, for pasting into another FormKit project and
 * rendering with <FormKitSchema>. Each fieldset becomes a <fieldset> holding
 * a FormKit group named after its snake_cased legend, and each field is named
 * after its snake_cased label. So the form's value comes out nested exactly
 * as rules read it here: { products: { minimum_product_rating: 4 } }, i.e.
 * formData.products.minimum_product_rating.
 */

type SchemaNode = Record<string, unknown>

function fieldNode(f: SchemaField): SchemaNode {
  const node: SchemaNode = {
    $formkit: f.type,
    name: fieldPath(f).split('.').pop(),
    label: f.label || f.key,
  }
  if (f.options) node.options = f.options
  if (f.default !== undefined) node.value = f.default
  // As in the Options Form: selects take extra classes on their wrapper.
  if (f.classes) node[f.type === 'select' ? 'innerClass' : 'inputClass'] = f.classes
  return node
}

/** `groupOrder` is the display order of groups, with null for ungrouped fields. */
export function toFormKitSchema(fields: SchemaField[], groupOrder: (string | null)[]): SchemaNode[] {
  return groupOrder.flatMap((group) => {
    const nodes = fields.filter((f) => (f.group || null) === group).map(fieldNode)
    if (!nodes.length) return []
    if (!group) return nodes
    return [
      {
        $el: 'fieldset',
        children: [
          { $el: 'legend', children: group },
          { $formkit: 'group', name: snakeCase(group), children: nodes },
        ],
      },
    ]
  })
}
