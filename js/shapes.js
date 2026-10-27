/* ==========================================================================
   V3NOM LABZ — Procedural, printable sample models (all units in mm, Y-up)
   Shared by the hero animation, the showcase renders and the quote lab.
   ========================================================================== */
window.V3Shapes = function (THREE, mergeGeometries) {

  function finalize(geo) {
    geo = geo.index ? geo.toNonIndexed() : geo;
    geo.computeVertexNormals();
    geo.computeBoundingBox();
    const b = geo.boundingBox;
    geo.translate(-(b.min.x + b.max.x) / 2, -b.min.y, -(b.min.z + b.max.z) / 2);
    geo.computeBoundingBox();
    geo.computeBoundingSphere();
    return geo;
  }

  function circlePath(x, y, r) {
    const p = new THREE.Path();
    p.absarc(x, y, r, 0, Math.PI * 2, true);
    return p;
  }

  /* Spur gear with bore and lightening holes */
  function gear() {
    const teeth = 18, rRoot = 26, rTip = 31, step = (Math.PI * 2) / teeth;
    const s = new THREE.Shape();
    for (let i = 0; i < teeth; i++) {
      const a = i * step;
      const pts = [
        [rRoot, a], [rRoot, a + step * 0.22], [rTip, a + step * 0.36],
        [rTip, a + step * 0.64], [rRoot, a + step * 0.78],
      ];
      pts.forEach(([r, t], j) => {
        const x = Math.cos(t) * r, y = Math.sin(t) * r;
        (i === 0 && j === 0) ? s.moveTo(x, y) : s.lineTo(x, y);
      });
    }
    s.closePath();
    s.holes.push(circlePath(0, 0, 6));
    for (let i = 0; i < 6; i++) {
      const t = (i / 6) * Math.PI * 2;
      s.holes.push(circlePath(Math.cos(t) * 16.5, Math.sin(t) * 16.5, 4.2));
    }
    const geo = new THREE.ExtrudeGeometry(s, {
      depth: 9, bevelEnabled: true, bevelThickness: 0.8, bevelSize: 0.5, bevelSegments: 2, curveSegments: 20,
    });
    geo.rotateX(-Math.PI / 2);
    return finalize(geo);
  }

  /* Twisted, faceted parametric vase (closed, printable shell) */
  function vase() {
    const H = 120, wall = 2.2, base = 3, N = 70;
    const radius = (y) => {
      const t = y / H;
      return 20 + 13 * Math.sin(t * Math.PI * 1.05) + 4 * Math.sin(t * Math.PI * 3.2) - 6 * t;
    };
    const pts = [new THREE.Vector2(0, 0)];
    for (let i = 0; i <= N; i++) { const y = (i / N) * H; pts.push(new THREE.Vector2(radius(y), y)); }
    for (let i = N; i >= 0; i--) {
      const y = base + (i / N) * (H - base);
      pts.push(new THREE.Vector2(Math.max(radius(y) - wall, 1), y));
    }
    pts.push(new THREE.Vector2(0, base));
    const geo = new THREE.LatheGeometry(pts, 7);
    const p = geo.attributes.position, v = new THREE.Vector3();
    for (let i = 0; i < p.count; i++) {
      v.fromBufferAttribute(p, i);
      const a = (v.y / H) * Math.PI * 0.9;
      const c = Math.cos(a), sn = Math.sin(a);
      p.setXYZ(i, v.x * c - v.z * sn, v.y, v.x * sn + v.z * c);
    }
    return finalize(geo);
  }

  /* Torus knot sculpture */
  function knot() {
    const geo = new THREE.TorusKnotGeometry(26, 8.5, 260, 36, 2, 3);
    return finalize(geo);
  }

  /* Lattice sphere: struts + nodes */
  function lattice() {
    const base = new THREE.IcosahedronGeometry(34, 1);
    const pos = base.attributes.position;
    const keyOf = (x, y, z) => `${x.toFixed(2)},${y.toFixed(2)},${z.toFixed(2)}`;
    const nodes = new Map(), edges = new Map();
    const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3();
    for (let i = 0; i < pos.count; i += 3) {
      a.fromBufferAttribute(pos, i); b.fromBufferAttribute(pos, i + 1); c.fromBufferAttribute(pos, i + 2);
      [[a, b], [b, c], [c, a]].forEach(([p, q]) => {
        const kp = keyOf(p.x, p.y, p.z), kq = keyOf(q.x, q.y, q.z);
        nodes.set(kp, p.clone()); nodes.set(kq, q.clone());
        const k = kp < kq ? kp + '|' + kq : kq + '|' + kp;
        if (!edges.has(k)) edges.set(k, [p.clone(), q.clone()]);
      });
    }
    const parts = [];
    const up = new THREE.Vector3(0, 1, 0);
    edges.forEach(([p, q]) => {
      const dir = new THREE.Vector3().subVectors(q, p);
      const len = dir.length();
      const cyl = new THREE.CylinderGeometry(1.8, 1.8, len, 10, 1);
      const quat = new THREE.Quaternion().setFromUnitVectors(up, dir.normalize());
      cyl.applyQuaternion(quat);
      const mid = new THREE.Vector3().addVectors(p, q).multiplyScalar(0.5);
      cyl.translate(mid.x, mid.y, mid.z);
      parts.push(cyl);
    });
    nodes.forEach((n) => {
      const s = new THREE.SphereGeometry(3.4, 14, 10);
      s.translate(n.x, n.y, n.z);
      parts.push(s);
    });
    parts.forEach((g) => { g.deleteAttribute('uv'); });
    const geo = mergeGeometries(parts.map((g) => g.toNonIndexed()));
    return finalize(geo);
  }

  /* Chess pawn miniature */
  function pawn() {
    const prof = [
      [0, 0], [17, 0], [17, 3.5], [15.5, 5], [15.5, 7.5], [13, 9], [11, 10.5],
      [9.5, 13], [8.2, 18], [7.2, 24], [6.6, 29], [10.5, 30.5], [11, 32.5], [7, 34], [6, 35.5],
    ];
    const cy = 43.5, r = 8.6;
    const startA = Math.asin((35.5 - cy) / r);
    for (let i = 0; i <= 18; i++) {
      const t = startA + (i / 18) * (Math.PI / 2 - startA);
      prof.push([Math.cos(t) * r, cy + Math.sin(t) * r]);
    }
    prof[prof.length - 1][0] = 0;
    const geo = new THREE.LatheGeometry(prof.map(([x, y]) => new THREE.Vector2(x, y)), 64);
    return finalize(geo);
  }

  /* L-bracket with mounting holes and gussets */
  function bracket() {
    const roundRect = (w, h, r) => {
      const s = new THREE.Shape(), x = -w / 2, y = -h / 2;
      s.moveTo(x + r, y); s.lineTo(x + w - r, y); s.quadraticCurveTo(x + w, y, x + w, y + r);
      s.lineTo(x + w, y + h - r); s.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
      s.lineTo(x + r, y + h); s.quadraticCurveTo(x, y + h, x, y + h - r);
      s.lineTo(x, y + r); s.quadraticCurveTo(x, y, x + r, y);
      return s;
    };
    const T = 5;
    const base = roundRect(80, 50, 6);
    [[-30, -14], [30, -14], [-30, 12], [30, 12]].forEach(([x, y]) => base.holes.push(circlePath(x, y, 3.2)));
    const slot = new THREE.Path();
    slot.moveTo(-10, -3); slot.lineTo(10, -3); slot.absarc(10, 0, 3, -Math.PI / 2, Math.PI / 2, false);
    slot.lineTo(-10, 3); slot.absarc(-10, 0, 3, Math.PI / 2, Math.PI * 1.5, false);
    base.holes.push(slot);
    const g1 = new THREE.ExtrudeGeometry(base, { depth: T, bevelEnabled: false, curveSegments: 16 });
    g1.rotateX(-Math.PI / 2);

    const wall = roundRect(80, 46, 6);
    [[-24, 6], [24, 6]].forEach(([x, y]) => wall.holes.push(circlePath(x, y, 3.2)));
    wall.holes.push(circlePath(0, 6, 8));
    const g2 = new THREE.ExtrudeGeometry(wall, { depth: T, bevelEnabled: false, curveSegments: 16 });
    g2.translate(0, 23 - 0.01, -25);

    const gus = new THREE.Shape();
    gus.moveTo(0, 0); gus.lineTo(20, 0); gus.lineTo(0, 26); gus.closePath();
    const mk = (x) => {
      const g = new THREE.ExtrudeGeometry(gus, { depth: 4, bevelEnabled: false });
      g.rotateY(-Math.PI / 2);
      g.translate(x + 2, T - 0.01, -20);
      return g;
    };
    const parts = [g1, g2, mk(-38), mk(38)];
    parts.forEach((g) => g.deleteAttribute('uv'));
    return finalize(mergeGeometries(parts));
  }

  return {
    gear, vase, knot, lattice, pawn, bracket,
    meta: {
      gear: { name: 'Spur gear', material: 'petg' },
      vase: { name: 'Twisted vase', material: 'pla' },
      knot: { name: 'Torus knot sculpture', material: 'resin' },
      lattice: { name: 'Lattice sphere', material: 'pacf' },
      pawn: { name: 'Chess pawn', material: 'tough' },
      bracket: { name: 'L-bracket', material: 'asa' },
    },
  };
};
