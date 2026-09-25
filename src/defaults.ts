import type { DataSource, Rule, SchemaField, SectionName } from './types'
import type { Pipeline } from './pipeline'

export const defaultSources: DataSource[] = [
  { key: 'products', url: 'https://dummyjson.com/products?limit=100' },
  { key: 'users', url: 'https://dummyjson.com/users?limit=0' },
  { key: 'carts', url: 'https://dummyjson.com/carts?limit=0' },
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
  { key: 'productId', label: 'Product ID', type: 'number', default: 100, group: 'Carts' },
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

/**
 * The customers who bought a product: carts holding it give their buyers'
 * user ids, then the users (as their Source Filter leaves them) with one of
 * those ids give their full names.
 */
export const defaultPipelines: Pipeline[] = [
  {
    name: 'Buyers',
    blocks: [
      { type: 'source', source: 'carts' },
      {
        type: 'filter',
        condition: {
          op: 'and',
          items: [{ some: [{ var: 'products' }, { '==': [{ var: 'id' }, { var: 'formData.carts.product_id' }] }] }],
        },
      },
      { type: 'map', path: 'userId' },
    ],
  },
  {
    name: 'Customer names',
    blocks: [
      { type: 'source', source: 'users' },
      { type: 'filter', condition: { op: 'and', items: [{ in: [{ var: 'id' }, { var: 'pipelines.Buyers' }] }] } },
      { type: 'map', path: 'firstName, lastName', join: ' ' },
    ],
  },
]

export const defaultSectionOpen: Record<SectionName, boolean> = {
  config: false,
  sources: true,
  form: true,
  rules: true,
  pipelines: true,
  results: true,
}

/**
 * Bump when the persisted shape changes so stale caches are ignored. v4: rules
 * read form values by snake_cased legend + label, not by field key. v5:
 * pipelines start from filtered list sources, and the demo gains carts.
 */
export const STORAGE_KEY = 'cdre-config-v5'
