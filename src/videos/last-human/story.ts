// Timeline of the Last Human short: shots timed to the voice words (last-human/voice/words.json)
// ~60.3s = 1808 frames @ 30fps
// Camera grammar: continuous slow push-ins; symmetric ease-in-out moves ~23f (10 in / 10 out),
// peak ~15 px/f at 720p; big reframes are hard cuts; impacts are 7-frame kicks that flip sign every frame.
// No hand-held float. DOF on ~1/3 of shots (CU, MS, inserts). Establishing/wide shots stay sharp.

export const FPS = 30;
export const TOTAL = 1808;
export type V3 = [number, number, number];

export const clamp01 = (x: number) => Math.max(0, Math.min(1, x));
export const smooth = (x: number) => { const u = clamp01(x); return u * u * (3 - 2 * u); };
export const easeOut = (u: number) => 1 - (1 - clamp01(u)) ** 4;
const lin = (pts: [number, number][], x: number) => {
  if (x <= pts[0][0]) return pts[0][1];
  for (let i = 1; i < pts.length; i++) if (x <= pts[i][0]) {
    const [x0, y0] = pts[i - 1], [x1, y1] = pts[i];
    return y0 + ((y1 - y0) * (x - x0)) / (x1 - x0);
  }
  return pts[pts.length - 1][1];
};

// ---------------- story time (tau = seconds of narration) ----------------
export const tau = (f: number) => f / FPS;

// ---------------- shots ----------------
export type Light = "day" | "golden" | "night" | "overcast";
export type Crowd = "none" | "cars" | "dogs" | "wolves" | "nature";
export type ShotDef = { id: number; a: number; b: number; light: Light; crowd: Crowd };
export const SHOTS: ShotDef[] = [
  { id: 1, a: 0,    b: 90,   light: "day",     crowd: "none"    }, // 0.00-3.00s  Hook: wide empty city
  { id: 2, a: 90,   b: 120,  light: "day",     crowd: "none"    }, // 3.00-4.00s  Protagonist reveal
  { id: 3, a: 120,  b: 240,  light: "day",     crowd: "cars"    }, // 4.00-8.00s  Paradise montage (mansion, supercar)
  { id: 4, a: 240,  b: 392,  light: "day",     crowd: "cars"    }, // 8.00-13.07s Driving Lamborghini
  { id: 5, a: 392,  b: 416,  light: "day",     crowd: "none"    }, // 13.07-13.87s "It's perfect"
  { id: 6, a: 416,  b: 468,  light: "day",     crowd: "none"    }, // 13.87-15.60s Silence gets heavy
  { id: 7, a: 468,  b: 498,  light: "night",   crowd: "none"    }, // 15.60-16.60s Lights go out
  { id: 8, a: 498,  b: 607,  light: "night",   crowd: "none"    }, // 16.60-20.23s Power plant shutdown
  { id: 9, a: 607,  b: 664,  light: "night",   crowd: "none"    }, // 20.23-22.13s Taps run dry
  { id: 10, a: 664, b: 759,  light: "overcast", crowd: "none"   }, // 22.13-25.30s Collecting rainwater
  { id: 11, a: 759, b: 873,  light: "day",     crowd: "nature"  }, // 25.30-29.10s Analogy: city as garden
  { id: 12, a: 873, b: 999,  light: "day",     crowd: "nature"  }, // 29.10-33.30s Maintenance montage
  { id: 13, a: 999, b: 1092, light: "golden",  crowd: "nature"  }, // 33.30-36.40s Nature takes it back
  { id: 14, a: 1092,b: 1252, light: "golden",  crowd: "dogs"    }, // 36.40-41.73s Years later: grass, dogs, vines
  { id: 15, a: 1252,b: 1316, light: "day",     crowd: "nature"  }, // 41.73-43.87s Ten years later: NYC ruins
  { id: 16, a: 1316,b: 1420, light: "day",     crowd: "nature"  }, // 43.87-47.33s Trees, rusted cars
  { id: 17, a: 1420,b: 1502, light: "day",     crowd: "none"    }, // 47.33-50.07s Supermarket growl
  { id: 18, a: 1502,b: 1575, light: "day",     crowd: "wolves"  }, // 50.07-52.50s Turn around, see wolves
  { id: 19, a: 1575,b: TOTAL, light: "golden",  crowd: "wolves"  }, // 52.50-60.27s Final: city belongs to them
];

