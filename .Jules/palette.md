## 2024-05-15 - Inline validation helper text link
**Learning:** For dynamic inline validation feedback in complex forms, linking the helper text via `aria-describedby` alongside `aria-invalid` is critical for ensuring screen readers announce the requirements and validation state when focus is on the input.
**Action:** Always link the `id` of the helper text wrapper to the `aria-describedby` attribute of the input, and use `aria-invalid` dynamically when conditions fail (e.g. `aria-invalid={reason.length > 0 && !reason.startsWith("DEMO:")}`).
