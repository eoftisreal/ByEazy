## 2023-10-24 - Dynamic Input Reveal and Focus
**Learning:** When a UI dynamically reveals a required input field after a failed action (like a fallback URL input appearing), screen reader and keyboard users can lose context or be unaware of the new element.
**Action:** Call `.focus()` on dynamically revealed inputs to smoothly transition the user to the required next step and implicitly announce the new field.
