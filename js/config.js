/* ==========================================================================
   V3NOM LABZ — SITE CONFIG
   Edit this file to change contact details, prices, materials and printer
   specs. Everything on the site (quote engine, materials section, contact
   links) reads from here.
   ========================================================================== */
window.V3NOM = {
  brand: 'V3nom Labz',

  /* ---- Contact ----------------------------------------------------------- */
  contact: {
    email: 'v3nomlabz@gmail.com',
    whatsapp: '919004300267',          // international format, digits only, no "+"
    phoneDisplay: '+91 90043 00267',
    location: 'Mumbai, India',
    instagram: 'https://www.instagram.com/v3nom.labz/',
    hours: 'Mon – Sat · 10:00 – 20:00',
  },

  /* ---- Money ------------------------------------------------------------ */
  currency: { code: 'INR', symbol: '₹', locale: 'en-IN' },

  /* ---- Printer limits (mm) --------------------------------------------- */
  buildVolume: {
    FDM: { x: 256, y: 256, z: 256 },
    SLA: { x: 218, y: 123, z: 250 },
  },

  /* ---- Pricing model ----------------------------------------------------
     unit price = material (grams × price/g) + machine time (hours × rate)
     line       = unit × qty × finish multiplier × (1 − bulk discount)
     order      = Σ lines + setup fee, × express multiplier, ≥ minimum order
  ------------------------------------------------------------------------ */
  pricing: {
    setupFee: 49,
    minimumOrder: 199,
    machineRate: { FDM: 45, SLA: 70 },      // per printer-hour
    expressMultiplier: 1.5,
    bulkDiscounts: [                        // per line, by quantity
      { min: 5, off: 0.05 },
      { min: 10, off: 0.10 },
      { min: 25, off: 0.15 },
      { min: 50, off: 0.20 },
    ],
  },

  /* ---- Quality presets -------------------------------------------------- */
  qualities: {
    FDM: [
      { id: 'draft', name: 'Draft', layer: 0.28 },
      { id: 'standard', name: 'Standard', layer: 0.20 },
      { id: 'fine', name: 'Fine', layer: 0.12 },
    ],
    SLA: [
      { id: 'standard', name: 'Standard', layer: 0.05 },
      { id: 'ultra', name: 'Ultra', layer: 0.025 },
    ],
  },

  /* ---- Finishing -------------------------------------------------------- */
  finishes: [
    { id: 'raw', name: 'Raw', desc: 'Supports removed', mult: 1 },
    { id: 'sanded', name: 'Sanded', desc: 'Smoothed surfaces', mult: 1.2 },
    { id: 'primed', name: 'Primed', desc: 'Sanded + primer, paint-ready', mult: 1.4 },
  ],

  /* ---- Materials ---------------------------------------------------------
     density g/cm³ · pricePerGram in your currency · props are 1–5 ratings
  ------------------------------------------------------------------------ */
  materials: [
    {
      id: 'pla', name: 'PLA', tech: 'FDM', density: 1.24, pricePerGram: 3,
      tagline: 'The all-rounder',
      desc: 'Crisp detail, rigid and affordable. Perfect for prototypes, décor, figurines and display pieces.',
      props: { strength: 3, flex: 1, heat: 1, detail: 4 },
      colors: ['#0d0d0d', '#f2f2f2', '#a3ff12', '#e63946', '#1d6fe0', '#ffb703', '#8d99ae', '#7b2cbf'],
    },
    {
      id: 'petg', name: 'PETG', tech: 'FDM', density: 1.27, pricePerGram: 4,
      tagline: 'Tough & food-adjacent',
      desc: 'Stronger and more impact-resistant than PLA with good chemical resistance. Great for functional parts.',
      props: { strength: 4, flex: 2, heat: 3, detail: 3 },
      colors: ['#0d0d0d', '#f2f2f2', '#1d6fe0', '#e63946', '#2a9d8f', '#cfd8dc'],
    },
    {
      id: 'abs', name: 'ABS', tech: 'FDM', density: 1.04, pricePerGram: 4,
      tagline: 'Heat-resistant workhorse',
      desc: 'Durable, machinable and vapour-smoothable. Ideal for enclosures, automotive and mechanical parts.',
      props: { strength: 4, flex: 2, heat: 4, detail: 3 },
      colors: ['#0d0d0d', '#f2f2f2', '#8d99ae', '#e63946'],
    },
    {
      id: 'asa', name: 'ASA', tech: 'FDM', density: 1.07, pricePerGram: 5,
      tagline: 'Built for outdoors',
      desc: 'ABS-like strength with excellent UV and weather resistance. Made for parts that live in the sun.',
      props: { strength: 4, flex: 2, heat: 4, detail: 3 },
      colors: ['#0d0d0d', '#f2f2f2', '#8d99ae'],
    },
    {
      id: 'tpu', name: 'TPU 95A', tech: 'FDM', density: 1.21, pricePerGram: 7,
      tagline: 'Rubber-like flex',
      desc: 'Flexible, abrasion-resistant elastomer. Phone cases, gaskets, grips, wheels and wearable parts.',
      props: { strength: 3, flex: 5, heat: 2, detail: 2 },
      colors: ['#0d0d0d', '#f2f2f2', '#e63946', '#a3ff12'],
    },
    {
      id: 'pacf', name: 'Nylon-CF', tech: 'FDM', density: 1.20, pricePerGram: 12,
      tagline: 'Engineering-grade',
      desc: 'Carbon-fibre reinforced nylon. Extremely stiff, light and strong — jigs, fixtures, drones and brackets.',
      props: { strength: 5, flex: 2, heat: 5, detail: 3 },
      colors: ['#1a1a1a'],
    },
    {
      id: 'resin', name: 'Standard Resin', tech: 'SLA', density: 1.12, pricePerGram: 8,
      tagline: 'Ultra-fine detail',
      desc: 'Smooth, near-invisible layers. Miniatures, jewellery masters, dental and high-detail display models.',
      props: { strength: 2, flex: 1, heat: 2, detail: 5 },
      colors: ['#8d99ae', '#f2f2f2', '#0d0d0d', '#c9a227'],
    },
    {
      id: 'tough', name: 'Tough Resin', tech: 'SLA', density: 1.15, pricePerGram: 11,
      tagline: 'Detail meets durability',
      desc: 'ABS-like resin that resists snapping. Functional snap-fits and detailed parts that get handled.',
      props: { strength: 4, flex: 3, heat: 3, detail: 5 },
      colors: ['#5c6b73', '#0d0d0d'],
    },
  ],
};
