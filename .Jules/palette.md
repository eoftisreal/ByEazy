## 2024-05-18 - Replace blocking alert with inline validation
**Learning:** Using native `alert()` for form validation is disruptive to the user experience and not fully accessible to screen readers natively integrated with form state.
**Action:** Replaced `alert()` with an inline validation error message linked to the input via `aria-describedby` and `aria-invalid`. The error container uses `aria-live="assertive"` to immediately notify screen readers without blocking the interaction flow. Clearing the error state on input improves the experience.
