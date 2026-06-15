# AGENTS.md — Machine-Oriented Guide for `@sourceflow-uk/job-search`

A concise, machine-consumable contract for integrating and extending the job search components. Covers props, render contracts, hooks, and automation entry points.

---

## Package Entry

```jsx
import JobSearch, { SALARY_FILTER_KEY } from "@sourceflow-uk/job-search";

// No CSS import needed — styles are injected automatically via a <style> tag.
// Disable with: options={{ includeStyles: false }}

// SALARY_FILTER_KEY = "salary" — sentinel value for topLevelCategoryOrder to position the salary filter
```

---

## Components

### `JobSearch` (default export)

Full search UI with filters, results, pagination, and internal state management.

```jsx
<JobSearch
  options={object}
  translations={object}
  jobs={array}
  onStateChange={function}
  notifyOnMount={boolean}
/>
```

#### Top-level props

| Prop            | Type     | Default | Description                                                        |
| --------------- | -------- | ------- | ------------------------------------------------------------------ |
| `options`       | object   | `{}`    | All configuration — see below                                      |
| `translations`  | object   | —       | Override display text — see Translations                           |
| `jobs`          | array    | —       | Initial job results for SSR pre-rendering                          |
| `onStateChange` | function | —       | `(state, prevState) => void` — fires on any internal state change  |
| `notifyOnMount` | boolean  | `true`  | When `true`, fires `onStateChange(state, undefined)` once on mount |

#### `options` shape

**Layout**

- `id` (string, default `"job-search"`) — `id` on the root container
- `includeStyles` (boolean, default `true`) — inject built-in `<style>` tag
- `baseTemplate` (function) — replace the entire layout; receives `{ id, form, filters, filtersToggle, filtersReset, totalCount, results, pagination }`, all JSX or `null`
- `resultsTemplate` (function) — replace the results list; receives `{ results }` where `results` is the raw API array

**URL param names**

- `queryParam` (string, default `"query"`) — the URL search param key used for the query value; change to `"keyword"` or any custom name when the destination URL uses a different convention (e.g. `?keyword=engineer`)

**Data / fetching**

- `performInitialSearch` (boolean, default `true`) — `false` skips the fetch on mount (use with `jobs` prop for SSR)
- `jobsPerPage` (number, default `10`) — results per page, 1–50
- `debounceTime` (number ms, default `300`) — delay before firing search after input change
- `prefilters` (object) — pre-apply filters to every API call; keyed by category UUID to array of value UUIDs
- `jobsUrl` (string, default `"/jobs"`) — base URL for job links and history entries
- `urlPattern` (string | function, default `"/jobs/{url_slug}"`) — individual job URL; `{url_slug}` is replaced, or supply `(job) => string`
- `jobPageUrlPattern` (string, default `"/jobs/page/{{page_num}}"`) — paginated route URL
- `activePageNumber` (number, default `1`) — initial page for SSR paginated routes

**Search form** (`searchInput`)

- `searchInput` (boolean | object, default: object below) — `false` hides the form entirely
  - `queryInput` (boolean, default `true`)
  - `locationInput` (boolean, default `false`)
  - `radiusInput` (boolean, default `false`)
  - `locationRegion` (string, default `"GB"`) — 2-letter country code for location bias
  - `locationSuffix` (string, default `""`) — appended to location before API call, invisible to user
  - `searchTotalCount` (boolean, default `true`) — show total count in the form
  - `radiusOptions.units` (`"miles"` | `"kilometres"`, default `"miles"`)
  - `radiusOptions.values` (number[], default `[5,10,20,30,40,50]`)
  - `radiusOptions.default` (number, default `5`)
  - `inFormFilters` (string[], default `[]`) — array of category IDs or names to render as dropdown fields inside the search form, after the location/radius inputs and before the submit button. Each dropdown shows a loading state before initial load, closes on item selection, and shows a clear (×) button when values are selected. Categories listed here are automatically excluded from the sidebar filter bar; set the key explicitly in `searchFiltersOptions.exclude` (e.g. `{ "Discipline": false }`) to opt back in.
  - `salaryFilter` (ReactNode, default `null`) — custom salary range picker rendered after radius; receives `{ state, min, max, onChange(min, max) }`
  - `searchSubmitButton` (boolean | ReactComponent, default `true`) — `false` hides it; pass a component to replace it; receives `onClick`, `disabled`, and children (button text)

