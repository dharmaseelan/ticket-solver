### `AGENTS.md` — Machine‑Oriented Guide for `@sourceflow-uk/job-search`

This document provides a concise, machine‑consumable contract for integrating, orchestrating, and extending the Job Search components. It focuses on props/contracts, render/input/output expectations, and reliable hooks for automation and AI agents.

---

### Package Entry

- Import (default UI):
  - Code:
    ```jsx
    import JobSearch from "@sourceflow-uk/job-search";
    import "@sourceflow-uk/job-search/dist/bundle.css";
    ```
- Rendering:
  - Code:
    ```jsx
    <JobSearch />
    ```

---

### Primary Components and Contracts

1) JobSearch (default/full widget)
- Purpose: Renders a complete job search UI including filters, results, and internal state management.
- Props:
  - `options` (object, optional)
    - `searchFilters` (boolean, default `true`): Toggle built‑in filter sidebar.
    - `searchFiltersOptions` (object, optional): Configuration for default filters.
      - `filterShowCount` (boolean, default `true`): Show counts on filter items.
      - `filterUnselectedElement` (ReactNode): Visual for unselected filter state (e.g., empty checkbox icon).
      - `filterSelectedElement` (ReactNode): Visual for selected filter state (e.g., checked checkbox icon).
      - `filterSelectorElementPosition` ("left" | "right", default `"left"`): Position of the selected/unselected element.
      - `nestedCategories` (Array<object>): Category trees loaded from SourceFlow JSON data (see Data Contracts below).
      - `filterFoldElement` (ReactNode, default `🔽`): Toggler icon for folding child filters.
      - `filterFoldDepth` (number, default `1`): Initial fold depth for nested filters (0 = never fold root).
      - `filterFoldStyle` (object, default `{ transform: "rotate(180deg)" }`): Style applied to fold element when toggled.
      - `categorySort` (object or function map): Per‑category sorting. Keys are category name or ID; values are either `{ key: "id"|"name"|"count", direction: "asc"|"desc" }` or a comparator `function(a,b){...}` applied to histogram items.
      - `allowFilterCollapse` (boolean, default `true`): Allow collapsing category panels by clicking title.
      - `collapseFilterOnChange` (boolean, default `false`): Collapse the category after selecting a value.
      - `initialFilterOpenState` (boolean | object, default `true`): `false` closes all on load; or object keyed by category name or ID with boolean open/closed per category.
      - `topLevelCategoryOrder` (string[] | uuid[], default `[]`): Reorder top‑level categories (others follow after, in original order).
      - `showResetSearchButton` (boolean | "before" | "after" | "both", default `false`): Show reset button position within filters.
      - `exclude` (object): Exclude entire categories or specific values by UUID or name.
        - Example:
          ```js
          const options = {
            searchFiltersOptions: {
              exclude: {
                "368c5d61-8fc4-4526-adcf-d345bed6070b": [
                  "137c398c-8889-457d-8449-31422cf75883",
                  "Permanent",
                ],
                Disciplines: ["IT"],
                Experience: true,
              },
            },
          };
          ```
      - `salaryFilter` (ReactNode, default `null`): A component that renders a salary range picker at the top of the filter sidebar. It must take 4 params: `state` (the current search state for read only reference), `min` (the current minimum saary set in the state), `max` (the current maximum salary set in the state), and `onChange` (a function that takes 2 parameters `min` and `max` and updates the state. Call it when the inputs are changed.)
    - `searchResults` (boolean | function, default `true`): Controls default results renderer or supplies a custom renderer.
      - Signature for custom: `(jobs: { results: any[]; [k: string]: any }) => React.ReactNode`
      - See `searchResultsOptions` for fine‑grained control of the default renderer.
    - `searchResultsOptions` (object): Options for default results UI.
      - `resultDetails` (boolean, default `true`)
      - `resultLocation` (boolean, default `true`)
      - `resultSalaryPackage` (boolean, default `true`)
      - `resultExternalReference` (boolean, default `false`)
      - `resultDescription` ("summary" | "description" | false, default "description")
      - `resultDescriptionLength` (number, default `300`)
      - `resultLinks` (boolean | function, default `true`)
      - `resultLinksTrailingSlash` (boolean, default `false`)
      - `resultCategories` (boolean | object, default `true`): Per‑category show/hide or allow‑list of values by ID or name.
      - `resultNewTab` (boolean, default `true`)
    - `searchSubmitButton` (boolean, default `true`)
    - `searchTotalCount` (boolean, default `false`): Show total above results.
    - `searchInput` (boolean | object): Control visibility and behavior of inputs within full widget.
      - When `false`, hides all inputs in the full widget.
      - Object shape (subset mirrors standalone widget and extends it):
        - `queryInput` (boolean, default `true`)
        - `locationInput` (boolean, default `false`)
        - `radiusInput` (boolean, default `false`)
        - `locationRegion` (string, default `"GB"`)
        - `locationSuffix` (string, default `""`)
        - `radiusOptions.units` ("miles" | "kilometres", default `"miles"`)
        - `radiusOptions.values` (number[], default `[5,10,20,30,40,50]`)
        - `radiusOptions.default` (number, default `5`)
        - `searchTotalCount` (boolean, default `true`): in‑form total count.
        - `salaryFilter` (ReactNode, default `null`): A component that renders a custom salary range picker after the radius and before the search button. It must take 4 params: `state` (the current search state for read only reference), `min` (the current minimum saary set in the state), `max` (the current maximum salary set in the state), and `onChange` (a function that takes 2 parameters `min` and `max` and updates the state. Call it when the inputs are changed.)
    - `searchPagination` (object):
      - `variant` ("default" | "paged" | "", default `"default"`): `""` disables pagination rendering.
      - `scrollTo` (object | undefined): Passed to `window.scrollTo` on page change, e.g., `{ top: 0, behavior: "instant" }`.
      - `reactPaginationOptions` (object): Passed through to `react-paginate` (`pageRangeDisplayed`, `marginPagesDisplayed`, labels, classNames, etc.).
    - `jobsPerPage` (number, default `10`, range 1..50)
    - `debounceTime` (number ms, default `300`)
    - `loading` (object):
      - `initial.mode` ("enabled" | "" | boolean, default "enabled") and `initial.element` (ReactNode)
      - `transition.mode` ("fallback" | "overlay" | "" | boolean, default "fallback") and `transition.element` (ReactNode)
    - `urlPattern` (string | function, default `"/jobs/{url_slug}"`): Job link pattern for results; `{url_slug}` placeholder will be replaced, or compute in a function.
    - `prefilters` (object): Apply prefilters to API call by category ID keyed to array of value IDs.
    - `urlFilters` (object): URL‑driven filtering.
      - `mode` ("active" | "prefilter" | "", default ""): "active" selects filters post‑fetch; "prefilter" sends as `prefilters` on fetch; `""` disables.
      - `jobCategories` (Array<object>): Category documents in order; URL hash segments are generated in this order. Multiple values per category are supported and alphabetically sorted in the URL segment by default.
      - `changeURLOnFilterChange` (boolean, default `false`): Updates `window.history` with `#/<values...>` as filters change.
      - `pushToHistoryOnSearch` (boolean, default `false`): Push a history entry when search or filter is submitted (uses `jobsURL` as base).
  - `onStateChange` (function, optional): Called whenever internal state changes.
    - Signature: `(state: any, prevState: any | undefined) => void`
    - Use with `notifyOnMount` to capture initial state.
  - `notifyOnMount` (boolean, default `true`): If true, triggers a single `onStateChange(state, undefined)` after mount.

  - `translations` (object): See i18n section for supported keys, including filter category labels/id mappings.
  - `additionalContent` (object): Injection points (see section below).
  - `jobs` (array): Initial jobs for SSR pre‑rendering of results markup.

