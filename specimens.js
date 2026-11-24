const TAU = Math.PI * 2;
const mix = (a, b, t) => a + (b - a) * t;

export const specimens = [
  ["flower", "Anatomy of a Bloom", "Flower", ["#7d3556","#ec9db9","#ffe6d2"], 1],
  ["tree", "Evergreen Wishes", "Christmas Tree", ["#225e49","#83c299","#ffe3a0"], 2],
  ["galaxy", "A Spiral of Stars", "Galaxy", ["#38336b","#8ca5ff","#ffe2c7"], 3],
  ["heart", "The Shape of Feeling", "Heart", ["#752949","#f784a0","#ffd1bd"], 1],
  ["snow", "The Geometry of Frost", "Snowflake", ["#456586","#a1d4ef","#f1fff9"], 0],
  ["saturn", "A Quiet Orbit", "Saturn", ["#765965","#e3ae94","#fff0bb"], 3],
  ["butterfly", "A Flutter in the Dark", "Butterfly", ["#624681","#b597e8","#ffe4b9"], 4],
  ["dna", "The Double Helix", "DNA", ["#326b60","#6ddcc2","#ffe3a0"], 0],
  ["jelly", "The Drifting Bell", "Jellyfish", ["#453166","#8fb7f4","#f9d2f0"], 5],
  ["hole", "Event Horizon", "Black Hole", ["#514575","#ff9866","#fff0ba"], 3],
  ["aurora", "The Northern Curtain", "Aurora", ["#5c4c9a","#6addb7","#cbf3df"], 6],
  ["fireworks", "After the Spark", "Fireworks", ["#9f466c","#ffac70","#fff0c9"], 7],
  ["ocean", "A Study in Tides", "Ocean Wave", ["#214e69","#56b9bc","#d5f5e6"], 6],
  ["torus", "Continuous Orbit", "Torus", ["#415763","#91b9d3","#f2f2dc"], 3],
  ["phoenix", "Feathers of Ember", "Phoenix", ["#7c263b","#f18354","#ffe8ae"], 4],
  ["dragon", "The Cloud Dragon", "Chinese Dragon", ["#30604e","#8ebc88","#ffcb84"], 8],
  ["lotus", "Still Water Lotus", "Lotus", ["#7e4766","#eeb4c7","#fff0c7"], 1],
  ["sphere", "The Spherical Field", "Sphere", ["#455167","#a6b7d2","#f5ecdc"], 0],
  ["cube", "Volume of Light", "Cube", ["#466775","#8eabbf","#f4e8ce"], 0],
].map(([id, title, name, colors, animation]) => ({id, title, name, colors, animation}));

export const morphs = ["Original", "Sphere", "Disc", "Hollow cube", "Solid cube", "Free spread"];
export const sceneById = new Map(specimens.map(scene => [scene.id, scene]));

function rng(seed) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let n = Math.imul(seed ^ seed >>> 15, seed | 1);
    n ^= n + Math.imul(n ^ n >>> 7, n | 61);
    return ((n ^ n >>> 14) >>> 0) / 4294967296;
  };
}

