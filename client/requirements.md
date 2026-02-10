## Packages
framer-motion | Smooth animations for UI elements and transcript appearance
clsx | Utility for conditional class names
tailwind-merge | Utility for merging tailwind classes

## Notes
Tailwind Config - extend fontFamily:
fontFamily: {
  display: ["var(--font-display)"],
  body: ["var(--font-body)"],
}

API expects multipart/form-data for transcription endpoint:
- file: Blob (audio chunk)
- prompt: string (previous context)
