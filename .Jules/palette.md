## 2024-10-24 - Replace native alert() with aria-live inline error for form validation
**Learning:** Native `alert()` dialogs are blocking, inaccessible to many screen readers in the context of forms, and provide a poor user experience as they disrupt the flow and focus.
**Action:** Always default to inline, non-blocking error messages paired with `aria-live="assertive"` for critical errors and `aria-invalid` attributes on the input fields. Additionally, clear the error state natively as the user types using an `input` event listener to provide immediate feedback.