/** Crossfades (frames) at place/time changes; white 4-frame flash after hook */
export const XFADE: Record<number, number> = {
  2: 6, 3: 8, 4: 8, 5: 6, 6: 6, 7: 8, 8: 8, 9: 6, 10: 8, 11: 8, 12: 8, 13: 8, 14: 8, 15: 8, 16: 8, 17: 6, 18: 6
};
export const FLASH_AT = 90; // frame 90 = 3.0s after "Imagine every human..."

export const shotAt = (f: number) => SHOTS.find((s) => f >= s.a && f < s.b) ?? SHOTS[SHOTS.length - 1];

/** layers to draw at frame f: base shot, plus the next shot fading in during a crossfade */
export const layersAt = (f: number): { id: number; alpha: number }[] => {
  for (const s of SHOTS) {
    const x = XFADE[s.id];
    if (x && f >= s.a - x / 2 && f < s.a + x / 2) return [
      { id: s.id - 1, alpha: 1 },
      { id: s.id, alpha: (f - (s.a - x / 2) + 1) / (x + 1) }
    ];
  }
  return [{ id: shotAt(f).id, alpha: 1 }];
};

// ---------------- camera ----------------
// Grammar: symmetric smootherstep glide 18-40f; big reframes (>~half frame or 40% zoom) = hard cut.
// Glides centred on key frame (whoosh peaks there). Holds push in 0.15-0.35%/f, punch 0.6%/f on emphasis.
// Rolls 4-8 deg over >=18f on beats, held tilt <= 0.07 rad.

export type Cam = { pos: V3; look: V3; fov: number; roll: number };
type ShotCam = Partial<Cam> & { pos: V3; look: V3 };
type Key = { f: number; dur?: number; cut?: boolean; s: (f: number) => ShotCam };

export const glide = (u: number) => { const x = clamp01(u); return x * x * x * (x * (6 * x - 15) + 10); };
const mix = (a: Cam, b: Cam, k: number): Cam => ({
  pos: a.pos.map((v, i) => v + (b.pos[i] - v) * k) as V3,
  look: a.look.map((v, i) => v + (b.look[i] - v) * k) as V3,
  fov: a.fov + (b.fov - a.fov) * k, roll: a.roll + (b.roll - a.roll) * k,
});
const full = (c: ShotCam): Cam => ({ fov: 40, roll: 0, ...c });
const run = (keys: Key[], f: number) => {
  let cur = full(keys[0].s(f));
  for (let i = 1; i < keys.length; i++) {
    const k = keys[i];
    if (f < k.f) break;
    cur = k.cut ? full(k.s(f)) : mix(cur, full(k.s(f)), glide((f - k.f) / (k.dur ?? 24)));
  }
  return cur;
};
const T = (f: number) => f / FPS;

/** push-in factor since f0: subject grows ~rate per frame; `punch` raises it for first n frames */
const pushK = (f: number, f0: number, rate: number, punch = 0, n = 35) => {
  const x = Math.max(0, f - f0);
  let s = rate * x;
  if (punch > rate) for (let i = 0; i < Math.min(x, n); i++) s += (punch - rate) * Math.max(0, Math.min(1, (i + 0.5) / 8, (n - i - 0.5) / 8));
  return Math.exp(-s);
};
const dolly = (pos: V3, look: V3, k: number, rest: Partial<Cam> = {}): ShotCam =>
  ({ pos: [look[0] + (pos[0] - look[0]) * k, look[1] + (pos[1] - look[1]) * k, look[2] + (pos[2] - look[2]) * k], look, ...rest });
const zoom = (pos: V3, look: V3, fov: number, k: number, rest: Partial<Cam> = {}): ShotCam =>
  ({ pos, look, fov: (360 / Math.PI) * Math.atan(Math.tan((fov * Math.PI) / 360) * k), ...rest });
const rolled = (s: (f: number) => ShotCam, roll: number) => (f: number): ShotCam => ({ ...s(f), roll });

// ---- Shot-specific camera framings ----

// Shot 1: Hook - wide empty city street, slow push in
const S1a = (f: number) => dolly([0, 8, -40], [0, 2, 20], pushK(f, 0, 0.002), { fov: 48 });

// Shot 2: Protagonist CU - eye level, slight roll
const S2a = (f: number) => dolly([1.5, 1.7, 3], [0, 1.65, 5], pushK(f, 90, 0.0025), { fov: 34, roll: -0.035 });

// Shot 3: Paradise montage - mansion exterior -> supercar CU
const S3a = (f: number) => dolly([12, 6, -15], [0, 4, 5], pushK(f, 120, 0.0018), { fov: 44 });
const S3b = (f: number) => dolly([0.8, 1.2, 1.5], [0.5, 1.1, 3], pushK(f, 180, 0.0025), { fov: 32 });

