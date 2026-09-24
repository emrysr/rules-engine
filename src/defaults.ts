import type { DataSource, Rule, SchemaField, SectionName } from './types'

export const defaultSources: DataSource[] = [
  { key: 'products', url: 'https://dummyjson.com/products?limit=100' },
  { key: 'users', url: 'https://dummyjson.com/users?limit=100' },
]

export const defaultSchema: SchemaField[] = [
  { key: 'minRating', label: 'Minimum product rating', type: 'number', default: 4, group: 'Products' },
  { key: 'minAge', label: 'Minimum user age', type: 'number', default: 25, group: 'Users' },
  {
    key: 'bloodType',
    label: 'User blood type',
    type: 'select',
    options: ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'],
    default: 'O+',
    group: 'Users',
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
    group: 'Products',
  },
]

export const defaultRules: Rule[] = [
  {
    key: 'highRating',
    source: 'products',
    enabled: true,
    logic: { '>': [{ var: 'rating' }, { var: 'formData.products.minimum_product_rating' }] },
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
    logic: { '==': [{ var: 'category' }, { var: 'formData.products.product_category' }] },
  },
  {
    key: 'adultUser',
    source: 'users',
    enabled: true,
    logic: { '>=': [{ var: 'age' }, { var: 'formData.users.minimum_user_age' }] },
  },
  {
    key: 'bloodTypeMatch',
    source: 'users',
    enabled: false,
    logic: { '==': [{ var: 'bloodGroup' }, { var: 'formData.users.user_blood_type' }] },
  },
]

export const defaultSectionOpen: Record<SectionName, boolean> = {
  config: false,
  form: true,
  rules: true,
  results: true,
  fetched: false,
}

/**
 * Bump when the persisted shape changes so stale caches are ignored. v4: rules
 * read form values by snake_cased legend + label, not by field key.
 */
export const STORAGE_KEY = 'cdre-config-v4'
