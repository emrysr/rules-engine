import type { DataSource, Rule, SchemaField, SectionName } from './types'

export const defaultSources: DataSource[] = [
  { key: 'products', url: 'https://dummyjson.com/products?limit=100' },
  { key: 'users', url: 'https://dummyjson.com/users?limit=100' },
]

export const defaultSchema: SchemaField[] = [
  { key: 'minRating', label: 'Minimum product rating', type: 'number', default: 4 },
  { key: 'minAge', label: 'Minimum user age', type: 'number', default: 25 },
  {
    key: 'bloodType',
    label: 'User blood type',
    type: 'select',
    options: ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'],
    default: 'O+',
  },
  {
    key: 'category',
    label: 'Product category',
    type: 'select',
    options: [
      'beauty',
      'fragrances',
      'furniture',
      'groceries',
      'home-decoration',
      'laptops',
      'smartphones',
      'sunglasses',
    ],
    default: 'smartphones',
  },
]

export const defaultRules: Rule[] = [
  {
    key: 'highRating',
    source: 'products',
    enabled: true,
    logic: { '>': [{ var: 'rating' }, { var: 'formData.minRating' }] },
  },
  {
    key: 'inStock',
    source: 'products',
    enabled: true,
    logic: { '>': [{ var: 'stock' }, 0] },
  },
  {
    key: 'categoryMatch',
    source: 'products',
    enabled: true,
    logic: { '==': [{ var: 'category' }, { var: 'formData.category' }] },
  },
  {
    key: 'adultUser',
    source: 'users',
    enabled: true,
    logic: { '>=': [{ var: 'age' }, { var: 'formData.minAge' }] },
  },
  {
    key: 'bloodTypeMatch',
    source: 'users',
    enabled: false,
    logic: { '==': [{ var: 'bloodGroup' }, { var: 'formData.bloodType' }] },
  },
]

export const defaultSectionOpen: Record<SectionName, boolean> = {
  config: false,
  form: true,
  rules: true,
  results: true,
  fetched: false,
}

/** Bump when the persisted shape changes so stale caches are ignored. */
export const STORAGE_KEY = 'cdre-config-v3'