- Minimal custom results example:
  ```jsx
  <JobSearch
    options={{
      searchResults: (jobs) => (
        <pre><code>{JSON.stringify(jobs, null, 2)}</code></pre>
      ),
    }}
  />
  ```

2) JobSearchStandaloneWidget (lightweight form only)
- Purpose: A compact search form (query/location/radius) that redirects to a destination URL with query params.
- Export: `JobSearchStandaloneWidget`
- Props:
  - `submitDestination` (string, default `"/jobs/"`): Redirect target. Supports `"{params}"` placeholder.
  - `translations` (object, default `DEFAULT_TRANSLATIONS`): i18n for labels/placeholders/button.
  - `searchInput` (object, optional): Controls visible inputs and radius options.
    - `queryInput` (boolean, default `true`)
    - `locationInput` (boolean, default `false`)
    - `radiusInput` (boolean, default `false`)
    - `radiusOptions` (object)
      - `units` (string, default `"miles"`)
      - `values` (number[], default `[5,10,20,30,40,50]`)
      - `default` (number, default `5`)

- Behavior:
  - Reads `query`, `location`, and `radius` from URLSearchParams on mount if present.
  - On submit: builds query string and navigates to `submitDestination` (replacing `"{params}"` if found).

- Example:
  ```jsx
  import { JobSearchStandaloneWidget } from "@sourceflow-uk/job-search";

  <JobSearchStandaloneWidget
    submitDestination="/jobs/{params}"
    searchInput={{ locationInput: true, radiusInput: true }}
  />
  ```

