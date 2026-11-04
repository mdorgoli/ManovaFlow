## 2024-11-04 - Form Helper Text Accessibility
**Learning:** Screen readers won't automatically announce helper text placed near an input field, even if visually it seems associated.
**Action:** Always associate helper text with the corresponding input field using `aria-describedby` pointing to the helper text's `id`.