// Shot 4: Driving sequence - dashboard POV -> wide road -> car exterior
const S4a = (f: number) => dolly([0, 1.3, 0.5], [0, 1.2, 40], pushK(f, 240, 0.0015), { fov: 50 });
const S4b = (f: number) => dolly([4, 2, -8], [0, 1.2, 30], pushK(f, 300, 0.0015), { fov: 42, roll: 0.02 });
const S4c = (f: number) => dolly([-3, 1.5, -5], [0, 1.3, 15], pushK(f, 350, 0.002), { fov: 38 });

// Shot 5: "It's perfect" - relaxed drive, slight roll
const S5a = (f: number) => dolly([0, 1.3, -4], [0, 1.2, 20], pushK(f, 392, 0.0015, 0.004, 30), { fov: 40, roll: 0.03 });

// Shot 6: Silence gets heavy - slow push on protagonist face, mood shift
const S6a = (f: number) => dolly([1.2, 1.65, 3], [0, 1.6, 5], pushK(f, 416, 0.002), { fov: 34, roll: -0.02 });

// Shot 7: Lights go out - wide city, sudden cut to darkness
const S7a = (f: number) => dolly([0, 10, -30], [0, 3, 15], pushK(f, 468, 0.0025), { fov: 46 });
const S7b = (f: number) => dolly([0, 1.7, 3], [0, 1.6, 5], pushK(f, 480, 0.003), { fov: 36 });

// Shot 8: Power plant - industrial interior, cooling towers
const S8a = (f: number) => dolly([0, 5, -25], [0, 4, 10], pushK(f, 498, 0.0018), { fov: 44 });
const S8b = (f: number) => dolly([2, 3, -5], [0, 2.5, 5], pushK(f, 550, 0.002), { fov: 38 });

// Shot 9: Taps run dry - bathroom CU
const S9a = (f: number) => dolly([0.5, 1.3, 0.8], [0.3, 1.2, 1.5], pushK(f, 607, 0.003), { fov: 30 });

// Shot 10: Collecting rainwater - balcony/rooftop, overcast
const S10a = (f: number) => dolly([0, 1.6, -2], [0, 1.4, 3], pushK(f, 664, 0.002), { fov: 38, roll: -0.02 });
const S10b = (f: number) => dolly([0.3, 1.2, 0.6], [0, 1.1, 1.2], pushK(f, 700, 0.003), { fov: 32 });

// Shot 11: Analogy - city as garden (visual metaphor)
const S11a = (f: number) => dolly([8, 6, -12], [0, 2, 8], pushK(f, 759, 0.0015), { fov: 42 });
const S11b = (f: number) => dolly([0, 1.5, -3], [0, 1.3, 4], pushK(f, 810, 0.002), { fov: 38 });

// Shot 12: Maintenance montage - pipes, roads, weeding
const S12a = (f: number) => dolly([0, 1.4, -4], [0, 1.2, 5], pushK(f, 873, 0.002), { fov: 40 });
const S12b = (f: number) => dolly([3, 1.5, -2], [0, 1.3, 4], pushK(f, 930, 0.002), { fov: 38 });

// Shot 13: Nature takes it back - time lapse feel, golden hour
const S13a = (f: number) => dolly([0, 3, -10], [0, 1.5, 8], pushK(f, 999, 0.0012), { fov: 44 });
const S13b = (f: number) => dolly([2, 1.8, -4], [0, 1.4, 6], pushK(f, 1040, 0.0018), { fov: 40, roll: 0.03 });

// Shot 14: Years later - grass, dogs, vines on buildings
const S14a = (f: number) => dolly([0, 1.7, -15], [0, 1.3, 10], pushK(f, 1092, 0.0015), { fov: 46 });
const S14b = (f: number) => dolly([4, 1.5, -5], [0, 1.2, 5], pushK(f, 1150, 0.002), { fov: 38 });
const S14c = (f: number) => dolly([0, 6, -20], [0, 3, 5], pushK(f, 1200, 0.0015), { fov: 44 });

// Shot 15: Ten years later - NYC ruins, protagonist walking
const S15a = (f: number) => dolly([0, 1.8, -12], [0, 1.6, 8], pushK(f, 1252, 0.0018), { fov: 42 });
const S15b = (f: number) => dolly([2, 1.6, -4], [0, 1.5, 6], pushK(f, 1280, 0.002), { fov: 38 });

