## 2024-05-18 - Form Accessibility: Explicit ARIA Relationships
**Learning:** React elements like `<input>` and `<small>` for helper text need explicit relationships to be accessible. By default, screen readers may not read the helper text associated with the input field if it is not programmatically linked.
**Action:** Use `aria-describedby` on the input element pointing to the `id` of the helper text to ensure screen readers announce it properly when the input is focused.
