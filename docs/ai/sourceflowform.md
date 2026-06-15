# @sourceflow-uk/sourceflowform

React component that handles the embedding of a Sourceflow form into a webpage.

## Usage

```jsx
import SourceflowForm from "@sourceflow-uk/sourceflowform";

<SourceflowForm formId={"c6285151-9175-4314-ad33-002e8f8bc188"} />;
```

Multiple forms can be included on the same page.

## Available Props

- `formId`: Required. The id of the form you wish to embed.
- `onSubmit`: Callback fired when the form has been submitted.
- `onSubmitDone`: Callback fired when the form has been received by the server.
- `onSubmitError`: Callback fired in the case that the server raised an error on submit.
- `onReady`: Callback fired when the form has finished loading and rendering. Passed a single param containing the form instance.

## Form Instance

https://help.form.io/developers/form-development/form-renderer#form-properties

Prefill a field based on a URL query param:

```js
const readyFunc = function (form) {
  const submission = form.submission;
  const params = new URLSearchParams(document.location.search);
  const name = params.get("name");
  if (name) {
    form.submission = {
      ...submission,
      data: { ...submission.data, firstName: name },
    };
  }
};
```

## Configuring Email Rules and Recipients

1. Create a dropdown or checkbox field in Form Builder (hidden + not disabled if driven by PageBuilder/code).
2. Make sure the field does not clear itself when hidden.
3. Use `onReady` to manipulate the form instance's `data` field (not `form.submission` — that triggers validation):

```js
const handleOnReady = (form) => {
  if (form_recipient?.email_address) {
    form.data = {
      ...form.data,
      emailRecipient: form_recipient.email_address,
    };
  }
};
```

Check the network tab to verify the submission payload contains the correct field names.

> No DOM element field is needed — Form.io uses the form instance object, not the DOM.

## Translations

Pass translations via the `options` prop with a `language` key and `i18n` object:

```jsx
const options = {
  language: "es",
  i18n: {
    es: {
      "First Name": "Nombre de pila",
      Submit: "Enviar",
      // ...
    },
  },
};

<SourceflowForm formId="<FORM_ID>" options={options} />;
```

## Install

```bash
npm install @sourceflow-uk/sourceflowform@1.8.1
```
