## 2026-10-01 - Replace native alerts with inline validation
**Learning:** Native `alert()` dialogs interrupt the user's flow and are not screen-reader friendly for form validation. They provide poor UX compared to contextual error messages.
**Action:** Default to inline, non-blocking error messages paired with `aria-live` (e.g., `assertive`) and `aria-invalid` attributes. Ensure focus is moved to the invalid input when the error occurs to aid keyboard navigation and screen readers.