---

### Data Contracts

- `nestedCategories` input expects 1..n JSON documents (e.g., `jobs-Job Type.json`, `jobs-Disciplines.json`, `jobs-FilterNest.json`) that contain category trees.
- Common fields expected per node (inferred):
  - `id` or `uuid` (string)
  - `name` or `label` (string)
  - `children` (array of nodes) — for nested relationships
- Exclusions via `exclude` accept either UUIDs or human‑readable names at category level or value level.

Note: Exact shapes may vary by SourceFlow export. Use `onStateChange` with `notifyOnMount` to introspect live state and verify category/value identifiers at runtime.

---

### URL, State, and Routing Contracts

- Query parameters used by the full search and standalone widget:
  - `query` (string): Free‑text search.
  - `location` (string): Location string when enabled.
  - `radius` (number|string): Distance value when enabled. Units follow `radiusOptions.units`.
  - `page` (number): Current page (when pagination is applicable). Defaults to `1` when omitted.
- Hash routing for filters (when `urlFilters.changeURLOnFilterChange=true`):
  - The URL becomes `/<path>#/<value-1>/<value-2>/...` reflecting selected filter value names, grouped in the order of `urlFilters.jobCategories` and alphabetically within each group by default.
  - Modes:
    - `active`: Apply selections client‑side after fetch and update UI state.
    - `prefilter`: Convert hash to `prefilters` before fetch.
- History behavior:
  - `pushToHistoryOnSearch=true` records history entries on search/filter interactions using `jobsURL` as the base path.

---

### State and Events

- `onStateChange(state, prevState)` is the primary introspection/automation hook.
  - Called on any relevant state mutation inside `JobSearch`.
  - With `notifyOnMount=true`, it will fire once on mount, enabling agents to capture the initial state snapshot.
- Typical fields you may observe in `state` (inferred):
  - `filters` — active filter selections and available filter sets
  - `query` — search text
  - `location` / `radius` — if implemented in the full search context
  - `results` — list/array of jobs
  - `pagination` — page number and size metadata
  - These are indicative; rely on runtime observation for exact keys.

- Hooks (prefer these over raw context access):
  - `useJobsStore()` → `[state, dispatch]`
  - `useJobsState()` → `state`
  - `useJobsDispatch()` → `dispatch`
  - `useJobs()` → `state.jobs`
  - `useSearch()` → `state.search`

- Common dispatch actions you may observe/use (indicative):
  - `INCREMENT_SEARCH_PAGE` with `{ page }`
  - `UPDATE_SEARCH_FILTERS` with `{ type: categoryId, value: valueId }`

---

### Rendering/Extension Points

- Custom Results: Supply `options.searchResults(jobs)` to fully control the results panel render.
- Custom Filters: Set `options.searchFilters=false` and render your own filters wired to URL/state, or extend default filters via `searchFiltersOptions`.
- CSS/DOM Hooks:
  - Filter state classes:
    - `js-filter-selected-class`
    - `js-filter-unselected-class`
  - Filters container and controls:
    - `.js-filter-box` (with `data-<category_name>`)
    - `.js-filter-title`, `.js-filter-title-button`, `.js-filter-title-icon`
    - `.js-filter-category-open` / `.js-filter-category-closed`
    - `.js-filter-title-open` / `.js-filter-title-closed`
    - `.js-filter-values-section`
  - Results list and items:
    - Wrapper per item: `.js-result.js-panel-border`
    - Title: `.js-result-title`
    - Details wrapper: `.js-result-details`
    - Details sub‑fields: `.js-results-details-location`, `.js-results-details-external-reference`, `.js-results-details-salary-package`, `.js-results-details-categories`
    - Description: `.js-result-description`
    - Links container and button: `.js-result-links`, `.js-result-links-button`
    - Empty state: `.js-result-none`
  - Standalone widget classes (useful for styling/automation):
    - Container: `.js-container`
    - Form: `.js-form`
    - Inputs: `.js-input`, `.js-input-query`, `.js-input-location`, `.js-input-radius`
    - Button: `.js-button`

- Data attributes on results (for styling/automation):
  - Category/value tags: `data-<category_name>` on container and `data-<category_name>-<value_name>` for each value.
  - Featured flag: `data-featured` when job is featured.
  - Recency badges: one or more of `data-new-6h`, `data-new-12h`, `data-new-24h`, `data-new-36h`, `data-new-48h`, `data-new-72h`, `data-new-1w` based on `published_at`.

---

### i18n

