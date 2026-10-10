## 2024-10-10 - Replace Blocking Alerts with Accessible Inline Errors
**Learning:** Native `alert()` dialogs block the main thread and provide poor user experience and accessibility for simple form validation (like empty fallback URL inputs).
**Action:** Replace `alert()` with inline error messages combined with `aria-live="assertive"` for screen readers and `aria-invalid="true"` on inputs, ensuring the input immediately receives focus.
