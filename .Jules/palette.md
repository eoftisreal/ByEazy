## 2024-09-28 - Missing visual feedback on backend errors
**Learning:** The application logs backend errors to a hidden DOM element, preventing users from seeing issues unless they know the secret `/mario` route. Additionally, screen readers had no semantic cues when the bypass processing started or failed.
**Action:** Always ensure that critical errors from backend systems are elevated to the visible UI. Use `aria-live` regions (`assertive` for errors, `polite` for loading states) so assistive technologies can announce dynamic status changes immediately.
