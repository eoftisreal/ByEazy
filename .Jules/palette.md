## 2025-02-14 - Replace Native Alerts with Inline Validation
**Learning:** Native `alert()` dialogs are problematic for accessibility as they block user interaction and provide poor context for screen reader users. In this app's components, error feedback should rely on ARIA live regions (`aria-live="assertive"`) and `aria-invalid` attributes.
**Action:** Default to inline, non-blocking error messages paired with `aria-live` and `aria-invalid` rather than blocking native dialogs.