**Filters** (`searchFilters` / `searchFiltersOptions`)

- `searchFilters` (boolean, default `true`) — `false` hides the filter sidebar
- `searchFiltersOptions`:
  - `filterShowCount` (boolean, default `true`)
  - `filterUnselectedElement` (ReactNode) — icon/element shown when filter value is unselected
  - `filterSelectedElement` (ReactNode) — icon/element shown when filter value is selected
  - `filterSelectorElementPosition` (`"left"` | `"right"`, default `"left"`)
  - `nestedCategories` (array) — SourceFlow `jobs-*.json` documents defining category tree structure
  - `filterFoldElement` (ReactNode, default `🔽`) — toggle icon for nested filter rows
  - `filterFoldDepth` (number, default `1`) — depth at which nested filters are folded on load; set to `99` to never fold
  - `filterFoldStyle` (object, default `{ transform: "rotate(180deg)" }`) — style applied to fold element when open
  - `allowFilterCollapse` (boolean, default `true`) — allow collapsing category panels by clicking their title
  - `collapseFilterOnChange` (boolean, default `false`) — collapse a category after a value is selected
  - `initialFilterOpenState` (boolean | object, default `true`) — `false` closes all; or object keyed by category name/ID with `true`/`false`
  - `topLevelCategoryOrder` (string[], default `[]`) — reorder top-level categories by name or UUID; unspecified categories follow in original order; include the `SALARY_FILTER_KEY` sentinel (`"salary"`) to position the salary filter within the list
  - `categorySort` (object) — per-category sort; key is category name or UUID; value is `{ key: "id"|"name"|"count", direction: "asc"|"desc" }` or a comparator `(a, b) => number`
  - `categoryFilterTypes` (object, default `{}`) — per-category filter UI type; key is category UUID or name; value is `"list"` (default, multi-select), `"radio"` (single-select, replaces on change, clears on re-click), or `"pills"` (multi-select horizontal chips); built-in styles injected automatically when `includeStyles: true`
  - `exclude` (object) — exclude entire categories or specific values; key is category name or UUID; value is `true` (exclude whole category) or array of value UUIDs/names
  - `salaryFilter` (component, default `null`) — custom salary range picker in the filter sidebar; pass component reference (not JSX); receives `{ state, min, max, onChange(min, max) }`; renders at top of sidebar unless positioned via `topLevelCategoryOrder` + `SALARY_FILTER_KEY`
  - `resetSearchButton` (ReactComponent) — custom reset filters button; receives `onClick` and `children`

**Job card** (`searchResultsOptions`)

- `searchResultsOptions`:
  - `resultDetails` (boolean, default `true`) — show/hide the details row
  - `resultLocation` (boolean, default `true`)
  - `resultSalaryPackage` (boolean, default `true`)
  - `resultExternalReference` (boolean, default `false`)
  - `resultDescription` (`"summary"` | `"description"` | `false`, default `"description"`) — `"description"` strips HTML tags
  - `resultDescriptionLength` (number, default `300`) — character limit for description
  - `resultLinks` (boolean | function, default `true`) — `false` hides; function receives `{ href, target }` and returns ReactNode
  - `resultLinksTrailingSlash` (boolean, default `false`)
  - `resultCategories` (boolean | object, default `true`) — `false` hides all; object keyed by category name/UUID maps to `true`, `false`, or array of permitted value names/UUIDs
  - `resultNewTab` (boolean, default `true`)

**Pagination** (`searchPagination`)

