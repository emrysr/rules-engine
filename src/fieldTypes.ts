/**
 * The field types the form editor offers, and what to call them. A curated
 * subset of FormKit's inputs: the structural ones (form, group, list, meta,
 * hidden), the buttons, and ones this app has no use for are left out.
 */

/** A menu entry. `withOptions` means the field is built from a list of choices. */
export interface FieldTypeItem {
  type: string
  label?: string
  withOptions?: boolean
}

const plain = (...types: string[]): FieldTypeItem[] => types.map((type) => ({ type }))

// A checkbox is a yes/no field on its own, or a group of choices when given options.
export const fieldTypeSections: { label: string; items: FieldTypeItem[] }[] = [
  { label: 'Text', items: plain('text', 'email', 'tel', 'url') },
  {
    label: 'Choice',
    items: [
      { type: 'select', withOptions: true },
      { type: 'radio', withOptions: true },
      { type: 'checkbox' },
      { type: 'checkbox', label: 'checkbox group', withOptions: true },
    ],
  },
  { label: 'Number', items: [{ type: 'number' }, { type: 'range', label: 'slider' }] },
  { label: 'Date & time', items: plain('date', 'month', 'week', 'time') },
  { label: 'Other', items: plain('color') },
]

/** What a type is called in labels and titles: "slider" for FormKit's range. */
export function typeNoun(type: string, withOptions = false): string {
  if (type === 'checkbox' && withOptions) return 'checkbox group'
  return type === 'range' ? 'slider' : type
}
