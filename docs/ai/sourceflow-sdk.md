# @sourceflow-uk/sourceflow-sdk

JavaScript SDK for interacting with the Sourceflow CMS. Server-side only (Node.js / Next.js `pages/` or App Router server components).

## Installation

```bash
npm install @sourceflow-uk/sourceflow-sdk
```

Add to `.npmrc`:
```
@sourceflow-uk:registry=https://npm.pkg.github.com/sourceflow-uk
```

Add to `~/.npmrc`:
```
//npm.pkg.github.com/:_authToken=<YOUR_GITHUB_PERSONAL_ACCESS_TOKEN>
```

## Init / Reset

```bash
npx sourceflow init <CMS_URL>   # e.g. https://<DOMAIN>/_sf/api/v1/cms.json
npx sourceflow reset            # refresh if new collections/items added
```

Add `.sourceflow` to `.gitignore`.

## Key Rules

- Server-side only — throws if called in browser
- In Next.js, call only from `pages/` (Pages Router) or server components (App Router)

## Terminology

- **Collection** — a set of CMS items (categories, disciplines, etc.)
- **Jobs** — a pre-built collection specifically for jobs
- **Object** — a single item within a collection

---

## Collection & Jobs

```js
import { Collection, Jobs } from "@sourceflow-uk/sourceflow-sdk";

const disciplines = await Collection('disciplines');       // default locale: 'en'
const disciplines = await Collection('disciplines', 'es'); // custom locale
const jobs = await Jobs('jobs');
```

---

## Collection Methods

### `getItems()`
Returns array of all items.

```js
const items = disciplines.getItems();
// [{ id, name, url_slug, created_at, updated_at }, ...]
```

### `getPaths(pathBy)`
Returns Next.js `getStaticPaths`-compatible paths.

```js
disciplines.getPaths('id');
// [{ params: { id: '71578c16-...' } }, ...]
```

### `getJsonItem(value, getBy)`
Find a single item by value. Used with `getStaticProps`.

```js
disciplines.getJsonItem('123', 'id');
// { id, name, url_slug, ... }
```

### `getPages(size)`
Splits collection into pages. Used with `getStaticPaths`.

```js
disciplines.getPages(2); // 8 items → 4 pages
// [{ params: { page: '1' } }, ..., { params: { page: '4' } }]
```

### `getPageItems(pageNumber, size)`
Gets items for a specific page. Used with `getStaticProps`.

```js
disciplines.getPageItems(2, 4);
// { totalItems, totalPages, current, next, previous, pageSize, items: [...] }
```

### `pluck(props)`
Select specific fields, returns new collection.

```js
disciplines.pluck(['id', 'name']).getItems();
// [{ id, name }, ...]
```

### Lodash Methods
`find`, `orderBy`, `filter`, `map` — all available as instance methods. Return value is also a collection so you can chain.

```js
disciplines.map('name');
// BaseCollection { items: [{ en: 'IT' }, { en: 'Business analyst' }, ...] }
```

---

## Install

```bash
npm install @sourceflow-uk/sourceflow-sdk@0.38.0
```
