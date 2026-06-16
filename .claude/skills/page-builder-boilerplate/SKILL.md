# Page Builder Boilerplate Reference

Reference for the Sourceflow page builder setup. The boilerplate lives at:
`/Users/dharma/Documents/Sourceflow Projects/Tickets/pb-snippets`

## Directory structure

```
project/
├── builder/
│   ├── index.js                        ← exports all builder components
│   ├── definitions.generic.mjs         ← reusable prop types
│   └── Content/                        ← example component
│       ├── index.jsx
│       ├── component.jsx
│       ├── definitions.sourceflow.mjs  ← prop schema for builder UI
│       └── styles.module.scss
├── pages/
│   ├── components.js                   ← iframe preview page
│   └── [...url_slugs]/index.js         ← dynamic page routing
└── ui/
    ├── ContentBlocks/                  ← renders content block array
    ├── DynamicPageSeo/                 ← SEO head
    └── AnimateIn/                      ← AOS animation wrapper
```

## npm dependencies to install

| Package | Old version | Latest version |
|---|---|---|
| `@sourceflow-uk/page-builder-cli` | ^1.2.1 | 2.0.2 |
| `@sourceflow-uk/eslint-plugin-page-builder-cli` | ^1.1.9 | 1.1.9 |
| `@sourceflow-uk/sourceflow-content` | ^0.0.18 | 0.0.20 |
| `@sourceflow-uk/sourceflow-sdk` | ^0.16.0 | 0.38.0 |
| `aos` | ^2.3.4 | — | optional |

The first four packages are **mandatory** for page builder. `aos` is optional (animation library, not required by the builder itself).

Always install the latest versions unless the project's existing dependencies require otherwise.

## package.json scripts

Full scripts block for reference:

```json
"scripts": {
    "dev": "next dev",
    "dev-reset": "npx sourceflow reset && next dev",
    "build": "next build",
    "sfprepare": "sfprepare -d /builder -o /out -p /out/components/index.html",
    "start": "next start",
    "lint": "next lint",
    "prebuild": "",
    "postbuild": "next-sitemap && npm run sfprepare"
}
```

When setting up page builder on a project, the key script to add (if not already present) is:

```json
"sfprepare": "sfprepare -d /builder -o /out -p /out/components/index.html"
```

Also ensure `postbuild` includes `npm run sfprepare`. If `postbuild` already exists, append `&& npm run sfprepare` rather than replacing it.

## Component anatomy

Each component inside `/builder/<Name>/` needs:
- `index.jsx` — re-exports using `next/dynamic` for code splitting
- `component.jsx` — the actual React component
- `definitions.sourceflow.mjs` — prop schema used by the builder UI
- `styles.module.scss` — optional SCSS styles

## definitions.generic.mjs — reusable prop types

Common props: `className` (string), `title` (string), `subtitle` (string), `text` (string), `image` (file), `form` (forms), `content` (formatted_text), `reverse` (boolean).

## ContentBlocks renderer

Maps a content array to builder components. Each block has a `component` (or `name`) field matching the folder name inside `/builder`. Falls back: if only `name` exists, uses it as `component`.

## Dynamic pages

- Paths generated from `.sourceflow/dynamic_pages.json`
- `getStaticPaths` + `getStaticProps` pattern (Next.js SSG)
- Draft pages excluded from static generation

## Preview page (pages/components.js)

Iframe page that listens for `SET_CONTENT` postMessage events. Used by the builder for live component preview.