// Shot 16: Nature details - trees through sidewalk, rusted cars
const S16a = (f: number) => dolly([0, 1.4, -3], [0, 1.2, 4], pushK(f, 1316, 0.0025), { fov: 36 });
const S16b = (f: number) => dolly([0, 1.3, -5], [0, 1.1, 3], pushK(f, 1360, 0.002), { fov: 34, roll: -0.03 });

// Shot 17: Supermarket growl - tension, low angle
const S17a = (f: number) => dolly([0, 1.5, -8], [0, 1.4, 4], pushK(f, 1420, 0.0015), { fov: 40 });
const S17b = (f: number) => dolly([0, 1.6, -2], [0, 1.5, 2], pushK(f, 1460, 0.0025), { fov: 36, roll: 0.04 });

// Shot 18: Turn around, see wolves - protagonist POV -> wolves
const S18a = (f: number) => dolly([0, 1.65, -1], [0, 1.6, 3], pushK(f, 1502, 0.003, 0.006, 25), { fov: 34 });
const S18b = (f: number) => dolly([0, 1.2, 5], [0, 1.0, 8], pushK(f, 1530, 0.0025), { fov: 38 });

// Shot 19: Final - wolves own the city, golden hour pull back
const S19a = (f: number) => dolly([0, 1.2, 4], [0, 1.0, 7], pushK(f, 1575, 0.0015), { fov: 40 });
const S19b = (f: number) => dolly([0, 4, 0], [0, 2, 15], pushK(f, 1650, 0.001), { fov: 46 });
const S19c = (f: number) => dolly([0, 8, 20], [0, 3, 30], pushK(f, 1720, 0.0008), { fov: 50 });

const CAMS: Record<number, Key[]> = {
  1: [{ f: 0, s: S1a }],
  2: [{ f: 90, s: S2a }],
  3: [
    { f: 120, s: S3a },
    { f: 180, cut: true, s: S3b },
  ],
  4: [
    { f: 240, s: S4a },
    { f: 300, cut: true, s: S4b },
    { f: 350, cut: true, s: S4c },
  ],
  5: [{ f: 392, s: S5a }],
  6: [{ f: 416, s: S6a }],
  7: [
    { f: 468, s: S7a },
    { f: 480, cut: true, s: S7b },
  ],
  8: [
    { f: 498, s: S8a },
    { f: 550, dur: 24, s: S8b },
  ],
  9: [{ f: 607, s: S9a }],
  10: [
    { f: 664, s: S10a },
    { f: 700, dur: 20, s: S10b },
  ],
  11: [
    { f: 759, s: S11a },
    { f: 810, dur: 24, s: S11b },
  ],
  12: [
    { f: 873, s: S12a },
    { f: 930, dur: 24, s: S12b },
  ],
  13: [
    { f: 999, s: S13a },
    { f: 1040, dur: 28, s: S13b },
  ],
  14: [
    { f: 1092, s: S14a },
    { f: 1150, dur: 24, s: S14b },
    { f: 1200, dur: 28, s: S14c },
  ],
  15: [
    { f: 1252, s: S15a },
    { f: 1280, dur: 28, s: S15b },
  ],
  16: [
    { f: 1316, s: S16a },
    { f: 1360, dur: 24, s: S16b },
  ],
  17: [
    { f: 1420, s: S17a },
    { f: 1460, dur: 20, s: S17b },
  ],
  18: [
    { f: 1502, s: S18a },
    { f: 1530, dur: 24, s: S18b },
  ],
  19: [
    { f: 1575, s: S19a },
    { f: 1650, dur: 40, s: S19b },
    { f: 1720, dur: 50, s: S19c },
  ],
};

// impact kicks: image offset flips sign every frame, decays to 0 in 7f
const KICKS: [number, number][] = [
  [15.60, 1.2], // lights go out
  [16.60, 0.8], // power plant slam
  [22.13, 0.6], // tap runs dry
  [47.33, 0.5], // growl heard
  [50.07, 1.0], // turn around / wolves
];
export const kickAt = (t: number) => {
  let a = 0;
  for (const [t0, g] of KICKS) {
    const n = Math.floor((t - t0) * FPS + 1e-6);
    if (n >= 0 && n < 7) a += g * (n % 2 ? -1 : 1) * (1 - n / 7) ** 1.5;
  }
  return a;
};
export const camAt = (id: number, f: number): Cam => {
  const c = run(CAMS[id], f), a = kickAt(T(f));
  if (!a) return c;
  const d: V3 = [c.look[0] - c.pos[0], c.look[1] - c.pos[1], c.look[2] - c.pos[2]];
  const L = Math.hypot(...d), h = Math.hypot(d[0], d[2]) || 1;
  const m = (3 / 640) * Math.tan((c.fov * Math.PI) / 360) * L * a;
  return { ...c, look: [c.look[0] - (d[2] / h) * m, c.look[1] + 0.6 * m, c.look[2] + (d[0] / h) * m], roll: c.roll + a * 0.004 };
};

