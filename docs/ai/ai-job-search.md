### `AGENTS.md` — Machine‑Oriented Guide for `@sourceflow-uk/ai-job-search`

This document defines a machine‑consumable contract for integrating and automating the AI Job Search component. It focuses on props, defaults, API payloads/responses, state schema, events, hooks, DOM hooks, and reliable usage patterns for AI agents.

---

### Package Entry

- Import (default UI):
  ```jsx
  import AIJobSearch from "@sourceflow-uk/ai-job-search";

  export default function App() {
    return <AIJobSearch options={{ /* see options below */ }} />;
  }
  ```

- Additional exports (importable from `@sourceflow-uk/ai-job-search`):
  - `AIJobSearchWrapper` — low‑level provider wrapper used internally by `AIJobSearch`.
  - `ExtraForm` — default consent form element inserted when `options.extraForm` is set (default)
  - Hooks: `useOptionsContext`, `useFileContext`, `useSearchResultsContext`
  - Constants: `AI_JOB_SEARCH_INITIAL_STATE`, `AI_JOB_SEARCH_DEBUG_DATA`

---

### Primary Component and Contract

1) `AIJobSearch` (default/full widget)
- Purpose: Provides a complete AI‑driven job matching flow: file upload, optional consent/extra form, results list with match score, and selected job details (with generated explanation).
- Props:
  - `options` (object, optional) — see Options section for full shape and defaults.

High‑level flow:
1. reCAPTCHA v3 Enterprise site key is fetched from `GET {endpoints.base}/_sf/api/v1/recaptcha/keys.json` before rendering the inner app. While loading, shows `options.visuals.initialLoading`.
2. User drops/selects a CV file (accepted types in `options.accept`).
3. If `options.extraForm` exists (default consent form), user can grant consent and click submit; otherwise the search starts immediately on file selection.
4. Component submits a multipart form to `POST {endpoints.base}{endpoints.api}`. Response populates state: results array, total count, selected job, and an explanation token.
5. Component then fetches a job‑specific explanation via `POST {endpoints.base}{endpoints.explanation}` and merges it into the selected job.

---

### Options (props) and Defaults

Default values are defined in `lib/constants/defaultOptions.jsx` and merged with any provided `options` using a deep merge with custom behavior (arrays are concatenated; objects with `values` keys are replaced; empty string overrides are respected).

```js
const options = {
  accept: { /* mime → extensions[] */ },
  endpoints: { base, api, explanation },
  extraForm,              // ReactNode (default: <ExtraForm />)
  state,                  // initial state object (default: INITIAL_STATE)
  stateReducer,           // reducer(state, action) (default provided)
  visuals: { /* nodes + helpers, see below */ },
};
```

1) `accept` (object: { [mimeType]: string[] })
- Defaults:
  ```js
  const accept = {
    "application/pdf": [".pdf"],
    "application/msword": [".doc", ".docx"],
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document": [".docx"],
  };
  ```

2) `endpoints` (object)
- Defaults:
  ```js
  const endpoints = {
    base: "",
    api: "/_sf/api/v1/jobs/ai_search.json",
    explanation: "/_sf/api/v1/jobs/ai_search_generate_explanation.json",
  };
  ```
- Notes:
  - reCAPTCHA keys endpoint (auto‑fetched): `GET {base}/_sf/api/v1/recaptcha/keys.json` → `{ site_key, field_key }`
  - Search endpoint (multipart form): `POST {base}{api}`
  - Explanation endpoint (JSON body): `POST {base}{explanation}`

3) `extraForm` (ReactNode)
- Default: `<ExtraForm />` — renders a consent checkbox and submit button. When present, file selection alone does not trigger search; user must click submit.
  - If omitted (`extraForm: null`), search is auto‑triggered when a file is selected.

4) `state` / `stateReducer`
- Defaults provided; see State Schema section.
- Reducer actions: `UPDATE` (shallow merge payload) and `RESET` (restore INITIAL_STATE).

5) `visuals` (object)
- Default nodes/helpers:
  - `initialLoading` — shown while reCAPTCHA site key is loading
  - `searchResultsLoading`
  - `searchResultsRetryButtonMessage`
  - `searchResultsRestartButtonMessage`
  - `searchResultsNoResultsMessage`
  - `resultColour(score:number): string` — color function for score bars
  - `droppedFileIcon`
  - `dropFileMessage`
  - `selectFileMessage`
  - `selectAnotherFileMessage`
  - `extraFormConsentMessage`
  - `extraFormSubmitButtonMessage`