function artwork(id, random, i, out) {
  const u = random(), v = random(), w = random();
  const a = v * TAU, b = w * TAU, fuzz = (random() - .5) * .07;
  const cos = Math.cos, sin = Math.sin, sqrt = Math.sqrt;
  let x = 0, y = 0, z = 0, c = .45 + (random() - .5) * .21;
  let r, t, k, side;
  switch (id) {
    case "flower":
    case "lotus": {
      const lotus = id === "lotus";
      if (u < .14) {
        r = sqrt(v) * (lotus ? .37 : .32);
        x = r * cos(b); y = r * sin(b); z = .3 + fuzz; c = .87 + w * .13;
      } else {
        k = i % (lotus ? 9 : 7);
        t = w; r = .18 + t * (lotus ? .99 : 1.05);
        const angle = TAU * k / (lotus ? 9 : 7) + (v - .5) * .84 * sin(Math.PI * t) + .28;
        x = r * cos(angle); y = r * sin(angle) * (lotus ? .72 : 1);
        z = (lotus ? .46 : .35) * sin(t * Math.PI) - t * .18 + fuzz + (lotus ? y * .28 : 0);
        c = .15 + t * .58 + v * .12;
      }
      break;
    }
    case "tree":
      if (u < .045) {
        k = Math.floor(v * 10); r = (k % 2 ? .085 : .22) * sqrt(w); t = k * TAU / 10;
        x = r * sin(t); y = 1.19 + r * cos(t); z = fuzz; c = 1;
      } else if (u < .10) {
        x = (v - .5) * .25; y = -.97 - .33 * w; z = fuzz * 2; c = .32;
      } else {
        k = i % 4; t = w; r = (.07 + t * .27) * (1 + k * .49);
        y = .99 - k * .3 - t * (.57 + k * .15);
        x = r * cos(a); z = r * sin(a);
        if (u > .81) { x *= 1.05; z *= 1.05; c = .88 + v * .12; }
        else c = .14 + t * .43 + v * .19;
      }
      break;
    case "galaxy":
    case "hole":
      r = id === "hole" ? .25 + sqrt(u) * .99 : .04 + Math.pow(u, .72) * 1.3;
      t = (i % (id === "hole" ? 4 : 3)) * TAU / (id === "hole" ? 4 : 3) + r * 4 + (v - .5) * (.45 + r * .4);
      x = r * cos(t); y = r * sin(t) * .56 + fuzz * (1 + r); z = r * sin(t) * .65 + fuzz;
      if (id === "hole" && u < .12) { r = .23 + v * .07; x = r * cos(b); y = r * sin(b); z = .12 + fuzz; }
      c = .18 + (1 - u) * .65 + w * .13;
      break;
    case "heart":
      r = .35 + sqrt(u) * .65;
      x = .076 * 16 * sin(a) ** 3 * r;
      y = .076 * (13 * cos(a) - 5 * cos(2 * a) - 2 * cos(3 * a) - cos(4 * a) + 2) * r;
      z = (w - .5) * (.15 + (1 - r) * .92); c = .26 + v * .39 + (1 - r) * .4;
      break;
    case "snow":
      t = i % 6 * TAU / 6; r = .06 + v * 1.17;
      k = u < .52 ? 0 : .08 + Math.floor(v * 5) * .22;
      if (k) { r = k + w * .22; x = (u < .76 ? -1 : 1) * w * (.12 + k * .22); }
      y = r * cos(t) - x * sin(t); x = r * sin(t) + x * cos(t); z = fuzz * 2;
      c = .28 + v * .43 + w * .23;
      break;
    case "saturn":
      if (u < .57) {
        r = .64 * (.84 + w * .16); t = 2 * v - 1; z = r * sqrt(1 - t * t) * sin(b);
        x = r * sqrt(1 - t * t) * cos(b); y = r * t; c = .30 + .56 * (.5 + .5 * sin(23 * y + 1.2 * z));
      } else {
        r = .82 + Math.floor(w * 4) * .15 + v * .10; t = a + w;
        x = r * cos(t); y = r * (.20 * cos(t) + .32 * sin(t)); z = r * sin(t) * .72; c = .57 + w * .32;
      }
      break;
    case "butterfly":
    case "phoenix": {
      const phoenix = id === "phoenix"; side = i % 2 ? -1 : 1;
      if (u < .12) {
        x = fuzz * (phoenix ? 2 : 1); y = -.81 + v * 1.59; z = fuzz * 2; c = .8;
        if (phoenix && u < .07) { x = fuzz + .28 * sin(b) * w; y = -.2 - 1.04 * w; z = fuzz; }
      } else {
        t = v; r = sqrt(w);
        x = side * (.08 + r * (phoenix ? 1.27 + .14 * t : 1.07 + .15 * sin(t * 7)));
        y = (t - .52) * (phoenix ? .95 : 1.52) * r + (phoenix ? .62 * r : -.13 * r);
        z = r * .25 + fuzz; c = .20 + .36 * r + .32 * Math.abs(sin(r * 14 + t * 5));
      }
      break;
    }
    case "dna":
      y = (v - .5) * 2.43; t = y * 5 + .35;
      r = u < .70 ? (i % 2 ? -.44 : .44) : (w - .5) * .84;
      if (u >= .70) { y = Math.round(y * 8) / 8; t = y * 5 + .35; }
      x = r * cos(t) + fuzz; z = r * sin(t) + fuzz; c = r < 0 ? .28 + v * .26 : .64 + v * .29;
      break;
    case "jelly":
      if (u < .47) {
        t = v * Math.PI * .53; r = .83 * sin(t);
        x = r * cos(b); z = r * sin(b); y = .25 + .77 * cos(t); c = .43 + .47 * v;
      } else {
        t = i % 13 * TAU / 13; r = (.23 + .50 * (i % 5) / 4) * (1 - v * .37);
        x = r * cos(t) + .09 * sin(v * 12 + t); z = r * sin(t) + fuzz;
        y = .35 - v * (1.45 + .11 * (i % 4)); c = .18 + (1 - v) * .48;
      }
      break;
    case "aurora":
      x = (v - .5) * 2.72; t = i % 4; z = (t - 1.5) * .28 + fuzz;
      y = .60 * sin(x * 2 + t * .55) + .14 * sin(x * 5) + (w - .42) * (.85 + u * .17);
      c = .13 + .77 * (1 - w);
      break;
    case "fireworks": {
      const centers = [[-.68,.22,.05],[.59,.39,-.18],[.05,-.32,.22]];
      k = i % 3; t = (i % 53) / 53 * TAU; r = Math.pow(v,.65) * (.59 + k * .02);
      x = centers[k][0] + r * cos(t) + fuzz; y = centers[k][1] + r * sin(t) - r * r * .22;
      z = centers[k][2] + (u - .5) * r; c = .29 + .69 * (1 - .52 * r) * w;
      if (u < .032) { x = centers[k][0] + fuzz * .45; y = mix(-1.3,centers[k][1],v); c = .79; }
      break;
    }
    case "ocean":
      x = (v - .5) * 2.87; z = (w - .5) * 1.42;
      t = x * 1.9 + z * 1.25; y = .56 * sin(t) + .15 * sin(t * 2.15) + fuzz;
      if (u > .86) { y += .16 * w; z += .18 * w; }
      c = .14 + .72 * (.50 + .50 * sin(t));
      break;
    case "torus":
      r = .82 + .32 * cos(b); x = r * cos(a); y = r * sin(a) * .80 - .24 * sin(b); z = .34 * sin(b) + y * .32;
      c = .33 + .61 * (.5 + .5 * cos(b));
      break;
    case "dragon":
      t = v; x = -1.21 + 2.36 * t; y = .46 * sin(t * 2.28 * Math.PI - .8) + .42 * t; z = .38 * cos(t * 2.4 * Math.PI);
      r = .045 + .145 * sin(Math.PI * t) + .15 * t ** 7;
      y += r * cos(b); z += r * sin(b); x += r * fuzz;
      c = .34 + .33 * u + t * .24;
      if (u > .81 && t > .76) { x = .96 + .32 * t + r * cos(b); y += .56 * w; z += .21 * sin(b); c = .9; }
      if (u < .10 && t > .18 && t < .72) { y -= .60 * w; x -= .22 * w; z += (i % 2 ? -1 : 1) * .38 * w; c = .72; }
      break;
    case "sphere":
      t = 2 * v - 1; r = 1.01 * (.86 + .14 * u); x = r * sqrt(1 - t * t) * cos(b);
      y = r * t; z = r * sqrt(1 - t * t) * sin(b); c = .31 + .59 * w;
      break;
    case "cube":
      x = 1.68 * (u - .5); y = 1.68 * (v - .5); z = 1.68 * (w - .5);
      t = i % 2 ? .84 : -.84;
      if (i % 3 === 0) x = t; else if (i % 3 === 1) y = t; else z = t;
      c = .34 + .55 * u;
      break;
  }
  out[0] = x; out[1] = y; out[2] = z; out[3] = Math.min(1, Math.max(0, c));
}

