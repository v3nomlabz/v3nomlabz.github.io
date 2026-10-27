/* ==========================================================================
   V3NOM LABZ — Instant Quote Lab
   Parses STL / OBJ / 3MF locally, analyses printability and prices the job.
   ========================================================================== */
(async function () {
  'use strict';

  const CFG = window.V3NOM;
  const UI = window.V3UI;
  const $ = (s, c = document) => c.querySelector(s);
  const $$ = (s, c = document) => Array.from(c.querySelectorAll(s));

  const el = {
    viewer: $('#q-viewer'), canvasWrap: $('#q-canvas'), drop: $('#q-drop'), file: $('#q-file'), sample: $('#q-sample'),
    loading: $('#q-loading'), loadingText: $('#q-loading-text'), dims: $('#q-dims'), toolbar: $('#q-toolbar'),
    layerWrap: $('#q-layer-wrap'), layer: $('#q-layer'), layerVal: $('#q-layer-val'), legend: $('#q-legend'),
    partsWrap: $('#q-parts-wrap'), parts: $('#q-parts'), analysis: $('#q-analysis'),
    score: $('#q-score'), scoreRing: $('#q-score-ring'), checks: $('#q-checks'),
    sDims: $('#s-dims'), sVol: $('#s-vol'), sArea: $('#s-area'), sTris: $('#s-tris'), sWeight: $('#s-weight'), sTime: $('#s-time'),
    config: $('#q-config'), partName: $('#c-partname'), material: $('#c-material'), materialHint: $('#c-material-hint'),
    colors: $('#c-colors'), colorName: $('#c-color-name'), quality: $('#c-quality'), infillWrap: $('#c-infill-wrap'),
    infill: $('#c-infill'), infillVal: $('#c-infill-val'), finish: $('#c-finish'), scale: $('#c-scale'), unit: $('#c-unit'), qty: $('#c-qty'),
    sumLines: $('#sum-lines'), sumMaterial: $('#sum-material'), sumMachine: $('#sum-machine'), sumFinish: $('#sum-finish'),
    sumDiscount: $('#sum-discount'), sumSetup: $('#sum-setup'), sumExpressRow: $('#sum-express-row'), sumExpressVal: $('#sum-express-val'),
    express: $('#sum-express'), total: $('#sum-total'), lead: $('#sum-lead'), note: $('#sum-note'), ref: $('#sum-ref'),
    btnWa: $('#btn-wa'), btnMail: $('#btn-mail'), btnCopy: $('#btn-copy'),
  };

  const COLOR_NAMES = {
    '#0d0d0d': 'Black', '#f2f2f2': 'White', '#a3ff12': 'Venom Green', '#e63946': 'Red', '#1d6fe0': 'Blue',
    '#ffb703': 'Yellow', '#8d99ae': 'Grey', '#7b2cbf': 'Purple', '#2a9d8f': 'Teal', '#cfd8dc': 'Translucent',
    '#1a1a1a': 'Carbon Black', '#c9a227': 'Gold', '#5c6b73': 'Slate',
  };
  const ACCEPT = ['stl', 'obj', '3mf'];
  const MAX_BYTES = 200 * 1024 * 1024;
  const REF = 'V3-' + Date.now().toString(36).toUpperCase().slice(-6);
  el.ref.textContent = 'REF ' + REF;
  el.canvasWrap.setAttribute('data-lenis-prevent', '');
  el.sumLines.setAttribute('data-lenis-prevent', '');

  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const fmtInt = (n) => Math.round(n).toLocaleString(CFG.currency.locale);
  const fmt1 = (n) => (n >= 100 ? n.toFixed(0) : n.toFixed(1));
  const fmtTime = (h) => { const m = Math.max(1, Math.round(h * 60)); return m < 60 ? `${m}m` : `${Math.floor(m / 60)}h ${String(m % 60).padStart(2, '0')}m`; };
  const nextFrame = () => new Promise((r) => requestAnimationFrame(() => setTimeout(r, 16)));
  const matById = (id) => CFG.materials.find((m) => m.id === id) || CFG.materials[0];
  const finishById = (id) => CFG.finishes.find((f) => f.id === id) || CFG.finishes[0];
  const colorName = (hex) => COLOR_NAMES[hex.toLowerCase()] || hex.toUpperCase();

  /* ---------- Load 3D engine ---------- */
  let THREE, OrbitControls, STLLoader, OBJLoader, ThreeMFLoader, mergeGeometries, RoomEnvironment;
  try {
    [THREE, { OrbitControls }, { STLLoader }, { OBJLoader }, { ThreeMFLoader }, { mergeGeometries }, { RoomEnvironment }] = await Promise.all([
      import('three'),
      import('three/addons/controls/OrbitControls.js'),
      import('three/addons/loaders/STLLoader.js'),
      import('three/addons/loaders/OBJLoader.js'),
      import('three/addons/loaders/3MFLoader.js'),
      import('three/addons/utils/BufferGeometryUtils.js'),
      import('three/addons/environments/RoomEnvironment.js'),
    ]);
  } catch (err) {
    console.error('[V3nom] Quote engine failed to load', err);
    $('h3', el.drop).textContent = 'The 3D engine could not load';
    $('p', el.drop).textContent = 'Please check your internet connection and refresh. You can still send us your files on WhatsApp or email.';
    return;
  }
  const shapes = window.V3Shapes(THREE, mergeGeometries);

  /* ==========================================================================
     VIEWER
     ========================================================================== */
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.localClippingEnabled = true;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  el.canvasWrap.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.add(new THREE.HemisphereLight(0xe6fff0, 0x0a0f0c, 0.55));
  const key = new THREE.DirectionalLight(0xffffff, 1.7); key.position.set(200, 400, 260); scene.add(key);
  const rim = new THREE.DirectionalLight(0xa3ff12, 0.9); rim.position.set(-300, 160, -220); scene.add(rim);

  const camera = new THREE.PerspectiveCamera(38, 1, 0.5, 20000);
  camera.position.set(260, 200, 300);
  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.08;
  controls.autoRotate = true;
  controls.autoRotateSpeed = 1.1;
  controls.maxPolarAngle = Math.PI * 0.94;

  // build plate (rebuilt per technology)
  const plateGroup = new THREE.Group();
  scene.add(plateGroup);
  let plateTech = null, volBox = null;
  function buildPlate(tech) {
    if (plateTech === tech) return;
    plateTech = tech;
    plateGroup.children.slice().forEach((c) => { plateGroup.remove(c); c.geometry?.dispose(); c.material?.dispose(); });
    const bv = CFG.buildVolume[tech];
    const W = bv.x, D = bv.y, H = bv.z;
    const base = new THREE.Mesh(
      new THREE.BoxGeometry(W + 14, 3, D + 14),
      new THREE.MeshStandardMaterial({ color: 0x0c110f, metalness: 0.6, roughness: 0.45 }),
    );
    base.position.y = -1.55;
    const pts = [];
    for (let x = -W / 2; x <= W / 2 + 0.01; x += 10) pts.push(x, 0.03, -D / 2, x, 0.03, D / 2);
    for (let z = -D / 2; z <= D / 2 + 0.01; z += 10) pts.push(-W / 2, 0.03, z, W / 2, 0.03, z);
    const gridGeo = new THREE.BufferGeometry();
    gridGeo.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
    const grid = new THREE.LineSegments(gridGeo, new THREE.LineBasicMaterial({ color: 0xa3ff12, transparent: true, opacity: 0.1 }));
    const borderGeo = new THREE.EdgesGeometry(new THREE.PlaneGeometry(W, D).rotateX(-Math.PI / 2));
    const border = new THREE.LineSegments(borderGeo, new THREE.LineBasicMaterial({ color: 0xa3ff12, transparent: true, opacity: 0.55 }));
    border.position.y = 0.04;
    volBox = new THREE.LineSegments(
      new THREE.EdgesGeometry(new THREE.BoxGeometry(W, H, D).translate(0, H / 2, 0)),
      new THREE.LineBasicMaterial({ color: 0xa3ff12, transparent: true, opacity: 0.07 }),
    );
    plateGroup.add(base, grid, border, volBox);
  }
  buildPlate('FDM');

  // model meshes
  const clip = new THREE.Plane(new THREE.Vector3(0, -1, 0), 1e6);
  const modelMat = new THREE.MeshPhysicalMaterial({
    color: 0xa3ff12, metalness: 0.12, roughness: 0.42, clearcoat: 0.35, clearcoatRoughness: 0.35, clippingPlanes: [clip],
  });
  const innerMat = new THREE.MeshBasicMaterial({ color: 0xa3ff12, side: THREE.BackSide, clippingPlanes: [clip] });
  const modelGroup = new THREE.Group();
  scene.add(modelGroup);
  let outerMesh = null, innerMesh = null;
  const bbox = new THREE.Box3();
  const bboxHelper = new THREE.Box3Helper(bbox, 0xa3ff12);
  bboxHelper.material.transparent = true;
  bboxHelper.material.opacity = 0.35;
  bboxHelper.visible = false;
  scene.add(bboxHelper);

  const view = { overhang: false, wire: false, reveal: 1, layer: 1 };

  function resize() {
    const r = el.viewer.getBoundingClientRect();
    if (!r.width || !r.height) return;
    renderer.setSize(r.width, r.height, false);
    camera.aspect = r.width / r.height;
    camera.updateProjectionMatrix();
  }
  new ResizeObserver(resize).observe(el.viewer);
  resize();

  let visible = false, looping = false;
  new IntersectionObserver(([en]) => { visible = en.isIntersecting; if (visible) startLoop(); }).observe(el.viewer);
  function startLoop() {
    if (looping) return;
    looping = true;
    const tick = () => {
      if (!visible) { looping = false; return; }
      controls.update();
      renderer.render(scene, camera);
      requestAnimationFrame(tick);
    };
    tick();
  }

  function fitCamera(animate) {
    if (!outerMesh) return;
    const size = bbox.getSize(new THREE.Vector3());
    const center = bbox.getCenter(new THREE.Vector3());
    const radius = Math.max(size.length() / 2, 5);
    const dist = (radius / Math.sin(THREE.MathUtils.degToRad(camera.fov / 2))) * 1.05;
    const dir = new THREE.Vector3(1, 0.72, 1.2).normalize();
    const pos = center.clone().add(dir.multiplyScalar(dist));
    camera.near = Math.max(dist / 200, 0.1);
    camera.far = dist * 60;
    camera.updateProjectionMatrix();
    controls.minDistance = radius * 0.6;
    controls.maxDistance = dist * 5;
    if (animate && window.gsap && !UI.reduced) {
      gsap.to(camera.position, { x: pos.x, y: pos.y, z: pos.z, duration: 1.1, ease: 'expo.out' });
      gsap.to(controls.target, { x: center.x, y: center.y, z: center.z, duration: 1.1, ease: 'expo.out' });
    } else {
      camera.position.copy(pos);
      controls.target.copy(center);
    }
  }

  function updateClip() {
    if (!outerMesh) return;
    const h = bbox.max.y;
    const v = Math.min(view.reveal, view.layer);
    clip.constant = v >= 0.999 ? 1e6 : h * v + 0.001;
  }

  /* ==========================================================================
     GEOMETRY: parse + analyse
     ========================================================================== */
  function positionsOnly(geo) {
    const g = geo.index ? geo.toNonIndexed() : geo;
    const a = g.getAttribute('position');
    const arr = new Float32Array(a.count * 3);
    for (let i = 0; i < a.count; i++) { arr[i * 3] = a.getX(i); arr[i * 3 + 1] = a.getY(i); arr[i * 3 + 2] = a.getZ(i); }
    const out = new THREE.BufferGeometry();
    out.setAttribute('position', new THREE.BufferAttribute(arr, 3));
    return out;
  }
  function collectMeshes(root) {
    root.updateMatrixWorld(true);
    const list = [];
    root.traverse((o) => {
      if (o.isMesh && o.geometry && o.geometry.getAttribute('position')) {
        const g = positionsOnly(o.geometry);
        g.applyMatrix4(o.matrixWorld);
        list.push(g);
      }
    });
    return list;
  }

  async function parseFile(file) {
    const ext = file.name.split('.').pop().toLowerCase();
    let list = [];
    if (ext === 'stl') {
      const g = new STLLoader().parse(await file.arrayBuffer());
      g.rotateX(-Math.PI / 2);
      list = [positionsOnly(g)];
    } else if (ext === 'obj') {
      list = collectMeshes(new OBJLoader().parse(await file.text()));
    } else if (ext === '3mf') {
      const obj = new ThreeMFLoader().parse(await file.arrayBuffer());
      obj.rotation.x = -Math.PI / 2;
      list = collectMeshes(obj);
    }
    list = list.filter((g) => g.getAttribute('position').count >= 3);
    if (!list.length) throw new Error('No mesh data found');
    return list.length === 1 ? list[0] : mergeGeometries(list);
  }

  function centerOnPlate(geo) {
    geo.computeBoundingBox();
    const b = geo.boundingBox;
    geo.translate(-(b.min.x + b.max.x) / 2, -b.min.y, -(b.min.z + b.max.z) / 2);
    geo.computeBoundingBox();
    geo.computeBoundingSphere();
  }

  // Volume + surface area (orientation independent). Fixes inside-out meshes.
  function analyseInvariant(geo) {
    const p = geo.attributes.position.array;
    let vol = 0, area = 0;
    for (let i = 0; i < p.length; i += 9) {
      const ax = p[i], ay = p[i + 1], az = p[i + 2];
      const bx = p[i + 3], by = p[i + 4], bz = p[i + 5];
      const cx = p[i + 6], cy = p[i + 7], cz = p[i + 8];
      vol += (ax * (by * cz - bz * cy) - ay * (bx * cz - bz * cx) + az * (bx * cy - by * cx)) / 6;
      const ux = bx - ax, uy = by - ay, uz = bz - az, vx = cx - ax, vy = cy - ay, vz = cz - az;
      const nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
      area += Math.sqrt(nx * nx + ny * ny + nz * nz) / 2;
    }
    if (vol < 0) {
      for (let i = 0; i < p.length; i += 9) {
        for (let k = 0; k < 3; k++) { const t = p[i + 3 + k]; p[i + 3 + k] = p[i + 6 + k]; p[i + 6 + k] = t; }
      }
      geo.attributes.position.needsUpdate = true;
      vol = -vol;
    }
    return { vol, area, tris: p.length / 9 };
  }

  // Watertightness: weld vertices, count how many faces share each edge.
  function analyseTopology(geo) {
    const p = geo.attributes.position.array;
    const nv = p.length / 3, nt = nv / 3;
    if (nt > 2000000) return { skipped: true };
    const ids = new Uint32Array(nv);
    const map = new Map();
    let next = 0;
    for (let i = 0; i < nv; i++) {
      const k = Math.round(p[i * 3] * 1000) + ',' + Math.round(p[i * 3 + 1] * 1000) + ',' + Math.round(p[i * 3 + 2] * 1000);
      let id = map.get(k);
      if (id === undefined) { id = next++; map.set(k, id); }
      ids[i] = id;
    }
    const N = next, edges = new Map();
    const add = (u, v) => { const k = u < v ? u * N + v : v * N + u; edges.set(k, (edges.get(k) || 0) + 1); };
    let degenerate = 0;
    for (let t = 0; t < nt; t++) {
      const a = ids[t * 3], b = ids[t * 3 + 1], c = ids[t * 3 + 2];
      if (a === b || b === c || a === c) { degenerate++; continue; }
      add(a, b); add(b, c); add(c, a);
    }
    let open = 0, nonManifold = 0;
    edges.forEach((c) => { if (c === 1) open++; else if (c > 2) nonManifold++; });
    return { verts: N, open, nonManifold, degenerate, watertight: open === 0 && nonManifold === 0 };
  }

  // Orientation dependent: size, overhangs (>45°), bed contact.
  function analyseOrient(geo) {
    geo.computeBoundingBox();
    const b = geo.boundingBox, minY = b.min.y;
    const p = geo.attributes.position.array;
    const nt = p.length / 9;
    const flags = new Uint8Array(nt);
    let overArea = 0, overVol = 0, bedArea = 0;
    const c45 = Math.SQRT1_2;
    for (let t = 0, i = 0; t < nt; t++, i += 9) {
      const ay = p[i + 1], by = p[i + 4], cy = p[i + 7];
      const ux = p[i + 3] - p[i], uy = by - ay, uz = p[i + 5] - p[i + 2];
      const vx = p[i + 6] - p[i], vy = cy - ay, vz = p[i + 8] - p[i + 2];
      const nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
      const len = Math.sqrt(nx * nx + ny * ny + nz * nz);
      if (!len) continue;
      const area = len / 2, dirY = ny / len;
      const low = Math.min(ay, by, cy) - minY, high = Math.max(ay, by, cy) - minY;
      if (dirY < -0.985 && high < 0.05) bedArea += area;
      else if (dirY < -c45 && low > 0.25) {
        flags[t] = 1;
        overArea += area;
        overVol += area * -dirY * ((ay + by + cy) / 3 - minY);
      }
    }
    return { size: b.getSize(new THREE.Vector3()), overArea, overVol, bedArea, flags };
  }

  function overhangColors(part) {
    if (part.colorsFor === part.orient) return;
    const nt = part.orient.flags.length;
    const col = new Float32Array(nt * 9);
    const base = [0.62, 0.68, 0.65], hot = [1, 0.23, 0.42];
    for (let t = 0; t < nt; t++) {
      const c = part.orient.flags[t] ? hot : base;
      for (let v = 0; v < 3; v++) col.set(c, t * 9 + v * 3);
    }
    part.geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
    part.colorsFor = part.orient;
  }

  /* ==========================================================================
     PRICING
     ========================================================================== */
  const scaleOf = (part) => (part.s.scale / 100) * part.s.unit;

  function calcPart(part) {
    const m = matById(part.s.material);
    const tech = m.tech;
    const qs = CFG.qualities[tech];
    const q = qs.find((x) => x.id === part.s.quality) || qs[0];
    const s = scaleOf(part);
    const vol = (part.inv.vol * s ** 3) / 1000;            // cm³
    const area = (part.inv.area * s ** 2) / 100;           // cm²
    const size = part.orient.size.clone().multiplyScalar(s); // mm
    const layers = Math.max(1, Math.ceil(size.y / q.layer));
    const supportCm3 = ((part.orient.overVol * s ** 3) / 1000) * (tech === 'FDM' ? 0.12 : 0.08);

    let matCm3, hours;
    if (tech === 'FDM') {
      const shell = Math.min(vol, area * 0.16);               // ~1.6 mm walls / top / bottom
      const infill = Math.max(0, vol - shell) * (part.s.infill / 100);
      matCm3 = shell + infill + supportCm3;
      const flow = 14 * (q.layer / 0.2);                      // cm³ per hour
      hours = matCm3 / flow + (layers * 3) / 3600 + 0.05;
    } else {
      matCm3 = vol * 1.06 + supportCm3 + 0.3;
      hours = (layers * 7) / 3600 + 0.2;
    }
    const grams = matCm3 * m.density * 1.03;
    const qty = part.s.qty;
    const qtyMachine = tech === 'SLA' ? 1 + (qty - 1) * 0.35 : qty; // resin parts share layers
    const material = grams * m.pricePerGram * qty;
    const machine = hours * CFG.pricing.machineRate[tech] * qtyMachine;
    const fin = finishById(part.s.finish);
    const finish = (material + machine) * (fin.mult - 1);
    const gross = material + machine + finish;
    const tier = CFG.pricing.bulkDiscounts.slice().sort((a, b) => b.min - a.min).find((d) => qty >= d.min);
    const discount = tier ? gross * tier.off : 0;
    const total = gross - discount;
    return {
      m, tech, q, s, vol, area, size, layers, grams, hours, material, machine, finish, discount, total,
      discountPct: tier ? tier.off : 0, machineHours: hours * qtyMachine,
    };
  }

  function checksFor(part, c) {
    const list = [];
    let score = 100;
    const ok = (t, d) => list.push({ lvl: 'ok', t, d });
    const warn = (t, d) => list.push({ lvl: 'warn', t, d });
    const bad = (t, d) => list.push({ lvl: 'bad', t, d });

    const bv = CFG.buildVolume[c.tech];
    const dims = [c.size.x, c.size.z, c.size.y];
    const direct = c.size.x <= bv.x && c.size.z <= bv.y && c.size.y <= bv.z;
    const sd = dims.slice().sort((a, b) => a - b), sb = [bv.x, bv.y, bv.z].sort((a, b) => a - b);
    const anyFit = sd.every((d, i) => d <= sb[i]);
    part.fits = direct ? 'yes' : anyFit ? 'rotate' : 'no';
    if (direct) ok('Fits the build volume', `${bv.x} × ${bv.y} × ${bv.z} mm ${c.tech === 'SLA' ? 'resin' : 'FDM'} printer`);
    else if (anyFit) { score -= 8; warn('Fits when re-oriented', 'Use the rotate tools, or we will orient it for you.'); }
    else { score -= 35; bad('Larger than the build volume', 'We can split it into sections and bond them. Price confirmed after review.'); }

    const t = part.topo;
    if (t.skipped) warn('Mesh check skipped', 'Very large file. We will inspect it manually.');
    else if (t.watertight) ok('Watertight mesh', `${fmtInt(t.verts)} vertices, no holes or open edges`);
    else {
      if (t.open > 0) {
        score -= t.open > 60 ? 25 : 10;
        (t.open > 60 ? bad : warn)('Holes / open edges found', `${fmtInt(t.open)} open edges. We will repair it before printing.`);
      }
      if (t.nonManifold > 0) { score -= 8; warn('Non-manifold edges', `${fmtInt(t.nonManifold)} edges shared by 3+ faces.`); }
    }

    const ratio = part.inv.area ? part.orient.overArea / part.inv.area : 0;
    const pct = (ratio * 100).toFixed(ratio < 0.1 ? 1 : 0);
    if (ratio > 0.2) { score -= 15; warn('Heavy overhangs', `${pct}% of the surface needs support. Try rotating the model.`); }
    else if (ratio > 0.03) { score -= 4; warn('Supports required', `${pct}% overhang area. Support material is included in the price.`); }
    else ok('Minimal overhangs', 'Prints with little or no support material');

    const minDim = Math.min(...dims), maxDim = Math.max(...dims);
    if (maxDim < 4) { score -= 22; bad('Model is extremely small', `Only ${maxDim.toFixed(2)} mm across. Are your file units cm or inches? Change "File units".`); }
    else if (minDim < (c.tech === 'SLA' ? 0.3 : 0.8)) { score -= 15; warn('Very thin features', `Thinnest dimension is ${minDim.toFixed(2)} mm and may be fragile.`); }
    else if (maxDim > 1500) { score -= 5; warn('Unusually large model', 'Is your file in mm? If it was exported in inches, check "File units".'); }

    if (c.tech === 'FDM' && part.orient.bedArea * c.s ** 2 < 40) {
      score -= 6;
      warn('Small contact with the bed', 'A brim or supports will be added for a stable print.');
    }
    if (part.inv.tris > 1500000) warn('Very dense mesh', `${fmtInt(part.inv.tris)} triangles. Detail beyond 0.05 mm won't be visible.`);

    score = Math.max(5, Math.min(100, Math.round(score)));
    const lvl = list.some((x) => x.lvl === 'bad') ? 'bad' : list.some((x) => x.lvl === 'warn') ? 'warn' : 'ok';
    return { list, score, lvl };
  }

  /* ==========================================================================
     STATE
     ========================================================================== */
  const state = { parts: [], activeId: null, express: false, defaultMaterial: CFG.materials[0].id };
  let uid = 0;
  const active = () => state.parts.find((p) => p.id === state.activeId) || null;

  function defaultSettings(materialId) {
    const m = matById(materialId || state.defaultMaterial);
    const qs = CFG.qualities[m.tech];
    return {
      material: m.id, color: m.colors[0], quality: (qs.find((q) => q.id === 'standard') || qs[0]).id,
      infill: 20, finish: CFG.finishes[0].id, scale: 100, unit: 1, qty: 1,
    };
  }

  function showLoading(text) { el.loading.hidden = false; el.loadingText.textContent = text; }
  function hideLoading() { el.loading.hidden = true; }

  async function ingest(name, geo, opts = {}) {
    centerOnPlate(geo);
    const inv = analyseInvariant(geo);
    geo.computeVertexNormals();
    showLoading('CHECKING MESH INTEGRITY…');
    await nextFrame();
    const topo = analyseTopology(geo);
    const orient = analyseOrient(geo);
    const part = { id: ++uid, name, geo, inv, topo, orient, colorsFor: null, s: defaultSettings(opts.material) };
    if (opts.qty) part.s.qty = opts.qty;
    state.parts.push(part);
    // gentle unit guess for tiny models (common with files exported in cm / inches)
    const maxDim = Math.max(orient.size.x, orient.size.y, orient.size.z);
    if (maxDim < 4 && maxDim > 0) UI.toast(`"${name}" is only ${maxDim.toFixed(2)} mm. Check the file units.`, true);
    selectPart(part.id, true);
  }

  async function handleFiles(fileList) {
    const files = Array.from(fileList || []);
    if (!files.length) return;
    let added = 0;
    for (const f of files) {
      const ext = f.name.split('.').pop().toLowerCase();
      if (!ACCEPT.includes(ext)) { UI.toast(`${f.name}: please upload STL, OBJ or 3MF`, true); continue; }
      if (f.size > MAX_BYTES) { UI.toast(`${f.name} is over 200 MB. Send it via email instead.`, true); continue; }
      showLoading(`READING ${f.name.toUpperCase()}…`);
      await nextFrame();
      try {
        const geo = await parseFile(f);
        showLoading('ANALYSING GEOMETRY…');
        await nextFrame();
        await ingest(f.name, geo);
        added++;
      } catch (err) {
        console.error(err);
        UI.toast(`Couldn't read ${f.name}. Is it a valid ${ext.toUpperCase()} file?`, true);
      }
    }
    hideLoading();
    el.file.value = '';
    if (added) UI.toast(added === 1 ? 'Model analysed. Configure your print →' : `${added} models analysed`);
  }

  const SAMPLES = ['bracket', 'gear', 'vase', 'pawn', 'knot', 'lattice'];
  let sampleIdx = 0;
  async function addSample(keyName) {
    const k = keyName || SAMPLES[sampleIdx++ % SAMPLES.length];
    const meta = shapes.meta[k];
    showLoading('GENERATING SAMPLE…');
    await nextFrame();
    const geo = positionsOnly(shapes[k]());
    await ingest(`${meta.name}.stl`, geo, { material: meta.material });
    hideLoading();
  }

  function removePart(id) {
    const i = state.parts.findIndex((p) => p.id === id);
    if (i < 0) return;
    const [p] = state.parts.splice(i, 1);
    if (state.activeId === id) {
      const next = state.parts[Math.min(i, state.parts.length - 1)];
      state.activeId = null;
      if (next) selectPart(next.id, true);
      else clearViewer();
    }
    setTimeout(() => p.geo.dispose(), 100);
    renderAll();
  }

  function clearViewer() {
    if (outerMesh) { modelGroup.remove(outerMesh, innerMesh); outerMesh = innerMesh = null; }
    bboxHelper.visible = false;
  }

  /* ---------- Viewer sync ---------- */
  function displayColor(hex) {
    const c = new THREE.Color(hex);
    const lum = c.r * 0.2126 + c.g * 0.7152 + c.b * 0.0722;
    if (lum < 0.02) c.set('#22282a');
    return c;
  }
  function applyAppearance(part) {
    if (!outerMesh) return;
    if (view.overhang) {
      overhangColors(part);
      modelMat.vertexColors = true;
      modelMat.color.set(0xffffff);
    } else {
      modelMat.vertexColors = false;
      modelMat.color.copy(displayColor(part.s.color));
    }
    const m = matById(part.s.material);
    modelMat.roughness = m.tech === 'SLA' ? 0.28 : 0.45;
    modelMat.wireframe = view.wire;
    innerMesh.visible = !view.wire;
    modelMat.needsUpdate = true;
    el.legend.hidden = !view.overhang;
  }
  function applyScale(part, refit, animate) {
    const s = scaleOf(part);
    modelGroup.scale.setScalar(s);
    modelGroup.updateMatrixWorld(true);
    bbox.copy(part.geo.boundingBox).applyMatrix4(modelGroup.matrixWorld);
    bboxHelper.visible = true;
    const c = part.calc;
    buildPlate(c.tech);
    const fitColor = part.fits === 'no' ? 0xff3b6b : part.fits === 'rotate' ? 0xffb020 : 0xa3ff12;
    bboxHelper.material.color.setHex(fitColor);
    if (volBox) { volBox.material.color.setHex(fitColor); volBox.material.opacity = part.fits === 'yes' ? 0.07 : 0.35; }
    el.dims.innerHTML = `<b class="x">X</b> ${fmt1(c.size.x)} · <b class="y">Y</b> ${fmt1(c.size.z)} · <b class="z">Z</b> ${fmt1(c.size.y)} <span>mm</span>`;
    updateClip();
    if (refit) fitCamera(animate);
  }
  function showPart(part) {
    if (!outerMesh) {
      outerMesh = new THREE.Mesh(part.geo, modelMat);
      innerMesh = new THREE.Mesh(part.geo, innerMat);
      modelGroup.add(outerMesh, innerMesh);
    } else {
      outerMesh.geometry = part.geo;
      innerMesh.geometry = part.geo;
    }
    modelGroup.rotation.set(0, 0, 0);
    applyAppearance(part);
    applyScale(part, true, true);
    playReveal();
  }
  function playReveal() {
    if (!window.gsap || UI.reduced) { view.reveal = 1; updateClip(); return; }
    gsap.fromTo(view, { reveal: 0 }, { reveal: 1, duration: 1.6, ease: 'power2.inOut', onUpdate: updateClip, overwrite: true });
  }

  /* ==========================================================================
     RENDER UI
     ========================================================================== */
  function selectPart(id, refit) {
    state.activeId = id;
    const part = active();
    if (!part) return;
    part.calc = calcPart(part);
    part.check = checksFor(part, part.calc);
    if (refit) showPart(part);
    renderAll();
  }

  function recalcAll() {
    state.parts.forEach((p) => { p.calc = calcPart(p); p.check = checksFor(p, p.calc); });
  }

  function renderAll() {
    recalcAll();
    const has = state.parts.length > 0;
    el.drop.classList.toggle('is-hidden', has);
    el.toolbar.hidden = el.layerWrap.hidden = el.dims.hidden = el.partsWrap.hidden = el.analysis.hidden = !has;
    el.config.classList.toggle('is-disabled', !has);
    [el.btnWa, el.btnMail, el.btnCopy].forEach((b) => { b.disabled = !has; });
    if (!has) el.legend.hidden = true;
    renderParts();
    renderConfig();
    renderAnalysis();
    renderSummary();
  }

  function renderParts() {
    el.parts.innerHTML = state.parts.map((p) => `
      <div class="part ${p.id === state.activeId ? 'is-active' : ''}" data-id="${p.id}" role="button" tabindex="0" aria-label="Select ${esc(p.name)}">
        <span class="part__status ${p.check.lvl}"></span>
        <span class="part__thumb" style="color:${esc(p.s.color)}"><i style="background:${esc(p.s.color)}"></i></span>
        <span class="part__info">
          <span class="part__name">${esc(p.name)}</span>
          <span class="part__meta">${p.calc.m.name} · ×${p.s.qty} · <b>${UI.money(p.calc.total)}</b></span>
        </span>
        <button class="part__remove" data-remove="${p.id}" type="button" aria-label="Remove ${esc(p.name)}"><svg viewBox="0 0 24 24"><path d="M6 6l12 12M18 6 6 18"/></svg></button>
      </div>`).join('');
  }

  /* --- config controls --- */
  // material chips (built once)
  CFG.materials.forEach((m) => {
    const b = document.createElement('button');
    b.type = 'button'; b.className = 'chip'; b.dataset.id = m.id; b.setAttribute('role', 'radio');
    b.innerHTML = `${m.name}<small>${m.tech === 'SLA' ? 'RESIN' : 'FDM'}</small>`;
    b.addEventListener('click', () => setSetting('material', m.id));
    el.material.appendChild(b);
  });

  function buildSegmented(container, items, onPick) {
    container.innerHTML = '<span class="segmented__pill"></span>' + items.map((it) =>
      `<button type="button" role="radio" data-id="${it.id}">${it.label}${it.sub ? `<small>${it.sub}</small>` : ''}</button>`).join('');
    $$('button', container).forEach((b) => b.addEventListener('click', () => onPick(b.dataset.id)));
  }
  function syncSegmented(container, id) {
    const pill = $('.segmented__pill', container);
    $$('button', container).forEach((b) => {
      const on = b.dataset.id === id;
      b.classList.toggle('is-on', on);
      b.setAttribute('aria-checked', on);
      if (on && pill) { pill.style.left = b.offsetLeft + 'px'; pill.style.width = b.offsetWidth + 'px'; }
    });
  }
  buildSegmented(el.finish, CFG.finishes.map((f) => ({ id: f.id, label: f.name, sub: f.mult > 1 ? `+${Math.round((f.mult - 1) * 100)}%` : 'incl.' })),
    (id) => setSetting('finish', id));

  let builtQualityTech = null, builtColorsFor = null;

  function renderConfig() {
    const p = active();
    if (!p) {
      el.partName.textContent = 'No model loaded';
      $$('.chip', el.material).forEach((b) => b.classList.remove('is-on'));
      return;
    }
    const m = matById(p.s.material);
    el.partName.textContent = p.name;
    el.partName.title = p.name;
    $$('.chip', el.material).forEach((b) => { const on = b.dataset.id === m.id; b.classList.toggle('is-on', on); b.setAttribute('aria-checked', on); });
    el.materialHint.textContent = `${m.tagline}. ${UI.money(m.pricePerGram)}/g`;

    if (builtColorsFor !== m.id) {
      builtColorsFor = m.id;
      el.colors.innerHTML = m.colors.map((c) =>
        `<button type="button" class="swatch" role="radio" data-color="${c}" style="background:${c}" title="${colorName(c)}" aria-label="${colorName(c)}"></button>`).join('');
    }
    $$('.swatch', el.colors).forEach((b) => { const on = b.dataset.color === p.s.color; b.classList.toggle('is-on', on); b.setAttribute('aria-checked', on); });
    el.colorName.textContent = colorName(p.s.color);

    if (builtQualityTech !== m.tech) {
      builtQualityTech = m.tech;
      buildSegmented(el.quality, CFG.qualities[m.tech].map((q) => ({ id: q.id, label: q.name, sub: `${q.layer} mm` })), (id) => setSetting('quality', id));
    }
    syncSegmented(el.quality, p.s.quality);
    syncSegmented(el.finish, p.s.finish);

    el.infillWrap.hidden = m.tech !== 'FDM';
    el.infill.value = p.s.infill;
    el.infillVal.textContent = p.s.infill + '%';
    el.infill.style.setProperty('--p', ((p.s.infill - 10) / 90) * 100 + '%');
    if (document.activeElement !== el.scale) el.scale.value = p.s.scale;
    el.unit.value = String(p.s.unit);
    if (document.activeElement !== el.qty) el.qty.value = p.s.qty;
  }

  function renderAnalysis() {
    const p = active();
    if (!p) return;
    const c = p.calc, ch = p.check;
    const C = 2 * Math.PI * 52;
    el.scoreRing.style.strokeDashoffset = String(C * (1 - ch.score / 100));
    el.scoreRing.style.stroke = ch.score >= 80 ? 'var(--venom)' : ch.score >= 55 ? 'var(--warn)' : 'var(--danger)';
    el.scoreRing.style.color = el.scoreRing.style.stroke;
    tweenNumber(el.score, ch.score, (v) => Math.round(v));
    const icon = { ok: '✓', warn: '!', bad: '✕' };
    el.checks.innerHTML = ch.list.map((x, i) =>
      `<li class="${x.lvl}" style="animation-delay:${i * 60}ms"><span class="ic">${icon[x.lvl]}</span><span>${esc(x.t)}<small>${esc(x.d)}</small></span></li>`).join('');
    el.sDims.textContent = `${fmt1(c.size.x)} × ${fmt1(c.size.z)} × ${fmt1(c.size.y)} mm`;
    el.sVol.textContent = `${fmt1(c.vol)} cm³`;
    el.sArea.textContent = `${fmt1(c.area)} cm²`;
    el.sTris.textContent = fmtInt(p.inv.tris);
    el.sWeight.textContent = `${fmt1(c.grams)} g`;
    el.sTime.textContent = `${fmtTime(c.hours)}${p.s.qty > 1 ? ' each' : ''}`;
  }

  function orderTotals() {
    let material = 0, machine = 0, finish = 0, discount = 0, hours = 0;
    state.parts.forEach((p) => {
      material += p.calc.material; machine += p.calc.machine; finish += p.calc.finish; discount += p.calc.discount; hours += p.calc.machineHours;
    });
    const setup = state.parts.length ? CFG.pricing.setupFee : 0;
    const subtotal = material + machine + finish - discount + setup;
    const express = state.express ? subtotal * (CFG.pricing.expressMultiplier - 1) : 0;
    let total = subtotal + express;
    const minApplied = state.parts.length > 0 && total < CFG.pricing.minimumOrder;
    if (minApplied) total = CFG.pricing.minimumOrder;
    const days = 3 + Math.ceil(hours / 20);
    const lead = state.express ? `Express · ships in ${Math.max(2, Math.ceil(hours / 22) + 1)} days` : `Standard · ships in ${days}–${days + 2} working days`;
    return { material, machine, finish, discount, setup, express, total, minApplied, hours, lead };
  }

  function renderSummary() {
    if (!state.parts.length) {
      el.sumLines.innerHTML = '<li class="summary__empty">Upload a model to see live pricing.</li>';
      [el.sumMaterial, el.sumMachine, el.sumFinish, el.sumDiscount, el.sumSetup].forEach((d) => { d.textContent = '–'; });
      el.sumExpressRow.hidden = true;
      el.total.textContent = '–'; el.total._v = 0;
      el.lead.textContent = 'Lead time: –';
      el.note.textContent = '';
      return;
    }
    el.sumLines.innerHTML = state.parts.map((p) =>
      `<li data-id="${p.id}"><span><b>${esc(p.name)}</b> × ${p.s.qty} · ${p.calc.m.name}${p.calc.discountPct ? ` · −${Math.round(p.calc.discountPct * 100)}%` : ''}</span><em>${UI.money(p.calc.total)}</em></li>`).join('');
    const o = orderTotals();
    el.sumMaterial.textContent = UI.money(o.material);
    el.sumMachine.textContent = `${UI.money(o.machine)} · ${fmtTime(o.hours)}`;
    el.sumFinish.textContent = o.finish ? UI.money(o.finish) : 'Included';
    el.sumDiscount.textContent = o.discount ? '−' + UI.money(o.discount) : '–';
    el.sumSetup.textContent = UI.money(o.setup);
    el.sumExpressRow.hidden = !state.express;
    el.sumExpressVal.textContent = UI.money(o.express);
    tweenNumber(el.total, o.total, (v) => UI.money(v));
    el.lead.textContent = o.lead;
    const notes = [];
    if (o.minApplied) notes.push(`Minimum order value of ${UI.money(CFG.pricing.minimumOrder)} applied.`);
    if (state.parts.some((p) => p.fits === 'no')) notes.push('Includes oversize parts. Final price confirmed after review.');
    el.note.textContent = notes.join(' ');
  }

  function tweenNumber(node, to, format) {
    const from = node._v || 0;
    node._v = to;
    if (node._tw) node._tw.kill();
    if (!window.gsap || UI.reduced) { node.textContent = format(to); return; }
    const o = { v: from };
    node._tw = gsap.to(o, { v: to, duration: 0.9, ease: 'power3.out', onUpdate: () => { node.textContent = format(o.v); } });
  }

  /* ==========================================================================
     ACTIONS
     ========================================================================== */
  function setSetting(k, v) {
    const p = active();
    if (!p) return;
    const prevTech = matById(p.s.material).tech;
    p.s[k] = v;
    if (k === 'material') {
      const m = matById(v);
      if (!m.colors.includes(p.s.color)) p.s.color = m.colors[0];
      const qs = CFG.qualities[m.tech];
      if (!qs.some((q) => q.id === p.s.quality)) p.s.quality = (qs.find((q) => q.id === 'standard') || qs[0]).id;
      state.defaultMaterial = v;
    }
    p.calc = calcPart(p);
    p.check = checksFor(p, p.calc);
    if (k === 'material' || k === 'color') applyAppearance(p);
    if (k === 'scale' || k === 'unit') applyScale(p, true, true);
    else if (k === 'material') applyScale(p, matById(v).tech !== prevTech, true);
    renderAll();
  }

  el.colors.addEventListener('click', (e) => { const b = e.target.closest('.swatch'); if (b) setSetting('color', b.dataset.color); });
  el.infill.addEventListener('input', () => setSetting('infill', parseInt(el.infill.value, 10)));
  el.unit.addEventListener('change', () => setSetting('unit', parseFloat(el.unit.value)));
  el.scale.addEventListener('change', () => {
    const v = Math.max(1, Math.min(1000, parseFloat(el.scale.value) || 100));
    el.scale.value = v;
    setSetting('scale', v);
  });
  el.scale.addEventListener('keydown', (e) => { if (e.key === 'Enter') el.scale.blur(); });
  const setQty = (v) => { const q = Math.max(1, Math.min(999, Math.round(v) || 1)); el.qty.value = q; setSetting('qty', q); };
  el.qty.addEventListener('change', () => setQty(parseFloat(el.qty.value)));
  $$('.stepper [data-step]').forEach((b) => b.addEventListener('click', () => {
    const p = active(); if (p) setQty(p.s.qty + parseInt(b.dataset.step, 10));
  }));
  el.express.addEventListener('change', () => { state.express = el.express.checked; renderSummary(); });

  el.parts.addEventListener('click', (e) => {
    const rm = e.target.closest('[data-remove]');
    if (rm) { e.stopPropagation(); removePart(parseInt(rm.dataset.remove, 10)); return; }
    const card = e.target.closest('.part');
    if (card && parseInt(card.dataset.id, 10) !== state.activeId) selectPart(parseInt(card.dataset.id, 10), true);
  });
  el.parts.addEventListener('keydown', (e) => {
    const card = e.target.closest('.part');
    if (card && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); selectPart(parseInt(card.dataset.id, 10), true); }
  });
  el.sumLines.addEventListener('click', (e) => {
    const li = e.target.closest('li[data-id]');
    if (li) selectPart(parseInt(li.dataset.id, 10), true);
  });

  // toolbar
  el.toolbar.addEventListener('click', (e) => {
    const b = e.target.closest('button[data-act]');
    const p = active();
    if (!b || !p) return;
    const act = b.dataset.act;
    if (act === 'rx' || act === 'ry' || act === 'rz') {
      // UI axes use printer convention (Z = up); three.js is Y-up.
      const axis = { rx: 'x', ry: 'z', rz: 'y' }[act];
      const g = p.geo;
      if (axis === 'x') g.rotateX(Math.PI / 2); else if (axis === 'y') g.rotateY(Math.PI / 2); else g.rotateZ(Math.PI / 2);
      centerOnPlate(g);
      g.computeVertexNormals();
      p.orient = analyseOrient(g);
      p.colorsFor = null;
      p.calc = calcPart(p);
      p.check = checksFor(p, p.calc);
      applyAppearance(p);
      applyScale(p, true, true);
      modelGroup.rotation.set(0, 0, 0);
      if (window.gsap && !UI.reduced) gsap.fromTo(modelGroup.rotation, { [axis]: -Math.PI / 2 }, { [axis]: 0, duration: 0.7, ease: 'expo.out', overwrite: true });
      renderAll();
    } else if (act === 'overhang') {
      view.overhang = !view.overhang; b.classList.toggle('is-on', view.overhang); applyAppearance(p);
    } else if (act === 'wire') {
      view.wire = !view.wire; b.classList.toggle('is-on', view.wire); applyAppearance(p);
    } else if (act === 'spin') {
      controls.autoRotate = !controls.autoRotate; b.classList.toggle('is-on', controls.autoRotate);
    } else if (act === 'reset') {
      fitCamera(true);
    }
  });

  el.layer.addEventListener('input', () => {
    view.layer = parseInt(el.layer.value, 10) / 1000;
    el.layerVal.textContent = Math.round(view.layer * 100) + '%';
    if (window.gsap) gsap.killTweensOf(view);
    view.reveal = 1;
    updateClip();
  });

  // file input + drag & drop
  el.file.addEventListener('change', () => handleFiles(el.file.files));
  el.sample.addEventListener('click', () => addSample());
  let dragDepth = 0;
  const hasFiles = (e) => e.dataTransfer && Array.from(e.dataTransfer.types || []).includes('Files');
  el.viewer.addEventListener('dragenter', (e) => {
    if (!hasFiles(e)) return;
    e.preventDefault(); dragDepth++;
    el.drop.classList.remove('is-hidden'); el.drop.classList.add('is-over');
  });
  el.viewer.addEventListener('dragover', (e) => { if (hasFiles(e)) { e.preventDefault(); e.dataTransfer.dropEffect = 'copy'; } });
  el.viewer.addEventListener('dragleave', () => {
    dragDepth = Math.max(0, dragDepth - 1);
    if (!dragDepth) { el.drop.classList.remove('is-over'); el.drop.classList.toggle('is-hidden', state.parts.length > 0); }
  });
  el.viewer.addEventListener('drop', (e) => {
    if (!hasFiles(e)) return;
    e.preventDefault(); dragDepth = 0;
    el.drop.classList.remove('is-over'); el.drop.classList.toggle('is-hidden', state.parts.length > 0);
    handleFiles(e.dataTransfer.files);
  });
  // stop the browser from opening files dropped slightly outside the viewer
  window.addEventListener('dragover', (e) => { if (hasFiles(e)) e.preventDefault(); });
  window.addEventListener('drop', (e) => { if (hasFiles(e)) e.preventDefault(); });

  // cross-section events
  document.addEventListener('v3:sample', (e) => addSample(e.detail));
  document.addEventListener('v3:material', (e) => {
    const m = matById(e.detail);
    state.defaultMaterial = m.id;
    if (active()) setSetting('material', m.id);
    UI.toast(`${m.name} selected${active() ? '' : '. Upload a model to see the price'}`);
  });
  const resyncPills = () => { const p = active(); if (p) { syncSegmented(el.quality, p.s.quality); syncSegmented(el.finish, p.s.finish); } };
  window.addEventListener('resize', resyncPills);
  if (document.fonts) document.fonts.ready.then(resyncPills);

  /* ---------- Sending the quote ---------- */
  function quoteText() {
    const o = orderTotals();
    const lines = state.parts.map((p, i) => {
      const c = p.calc;
      const fin = finishById(p.s.finish);
      return [
        `${i + 1}) ${p.name} × ${p.s.qty}`,
        `   ${c.m.name} (${colorName(p.s.color)}) · ${c.q.name} ${c.q.layer} mm${c.tech === 'FDM' ? ` · ${p.s.infill}% infill` : ''} · ${fin.name}`,
        `   ${fmt1(c.size.x)} × ${fmt1(c.size.z)} × ${fmt1(c.size.y)} mm${p.s.scale !== 100 ? ` (scaled ${p.s.scale}%)` : ''} · ~${fmt1(c.grams)} g · ~${fmtTime(c.hours)} each`,
        `   Line total: ${UI.money(c.total)}`,
      ].join('\n');
    });
    return [
      `Hi ${CFG.brand}! I'd like to order these prints.`,
      `Quote ref: ${REF}`,
      '',
      ...lines,
      '',
      `Setup & review: ${UI.money(o.setup)}`,
      o.discount ? `Bulk discount: −${UI.money(o.discount)}` : null,
      state.express ? `Express production: +${UI.money(o.express)}` : null,
      `ESTIMATED TOTAL: ${UI.money(o.total)}`,
      o.lead,
      '',
      'I will attach my model file(s).',
    ].filter((x) => x !== null).join('\n');
  }
  el.btnWa.addEventListener('click', () => {
    window.open(`https://wa.me/${CFG.contact.whatsapp}?text=${encodeURIComponent(quoteText())}`, '_blank', 'noopener');
  });
  el.btnMail.addEventListener('click', () => {
    const subject = `Print quote ${REF} (${UI.money(orderTotals().total)})`;
    window.location.href = `mailto:${CFG.contact.email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(quoteText())}`;
  });
  el.btnCopy.addEventListener('click', async () => {
    const text = quoteText();
    try { await navigator.clipboard.writeText(text); }
    catch (_) {
      const ta = document.createElement('textarea');
      ta.value = text; ta.style.position = 'fixed'; ta.style.opacity = '0';
      document.body.appendChild(ta); ta.select(); document.execCommand('copy'); ta.remove();
    }
    UI.toast('Quote summary copied to clipboard');
  });

  renderAll();
})();
