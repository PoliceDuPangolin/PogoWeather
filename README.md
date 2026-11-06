# PogoWeather — Publish Ready

Version backend + publication.

## Inclus

- Backend Node.js/Express
- Logique météo côté serveur
- Compression HTTP
- Rate limiting anti-abus
- Cache serveur TTL
- Suggestions Pokémon via API backend
- Pagination des résultats
- Carte Leaflet
- Logo PNG, favicon, Apple touch icon, manifest PWA
- OG image
- Pages SEO/articles
- Privacy / Disclaimer
- Emplacements Google Analytics et AdSense à compléter

## Lancer en local

```bash
npm install
npm run dev
```

Ouvrir :

```text
http://localhost:3000
```

## Google Analytics

Dans les fichiers HTML, cherche :

```html
G-XXXXXXXXXX
```

Remplace par ton ID Google Analytics.

## Google Search Console

Quand Google te donne une balise meta, colle-la dans le `<head>` des pages, ou vérifie par DNS si tu as un domaine.

## AdSense

N'ajoute le vrai script AdSense qu'après :
- domaine connecté
- HTTPS
- pages indexables
- privacy/disclaimer propres
- contenu suffisant

## Production

Sur Render/Railway/Fly.io :
- Build command : `npm install`
- Start command : `npm run start`
- Node version : 18+ ou 20+
