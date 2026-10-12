# Jyotish Studio v0.1

A stand-alone, client-side Jyotish birth-chart workbench built as a Vercel-ready application. This project lives in the `jyotish-studio-v1` branch of `celestial-time`, in the `jyotish-studio/` folder; no existing main-branch app files have been replaced.

## Features
- Local civil birth time with explicitly entered historical UTC offset, geocoordinates, and name.
- Sidereal Lahiri D1 circular chart using whole-sign houses, Sun through Saturn, mean Rahu/Ketu, Moon nakshatra/pada.
- Swiss Ephemeris WebAssembly package in Moshier fallback mode (no network ephemeris file download required).
- Vimshottari mahadasha and antardasha intervals using the remainder of the natal Moon's nakshatra, 120-year cycle and 365.2425-day year.
- Selected yoga condition checks: Gaja Kesari, Budha Aditya, Chandra Mangala, the five Mahapurusha combinations, and a conjunction condition for Dharma–Karma Adhipati.
- Explicit evidence for every yoga detection. These are screening rules, **not** full-strength evaluations.

## Vercel deployment
1. In Vercel, choose Add New → Project and import `flashelksworld89-creator/celestial-time`.
2. Name the Vercel project `jyotish-studio` (this does not rename the GitHub repository).
3. Set **Production Branch** to `jyotish-studio-v1` (in Git settings if not offered at import).
4. Set **Root Directory** to `jyotish-studio`.
5. Framework preset: Vite. Build command: `npm run build`. Output: `dist`.
6. Deploy; do not reuse the existing Celestial Time Vercel project because it has a different app root.
No application API keys required.

## Local testing
```bash
cd jyotish-studio
npm install
npm run dev
```

## Accuracy / roadmap
Treat this as an initial calculation prototype until independently compared against a validated reference chart across timezones, DST transitions, boundary positions, and historical dates. The date entry currently relies on a manually entered UTC offset. The UI does not resolve city names or historical daylight saving times. Ayanamsa and node type are fixed, and planetary coordinates use Moshier ephemeris instead of optional downloaded Swiss files. Yoga strength scoring and full interpretive rules are not yet implemented. The yoga list is deliberately partial. Additional divisional charts (D9/D10), rectification, custom ayanamsas, dashas, precise combustion and strength measures will come later.

## Licensing
The project currently depends on `@swisseph/browser`, licensed under AGPL-3.0. Review AGPL obligations or arrange a suitable professional Swiss Ephemeris license before distributing a closed-source paid product.
