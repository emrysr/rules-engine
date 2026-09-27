import type { EngineConfig } from './types'

/**
 * Built-in example setups, shown in order in the Configuration panel so the
 * idea can be shown step by step: from one filter on one source to the full
 * set of features. Unlike presets they live in the code, so they're the same
 * on every machine and can't be overwritten.
 */
export interface Example {
  name: string
  /** What it shows, in a sentence. */
  description: string
  config: EngineConfig
}

const CATEGORIES = [
  'beauty',
  'fragrances',
  'furniture',
  'groceries',
  'home-decoration',
  'kitchen-accessories',
  'laptops',
  'mens-shirts',
  'mens-shoes',
  'mens-watches',
  'mobile-accessories',
  'motorcycle',
  'skin-care',
  'smartphones',
  'sports-accessories',
  'sunglasses',
  'tablets',
  'tops',
  'vehicle',
  'womens-bags',
  'womens-dresses',
  'womens-jewellery',
  'womens-shoes',
  'womens-watches',
]

/** "home-decoration" → "Home decoration". */
function label(category: string): string {
  const words = category.replace(/-/g, ' ')
  return words.charAt(0).toUpperCase() + words.slice(1)
}

export const examples: Example[] = [
  {
    name: '1. One filter',
    description:
      'One source and one choice: the products in the category picked in the form. No pipeline, so Results is the filtered products.',
    config: {
      sources: [{ key: 'products', url: 'https://dummyjson.com/products?limit=0' }],
      schema: [
        {
          key: 'category',
          label: 'Category',
          type: 'select',
          options: CATEGORIES.map((c) => ({ label: label(c), value: c })),
          default: 'smartphones',
          group: 'Products',
          help: 'Only products in this category are kept (categoryMatch).',
        },
      ],
      rules: [
        {
          key: 'categoryMatch',
          source: 'products',
          enabled: true,
          logic: { '==': [{ var: 'category' }, { var: 'formData.products.category' }] },
        },
      ],
      formData: { category: 'smartphones' },
    },
  },
  {
    name: '2. Two sources joined',
    description:
      'Two sources, each with its own filter, joined by two short pipelines: the popular posts written by older users. The first pipeline gets the authors, the second keeps the posts they wrote.',
    config: {
      sources: [
        { key: 'users', url: 'https://dummyjson.com/users?limit=0' },
        { key: 'posts', url: 'https://dummyjson.com/posts?limit=0' },
      ],
      schema: [
        {
          key: 'minAge',
          label: 'Minimum age',
          type: 'number',
          default: 45,
          group: 'Users',
          help: 'Only users at least this old count as authors (oldEnough).',
        },
        {
          key: 'minViews',
          label: 'Minimum views',
          type: 'number',
          default: 2000,
          group: 'Posts',
          help: 'Only posts viewed at least this many times are kept (popular).',
        },
      ],
      rules: [
        {
          key: 'oldEnough',
          source: 'users',
          enabled: true,
          logic: { '>=': [{ var: 'age' }, { var: 'formData.users.minimum_age' }] },
        },
        {
          key: 'popular',
          source: 'posts',
          enabled: true,
          logic: { '>=': [{ var: 'views' }, { var: 'formData.posts.minimum_views' }] },
        },
      ],
      pipelines: [
        {
          name: 'Authors',
          blocks: [
            { type: 'source', source: 'users' },
            { type: 'map', path: 'id' },
          ],
        },
        {
          name: 'Their posts',
          blocks: [
            { type: 'source', source: 'posts' },
            { type: 'filter', condition: { op: 'and', items: [{ in: [{ var: 'userId' }, { var: 'pipelines.Authors' }] }] } },
            { type: 'map', path: 'title' },
          ],
        },
      ],
      formData: { minAge: 45, minViews: 2000 },
    },
  },
  {
    name: '3. Who bought it?',
    description:
      'Three sources joined into one answer: the customers of the chosen age who bought a product, and how many. Uses list checks, a pasted values source, rules to switch on, and pipelines that build on each other.',
    config: {
      sources: [
        { key: 'carts', url: 'https://dummyjson.com/carts?limit=0' },
        { key: 'users', url: 'https://dummyjson.com/users?limit=0' },
        { key: 'shop', data: { big_cart_total: 1000 }, use: 'values' },
      ],
      schema: [
        {
          key: 'product',
          label: 'Product',
          type: 'select',
          options: [
            { label: 'Apple AirPods', value: '100' },
            { label: 'Cat Food', value: '18' },
            { label: "Dior J'adore", value: '8' },
            { label: 'Samsung Galaxy S10', value: '133' },
            { label: 'Tartan Dress', value: '166' },
          ],
          default: '100',
          group: 'Carts',
          help: 'The product whose buyers the result lists (hasProduct).',
        },
        {
          key: 'minAge',
          label: 'Minimum age',
          type: 'number',
          default: 30,
          group: 'Customers',
          help: 'Customers younger than this are left out (oldEnough).',
        },
        {
          key: 'bloodType',
          label: 'Blood type',
          type: 'select',
          options: ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'],
          default: 'O+',
          group: 'Customers',
          help: 'Only customers with this blood type, when bloodTypeMatch is switched on.',
        },
      ],
      rules: [
        {
          key: 'hasProduct',
          source: 'carts',
          enabled: true,
          logic: { some: [{ var: 'products' }, { '==': [{ var: 'id' }, { var: 'formData.carts.product' }] }] },
        },
        {
          key: 'bigCart',
          source: 'carts',
          enabled: false,
          logic: { '>=': [{ var: 'total' }, { var: 'shop.big_cart_total' }] },
        },
        {
          key: 'oldEnough',
          source: 'users',
          enabled: true,
          logic: { '>=': [{ var: 'age' }, { var: 'formData.customers.minimum_age' }] },
        },
        {
          key: 'bloodTypeMatch',
          source: 'users',
          enabled: false,
          logic: { '==': [{ var: 'bloodGroup' }, { var: 'formData.customers.blood_type' }] },
        },
      ],
      combine: {
        carts: { op: 'and', items: ['hasProduct', 'bigCart'] },
        users: { op: 'and', items: ['oldEnough', 'bloodTypeMatch'] },
      },
      pipelines: [
        {
          name: 'Buyers',
          blocks: [
            { type: 'source', source: 'carts' },
            { type: 'map', path: 'userId' },
          ],
        },
        {
          name: 'Customers',
          blocks: [
            { type: 'source', source: 'users' },
            { type: 'filter', condition: { op: 'and', items: [{ in: [{ var: 'id' }, { var: 'pipelines.Buyers' }] }] } },
            { type: 'map', path: 'firstName, lastName' },
          ],
        },
        {
          name: 'How many',
          blocks: [
            { type: 'source', source: '', above: true },
            { type: 'count' },
          ],
        },
      ],
      formData: { product: '100', minAge: 30, bloodType: 'O+' },
    },
  },
]