- `searchPagination`:
  - `variant` (`"default"` | `"paged"` | `""`, default `"default"`) — `""` disables pagination entirely; `"paged"` renders client-side numbered pagination via `react-paginate`
  - `scrollTo` (object) — passed to `window.scrollTo` on page change, e.g. `{ top: 0, behavior: "instant" }`
  - `reactPaginationOptions` (object) — passed through to `react-paginate`; see [react-paginate docs](https://www.npmjs.com/package/react-paginate) for all keys

**Loading** (`loading`)

- `loading`:
  - `initial.mode` (`"enabled"` | `""`, default `"enabled"`) — `""` disables initial loading state
  - `initial.element` (ReactNode, default `<div>Loading...</div>`)
  - `transition.mode` (`"fallback"` | `"overlay"` | `""`, default `"fallback"`) — `"fallback"` hides results while loading; `"overlay"` renders element before results
  - `transition.element` (ReactNode, default `<div>Loading results...</div>`)

**URL filters** (`urlFilters`)

- `urlFilters`:
  - `mode` (`"active"` | `"prefilter"` | `"complete"` | `""`, default `""`) — `"active"` applies URL hash values as sidebar selections after fetch; `"prefilter"` sends them as prefilters before fetch; `"complete"` reads/writes filter values from the URL pathname (e.g. `/jobs/permanent/technology`) — requires `jobFilterCombinations`
  - `jobCategories` (array) — SourceFlow `jobs-*.json` documents; order determines URL hash segment order
  - `jobFilterCombinations` (object) — required when `mode` is `"complete"`; describes valid pre-built filter URL paths
    - `combinations` (string[]) — array of known filter path suffixes (e.g. `["permanent", "permanent/technology"]`)
    - `jobs_url_pattern` (string) — URL pattern used to generate filter paths
  - `changeURLOnFilterChange` (boolean, default `false`) — update URL hash when filters change
  - `pushToHistoryOnSearch` (boolean, default `false`) — push history entry on search/filter; uses `jobsUrl` as base
  - `enableParams` (boolean, default `true`) — when `true`, clicking search writes the query (using the key defined by `queryParam`), `location`, and `radius` as URL search params; `false` disables this

**Callbacks**

- `resetCallback` (function) — called when the reset filters button is clicked

---

### `JobSearchStandaloneWidget` (named export)

Lightweight search form that redirects to a destination URL. Does not share state with `JobSearch`.

```jsx
import { JobSearchStandaloneWidget } from "@sourceflow-uk/job-search";

<JobSearchStandaloneWidget
  submitDestination="/jobs/{params}"
  searchInput={{ queryInput: true, locationInput: true, radiusInput: true }}
  translations={{ "button.text": "Find Jobs" }}
/>;
```

#### Props

| Prop                | Type   | Default    | Description                                                                        |
| ------------------- | ------ | ---------- | ---------------------------------------------------------------------------------- |
| `submitDestination` | string | `"/jobs/"` | Redirect target; `{params}` is replaced with the query string                      |
| `queryParam`        | string | `"query"`  | URL param key for the query value; set to `"keyword"` or any custom name if needed |
| `searchInput`       | object | —          | Same shape as `JobSearch` `searchInput` (minus `searchSubmitButton`)               |
| `translations`      | object | —          | Same keys as `JobSearch` translations                                              |

On mount, reads the param named by `queryParam` (default `"query"`), `location`, and `radius` from `URLSearchParams` to pre-fill inputs. On submit, builds a query string using the same key and navigates via `window.location.href`.

---

## Hooks

Must be rendered inside a `<JobSearch>` tree to access its context.

```js
import { useJobsStore, useJobsState, useJobsDispatch, useJobs, useSearch } from "@sourceflow-uk/job-search";
```

| Hook                | Returns             | Use when                     |
| ------------------- | ------------------- | ---------------------------- |
| `useJobsStore()`    | `[state, dispatch]` | Need both state and dispatch |
| `useJobsState()`    | `state`             | Read-only state access       |
| `useJobsDispatch()` | `dispatch`          | Only need to dispatch        |
| `useJobs()`         | `state.jobs`        | Only need the jobs payload   |
| `useSearch()`       | `state.search`      | Only need search params      |

#### Dispatch actions

```js
dispatch({ type: "INCREMENT_SEARCH_PAGE", data: { page: 2 } });
dispatch({ type: "UPDATE_SEARCH_FILTERS", data: { type: categoryId, value: valueId } }); // toggles value in multi-select array
dispatch({ type: "SET_SEARCH_FILTER", data: { type: categoryId, value: valueId } }); // sets single value (clears if already selected) — used by "radio" type
dispatch({ type: "RESET_SEARCH_FILTERS" });
```

---

## Translations

Pass a `translations` object to either component to override display strings.

| Key                               | Description                                        |
| --------------------------------- | -------------------------------------------------- |
| `button.text`                     | Submit button label                                |
| `input.query.label`               | Query input label                                  |
| `input.query.placeholder`         | Query input placeholder                            |
| `input.location.label`            | Location input label                               |
| `input.location.placeholder`      | Location input placeholder                         |
| `input.radius.label`              | Radius input label                                 |
| `input.radius.milesUnit`          | Miles suffix                                       |
| `input.radius.kilometresUnit`     | Kilometres suffix                                  |
| `searchResults.buttonText`        | Job card link button text                          |
| `searchResults.noResultsText`     | Empty results message                              |
| `searchResults.loadMore`          | Load more button text                              |
| `searchResults.resultsTotalCount` | Total count text; use `{{count}}` for the number   |
| `filters.toggleButtonText`        | Mobile filters toggle button                       |
| `filters.resetSearchText`         | Reset filters button text                          |
| `input.filter.allText`            | In-form filter placeholder when nothing selected   |
| `input.filter.selectedText`       | Suffix for multi-value display, e.g. "3 selected"  |
| `input.filter.loadingText`        | In-form filter loading message before initial load |

**Filter category/item labels** (not in defaults; add to your app):

- `filters.categories.<category_id>` or `filters.categories.<category_name>` — category title
- `filters.categories.<category_id>.<item_id>` or `filters.categories.<category_name>.<item_name>` — item label

Lookup order: ID-based → name-based → raw API value.

---

## Data Attributes

Applied to result and filter DOM elements for CSS targeting.

**Results** (`.js-result`):

- `data-<category_name>` and `data-<category_name>-<value_name>` — category membership
- `data-featured` — job is featured
- `data-new-6h`, `data-new-12h`, `data-new-24h`, `data-new-36h`, `data-new-48h`, `data-new-72h`, `data-new-1w` — recency; multiple attributes are set when a job meets several thresholds

**Filters** (`.js-filter-box`):

- `data-<category_name>` — on the filter category container

---

## CSS Classes Reference

| Class                                                         | Element                                                      |
| ------------------------------------------------------------- | ------------------------------------------------------------ |
| `.js-container`                                               | Root container                                               |
| `.js-form`                                                    | Search form                                                  |
| `.js-input`                                                   | Text inputs                                                  |
| `.js-input-query` / `.js-input-location` / `.js-input-radius` | Specific inputs                                              |
| `.js-input-wrapper-filter`                                    | Wrapper for each in-form filter field                        |
| `.js-form-group-filter`                                       | In-form filter field group (label + trigger)                 |
| `.js-input-filter-wrapper`                                    | Relative positioning wrapper for trigger + dropdown          |
| `.js-input-filter-trigger`                                    | In-form filter trigger button (styled like an input)         |
| `.js-input-filter-trigger-has-value`                          | Added to trigger when one or more values are selected        |
| `.js-input-filter-label`                                      | Text inside the trigger showing current selection            |
| `.js-input-filter-clear`                                      | Clear (×) button, visible when values are selected           |
| `.js-input-filter-dropdown`                                   | Absolutely positioned dropdown panel                         |
| `.js-input-filter-loading`                                    | Loading message inside the dropdown before initial load      |
| `.js-button`                                                  | Submit / load-more / toggle buttons                          |
| `.js-filters-column`                                          | Filters sidebar                                              |
| `.js-filter-box`                                              | Per-category filter panel                                    |
| `.js-filter-title`, `.js-filter-title-button`                 | Category title row                                           |
| `.js-filter-category-open` / `.js-filter-category-closed`     | Category open state                                          |
| `.js-filter-values-section`                                   | Values list container (all types)                            |
| `.js-filter-list-section`                                     | Values list — `"list"` type                                  |
| `.js-filter-radio-section`                                    | Values list — `"radio"` type                                 |
| `.js-filter-pills-section`                                    | Values list — `"pills"` type                                 |
| `.js-filter-single-value`                                     | Filter box when single self-named value collapses the header |
| `.js-filter-value`                                            | Individual value button — `"list"` type                      |
| `.js-filter-radio-value`                                      | Individual value button — `"radio"` type                     |
| `.js-filter-pill-value`                                       | Individual value button — `"pills"` type                     |
| `.js-filter-value-list-item`                                  | List item — `"list"` type                                    |
| `.js-filter-radio-item`                                       | List item — `"radio"` type                                   |
| `.js-filter-pill-item`                                        | List item — `"pills"` type                                   |
| `.js-filter-selected-class` / `.js-filter-unselected-class`   | Selection state (all types)                                  |
| `.js-result`                                                  | Individual result card                                       |
| `.js-result-title`                                            | Job title                                                    |
| `.js-result-details`                                          | Details row wrapper                                          |
| `.js-result-description`                                      | Description text                                             |
| `.js-result-links`                                            | Links container                                              |
| `.js-result-none`                                             | Empty results message                                        |
| `.js-panel-border`                                            | Shared border/padding panel style                            |

---

## Job Object Shape (default result card)

Minimum fields used by the built-in card:

```js
{
  job: {
    id,               // string | number
    title,            // string
    description,      // string — may contain HTML; stripped when shown as "description"
    addresses,        // string[] — addresses[0] shown as location
    salary_package,   // string
    external_reference, // string
    published_at,     // epoch seconds — used for recency data attributes
    featured,         // boolean
    url_slug,         // string — used in urlPattern substitution
    categories,       // { id, name, values: { id, name }[] }[]
  },
  summary,            // string — Google-generated summary for resultDescription: "summary"
}
```

---

## Integration Examples

**Default**

```jsx
<JobSearch />
```

**Custom layout and results**

```jsx
<JobSearch
  options={{
    baseTemplate: ({ id, form, filters, results, pagination }) => (
      <div id={id}>
        {form}
        <div style={{ display: "flex" }}>
          <aside>{filters}</aside>
          <main>
            {results}
            {pagination}
          </main>
        </div>
      </div>
    ),
    resultsTemplate: ({ results }) => (
      <ul>
        {results.map(({ job }) => (
          <li key={job.id}>
            <a href={job.url_slug}>{job.title}</a>
          </li>
        ))}
      </ul>
    ),
  }}
/>
```

**State observer**

```jsx
<JobSearch onStateChange={(state, prev) => console.log("state changed", state)} notifyOnMount />
```

**Standalone widget**

```jsx
<JobSearchStandaloneWidget
  submitDestination="/jobs/{params}"
  searchInput={{ locationInput: true, radiusInput: true }}
/>
```

---

## SSR Notes

- Pass `jobs` prop to pre-render results for crawlers before client-side fetch.
- Set `performInitialSearch: false` when using SSR jobs to prevent a redundant fetch on mount.
- `JobSearchStandaloneWidget` reads/writes `window.location` — ensure client-side only rendering in SSR frameworks (e.g., Next.js `"use client"`).
- The bundle already includes `"use client"` in its banner for Next.js App Router compatibility.
