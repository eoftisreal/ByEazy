## 2026-09-29 - Inline Error Validation & Accessibility
**Learning:** Replacing blocking `alert()` dialogs with inline error messages combined with `aria-live` (`assertive` for errors, `polite` for loading) and `aria-invalid` provides a significantly better, non-blocking user experience, especially for screen readers, while reusing existing design system utility classes.
**Action:** Default to using inline `aria-live` containers instead of native `alert()` or custom modals for form validation and dynamic state communication.
