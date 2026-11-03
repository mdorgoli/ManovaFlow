## 2024-11-03 - Form Input Help Text Accessibility
**Learning:** Screen readers won't announce help text adjacent to an input unless it is explicitly associated with it. This is especially important for critical requirements, such as a required prefix for the input value.
**Action:** Use `aria-describedby` on the `<input>` element, pointing to the `id` of the element containing the help text, ensuring screen readers convey necessary instructions before the user interacts with the input.
