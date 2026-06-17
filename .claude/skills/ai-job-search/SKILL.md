# AI Job Search Package Reference

Package: `@sourceflow-uk/ai-job-search`  
Source: `https://github.com/sourceflow-uk/components/pkgs/npm/ai-job-search`

## Basic Usage

```jsx
import AIJobSearch from "@sourceflow-uk/ai-job-search";

export default function App() {
  return (
    <div style={{ maxWidth: "1140px" }}>
      <AIJobSearch options={options} />
    </div>
  );
}
```

## Options Object

```js
{
  accept: { ... },        // MIME types for file upload
  endpoints: { ... },     // API base URL + endpoint paths
  extraForm: <ExtraForm />, // Optional extra form component
  state: { ... },         // Initial state overrides
  stateReducer: fn,       // Custom state reducer
  visuals: { ... },       // UI messages and components
  enableSearchTracking: false,
  searchRadiusKm: 100,
}
```

## Endpoints (most important)

```js
endpoints: {
  base: "",  // e.g. "https://example.com"
  api: "/_sf/api/v1/jobs/ai_search.json",
  explanation: "/_sf/api/v1/jobs/ai_search_generate_explanation.json",
}
```

## Accept (default)

```js
accept: {
  "application/pdf": [".pdf"],
  "application/msword": [".doc", ".docx"],
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": [".docx"],
}
```

## Custom UI via Wrapper + Hooks

```jsx
import { AIJobSearchWrapper } from "@sourceflow-uk/ai-job-search";

export default function MyCustomJobSearch({ options }) {
  return (
    <AIJobSearchWrapper options={options}>
      <MyCustomFileInput />
      <MyCustomSearchResults />
    </AIJobSearchWrapper>
  );
}
```

### Available Hooks

- `useOptionsContext()` — access/update options
- `useFileContext()` — `{ file, setFile }` for file upload state
- `useSearchResultsContext()` — `{ state, dispatch }` for results and loading state

### State Shape

```js
{
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
}
```

### Dispatch

```js
dispatch({ type: "UPDATE", payload: { isLoading: true } });
```

## File Input with useDropzone

The package uses `react-dropzone` internally. When building custom UI:

```jsx
import { useDropzone } from "react-dropzone";
import { useFileContext, useSearchResultsContext } from "@sourceflow-uk/ai-job-search";

const { setFile } = useFileContext();
const { dispatch } = useSearchResultsContext();

const { getRootProps, getInputProps, open } = useDropzone({
  accept,
  noClick: true,
  noKeyboard: true,
  onDropAccepted: (files) => {
    dispatch({ type: "UPDATE", payload: { isDragEntered: false } });
    setFile(files[0]);
  },
});
```

## Result Shape

```js
{
  score: 85,       // 0-100 match score
  job: { ... },    // Job listing object
  explanation: {
    explanation_cv_owner: "...",  // AI-generated match explanation
  }
}
```

## Jobs Data

Jobs live in `.sourceflow/jobs.json` in the project root. The AI API matches a CV against these jobs.

## Real-World Setup (from forward-role)

- API URL proxied via `next.config.js` rewrite from env var `API_URL`
- Component wrapped in `AIJobSearchWrapper` with options including `endpoints.base`
- Jobs stored in `.sourceflow/jobs.json` (74 entries in forward-role)
- Results returned with `score`, `job`, and `explanation.explanation_cv_owner`
