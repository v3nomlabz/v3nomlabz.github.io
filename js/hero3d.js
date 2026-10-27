/* ==========================================================================
   V3NOM LABZ — Hero: a live, layer-by-layer 3D print
   ========================================================================== */
(async function () {
  'use strict';
  const canvas = document.getElementById('hero-canvas');
  if (!canvas) return;

  let THREE, mergeGeometries, RoomEnvironment;
  try {
    THREE = await import('three');
    ({ mergeGeometries } = await import('three/addons/utils/BufferGeometryUtils.js'));
    ({ RoomEnvironment } = await import('three/addons/environments/RoomEnvironment.js'));
  } catch (err) {
    console.warn('[V3nom] 3D hero unavailable:', err);
    return;
  }

  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const shapes = window.V3Shapes(THREE, mergeGeometries);
  const GREEN = new THREE.Color('#a3ff12');

  /* ---------- Renderer / scene ---------- */
  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'high-performance' });
  } catch (err) { console.warn('[V3nom] WebGL unavailable'); return; }
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.localClippingEnabled = true;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  renderer.outputColorSpace = THREE.SRGBColorSpace;

  const scene = new THREE.Scene();
  scene.fog = new THREE.Fog(0x050706, 380, 900);
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;

  const camera = new THREE.PerspectiveCamera(32, 1, 1, 3000);
  const camBase = new THREE.Vector3(0, 125, 310);
  const lookAt = new THREE.Vector3(0, 48, 0);

  scene.add(new THREE.HemisphereLight(0xcfe8d8, 0x050706, 0.35));
  const key = new THREE.DirectionalLight(0xffffff, 1.6);
  key.position.set(-120, 220, 160);
  scene.add(key);
  const rim = new THREE.DirectionalLight(0xa3ff12, 1.4);
  rim.position.set(160, 80, -180);
  scene.add(rim);
  const fill = new THREE.PointLight(0x00f0b5, 600, 400, 1.6);
  fill.position.set(-140, 40, 80);
  scene.add(fill);

  /* ---------- Printer rig ---------- */
  const rig = new THREE.Group();
  scene.add(rig);

  const PLATE = 170;
  const plate = new THREE.Mesh(
    new THREE.BoxGeometry(PLATE, 4, PLATE),
    new THREE.MeshStandardMaterial({ color: 0x0b100e, metalness: 0.7, roughness: 0.35, envMapIntensity: 0.6 }),
  );
  plate.position.y = -2.02;
  rig.add(plate);
  const plateEdges = new THREE.LineSegments(
    new THREE.EdgesGeometry(plate.geometry),
    new THREE.LineBasicMaterial({ color: GREEN, transparent: true, opacity: 0.45 }),
  );
  plateEdges.position.copy(plate.position);
  rig.add(plateEdges);
  const grid = new THREE.GridHelper(PLATE, 34, 0xa3ff12, 0x1c2a22);
  grid.material.transparent = true;
  grid.material.opacity = 0.22;
  grid.position.y = 0.05;
  rig.add(grid);

  // radial glow under the model
  const glowTex = (() => {
    const c = document.createElement('canvas'); c.width = c.height = 256;
    const g = c.getContext('2d');
    const grd = g.createRadialGradient(128, 128, 0, 128, 128, 128);
    grd.addColorStop(0, 'rgba(163,255,18,0.55)');
    grd.addColorStop(0.4, 'rgba(163,255,18,0.15)');
    grd.addColorStop(1, 'rgba(163,255,18,0)');
    g.fillStyle = grd; g.fillRect(0, 0, 256, 256);
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
  })();
  const glow = new THREE.Mesh(
    new THREE.PlaneGeometry(200, 200),
    new THREE.MeshBasicMaterial({ map: glowTex, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }),
  );
  glow.rotation.x = -Math.PI / 2;
  glow.position.y = 0.2;
  rig.add(glow);

  // print head
  const head = new THREE.Group();
  const metalDark = new THREE.MeshStandardMaterial({ color: 0x1b2220, metalness: 0.8, roughness: 0.35 });
  const shroud = new THREE.Mesh(new THREE.BoxGeometry(26, 22, 20), metalDark);
  shroud.position.y = 24;
  const stripe = new THREE.Mesh(new THREE.BoxGeometry(26.4, 2, 20.4), new THREE.MeshBasicMaterial({ color: GREEN }));
  stripe.position.y = 19;
  const block = new THREE.Mesh(new THREE.BoxGeometry(12, 8, 12), new THREE.MeshStandardMaterial({ color: 0x8a9290, metalness: 0.9, roughness: 0.25 }));
  block.position.y = 10;
  const nozzle = new THREE.Mesh(new THREE.ConeGeometry(4, 6, 24), new THREE.MeshStandardMaterial({ color: 0xd4a637, metalness: 1, roughness: 0.25 }));
  nozzle.rotation.x = Math.PI;
  nozzle.position.y = 3;
  const tip = new THREE.Mesh(new THREE.SphereGeometry(1.3, 16, 12), new THREE.MeshBasicMaterial({ color: 0xd8ff8a }));
  const tipLight = new THREE.PointLight(0xa3ff12, 900, 90, 1.8);
  tipLight.position.y = 1;
  head.add(shroud, stripe, block, nozzle, tip, tipLight);
  rig.add(head);

  const gantry = new THREE.Mesh(new THREE.BoxGeometry(PLATE + 60, 5, 6), metalDark);
  rig.add(gantry);

  /* ---------- Sparks from the nozzle ---------- */
  const SPARKS = 70;
  const sparkPos = new Float32Array(SPARKS * 3);
  const sparkVel = new Float32Array(SPARKS * 3);
  const sparkLife = new Float32Array(SPARKS);
  const sparkGeo = new THREE.BufferGeometry();
  sparkGeo.setAttribute('position', new THREE.BufferAttribute(sparkPos, 3));
  const sparks = new THREE.Points(sparkGeo, new THREE.PointsMaterial({
    color: 0xc8ff5a, size: 1.6, transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false,
  }));
  rig.add(sparks);

  /* ---------- Ambient particles ---------- */
  const DUST = 700;
  const dustPos = new Float32Array(DUST * 3);
  for (let i = 0; i < DUST; i++) {
    dustPos[i * 3] = (Math.random() - 0.5) * 900;
    dustPos[i * 3 + 1] = Math.random() * 420 - 60;
    dustPos[i * 3 + 2] = (Math.random() - 0.5) * 700 - 100;
  }
  const dustGeo = new THREE.BufferGeometry();
  dustGeo.setAttribute('position', new THREE.BufferAttribute(dustPos, 3));
  const dust = new THREE.Points(dustGeo, new THREE.PointsMaterial({
    color: 0xa3ff12, size: 1.4, transparent: true, opacity: 0.45, blending: THREE.AdditiveBlending, depthWrite: false, sizeAttenuation: true,
  }));
  scene.add(dust);

  /* ---------- Printable models ---------- */
  const clipPlane = new THREE.Plane(new THREE.Vector3(0, -1, 0), 0);
  const uniforms = { uClipY: { value: 0 }, uGlow: { value: GREEN.clone() } };

  function layerMaterial(color, opts = {}) {
    const m = new THREE.MeshPhysicalMaterial({
      color, metalness: opts.metalness ?? 0.15, roughness: opts.roughness ?? 0.38, clearcoat: 0.5, clearcoatRoughness: 0.3,
      clippingPlanes: [clipPlane], side: THREE.FrontSide, envMapIntensity: 0.9,
    });
    m.onBeforeCompile = (shader) => {
      shader.uniforms.uClipY = uniforms.uClipY;
      shader.uniforms.uGlow = uniforms.uGlow;
      shader.vertexShader = shader.vertexShader
        .replace('#include <common>', '#include <common>\nvarying float vWY;')
        .replace('#include <worldpos_vertex>', '#include <worldpos_vertex>\nvWY = (modelMatrix * vec4(transformed, 1.0)).y;');
      shader.fragmentShader = shader.fragmentShader
        .replace('#include <common>', '#include <common>\nuniform float uClipY;\nuniform vec3 uGlow;\nvarying float vWY;')
        .replace('#include <color_fragment>', '#include <color_fragment>\nfloat lay = 0.5 + 0.5 * sin(vWY * 8.0);\ndiffuseColor.rgb *= 0.84 + 0.16 * lay;')
        .replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\nfloat hot = smoothstep(3.0, 0.0, uClipY - vWY);\ntotalEmissiveRadiance += uGlow * hot * 1.4;');
    };
    return m;
  }
  const innerMat = new THREE.MeshBasicMaterial({ color: 0x7fcc10, side: THREE.BackSide, clippingPlanes: [clipPlane] });

  const jobs = [
    { key: 'knot', label: 'KNOT', color: 0x9be22b, opts: { roughness: 0.32 } },
    { key: 'vase', label: 'VASE', color: 0xdfe6e2, opts: { roughness: 0.25, metalness: 0.35 } },
    { key: 'gear', label: 'GEAR', color: 0x22282a, opts: { roughness: 0.45, metalness: 0.5 } },
  ].map((j) => {
    const geo = shapes[j.key]();
    const b = geo.boundingBox;
    const size = new THREE.Vector3(); b.getSize(size);
    const scale = 92 / Math.max(size.x, size.y, size.z);
    const group = new THREE.Group();
    const outer = new THREE.Mesh(geo, layerMaterial(j.color, j.opts));
    const inner = new THREE.Mesh(geo, innerMat);
    group.add(outer, inner);
    group.scale.setScalar(scale);
    group.visible = false;
    rig.add(group);
    return { ...j, group, height: size.y * scale, radius: Math.max(size.x, size.z) * scale * 0.42, mmHeight: size.y };
  });

  /* ---------- HUD ---------- */
  const hud = {
    layer: document.getElementById('hud-layer'), temp: document.getElementById('hud-temp'),
    speed: document.getElementById('hud-speed'), bar: document.getElementById('hud-bar'),
    pct: document.getElementById('hud-pct'), job: document.getElementById('hud-job'),
  };
  let jobCount = 1;
  function updateHUD(job, p) {
    if (!hud.layer) return;
    const total = Math.round(job.mmHeight / 0.2);
    const cur = Math.min(total, Math.floor(p * total));
    hud.layer.textContent = `${String(cur).padStart(3, '0')} / ${String(total).padStart(3, '0')}`;
    hud.bar.style.width = (p * 100).toFixed(1) + '%';
    hud.pct.textContent = Math.floor(p * 100);
  }

  /* ---------- Layout ---------- */
  let layoutX = 0;
  function resize() {
    const w = canvas.clientWidth, h = canvas.clientHeight;
    if (!w || !h) return;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    const wide = w > 1024;
    layoutX = wide ? 44 : 0;
    camBase.set(0, wide ? 125 : 150, wide ? 310 : (w < 640 ? 470 : 400));
    lookAt.set(0, wide ? 48 : 70, 0);
    camera.updateProjectionMatrix();
  }
  window.addEventListener('resize', resize);
  resize();

  /* ---------- Interaction ---------- */
  const pointer = { x: 0, y: 0, tx: 0, ty: 0 };
  window.addEventListener('pointermove', (e) => {
    pointer.tx = (e.clientX / window.innerWidth) * 2 - 1;
    pointer.ty = (e.clientY / window.innerHeight) * 2 - 1;
  }, { passive: true });

  let visible = true;
  new IntersectionObserver(([en]) => { visible = en.isIntersecting; if (visible) loop(); }, { threshold: 0 })
    .observe(document.getElementById('hero'));

  /* ---------- Print state machine ---------- */
  const PRINT = reduced ? 0.01 : 9.5, HOLD = 3.2, UNPRINT = 1.1;
  let jobIdx = 0, phase = 'print', phaseT = 0;
  let job = jobs[0];
  job.group.visible = true;
  if (hud.job) hud.job.textContent = `JOB_${String(jobCount).padStart(4, '0')} · ${job.label}`;

  function emitSpark(x, y, z) {
    for (let i = 0; i < SPARKS; i++) {
      if (sparkLife[i] <= 0) {
        sparkLife[i] = 0.4 + Math.random() * 0.5;
        sparkPos[i * 3] = x; sparkPos[i * 3 + 1] = y; sparkPos[i * 3 + 2] = z;
        const a = Math.random() * Math.PI * 2, s = 15 + Math.random() * 35;
        sparkVel[i * 3] = Math.cos(a) * s; sparkVel[i * 3 + 1] = 10 + Math.random() * 30; sparkVel[i * 3 + 2] = Math.sin(a) * s;
        return;
      }
    }
  }

  const clock = new THREE.Clock();
  let running = false, elapsed = 0;
  function loop() {
    if (running) return;
    running = true;
    clock.getDelta();
    requestAnimationFrame(frame);
  }
  function frame() {
    if (!visible) { running = false; return; }
    const dt = Math.min(clock.getDelta(), 0.05);
    elapsed += dt;
    phaseT += dt;

    // phase progression
    let p;
    if (phase === 'print') {
      p = Math.min(phaseT / PRINT, 1);
      if (p >= 1) { phase = 'hold'; phaseT = 0; }
    } else if (phase === 'hold') {
      p = 1;
      if (phaseT >= HOLD) { phase = 'unprint'; phaseT = 0; }
    } else {
      p = 1 - Math.min(phaseT / UNPRINT, 1);
      if (phaseT >= UNPRINT) {
        job.group.visible = false;
        jobIdx = (jobIdx + 1) % jobs.length;
        job = jobs[jobIdx];
        job.group.visible = true;
        jobCount++;
        if (hud.job) hud.job.textContent = `JOB_${String(jobCount).padStart(4, '0')} · ${job.label}`;
        phase = 'print'; phaseT = 0; p = 0;
      }
    }

    const eased = phase === 'unprint' ? p * p : p;
    const clipY = -0.5 + eased * (job.height + 1.5);
    clipPlane.constant = clipY;
    // fresh-layer glow follows the cut; after printing it drifts off the top and fades
    uniforms.uClipY.value = phase === 'hold' ? job.height + 3 + phaseT * 6 : clipY;
    updateHUD(job, phase === 'unprint' ? 0 : p);

    // print head motion
    const printing = phase === 'print';
    const r = job.radius;
    const t = elapsed * 2.4;
    const hx = printing ? Math.sin(t * 1.7) * r : Math.sin(elapsed * 0.6) * 20;
    const hz = printing ? Math.cos(t * 1.13) * r * 0.85 : -30;
    const targetY = printing ? clipY + 0.6 : job.height + 40;
    head.position.x += (hx - head.position.x) * (printing ? 0.35 : 0.04);
    head.position.z += (hz - head.position.z) * (printing ? 0.35 : 0.04);
    head.position.y += (targetY - head.position.y) * (printing ? 0.5 : 0.05);
    gantry.position.set(0, head.position.y + 24, head.position.z);
    tipLight.intensity = printing ? 700 + Math.random() * 400 : 120;
    tip.material.color.setHex(printing ? 0xd8ff8a : 0x55602f);
    if (printing && Math.random() < 0.7) emitSpark(head.position.x, head.position.y, head.position.z);
    if (hud.temp && Math.random() < 0.08) hud.temp.textContent = `${printing ? 214 + Math.round(Math.random() * 2) : 215}°C`;
    if (hud.speed && Math.random() < 0.05) hud.speed.textContent = `${printing ? 240 + Math.round(Math.random() * 30) : 0} mm/s`;

    // sparks
    for (let i = 0; i < SPARKS; i++) {
      if (sparkLife[i] > 0) {
        sparkLife[i] -= dt;
        sparkVel[i * 3 + 1] -= 120 * dt;
        sparkPos[i * 3] += sparkVel[i * 3] * dt;
        sparkPos[i * 3 + 1] += sparkVel[i * 3 + 1] * dt;
        sparkPos[i * 3 + 2] += sparkVel[i * 3 + 2] * dt;
        if (sparkLife[i] <= 0) sparkPos[i * 3 + 1] = -9999;
      }
    }
    sparkGeo.attributes.position.needsUpdate = true;

    // model / rig motion
    job.group.rotation.y += dt * (phase === 'hold' ? 0.9 : 0.12);
    rig.rotation.y = Math.sin(elapsed * 0.18) * 0.35 - 0.25;
    rig.position.x += (layoutX - rig.position.x) * 0.05;
    glow.material.opacity = 0.6 + Math.sin(elapsed * 3) * 0.15;
    dust.rotation.y = elapsed * 0.012;
    dust.position.y = Math.sin(elapsed * 0.3) * 6;

    // camera parallax
    pointer.x += (pointer.tx - pointer.x) * 0.04;
    pointer.y += (pointer.ty - pointer.y) * 0.04;
    camera.position.set(camBase.x + pointer.x * 30, camBase.y - pointer.y * 18, camBase.z);
    camera.lookAt(lookAt.x + layoutX * 0.15, lookAt.y, lookAt.z);

    renderer.render(scene, camera);
    requestAnimationFrame(frame);
  }

  canvas.style.opacity = '0';
  canvas.style.transition = 'opacity 1.6s ease';
  loop();
  requestAnimationFrame(() => { canvas.style.opacity = '1'; });
})();
