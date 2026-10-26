## 2024-03-24 - Replace Blocking Alerts with Inline Validation
**Learning:** Native `alert()` dialogs create poor user experiences by blocking interaction and are often not well-handled by screen readers in context.
**Action:** Always default to inline, non-blocking error messages paired with `aria-live` and `aria-invalid` attributes. Clear the error state natively as the user types using an `input` event listener to provide immediate feedback.
