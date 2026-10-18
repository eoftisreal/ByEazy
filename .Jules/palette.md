## 2025-01-20 - Inline Validation Over Alerts
**Learning:** Native `alert()` dialogs block the main thread and provide a poor, inaccessible experience for form validation. They disconnect the error context from the input field causing the error.
**Action:** Always replace native `alert()` validation with inline error messages positioned near the relevant input. Use `aria-live="assertive"` for the error container and `aria-invalid="true"` on the input field when an error occurs. Clear the error state natively as the user types using an `input` event listener.
