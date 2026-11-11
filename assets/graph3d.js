/* CORE Graph — geo-anchored 3D knowledge graph (three.js) */
import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { CSS2DRenderer, CSS2DObject } from "three/addons/renderers/CSS2DRenderer.js";

const GD = window.CORE_GRAPH, D = window.CORE_DATA || {}, GEO = window.CORE_GEO || {};
const stage = document.getElementById("graph3d");
const LANG = () => document.documentElement.lang;
const UZ = window.CORE_UZ || {};
const T = (en, r) => (LANG() === "en" ? en : LANG() === "uz" ? (UZ[r] != null ? UZ[r] : r) : r);
const TOPIC_RU = window.CORE_TOPIC_RU || {};
const topicName = (s) => T(s, TOPIC_RU[s] || s);
const UNI_NAMES = {};
((window.CORE_DATA || {}).unis || []).forEach((u) => { UNI_NAMES[u[0]] = u; });
const uniName = (id, fallback) => {
  const u = UNI_NAMES[id]; if (!u) return fallback;
  const lang = LANG(), ru = u[8], nat = u[9], cyr = /[А-Яа-яЁё]/;
  if (lang === "ru") return ru || (nat && cyr.test(nat) ? nat : "") || u[1];
  if (lang === "uz") return (u[2] === "UZ" && nat && !cyr.test(nat) ? nat : "") || ru || nat || u[1];
  return u[1] || fallback;
};
const nf = (n) => Number(n).toLocaleString(LANG() === "en" ? "en-US" : "ru-RU");

function webglOK() {
  try { const c = document.createElement("canvas"); return !!(window.WebGLRenderingContext && (c.getContext("webgl2") || c.getContext("webgl"))); } catch (e) { return false; }
}
if (!stage || !GD || !webglOK()) {
  document.documentElement.classList.add("no-webgl");
} else {
  init();
}

