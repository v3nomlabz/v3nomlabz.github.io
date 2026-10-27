/* ==========================================================================
   V3NOM LABZ — Showcase: real-time renders of printable models
   ========================================================================== */
(function () {
  'use strict';
  const grid = document.getElementById('showcase-grid');
  if (!grid) return;

  // Clicking a piece loads it into the quote lab
  grid.addEventListener('click', (e) => {
    const card = e.target.closest('[data-shape]');
    if (!card) return;
    document.dispatchEvent(new CustomEvent('v3:sample', { detail: card.dataset.shape }));
    window.V3UI.scrollTo('#quote');
  });

  const LOOKS = {
    gear: { color: '#7fd10f', metalness: 0.15, roughness: 0.45, layers: true, rot: [0.95, 0.4, 0] },
    vase: { color: '#e9eeec', metalness: 0.55, roughness: 0.22, layers: true, rot: [0.18, 0.5, 0] },
    knot: { color: '#9aa6b0', metalness: 0.2, roughness: 0.18, layers: false, rot: [0.3, 0.6, 0] },
    lattice: { color: '#30373a', metalness: 0.5, roughness: 0.5, layers: true, rot: [0.3, 0.3, 0] },
    pawn: { color: '#c9a227', metalness: 0.75, roughness: 0.25, layers: false, rot: [0.12, 0, 0] },
    bracket: { color: '#8d99ae', metalness: 0.15, roughness: 0.5, layers: true, rot: [0.45, -0.7, 0] },
  };

  let started = false;
  const io = new IntersectionObserver(([en]) => {
    if (en.isIntersecting && !started) { started = true; io.disconnect(); render(); }
  }, { rootMargin: '700px 0px' });
  io.observe(grid);

  async function render() {
    let THREE, mergeGeometries, RoomEnvironment;
    try {
      THREE = await import('three');
      ({ mergeGeometries } = await import('three/addons/utils/BufferGeometryUtils.js'));
      ({ RoomEnvironment } = await import('three/addons/environments/RoomEnvironment.js'));
    } catch (err) { console.warn('[V3nom] showcase renders unavailable', err); return; }

    const shapes = window.V3Shapes(THREE, mergeGeometries);
    const W = 800, H = 680;
    let renderer;
    try { renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true }); }
    catch (err) { return; }
    renderer.setSize(W, H, false);
    renderer.setPixelRatio(1);
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.outputColorSpace = THREE.SRGBColorSpace;

    const scene = new THREE.Scene();
    const pmrem = new THREE.PMREMGenerator(renderer);
    scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    scene.add(new THREE.HemisphereLight(0xe8fff0, 0x050706, 0.5));
    const keyL = new THREE.DirectionalLight(0xffffff, 2.2); keyL.position.set(-200, 300, 250); scene.add(keyL);
    const rimL = new THREE.DirectionalLight(0xa3ff12, 2.4); rimL.position.set(250, 120, -260); scene.add(rimL);
    const fillL = new THREE.DirectionalLight(0x00f0b5, 0.6); fillL.position.set(300, -50, 200); scene.add(fillL);

    // soft contact shadow + glow under each model
    const blob = (inner, outer) => {
      const c = document.createElement('canvas'); c.width = c.height = 256;
      const g = c.getContext('2d');
      const grd = g.createRadialGradient(128, 128, 0, 128, 128, 128);
      grd.addColorStop(0, inner); grd.addColorStop(1, outer);
      g.fillStyle = grd; g.fillRect(0, 0, 256, 256);
      const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
    };
    const glow = new THREE.Mesh(new THREE.PlaneGeometry(1, 1),
      new THREE.MeshBasicMaterial({ map: blob('rgba(163,255,18,0.35)', 'rgba(163,255,18,0)'), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
    glow.rotation.x = -Math.PI / 2;
    const shadow = new THREE.Mesh(new THREE.PlaneGeometry(1, 1),
      new THREE.MeshBasicMaterial({ map: blob('rgba(0,0,0,0.75)', 'rgba(0,0,0,0)'), transparent: true, depthWrite: false }));
    shadow.rotation.x = -Math.PI / 2;
    scene.add(glow, shadow);

    const camera = new THREE.PerspectiveCamera(30, W / H, 1, 5000);

    const imgs = Array.from(grid.querySelectorAll('img[data-render]'));
    for (const img of imgs) {
      const k = img.dataset.render;
      const look = LOOKS[k];
      const geo = shapes[k]();
      const mat = new THREE.MeshPhysicalMaterial({
        color: look.color, metalness: look.metalness, roughness: look.roughness, clearcoat: 0.4, clearcoatRoughness: 0.3,
      });
      if (look.layers) {
        mat.onBeforeCompile = (sh) => {
          sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying float vY;')
            .replace('#include <begin_vertex>', '#include <begin_vertex>\nvY = position.y;');
          sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nvarying float vY;')
            .replace('#include <color_fragment>', '#include <color_fragment>\ndiffuseColor.rgb *= 0.86 + 0.14 * (0.5 + 0.5 * sin(vY * 10.0));');
        };
      }
      const mesh = new THREE.Mesh(geo, mat);
      const size = new THREE.Vector3(); geo.boundingBox.getSize(size);
      const pivot = new THREE.Group();
      mesh.position.y = -size.y / 2;
      pivot.add(mesh);
      pivot.rotation.set(look.rot[0], look.rot[1], look.rot[2]);
      scene.add(pivot);

      const box = new THREE.Box3().setFromObject(pivot);
      const sphere = box.getBoundingSphere(new THREE.Sphere());
      const floorY = box.min.y - 1;
      glow.position.set(sphere.center.x, floorY, sphere.center.z);
      shadow.position.set(sphere.center.x, floorY + 0.1, sphere.center.z);
      glow.scale.setScalar(sphere.radius * 3.2);
      shadow.scale.setScalar(sphere.radius * 2.2);

      const dist = sphere.radius / Math.sin(THREE.MathUtils.degToRad(camera.fov / 2)) * 0.8;
      camera.position.set(sphere.center.x + dist * 0.55, sphere.center.y + dist * 0.42, sphere.center.z + dist * 0.72);
      camera.lookAt(sphere.center);

      renderer.render(scene, camera);
      img.src = renderer.domElement.toDataURL('image/png');
      img.onload = () => img.classList.add('is-ready');

      scene.remove(pivot);
      geo.dispose(); mat.dispose();
      await new Promise((r) => requestAnimationFrame(r));
    }
    renderer.dispose();
    renderer.forceContextLoss();
  }
})();