- `JobSearchStandaloneWidget` supports translations via `translations` prop; defaults are provided by `DEFAULT_TRANSLATIONS`.
- The full `JobSearch` component supports translations for built‑in UI and for filters/categories.
- Supported keys (non‑exhaustive, based on README and code):
  - `button.text`
  - `input.query.label`, `input.query.placeholder`
  - `input.location.label`, `input.location.placeholder`
  - `input.radius.label`, `input.radius.milesUnit`, `input.radius.kilometresUnit`
  - `searchResults.buttonText`, `searchResults.noResultsText`, `searchResults.loadMore`, `searchResults.resultsTotalCount`
  - Filter toggles and reset buttons:
    - `filters.toggleButtonText`
    - `filters.resetSearchText`
    - `filters.resetSearchText.before`
    - `filters.resetSearchText.after`
  - Filter category and item labels (prefer IDs):
    - Category title by ID or name:
      - `filters.categories.<category_id>`
      - `filters.categories.<category_name>`
    - Item labels by ID or name:
      - `filters.categories.<category_id>.<item_id>`
      - `filters.categories.<category_name>.<item_name>`

---

### Additional Content Injection Points

- `additionalContent` object on `JobSearch` allows inserting content at key locations:
  - `beforeSearchForm`
  - `beforeQueryInput`
  - `afterSearchButton`
  - `afterSearchForm`
  - `afterSearchFilters`
  - `beforeResults`
  - `afterResults`
  - `AfterPagination`

---

### Job Object Expectations (default renderer)

- Minimal fields referenced by the default results UI (indicative):
  - `job.id` (string|number)
  - `job.title` (string)
  - `job.description` (string, may contain HTML — stripped when shown as `description`)
  - `job.addresses[0]` (string) for location
  - `job.salary_package` (string)
  - `job.external_reference` (string)
  - `job.published_at` (epoch seconds)
  - `job.featured` (boolean)
  - `job.slug_url` (string) for `urlPattern` substitution
  - `job.categories` (array): each `{ id, name, values: Array<{ id, name }> }`

---

### Pagination and Sorting

- Pagination rendering/configuration via `searchPagination` (see options above). Internal state maintains current `page`; hooks like `useSearch()` expose it.
- Programmatic page change example using hooks:
  ```jsx
  const search = useSearch();
  const dispatch = useJobsDispatch();
  dispatch({ type: "INCREMENT_SEARCH_PAGE", data: { page: (search.page || 1) + 1 } });
  ```

---

### SSR and Routing Notes

- The standalone widget reads from and writes to `window.location`; ensure client‑side execution.
- In SSR frameworks (e.g., Next.js), render these components client‑side only or guard any logic that depends on `window`.
- For navigation, the standalone widget performs a full page redirect by setting `window.location.href`.
- The full `JobSearch` supports passing `jobs` for SSR so crawlers can parse server‑rendered markup.

---

### Integration Examples

1) Default full search
```jsx
<JobSearch />
```

2) Full search with custom results and filters disabled
```jsx
<JobSearch
  options={{
    searchFilters: false,
    searchResults: (jobs) => <MyResults jobs={jobs} />,
  }}
  onStateChange={(state, prev) => {
    // collect analytics, sync external store, etc.
  }}
  notifyOnMount
/>
```

3) Standalone widget with all inputs
```jsx
<JobSearchStandaloneWidget
  submitDestination="/jobs/{params}"
  searchInput={{
    queryInput: true,
    locationInput: true,
    radiusInput: true,
    radiusOptions: { units: "km", values: [1, 5, 10, 25], default: 5 },
  }}
/>
```

---

### Performance and Safety

- Avoid heavy synchronous work inside `searchResults` renderer; it is called on state updates.
- When wiring custom filters, debounce input changes where appropriate to prevent excessive re‑renders.
- Treat all JSON inputs as untrusted; validate structure before passing to `nestedCategories`.
 - Avoid over‑broad URL histories; prefer `changeURLOnFilterChange` for replaceState updates unless deep history is desired.

---

### jobSearchAPI — direct API client

- Import factory and create an instance with your API base URL:
  ```js
  import { jobSearchAPI } from "@sourceflow-uk/job-search";
  export const jobSearch = jobSearchAPI(process.env.API_URL);
  // usage: await jobSearch({ limit, query, location, radius, region, radius_units, page, filters })
  ```
- Request parameters (defaults from README):
  - `limit` (number, default 10)
  - `query` (string | null)
  - `location` (string | null)
  - `radius` (number | null)
  - `region` (string, default `GB`)
  - `radius_units` ("miles" | "kilometres", default `miles`)
  - `page` (number, default `1`)
  - `filters` (object, default `{}`)

---

### Versioning and Compatibility

- This document reflects currently observed props and behaviors from the codebase and README. If new props or events are introduced, prefer backward‑compatible extensions.