function init() {
  document.documentElement.classList.add("has-webgl");
  /* ---------- projection ---------- */
  const LON0 = 67, LAT0 = 45.3, K = Math.cos((LAT0 * Math.PI) / 180), S = 2.35;
  const P = (lon, lat, y = 0) => new THREE.Vector3((lon - LON0) * K * S, y, -(lat - LAT0) * S);

  /* ---------- renderer / scene ---------- */
  const W = () => stage.clientWidth, H = () => stage.clientHeight;
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(W(), H());
  stage.appendChild(renderer.domElement);
  const labels = new CSS2DRenderer();
  labels.setSize(W(), H());
  labels.domElement.className = "g3-labels";
  stage.appendChild(labels.domElement);

  const scene = new THREE.Scene();
  scene.fog = new THREE.Fog(0x07090c, 120, 260);
  const camera = new THREE.PerspectiveCamera(42, W() / H(), 0.1, 1000);
  const mobile = W() < 640;
  camera.position.set(0, mobile ? 64 : 50, mobile ? 96 : 96);
  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true; controls.dampingFactor = 0.07;
  controls.autoRotate = true; controls.autoRotateSpeed = 0.35;
  controls.minDistance = 30; controls.maxDistance = 230;
  controls.maxPolarAngle = Math.PI * 0.47;
  controls.target.set(0, 13, 4);
  controls.enableZoom = false; // page scroll stays page scroll; zoom via buttons / fullscreen
  const tex = dotTexture();

  /* ---------- layer groups ---------- */
  const L = {};
  ["land", "places", "knowledge", "collab", "datasets", "world"].forEach((k) => { L[k] = new THREE.Group(); scene.add(L[k]); });

  /* ---------- land: outlines + dot matrix ---------- */
  const polys = {};
  Object.entries(GEO).forEach(([c, rings]) => {
    polys[c] = rings;
    rings.forEach((ring) => {
      const pts = ring.map(([lon, lat]) => P(lon, lat, 0));
      const g = new THREE.BufferGeometry().setFromPoints(pts);
      const live = c !== "TM";
      L.land.add(new THREE.LineLoop(g, new THREE.LineBasicMaterial({ color: live ? 0x3ddbc1 : 0x5d6875, transparent: true, opacity: live ? 0.55 : 0.25 })));
    });
  });
  const inPoly = (lon, lat, ring) => {
    let ins = false;
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
      const [xi, yi] = ring[i], [xj, yj] = ring[j];
      if (yi > lat !== yj > lat && lon < ((xj - xi) * (lat - yi)) / (yj - yi) + xi) ins = !ins;
    }
    return ins;
  };
  const dots = [];
  for (let lat = 35.2; lat < 55.6; lat += 0.42) {
    for (let lon = 46.6; lon < 87.4; lon += 0.42 / K) {
      for (const c in polys) {
        if (polys[c].some((r) => inPoly(lon, lat, r))) { const v = P(lon, lat, 0); dots.push(v.x, 0, v.z); break; }
      }
    }
  }
  L.land.add(points(dots, 0x8a95a3, 0.45, 0.32));

  /* ---------- places: universities (pillars) + medical facilities ---------- */
  const uniById = {}, uniPick = [];
  const pillarPos = [];
  const uniPts = [], uniSizes = [];
  GD.unis.forEach((u) => {
    const [id, name, c, lat, lon, city, w, prec] = u;
    const h = 1.2 + Math.log10(1 + w) * 3.2;
    const base = P(lon, lat, 0), top = P(lon, lat, h);
    pillarPos.push(base.x, 0, base.z, top.x, h, top.z);
    uniPts.push(top.x, h, top.z);
    uniById[id] = { id, name, c, city, w, prec, top, base, topics: [], partners: 0, ds: 0, world: [] };
    uniPick.push(uniById[id]);
  });
  const pillars = new THREE.LineSegments(geom(pillarPos), new THREE.LineBasicMaterial({ color: 0x3ddbc1, transparent: true, opacity: 0.45, blending: THREE.AdditiveBlending }));
  L.places.add(pillars);
  const uniCloud = points(uniPts, 0x9ff5e6, 2.1, 0.95, tex);
  L.places.add(uniCloud);
  const med = [];
  (D.med || []).forEach((m) => { const v = P(m[1], m[0], 0.15); med.push(v.x, 0.15, v.z); });
  L.places.add(points(med, 0xf5a524, 0.55, 0.8, tex));

  /* ---------- knowledge: topic nodes floating above ---------- */
  const DOM = { "Social Sciences": 0x3ddbc1, "Physical Sciences": 0x9b8cff, "Life Sciences": 0x7bd88f, "Health Sciences": 0xe86a8d };
  const topicById = {};
  const acc = {};
  GD.uniTopic.forEach(([u, s, n]) => {
    const U = uniById[u]; if (!U) return;
    (acc[s] = acc[s] || { x: 0, z: 0, w: 0 });
    acc[s].x += U.base.x * n; acc[s].z += U.base.z * n; acc[s].w += n;
    U.topics.push([s, n]);
  });
  const maxT = Math.max(...GD.topics.map((t) => t[1]));
  GD.topics.forEach(([s, n, field, dom], i) => {
    const a = acc[s];
    const ang = i * 2.399963; // golden angle spread
    const rad = 9 + Math.sqrt(i + 1) * 4.6;
    let x = Math.cos(ang) * rad, z = Math.sin(ang) * rad * 0.7;
    if (a && a.w) { x = x * 0.9 + (a.x / a.w) * 0.35; z = z * 0.9 + (a.z / a.w) * 0.35; }
    const y = 20 + (i % 6) * 3.6 + (dom === "Physical Sciences" ? 4 : dom === "Health Sciences" ? -2 : 0);
    const size = 2.2 + 6 * Math.sqrt(n / maxT);
    const col = DOM[dom] || 0xffffff;
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, color: col, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
    sp.position.set(x, y, z); sp.scale.setScalar(size);
    sp.userData = { kind: "topic", s, n, field, dom };
    L.knowledge.add(sp);
    topicById[s] = { s, n, field, dom, pos: sp.position, sprite: sp, unis: [] };
    if (i < (mobile ? 4 : 8)) {
      const div = document.createElement("div"); div.className = "g3-label g3-topic"; div.dataset.topic = s; div.textContent = topicName(s);
      const lab = new CSS2DObject(div); lab.position.set(0, 0.9, 0); sp.add(lab);
      topicById[s].label = div;
    }
  });
  const tl = [], tlCol = [];
  GD.uniTopic.forEach(([u, s, n]) => {
    const U = uniById[u], Tn = topicById[s]; if (!U || !Tn) return;
    Tn.unis.push(u);
    tl.push(U.top.x, U.top.y, U.top.z, Tn.pos.x, Tn.pos.y, Tn.pos.z);
    const c = new THREE.Color(DOM[Tn.dom] || 0xffffff);
    tlCol.push(c.r * 0.6, c.g * 0.6, c.b * 0.6, c.r, c.g, c.b);
  });
  const topicLinks = new THREE.LineSegments(geom(tl, tlCol), new THREE.LineBasicMaterial({ vertexColors: true, transparent: true, opacity: 0.22, blending: THREE.AdditiveBlending, depthWrite: false }));
  L.knowledge.add(topicLinks);

  /* ---------- collaboration: arcs + flowing particles ---------- */
  const arcs = [];
  const arcPos = [];
  const maxCo = Math.max(...GD.co.map((c) => c[2]));
  GD.co.forEach(([a, b, n]) => {
    const A = uniById[a], B = uniById[b]; if (!A || !B) return;
    A.partners++; B.partners++;
    const d = A.base.distanceTo(B.base);
    if (d < 0.6) return;
    const mid = A.base.clone().add(B.base).multiplyScalar(0.5); mid.y = 2 + d * 0.32;
    const curve = new THREE.QuadraticBezierCurve3(A.top, mid, B.top);
    const pts = curve.getPoints(28);
    for (let i = 0; i < pts.length - 1; i++) arcPos.push(pts[i].x, pts[i].y, pts[i].z, pts[i + 1].x, pts[i + 1].y, pts[i + 1].z);
    arcs.push({ curve, n, a, b, t: Math.random(), speed: 0.0025 + 0.004 * (n / maxCo) });
  });
  const arcLines = new THREE.LineSegments(geom(arcPos), new THREE.LineBasicMaterial({ color: 0x9b8cff, transparent: true, opacity: 0.18, blending: THREE.AdditiveBlending, depthWrite: false }));
  L.collab.add(arcLines);
  const flow = arcs.filter((a, i) => i < 220);
  const flowGeo = new THREE.BufferGeometry();
  flowGeo.setAttribute("position", new THREE.Float32BufferAttribute(new Float32Array(flow.length * 3), 3));
  const flowPts = new THREE.Points(flowGeo, new THREE.PointsMaterial({ color: 0xd9d2ff, size: 1.3, map: tex, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
  L.collab.add(flowPts);

  /* ---------- datasets: satellites around their university ---------- */
  const dsPos = [], dsLines = [];
  const dsCount = {};
  GD.datasets.forEach(([u]) => { dsCount[u] = (dsCount[u] || 0) + 1; });
  const seen = {};
  GD.datasets.forEach(([u, title, field]) => {
    const U = uniById[u]; if (!U) return;
    U.ds++;
    const k = (seen[u] = (seen[u] || 0) + 1), tot = dsCount[u];
    const ang = (k / tot) * Math.PI * 2, r = 1.4 + Math.sqrt(tot) * 0.55;
    const x = U.top.x + Math.cos(ang) * r, z = U.top.z + Math.sin(ang) * r, y = U.top.y + 2.2 + (k % 3) * 0.7;
    dsPos.push(x, y, z);
    dsLines.push(U.top.x, U.top.y, U.top.z, x, y, z);
  });
  L.datasets.add(points(dsPos, 0xffffff, 0.9, 0.95, tex));
  L.datasets.add(new THREE.LineSegments(geom(dsLines), new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.16, depthWrite: false })));

  /* ---------- world: partner countries on a horizon ring ---------- */
  const CC = { RU: [37.6, 55.7, "Russia", "Россия"], CN: [116.4, 39.9, "China", "Китай"], US: [-77, 38.9, "USA", "США"], IN: [77.2, 28.6, "India", "Индия"], TR: [32.9, 39.9, "Türkiye", "Турция"], SA: [46.7, 24.7, "Saudi Arabia", "Сауд. Аравия"], UA: [30.5, 50.4, "Ukraine", "Украина"], DE: [13.4, 52.5, "Germany", "Германия"], PK: [73, 33.7, "Pakistan", "Пакистан"], GB: [-0.1, 51.5, "UK", "Великобритания"], KR: [127, 37.5, "Korea", "Корея"], JP: [139.7, 35.7, "Japan", "Япония"], IT: [12.5, 41.9, "Italy", "Италия"], PL: [21, 52.2, "Poland", "Польша"], FR: [2.35, 48.85, "France", "Франция"], MY: [101.7, 3.1, "Malaysia", "Малайзия"], IR: [51.4, 35.7, "Iran", "Иран"], ES: [-3.7, 40.4, "Spain", "Испания"], AU: [149.1, -35.3, "Australia", "Австралия"], CZ: [14.4, 50.1, "Czechia", "Чехия"] };
  const bearing = (lon, lat) => { // initial bearing from Tashkent
    const f1 = (41.3 * Math.PI) / 180, f2 = (lat * Math.PI) / 180, dl = ((lon - 69.24) * Math.PI) / 180;
    return Math.atan2(Math.sin(dl) * Math.cos(f2), Math.cos(f1) * Math.sin(f2) - Math.sin(f1) * Math.cos(f2) * Math.cos(dl));
  };
  const worldNode = {}, maxW = Math.max(...GD.world.map((w) => w[1]));
  const ringR = 78;
  GD.world.forEach(([cc, n]) => {
    const meta = CC[cc]; if (!meta) return;
    const b = bearing(meta[0], meta[1]);
    const pos = new THREE.Vector3(Math.sin(b) * ringR, 10, -Math.cos(b) * ringR);
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, color: 0xf5c46b, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
    sp.position.copy(pos); sp.scale.setScalar(2.5 + 5 * Math.sqrt(n / maxW));
    L.world.add(sp);
    const div = document.createElement("div"); div.className = "g3-label g3-country"; div.dataset.en = meta[2]; div.dataset.ru = meta[3];
    div.textContent = T(meta[2], meta[3]);
    const lab = new CSS2DObject(div); lab.position.set(0, 0.8, 0); sp.add(lab);
    worldNode[cc] = { pos, div };
  });
  const wl = [];
  GD.uniWorld.forEach(([u, cc, n]) => {
    const U = uniById[u], Wn = worldNode[cc]; if (!U || !Wn) return;
    U.world.push([cc, n]);
    const mid = U.top.clone().lerp(Wn.pos, 0.5); mid.y += 16;
    const pts = new THREE.QuadraticBezierCurve3(U.top, mid, Wn.pos).getPoints(24);
    for (let i = 0; i < pts.length - 1; i++) wl.push(pts[i].x, pts[i].y, pts[i].z, pts[i + 1].x, pts[i + 1].y, pts[i + 1].z);
  });
  L.world.add(new THREE.LineSegments(geom(wl), new THREE.LineBasicMaterial({ color: 0xf5a524, transparent: true, opacity: 0.14, blending: THREE.AdditiveBlending, depthWrite: false })));

  /* ---------- country labels on the land ---------- */
  [["KZ", 67.5, 48.3, "Kazakhstan", "Казахстан"], ["UZ", 62.6, 42.2, "Uzbekistan", "Узбекистан"], ["TM", 58.4, 39.2, "Turkmenistan", "Туркменистан"], ["KG", 75.2, 41.6, "Kyrgyzstan", "Кыргызстан"], ["TJ", 71.6, 38.6, "Tajikistan", "Таджикистан"]].forEach(([c, lon, lat, en, r]) => {
    const div = document.createElement("div"); div.className = "g3-label g3-land"; div.dataset.en = en; div.dataset.ru = r;
    div.textContent = T(en, r);
    const o = new CSS2DObject(div); o.position.copy(P(lon, lat, 0.5)); L.land.add(o);
  });

  /* ---------- highlight layer (selected university) ---------- */
  const hl = new THREE.Group(); scene.add(hl);
  const panel = document.getElementById("g3Panel");
  const tip = document.getElementById("g3Tip");
  let selected = null;
  function select(U) {
    hl.clear(); selected = U;
    const dim = !!U;
    topicLinks.material.opacity = dim ? 0.05 : 0.22;
    arcLines.material.opacity = dim ? 0.05 : 0.18;
    if (!U) { panel.hidden = true; return; }
    const seg = [];
    U.topics.forEach(([s]) => { const Tn = topicById[s]; if (Tn) seg.push(U.top.x, U.top.y, U.top.z, Tn.pos.x, Tn.pos.y, Tn.pos.z); });
    hl.add(new THREE.LineSegments(geom(seg), new THREE.LineBasicMaterial({ color: 0x3ddbc1, transparent: true, opacity: 0.95 })));
    const arcSeg = [];
    arcs.forEach((a) => { if (a.a === U.id || a.b === U.id) { const p = a.curve.getPoints(28); for (let i = 0; i < p.length - 1; i++) arcSeg.push(p[i].x, p[i].y, p[i].z, p[i + 1].x, p[i + 1].y, p[i + 1].z); } });
    hl.add(new THREE.LineSegments(geom(arcSeg), new THREE.LineBasicMaterial({ color: 0xc9bfff, transparent: true, opacity: 0.9 })));
    const ring = new THREE.Mesh(new THREE.RingGeometry(1.6, 2.1, 40), new THREE.MeshBasicMaterial({ color: 0x3ddbc1, side: THREE.DoubleSide, transparent: true, opacity: 0.9 }));
    ring.rotation.x = -Math.PI / 2; ring.position.copy(U.base).setY(0.2); hl.add(ring);
    renderPanel();
    controls.autoRotate = false;
  }
  function renderPanel() {
    const U = selected; if (!U) return;
    const topT = U.topics.slice(0, 4).map(([s, n]) => `<li><i style="background:#${(DOM[topicById[s]?.dom] || 0xffffff).toString(16).padStart(6, "0")}"></i>${topicName(s)}<b>${nf(n)}</b></li>`).join("");
    const coN = arcs.filter((a) => a.a === U.id || a.b === U.id).length;
    panel.innerHTML = `<button class="g3-x" aria-label="close">×</button>
      <span class="mono small" style="color:var(--teal)">${U.id}</span>
      <h4>${uniName(U.id, U.name)}</h4><p class="small muted">${U.city}${U.prec ? "" : " · " + T("location: city", "местоположение: город")}</p>
      <div class="g3-kpi"><div><b>${nf(U.w)}</b><span>${T("works", "работ")}</span></div><div><b>${coN}</b><span>${T("strong CA links", "сильных связей в ЦА")}</span></div><div><b>${U.ds}</b><span>${T("open datasets by scholars", "открытых наборов учёных")}</span></div></div>
      ${topT ? `<p class="small muted" style="margin-top:12px">${T("Strongest research areas", "Сильные направления")}</p><ul class="g3-topics">${topT}</ul>` : ""}`;
    panel.hidden = false;
    panel.querySelector(".g3-x").onclick = () => select(null);
  }

  /* ---------- picking ---------- */
  const ray = new THREE.Raycaster(); ray.params.Points.threshold = 1.2;
  const mouse = new THREE.Vector2();
  let downAt = null;
  function pick(ev) {
    const r = renderer.domElement.getBoundingClientRect();
    mouse.set(((ev.clientX - r.left) / r.width) * 2 - 1, -((ev.clientY - r.top) / r.height) * 2 + 1);
    ray.setFromCamera(mouse, camera);
    if (L.places.visible) { const h = ray.intersectObject(uniCloud)[0]; if (h) return { kind: "uni", U: uniPick[h.index], x: ev.clientX - r.left, y: ev.clientY - r.top }; }
    if (L.knowledge.visible) { const h = ray.intersectObjects(L.knowledge.children.filter((o) => o.isSprite))[0]; if (h) return { kind: "topic", t: h.object.userData, x: ev.clientX - r.left, y: ev.clientY - r.top }; }
    return null;
  }
  renderer.domElement.addEventListener("pointermove", (ev) => {
    const p = pick(ev);
    renderer.domElement.style.cursor = p ? "pointer" : "grab";
    if (!p) { tip.hidden = true; return; }
    tip.innerHTML = p.kind === "uni"
      ? `<b>${uniName(p.U.id, p.U.name)}</b>${p.U.city}${p.U.prec ? "" : " (" + T("location: city", "местоположение: город") + ")"} · <span class="mono">${p.U.id}</span><br>${nf(p.U.w)} ${T("works", "работ")} · ${T("click to explore", "нажмите, чтобы открыть")}`
      : `<b>${topicName(p.t.s)}</b>${topicName(p.t.field)} · ${nf(p.t.n)} ${T("works", "работ")}`;
    tip.style.left = Math.min(p.x + 14, W() - 240) + "px"; tip.style.top = p.y + 14 + "px"; tip.hidden = false;
  });
  let rotateWanted = true;
  renderer.domElement.addEventListener("pointerenter", (ev) => { if (ev.pointerType === "mouse") { rotateWanted = controls.autoRotate; controls.autoRotate = false; } });
  renderer.domElement.addEventListener("pointerleave", (ev) => { tip.hidden = true; if (ev.pointerType === "mouse" && !selected && rotateWanted && !reduce) controls.autoRotate = true; });
  renderer.domElement.addEventListener("pointerdown", (ev) => { downAt = [ev.clientX, ev.clientY]; controls.autoRotate = false; });
  renderer.domElement.addEventListener("pointerup", (ev) => {
    if (!downAt || Math.hypot(ev.clientX - downAt[0], ev.clientY - downAt[1]) > 5) return;
    const p = pick(ev);
    if (p && p.kind === "uni") select(p.U); else if (!p) select(null);
  });

  /* ---------- layer toggles & story ---------- */
  const order = ["places", "knowledge", "collab", "datasets", "world"];
  const btns = Array.from(document.querySelectorAll("[data-g3layer]"));
  function setLayers(on) {
    order.forEach((k) => { L[k].visible = on.includes(k); });
    btns.forEach((b) => b.classList.toggle("on", on.includes(b.dataset.g3layer)));
  }
  btns.forEach((b) => b.addEventListener("click", () => {
    const k = b.dataset.g3layer; L[k].visible = !L[k].visible; b.classList.toggle("on", L[k].visible); stopStory(); emphasize("all");
  }));
  const CAMS = {
    places: [new THREE.Vector3(10, 62, 70), new THREE.Vector3(4, 0, 6)],
    knowledge: [new THREE.Vector3(-30, 58, 84), new THREE.Vector3(0, 18, 0)],
    collab: [new THREE.Vector3(26, 30, 46), new THREE.Vector3(2, 4, 8)],
    datasets: [new THREE.Vector3(18, 26, 40), new THREE.Vector3(4, 6, 8)],
    world: [new THREE.Vector3(0, 120, 150), new THREE.Vector3(0, 6, 0)],
  };
  let fly = null;
  function flyTo(k) {
    const [pos, tgt] = CAMS[k];
    const p = mobile ? pos.clone().multiplyScalar(1.05) : pos;
    fly = { p0: camera.position.clone(), t0: controls.target.clone(), p1: p, t1: tgt, s: performance.now(), d: 1800 };
  }
  const cap = document.getElementById("g3Caption");
  const steps = Array.from(document.querySelectorAll("[data-g3step]"));
  let storyTimer = null, stepIdx = 0;
  function goStep(i) {
    stepIdx = i;
    const k = order[i];
    setLayers(order.slice(0, i + 1));
    emphasize(k);
    flyTo(k);
    steps.forEach((s, j) => s.classList.toggle("on", j === i));
    if (cap) cap.dataset.step = k;
  }
  // the current story layer is bright, earlier layers step back
  function emphasize(k) {
    const all = k === "all" || k === "world";
    topicLinks.material.opacity = all ? 0.22 : k === "knowledge" ? 0.4 : 0.05;
    arcLines.material.opacity = all ? 0.18 : k === "collab" ? 0.7 : 0.08;
    flowPts.material.opacity = k === "collab" || all ? 1 : 0.3;
    L.knowledge.children.forEach((o) => { if (o.isSprite) o.material.opacity = all || k === "knowledge" ? 1 : 0.35; });
  }
  function stopStory() { clearInterval(storyTimer); storyTimer = null; document.getElementById("g3Play")?.classList.remove("on"); }
  function playStory() {
    stopStory(); goStep(0);
    document.getElementById("g3Play")?.classList.add("on");
    storyTimer = setInterval(() => { if (stepIdx >= order.length - 1) { stopStory(); controls.autoRotate = true; return; } goStep(stepIdx + 1); }, 4200);
  }
  steps.forEach((s, i) => s.addEventListener("click", () => { stopStory(); goStep(i); }));
  document.getElementById("g3Play")?.addEventListener("click", () => (storyTimer ? stopStory() : playStory()));
  document.getElementById("g3Zoom")?.addEventListener("click", () => {
    const full = stage.closest(".g3").classList.toggle("full");
    document.body.classList.toggle("g3-lock", full);
    controls.enableZoom = full;
    setTimeout(resize, 30);
  });
  document.addEventListener("keydown", (e) => { if (e.key === "Escape" && stage.closest(".g3").classList.contains("full")) document.getElementById("g3Zoom").click(); });

  /* ---------- language refresh ---------- */
  window.addEventListener("core:lang", () => {
    stage.querySelectorAll(".g3-label[data-en]").forEach((d) => { d.textContent = T(d.dataset.en, d.dataset.ru); });
    stage.querySelectorAll(".g3-label[data-topic]").forEach((d) => { d.textContent = topicName(d.dataset.topic); });
    renderPanel();
  });

  /* ---------- loop (pauses off-screen) ---------- */
  let visible = true;
  new IntersectionObserver((e) => { visible = e[0].isIntersecting; }, { threshold: 0.02 }).observe(stage);
  function resize() {
    camera.aspect = W() / H(); camera.updateProjectionMatrix();
    renderer.setSize(W(), H()); labels.setSize(W(), H());
  }
  window.addEventListener("resize", resize);
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (reduce) controls.autoRotate = false;
  const fpos = flowGeo.attributes.position;
  const clock = new THREE.Clock();
  function tick() {
    requestAnimationFrame(tick);
    if (!visible) return;
    const t = clock.getElapsedTime();
    if (fly) {
      const k = Math.min(1, (performance.now() - fly.s) / fly.d), e = k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2;
      camera.position.lerpVectors(fly.p0, fly.p1, e); controls.target.lerpVectors(fly.t0, fly.t1, e);
      if (k >= 1) fly = null;
    }
    if (L.collab.visible && !reduce) {
      flow.forEach((a, i) => { a.t = (a.t + a.speed) % 1; const p = a.curve.getPoint(a.t); fpos.setXYZ(i, p.x, p.y, p.z); });
      fpos.needsUpdate = true;
    }
    L.knowledge.children.forEach((o, i) => { if (o.isSprite) o.position.y += Math.sin(t * 0.6 + i) * 0.006; });
    controls.update();
    renderer.render(scene, camera);
    labels.render(scene, camera);
  }
  goStep(order.length - 1);
  camera.position.set(0, mobile ? 64 : 50, mobile ? 96 : 96); fly = null;
  tick();
  stage.classList.add("ready");
  // deep link: ?uni=UNI-UZ-0138 opens that university's subgraph (handy for partner meetings)
  const deep = new URLSearchParams(location.search).get("uni");
  if (deep && uniById[deep]) {
    const U = uniById[deep];
    select(U);
    fly = { p0: camera.position.clone(), t0: controls.target.clone(), p1: U.top.clone().add(new THREE.Vector3(14, 22, 30)), t1: U.top.clone().setY(10), s: performance.now(), d: 2200 };
  }

  /* ---------- helpers ---------- */
  function geom(pos, col) {
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
    if (col) g.setAttribute("color", new THREE.Float32BufferAttribute(col, 3));
    return g;
  }
  function points(pos, color, size, opacity, map) {
    return new THREE.Points(geom(pos), new THREE.PointsMaterial({ color, size, map: map || null, transparent: true, opacity, depthWrite: false, blending: map ? THREE.AdditiveBlending : THREE.NormalBlending, sizeAttenuation: true }));
  }
  function dotTexture() {
    const c = document.createElement("canvas"); c.width = c.height = 64;
    const x = c.getContext("2d"), g = x.createRadialGradient(32, 32, 0, 32, 32, 32);
    g.addColorStop(0, "rgba(255,255,255,1)"); g.addColorStop(0.25, "rgba(255,255,255,.85)"); g.addColorStop(0.55, "rgba(255,255,255,.18)"); g.addColorStop(1, "rgba(255,255,255,0)");
    x.fillStyle = g; x.fillRect(0, 0, 64, 64);
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
  }
}
