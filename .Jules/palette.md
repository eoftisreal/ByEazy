## 2024-05-24 - Replace Blocking Alerts with Inline Errors
**Learning:** Native `alert()` dialogs block the main thread and can be jarring for users, particularly those using screen readers who might lose context. They also provide a poor user experience as they must be dismissed before the user can fix the issue.
**Action:** Always default to inline, non-blocking error messages. Pair these with `aria-live="assertive"` for screen reader announcements and `aria-invalid="true"` on the related input field to clearly associate the error with the source element and provide immediate feedback.
