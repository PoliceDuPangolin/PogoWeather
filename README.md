# PogoWeather — English clean version

This version removes the temporary JS translation system and uses English content directly.

## What changed

- Site UI translated to English
- Article pages translated to English
- Removed `translations.js` and the language selector
- Removed `node_modules` and `.git` from the ZIP
- Fixed the Visual Crossing API key handling: use `VISUAL_CROSSING_API_KEY` as an environment variable
- Kept your Google Search Console HTML verification file if present

## Run locally

```bash
npm install
npm run dev
```

Then open:

```text
http://localhost:3000
```

## Important

If you had accidentally put a Visual Crossing API key in code, rotate/delete that key and create a new one.
On Render, store the new key in Environment Variables:

```text
VISUAL_CROSSING_API_KEY=your_key_here
```
