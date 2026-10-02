## 2024-05-15 - Replace Native Alerts with Inline Validation
**Learning:** Replacing blocking `alert()` calls with inline error validation combined with `aria-live` significantly improves the user experience and accessibility for screen reader users by preventing focus loss and modal trapping.
**Action:** Always prefer inline error messages linked with `aria-live="assertive"` or `aria-invalid` attributes over native browser dialogs when implementing form validations.
