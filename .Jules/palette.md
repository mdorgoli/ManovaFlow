## 2024-10-22 - Explain disabled states
**Learning:** Users can get stuck when action buttons are disabled without context. Adding a simple native `title` tooltip to explain *why* the button is disabled (e.g. "No completion evidence has been attached.") makes the UI self-documenting.
**Action:** When an action button is dynamically disabled due to a missing requirement, always provide a `title` (or tooltip component if available) explaining the missing requirement.