export const keyEnd = (id: number, f: number) => {
  let e = 0;
  for (const k of CAMS[id]) if (f >= k.f) e = k.f + (k.cut ? 0 : k.dur ?? 24);
  return Math.max(f, e);
};

// ---------------- lens: depth of field + foreground framing ----------------
export type Dof = { f: number; dur?: number; cInf: number; focus?: (f: number) => V3 };
const eyes = (y: number) => (f: number): V3 => [0, y, 0];
const boots = (y: number) => (f: number): V3 => [0, y - 1.3, 0];

export const DOF: Dof[] = [
  { f: 0,    cInf: 0 },        // Shot 1: wide city, sharp
  { f: 90,   cInf: 14, focus: eyes(1.65) }, // Shot 2: protagonist CU
  { f: 120,  cInf: 8 },       // Shot 3a: mansion wide
  { f: 180,  cInf: 16, focus: eyes(1.1) }, // Shot 3b: supercar CU
  { f: 240,  cInf: 0 },       // Shot 4: driving wide
  { f: 392,  cInf: 12, focus: eyes(1.3) }, // Shot 5: "perfect" MS
  { f: 416,  cInf: 10, focus: eyes(1.6) }, // Shot 6: silence face
  { f: 468,  cInf: 0 },       // Shot 7: city blackout
  { f: 498,  cInf: 6 },       // Shot 8: power plant
  { f: 607,  cInf: 18, focus: eyes(1.2) }, // Shot 9: tap CU
  { f: 664,  cInf: 5 },       // Shot 10: rainwater wide
  { f: 759,  cInf: 7 },       // Shot 11: garden analogy
  { f: 873,  cInf: 0 },       // Shot 12: maintenance wide
  { f: 999,  cInf: 6 },       // Shot 13: nature golden
  { f: 1092, cInf: 5 },       // Shot 14: years later
  { f: 1252, cInf: 12, focus: eyes(1.6) }, // Shot 15: NYC protagonist
  { f: 1316, cInf: 14, focus: eyes(1.2) }, // Shot 16: trees/cars CU
  { f: 1420, cInf: 10 },      // Shot 17: supermarket tension
  { f: 1502, cInf: 16, focus: eyes(1.0) }, // Shot 18: wolves CU
  { f: 1575, cInf: 5 },       // Shot 19: final pull back
];
export const dofAt = (f: number) => {
  let i = 0; while (i + 1 < DOF.length && f >= DOF[i + 1].f) i++;
  const d = DOF[i], p = DOF[Math.max(0, i - 1)];
  const k = d.dur ? Math.min(1, (f - d.f) / d.dur) : 1;
  return { cInf: p.cInf + (d.cInf - p.cInf) * k, focus: d.focus };
};
export const focusAt = (id: number, f: number): V3 => {
  const d = dofAt(f);
  return d.focus ? d.focus(f) : camAt(id, f).look;
};

// near framing objects: visible while a <= f < b
export type Fg = { a: number; b: number; kit: string; pos: V3; s?: number; yaw?: number };
export const FOREGROUND: Fg[] = [
  // Shot 10: rainwater collection - bucket in foreground
  { a: 664, b: 759, kit: "bucket", pos: [-1.5, 0, 2], s: 0.4, yaw: 0.3 },
  // Shot 14: overgrown street - bush in foreground
  { a: 1092, b: 1252, kit: "plant_bushDetailed", pos: [-3, 0, -5], s: 1.2, yaw: 0.5 },
  // Shot 16: rusted car - car frame in foreground
  { a: 1316, b: 1420, kit: "car", pos: [2, 0, -3], s: 1.0, yaw: 0.2 },
  // Shot 17: supermarket - shopping cart
  { a: 1420, b: 1502, kit: "cart", pos: [-2, 0, -4], s: 0.9, yaw: -0.3 },
  // Shot 18/19: wolves - grass tufts
  { a: 1502, b: 1575, kit: "plant_grass", pos: [-1.5, 0, 1.5], s: 0.5, yaw: 0 },
  { a: 1575, b: TOTAL, kit: "plant_grass", pos: [1.5, 0, 2], s: 0.5, yaw: 0.2 },
];