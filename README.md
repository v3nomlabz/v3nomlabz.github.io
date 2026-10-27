# V3nom Labz: Website

Static site for a precision 3D printing studio, with an **Instant Quote Lab**: customers upload STL, OBJ or 3MF files, see the model in 3D, get a printability check and a live price, then send the quote to you on WhatsApp or email.

No build step and no backend. It's plain HTML, CSS and JS, with Three.js and GSAP loaded from CDNs.

## Run it locally

```bash
cd "3dprinted website"
python3 -m http.server 8080
# open http://localhost:8080
```

(Opening `index.html` directly also works in most browsers, but a local server is the most reliable.)

## Make it yours: edit `js/config.js`

| What | Where |
|---|---|
| Email, WhatsApp number, location, hours, Instagram | `contact` |
| Currency (default ₹ INR) | `currency` |
| Printer build volumes | `buildVolume` |
| Setup fee, minimum order, machine hourly rates, express surcharge, bulk discounts | `pricing` |
| Layer-height presets | `qualities` |
| Finishing options and surcharges | `finishes` |
| Materials: price per gram, density, colours, description, ratings | `materials` |

Everything on the site reads from this file: the quote engine, the materials explorer and the contact links.

Contact details are set to `v3nomlabz@gmail.com`, WhatsApp `+91 90043 00267` and Mumbai. Check the specs in the hero and service cards (0.025 mm, 256 mm, 48 h, ±0.1 mm) match your machines before going live.

## Showcase photos

The "From the lab" gallery uses the photos in `assets/work/`. Each one has a full-size `name.webp` (opened in the lightbox) and a smaller `name-sm.webp` (shown in the grid). To add a photo, export both sizes as WebP and copy one of the `work__item` buttons in `index.html`.

## How the quote is calculated

For each model the browser computes the real **volume**, **surface area**, **height**, **overhang area** and **watertightness** from the mesh, then:

- **FDM:** material = shell (≈1.6 mm skin) + infill% of the interior + estimated supports. Time = material ÷ flow rate (scaled by layer height) + per-layer overhead.
- **Resin:** material = solid volume + supports + base. Time = layers × ~7 s. Extra copies share layers, so they cost less machine time.
- **Price** = grams × price/g + hours × machine rate, × finish surcharge, − bulk discount, + setup fee, × express (optional), with a minimum order value.

Tune the numbers in `config.js` until estimates match your slicer and your margins.

## Files

```
index.html        page structure
css/style.css     design system, layout, animations
js/config.js      ← your business settings
js/main.js        smooth scroll, preloader, scroll animations, menus, materials, FAQ, contact form
js/hero3d.js      animated layer-by-layer 3D print in the hero
js/quote.js       instant quote lab (parsing, analysis, pricing, viewer)
js/shapes.js      procedural sample models (gear, vase, knot, lattice, pawn, bracket)
js/showcase.js    renders the showcase images in real time
assets/favicon.svg
```

## Deploy

Upload the folder to any static host: Netlify (drag and drop), Vercel, GitHub Pages, Cloudflare Pages or regular shared hosting.

## Notes

- Model files are processed **entirely in the visitor's browser**, so nothing is uploaded. Customers attach their files when they send the quote by WhatsApp or email.
- To receive files directly on the site, add a form backend (for example Netlify Forms with file uploads, Formspree or your own server) to the quote "Send" step.