export function makeTargets(id, count, morph = 0) {
  const values = new Float32Array(count * 4);
  const r = rng(18219), out = new Float32Array(4), alternate = rng(41712);
  for (let i = 0; i < count; i++) {
    artwork(id, r, i, out);
    let [x,y,z,c] = out;
    if (morph >= 1 && morph <= 4) {
      const a = alternate(), b = alternate(), w = alternate(), theta = TAU * b;
      if (morph === 1) {
        const h = 2 * a - 1, radius = Math.sqrt(1 - h * h);
        x = radius * Math.cos(theta); y = h; z = radius * Math.sin(theta);
      } else if (morph === 2) {
        const radius = Math.sqrt(a) * 1.15;
        x = radius * Math.cos(theta); y = radius * Math.sin(theta) * .42; z = radius * Math.sin(theta) * .78;
      } else {
        x = a * 1.68 - .84; y = b * 1.68 - .84; z = w * 1.68 - .84;
        if (morph === 3) {
          const wall = i % 2 ? .84 : -.84;
          if (i % 3 === 0) x = wall; else if (i % 3 === 1) y = wall; else z = wall;
        }
      }
    }
    const j = i * 4;
    values[j] = x; values[j+1] = y; values[j+2] = z; values[j+3] = c;
  }
  return values;
}