---

### API Contracts

1) reCAPTCHA keys (auto):
- Request: `GET {endpoints.base}/_sf/api/v1/recaptcha/keys.json`
- Response (example):
  ```json
  { "site_key": "<string>", "field_key": "g-recaptcha" }
  ```

2) Search (multipart form)
- Request: `POST {endpoints.base}{endpoints.api}` with body `FormData`
  - `ai_search[cv]` → File (the uploaded CV)
  - `ai_search[extra_form_data]` → JSON string (mirrors `state.extraFormData`)
  - `ai_search[<field_key>][token]` → string (reCAPTCHA v3 token from `executeV3("submit")`)
  - `ai_search[cv_reference]` → string (stable ref derived from file checksum + date)
  - `ai_search[search_reference]` → string (hash of `extra_form_data` + `cv_reference`)
- Successful response (shape observed in code):
  ```js
  const response = {
    results: [ { job: {}, score: 87.1 } ],
    total_size: 42,
    explanation_token: "<string>",
  };
  ```

3) Explanation (JSON)
- Request: `POST {endpoints.base}{endpoints.explanation}` with headers `{ "content-type": "application/json" }`
  - Body:
    ```json
    { "job_id": "<id>", "cv_reference": "<string>", "explanation_token": "<string>" }
    ```
- Response (shape observed):
  ```json
  { "data": { "explanation": { "explanation_cv_owner": "<html or text>" } } }
  ```

---

### State Schema (INITIAL_STATE)

Default from `lib/constants/defaultOptions.jsx`:
```js
const INITIAL_STATE = {
  results: [],
  resultsCount: 0,
  selectedJob: null,
  extraFormData: null,
  isValid: false,
  isLoading: false,
  isLoadingExplanation: false,
  isDragEntered: false,
  isError: false,
  error: null,
  isSubmitted: false,
  explanationToken: null,
};
```

Reducer actions:
- `UPDATE` with `{ payload: Partial<State> }` → shallow‑merge update
- `RESET` → restore INITIAL_STATE

---

### Hooks API

- `useOptionsContext()` → `{ options }`
  - Options are the deep‑merged result of defaults + user overrides.

- `useFileContext()` → `{ file, setFile, fileReference }`
  - `fileReference` is computed as `"<sha256(file)>-YYYY-MM-DD"`; updates when `file` changes.

- `useSearchResultsContext()` → `{ state, dispatch, mutation }`
  - `state` matches the schema above.
  - `dispatch({ type: "UPDATE"|"RESET", payload? })` updates state.
  - `mutation` is a React‑Query mutation; call `mutation.mutate()` to execute the search request.

Example (programmatic submit):
```jsx
import { useSearchResultsContext } from "@sourceflow-uk/ai-job-search";

function SubmitButton() {
  const { mutation } = useSearchResultsContext();
  return <button onClick={() => mutation.mutate()}>Run AI search</button>;
}
```

---

### DOM/CSS Hooks (stable class names)

- Container/layout:
  - `.js-ai-search` — top‑level wrapper inside `AIJobSearch`
  - `.js-columns-container` — results area container

- File input:
  - `.js-file-input` — wrapper
  - `.js-file-input-field` — dropzone area; adds `drag-entered` and `file-selected glow-border` dynamically
  - `.js-file-input-field-button` — select/change file button
  - File name area contains optional icon and filename text

- Extra form (when present):
  - `.js-extra-form-data`
  - `.js-extra-form-label`
  - `.js-extra-form-input.js-extra-form-checkbox`
  - `.js-extra-form-submit-button-wrapper`
  - `.js-extra-form-submit-button`

- Results and errors:
  - `.js-error` / `.js-error-text` / `.js-error-footer` / `.js-error-button`
  - `.js-results` — two‑column layout: list + job details
  - `.js-results-list` — list wrapper
  - `.js-results-card` — list item (adds `selected` class when active)
  - `.js-results-card-score`, `.js-results-card-score-bar`, `.js-results-card-score-value`, `.js-results-card-expiry`
  - `.js-results-card-title-col`, `.js-results-card-job-posted-at`, `.js-results-card-job-title`

- Job details pane:
  - `.js-job-details`
  - `.js-job-details-title`, `.js-job-details-title-left-side`, `.js-job-details-title-right-side`, `.js-job-details-title-value`
  - `.js-job-details-top-buttons` (contains an "Apply Now" button — supply your own click handler externally if needed)
  - `.js-job-details-summary` — explanation text block (rendered when available)
  - `.js-job-details-additional-info` and panels:
    - `.js-job-details-location` (+ `-title`/`-value`)
    - `.js-job-details-salary` (+ `-title`/`-value`)
    - `.js-job-details-job-type` (+ `-title`/`-value`)
    - `.js-job-details-reference` (+ `-title`/`-value`)
  - `.js-job-details-description` — renders `job.description` as HTML

---

### Job Object Expectations (used by default UI)

Each result is shaped as:
```ts
type Result = {
  job: {
    id: string;
    title: string;
    expires_at: string;              // ISO date string
    displayed_posting_date?: string; // ISO date string
    location?: string;
    salary_package?: string;
    external_reference?: string;
    description?: string;            // may contain HTML
  };
  score: number | string;            // numeric string acceptable; rounded for display
  explanation?: {                    // merged after explanation fetch
    explanation_cv_owner?: string;   // explanation text/HTML
  };
};
```

---

### i18n and Visual Customization

There is no dedicated translation keys object; instead, pass React nodes/strings via `options.visuals` to fully control text and small UI fragments:
- Loading nodes: `initialLoading`, `searchResultsLoading`
- Error actions: `searchResultsRetryButtonMessage`, `searchResultsRestartButtonMessage`
- Empty state: `searchResultsNoResultsMessage`
- File input prompts: `dropFileMessage`, `selectFileMessage`, `selectAnotherFileMessage`, `droppedFileIcon`
- Consent form: `extraFormConsentMessage`, `extraFormSubmitButtonMessage`
- Coloring: `resultColour(score)` controls score bar color and gauge color in details

If you need full i18n, provide your own components in these visual slots or entirely replace sub‑components.

---

### SSR and Runtime Notes

- Client‑only: This package fetches reCAPTCHA keys and calls `window.fetch`, and it relies on reCAPTCHA v3 Enterprise. Render only on the client or guard server rendering with dynamic import/no‑SSR in frameworks like Next.js.
- reCAPTCHA: The wrapper fetches keys, then renders children inside `GoogleReCaptchaProvider` (`type="v3"`, Enterprise). The search call automatically obtains a token via `executeV3("submit")`.
- Networking: A `QueryClientProvider` from `@tanstack/react-query` is used internally; no configuration required for basic usage.

---

### Integration Examples

1) Minimal default usage
```jsx
import AIJobSearch from "@sourceflow-uk/ai-job-search";

export default function Page() {
  return <AIJobSearch options={{}} />;
}
```

2) Configure endpoints and visuals
```jsx
<AIJobSearch
  options={{
    endpoints: {
      base: "https://example.com", // required when API lives on a different origin/path
      api: "/_sf/api/v1/jobs/ai_search.json",
      explanation: "/_sf/api/v1/jobs/ai_search_generate_explanation.json",
    },
    visuals: {
      searchResultsNoResultsMessage: <div>No matches found.</div>,
      searchResultsRetryButtonMessage: <>Try again</>,
      searchResultsRestartButtonMessage: <>Start over</>,
    },
  }}
/>
```

3) Manual submission with consent form
```jsx
import React from "react";
import AIJobSearch, { useSearchResultsContext } from "@sourceflow-uk/ai-job-search";

function SubmitAnywhere() {
  const { mutation, state } = useSearchResultsContext();
  return (
    <button disabled={!state?.extraFormData?.consent} onClick={() => mutation.mutate()}>
      Submit
    </button>
  );
}

export default function Page() {
  return (
    <AIJobSearch
      options={{
        extraForm: null, // remove to auto-submit on file drop; keep to require explicit consent+submit
      }}
    />
  );
}
```

---

### Performance and Safety

- File types: Restrict accepted types via `options.accept`; server should validate content as well.
- Debounce not required: submission is explicit; React‑Query manages request state.
- Error handling: When the search call fails, `.js-error` UI displays the message and exposes Retry/Restart actions.
- Large responses: Rendering lists and score animations is O(n); keep result sizes reasonable for the UI.
- Security: Treat explanation HTML or job description HTML as untrusted; they are injected via `dangerouslySetInnerHTML` in the details pane. Ensure backend sanitizes or provide your own renderer if needed.

---

### Versioning and Compatibility

- This document reflects the observed public API and internal behavior from the ai-job-search codebase at the time of authoring. Backward‑compatible extensions are preferred for future changes.
