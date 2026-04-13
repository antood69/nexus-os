import { useState, useRef, useEffect, useCallback } from "react";
import { useLocation } from "wouter";
import { X, Send, Mic, MicOff, ChevronUp } from "lucide-react";
import * as THREE from "three";

// ─── Types ────────────────────────────────────────────────────────────────────
type OrbState = "idle" | "listening" | "thinking" | "speaking" | "error";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
}

// ─── Orb State Configs ────────────────────────────────────────────────────────
interface StateConfig {
  coreColor: [number, number, number];
  particleColor: [number, number, number];
  glowColor: [number, number, number];
  coreIntensity: number;
  particleAlpha: number;
  orbitalSpeed: number;
  turbulence: number;
  pulseRate: number;
  pulseDepth: number;
  trailStrength: number;
  arcFrequency: number;
  breathBlend: number;
  scaleTarget: number;
  dustAlpha: number;
  ringAlpha: number;
}

const C = {
  cyan:      [0.000, 0.832, 1.000] as [number, number, number],
  cyanBrite: [0.549, 0.882, 1.000] as [number, number, number],
  cyanDeep:  [0.000, 0.549, 0.863] as [number, number, number],
  cyanPale:  [0.314, 0.784, 1.000] as [number, number, number],
  speakCore: [1.000, 0.920, 0.780] as [number, number, number],
  speakPart: [0.200, 0.780, 0.920] as [number, number, number],
  speakGlow: [0.100, 0.620, 0.820] as [number, number, number],
  white:     [1.000, 1.000, 1.000] as [number, number, number],
  errRed:    [1.000, 0.314, 0.157] as [number, number, number],
  errPale:   [1.000, 0.627, 0.549] as [number, number, number],
  thinkA:    [0.350, 0.720, 0.950] as [number, number, number],
  thinkB:    [0.200, 0.580, 0.880] as [number, number, number],
};

const STATES: Record<OrbState, StateConfig> = {
  idle: {
    coreColor: C.cyanBrite, particleColor: C.cyan, glowColor: C.cyanDeep,
    coreIntensity: 0.95, particleAlpha: 1.0, orbitalSpeed: 0.18, turbulence: 0.025,
    pulseRate: 0.45, pulseDepth: 0.22, trailStrength: 0.0, arcFrequency: 0.0,
    breathBlend: 0.70, scaleTarget: 1.0, dustAlpha: 0.30, ringAlpha: 0.20,
  },
  listening: {
    coreColor: C.cyanBrite, particleColor: C.cyanPale, glowColor: C.cyanDeep,
    coreIntensity: 0.95, particleAlpha: 1.0, orbitalSpeed: 0.10, turbulence: 0.03,
    pulseRate: 0.8, pulseDepth: 0.24, trailStrength: 0.06, arcFrequency: 0.15,
    breathBlend: 0.30, scaleTarget: 0.93, dustAlpha: 0.32, ringAlpha: 0.20,
  },
  thinking: {
    coreColor: C.white, particleColor: C.thinkA, glowColor: C.thinkB,
    coreIntensity: 1.0, particleAlpha: 1.0, orbitalSpeed: 0.28, turbulence: 0.06,
    pulseRate: 1.2, pulseDepth: 0.30, trailStrength: 0.14, arcFrequency: 0.5,
    breathBlend: 0.10, scaleTarget: 0.94, dustAlpha: 0.36, ringAlpha: 0.22,
  },
  speaking: {
    coreColor: C.speakCore, particleColor: C.speakPart, glowColor: C.speakGlow,
    coreIntensity: 1.1, particleAlpha: 1.0, orbitalSpeed: 0.07, turbulence: 0.025,
    pulseRate: 0.55, pulseDepth: 0.38, trailStrength: 0.10, arcFrequency: 0.25,
    breathBlend: 0.85, scaleTarget: 1.05, dustAlpha: 0.30, ringAlpha: 0.20,
  },
  error: {
    coreColor: C.errPale, particleColor: C.errRed, glowColor: C.errRed,
    coreIntensity: 0.18, particleAlpha: 0.45, orbitalSpeed: 0.03, turbulence: 0.025,
    pulseRate: 0.45, pulseDepth: 0.08, trailStrength: 0.0, arcFrequency: 0.0,
    breathBlend: 0.08, scaleTarget: 0.75, dustAlpha: 0.04, ringAlpha: 0.04,
  },
};

// ─── GLSL Shaders ─────────────────────────────────────────────────────────────
const PARTICLE_COUNT = 2400;
const DUST_COUNT = 180;
const ARC_COUNT = 8;
const ARC_PTS = 40;
const SHELL_COUNTS = [800, 1200, 400];
const SHELL_SPLIT = [800, 2000, 2400];

const VERT_PARTICLES = /* glsl */`
  attribute float aSize;
  attribute float aBright;
  attribute float aShell;
  attribute float aPhase;
  attribute vec3  aOrbitAxis;

  uniform float uTime;
  uniform float uPulse;
  uniform float uScale;
  uniform float uAudio;
  uniform float uTrail;

  varying float vAlpha;
  varying float vShell;

  vec3 mod289(vec3 x) { return x - floor(x * (1.0/289.0)) * 289.0; }
  vec4 mod289(vec4 x) { return x - floor(x * (1.0/289.0)) * 289.0; }
  vec4 perm(vec4 x) { return mod289(((x * 34.0) + 1.0) * x); }
  float snoise(vec3 v) {
    const vec2 C = vec2(1.0/6.0, 1.0/3.0);
    vec3 i = floor(v + dot(v, vec3(C.y)));
    vec3 x0 = v - i + dot(i, vec3(C.x));
    vec3 g = step(x0.yzx, x0.xyz);
    vec3 l = 1.0 - g;
    vec3 i1 = min(g, l.zxy);
    vec3 i2 = max(g, l.zxy);
    vec3 x1 = x0 - i1 + C.x;
    vec3 x2 = x0 - i2 + C.y;
    vec3 x3 = x0 - 0.5;
    i = mod289(i);
    vec4 p = perm(perm(perm(
      i.z + vec4(0.0, i1.z, i2.z, 1.0))
    + i.y + vec4(0.0, i1.y, i2.y, 1.0))
    + i.x + vec4(0.0, i1.x, i2.x, 1.0));
    vec4 j = p - 49.0 * floor(p * (1.0/49.0));
    vec4 x_ = floor(j * (1.0/7.0));
    vec4 y_ = floor(j - 7.0 * x_);
    vec4 xx = (x_ * 2.0 + 0.5) / 7.0 - 1.0;
    vec4 yy = (y_ * 2.0 + 0.5) / 7.0 - 1.0;
    vec4 h = 1.0 - abs(xx) - abs(yy);
    vec4 b0 = vec4(xx.xy, yy.xy);
    vec4 b1 = vec4(xx.zw, yy.zw);
    vec4 s0 = floor(b0) * 2.0 + 1.0;
    vec4 s1 = floor(b1) * 2.0 + 1.0;
    vec4 sh = -step(h, vec4(0.0));
    vec4 a0 = b0.xzyw + s0.xzyw * sh.xxyy;
    vec4 a1 = b1.xzyw + s1.xzyw * sh.zzww;
    vec3 g0 = vec3(a0.xy, h.x);
    vec3 g1 = vec3(a0.zw, h.y);
    vec3 g2 = vec3(a1.xy, h.z);
    vec3 g3 = vec3(a1.zw, h.w);
    vec4 norm = 1.79284291400159 - 0.85373472095314 *
      vec4(dot(g0,g0), dot(g1,g1), dot(g2,g2), dot(g3,g3));
    g0 *= norm.x; g1 *= norm.y; g2 *= norm.z; g3 *= norm.w;
    vec4 m = max(0.6 - vec4(dot(x0,x0), dot(x1,x1), dot(x2,x2), dot(x3,x3)), 0.0);
    m = m * m;
    return 42.0 * dot(m*m, vec4(dot(g0,x0), dot(g1,x1), dot(g2,x2), dot(g3,x3)));
  }

  vec3 rotateAxis(vec3 p, vec3 axis, float angle) {
    float c = cos(angle); float s = sin(angle);
    return p * c + cross(axis, p) * s + axis * dot(axis, p) * (1.0 - c);
  }

  void main() {
    float shellSpeedVariation = 0.4 + aShell * 0.6;
    float angle = uTime * shellSpeedVariation + aPhase * 6.2831853;
    vec3 orbited = rotateAxis(position, normalize(aOrbitAxis), angle);
    float n = snoise(orbited * 3.0 + uTime * 0.25);
    vec3 disp = normalize(orbited) * n * 0.06;
    float audioMix = 1.0 + uAudio * (0.35 - aShell * 0.2);
    float pulseMix = 1.0 + uPulse * 0.10;
    vec3 pos = (orbited + disp) * uScale * pulseMix * audioMix;
    vec4 mvPos = modelViewMatrix * vec4(pos, 1.0);
    gl_Position = projectionMatrix * mvPos;
    float depth = -mvPos.z;
    float baseSize = aSize * (40.0 / max(depth, 0.5));
    gl_PointSize = max(1.5, baseSize * (0.85 + uPulse * 0.15) * audioMix);
    float depthFade = smoothstep(6.0, 2.5, depth);
    vAlpha = aBright * (0.82 + depthFade * 0.18) * (0.85 + uPulse * 0.15);
    vShell = aShell;
  }
`;

const FRAG_PARTICLES = /* glsl */`
  uniform vec3  uColor;
  uniform vec3  uCoreCol;
  uniform float uAlpha;
  varying float vAlpha;
  varying float vShell;

  void main() {
    float d = length(gl_PointCoord - vec2(0.5));
    if (d > 0.5) discard;
    float core = exp(-d * d * 120.0);
    float glow = exp(-d * d * 18.0);
    float edge = max(0.0, 1.0 - d * 2.0);
    vec3 col = mix(uColor, uCoreCol, core * 0.8 + glow * 0.15);
    float alpha = (core * 1.0 + glow * 0.6 + edge * 0.1) * vAlpha * uAlpha;
    gl_FragColor = vec4(col * alpha * 3.2, alpha);
  }
`;

const VERT_DUST = /* glsl */`
  attribute float aSize;
  attribute float aPhase;
  uniform float uTime;
  uniform float uScale;
  varying float vFade;

  void main() {
    float t = uTime * 0.03 + aPhase * 6.28;
    float drift = 1.0 + mod(uTime * 0.02 + aPhase, 1.0) * 0.4;
    vec3 pos = position * drift * uScale;
    float c = cos(t); float s = sin(t);
    pos = vec3(pos.x * c - pos.z * s, pos.y, pos.x * s + pos.z * c);
    vec4 mvPos = modelViewMatrix * vec4(pos, 1.0);
    gl_Position = projectionMatrix * mvPos;
    float depth = -mvPos.z;
    gl_PointSize = aSize * (200.0 / max(depth, 0.5));
    vFade = smoothstep(4.5, 2.0, depth);
  }
`;

const FRAG_DUST = /* glsl */`
  uniform vec3  uColor;
  uniform float uAlpha;
  varying float vFade;

  void main() {
    float d = length(gl_PointCoord - vec2(0.5));
    if (d > 0.5) discard;
    float glow = exp(-d * d * 12.0);
    float alpha = glow * vFade * uAlpha * 0.45;
    gl_FragColor = vec4(uColor * alpha, alpha);
  }
`;

const VERT_GLOW = /* glsl */`
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const FRAG_GLOW = /* glsl */`
  uniform vec3  uCore;
  uniform vec3  uMid;
  uniform vec3  uOuter;
  uniform float uIntensity;
  uniform float uPulse;
  varying vec2  vUv;

  void main() {
    float d = length(vUv - vec2(0.5)) * 2.0;
    // Hard-kill pixels near quad edge to eliminate smoky box artifact
    if (d > 0.92) discard;
    float edgeFade = smoothstep(0.92, 0.55, d);
    float p = 1.0 + uPulse * 0.25;
    float L0 = exp(-d * d * 28.0) * 1.8  * uIntensity;
    float L1 = exp(-d * d * 8.0)  * 0.72 * p * uIntensity;
    float L2 = exp(-d * d * 2.5)  * 0.30 * p * uIntensity;
    float L3 = exp(-d * d * 0.6)  * 0.10 * uIntensity;
    float L4 = exp(-d * d * 0.18) * 0.035 * uIntensity;
    vec3 col = vec3(1.0) * L0 + uCore * L1 + uMid * L2 + uOuter * L3 + uOuter * L4;
    float alpha = (L0 + L1 + L2 + L3 + L4) * edgeFade;
    gl_FragColor = vec4(col * edgeFade, alpha);
  }
`;

const VERT_ARC = /* glsl */`
  attribute float aT;
  uniform float uScale;
  varying float vT;
  void main() {
    vT = aT;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position * uScale, 1.0);
  }
`;

const FRAG_ARC = /* glsl */`
  uniform vec3  uColor;
  uniform float uAlpha;
  uniform float uHead;
  varying float vT;

  void main() {
    float headDist = abs(vT - uHead);
    float trail = smoothstep(0.4, 0.0, headDist);
    float tipGlow = exp(-headDist * headDist * 80.0) * 0.5;
    float alpha = (trail + tipGlow) * uAlpha;
    gl_FragColor = vec4(uColor * alpha * 1.4, alpha);
  }
`;

// ─── Helpers ──────────────────────────────────────────────────────────────────
function lerpN(a: number, b: number, t: number): number { return a + (b - a) * t; }
function lerpV3(a: [number,number,number], b: [number,number,number], t: number): [number,number,number] {
  return [lerpN(a[0],b[0],t), lerpN(a[1],b[1],t), lerpN(a[2],b[2],t)];
}
function heartbeat(t: number, hz: number): number {
  const p = (t * hz) % 1.0;
  return Math.exp(-Math.pow((p - 0.08) * 18, 2)) + Math.exp(-Math.pow((p - 0.24) * 18, 2)) * 0.65;
}
function breathe(t: number, hz: number): number {
  return (Math.sin(t * hz * Math.PI * 2) * 0.5 + 0.5) * 0.85
       + (Math.sin(t * hz * 1.37 * Math.PI * 2) * 0.15 + 0.15) * 0.15;
}
function fibSphere(i: number, n: number): [number, number, number] {
  const golden = Math.PI * (3 - Math.sqrt(5));
  const theta = golden * i;
  const phi = Math.acos(1 - (2 * (i + 0.5)) / n);
  return [Math.sin(phi) * Math.cos(theta), Math.cos(phi), Math.sin(phi) * Math.sin(theta)];
}
function randAxis(): [number, number, number] {
  const u = Math.random() * 2 - 1;
  const t = Math.random() * Math.PI * 2;
  const s = Math.sqrt(1 - u * u);
  return [s * Math.cos(t), u, s * Math.sin(t)];
}
function slerp(a: number[], b: number[], t: number): number[] {
  const dot = a[0]*b[0] + a[1]*b[1] + a[2]*b[2];
  const omega = Math.acos(Math.min(1, Math.max(-1, dot)));
  if (omega < 0.001) return a.map((v,i) => v + (b[i]-v)*t);
  const sinO = Math.sin(omega);
  const sa = Math.sin((1-t)*omega)/sinO;
  const sb = Math.sin(t*omega)/sinO;
  return [a[0]*sa+b[0]*sb, a[1]*sa+b[1]*sb, a[2]*sa+b[2]*sb];
}

// ─── Three.js Orb Component ───────────────────────────────────────────────────
function JarvisOrb({ orbState, audioAmplitude = 0 }: { orbState: OrbState; audioAmplitude?: number }) {
  const mountRef = useRef<HTMLDivElement>(null);
  const frameRef = useRef<number>(0);
  const clockRef = useRef(new THREE.Clock());
  const curRef = useRef<StateConfig>({ ...STATES[orbState] });
  const tgtRef = useRef<StateConfig>({ ...STATES[orbState] });
  const ampRef = useRef(0);

  useEffect(() => { tgtRef.current = { ...STATES[orbState] }; }, [orbState]);
  useEffect(() => { ampRef.current = audioAmplitude; }, [audioAmplitude]);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: "high-performance" });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setClearColor(0x000000, 0);
    mount.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(40, 1, 0.1, 100);
    camera.position.set(0, 0, 3.5);
    camera.lookAt(0, 0, 0);

    // 1. PARTICLES
    const pos = new Float32Array(PARTICLE_COUNT * 3);
    const sizes = new Float32Array(PARTICLE_COUNT);
    const brights = new Float32Array(PARTICLE_COUNT);
    const shells = new Float32Array(PARTICLE_COUNT);
    const phases = new Float32Array(PARTICLE_COUNT);
    const orbAxes = new Float32Array(PARTICLE_COUNT * 3);

    for (let i = 0; i < PARTICLE_COUNT; i++) {
      let shell = 0;
      if (i < SHELL_SPLIT[0]) shell = 0;
      else if (i < SHELL_SPLIT[1]) shell = 1;
      else shell = 2;

      let rMin = 0, rMax = 0;
      if (shell === 0) { rMin = 0.12; rMax = 0.22; }
      else if (shell === 1) { rMin = 0.30; rMax = 0.50; }
      else { rMin = 0.55; rMax = 0.85; }
      const r = rMin + Math.random() * (rMax - rMin);

      const shellBaseIdx = shell === 0 ? 0 : shell === 1 ? 800 : 2000;
      const idxInShell = i - shellBaseIdx;
      const [x, y, z] = fibSphere(idxInShell, SHELL_COUNTS[shell]);
      pos[i*3] = x * r; pos[i*3+1] = y * r; pos[i*3+2] = z * r;

      if (shell === 0) { sizes[i] = 1.8 + Math.random() * 1.2; brights[i] = 0.90 + Math.random() * 0.10; }
      else if (shell === 1) { sizes[i] = 2.5 + Math.random() * 2.0; brights[i] = 0.65 + Math.random() * 0.25; }
      else { sizes[i] = 3.5 + Math.random() * 3.0; brights[i] = 0.45 + Math.random() * 0.25; }

      shells[i] = shell / 2.0;
      phases[i] = Math.random();
      const ax = randAxis();
      orbAxes[i*3] = ax[0]; orbAxes[i*3+1] = ax[1]; orbAxes[i*3+2] = ax[2];
    }

    const pGeom = new THREE.BufferGeometry();
    pGeom.setAttribute("position",   new THREE.BufferAttribute(pos, 3));
    pGeom.setAttribute("aSize",      new THREE.BufferAttribute(sizes, 1));
    pGeom.setAttribute("aBright",    new THREE.BufferAttribute(brights, 1));
    pGeom.setAttribute("aShell",     new THREE.BufferAttribute(shells, 1));
    pGeom.setAttribute("aPhase",     new THREE.BufferAttribute(phases, 1));
    pGeom.setAttribute("aOrbitAxis", new THREE.BufferAttribute(orbAxes, 3));

    const pMat = new THREE.ShaderMaterial({
      vertexShader: VERT_PARTICLES, fragmentShader: FRAG_PARTICLES,
      uniforms: {
        uTime: { value: 0 }, uColor: { value: new THREE.Color() },
        uCoreCol: { value: new THREE.Color() }, uAlpha: { value: 0.55 },
        uPulse: { value: 0 }, uScale: { value: 1.0 },
        uAudio: { value: 0 }, uTrail: { value: 0 },
      },
      transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, depthTest: false,
    });
    scene.add(new THREE.Points(pGeom, pMat));

    // 2. NUCLEUS GLOW
    const glowMat = new THREE.ShaderMaterial({
      vertexShader: VERT_GLOW, fragmentShader: FRAG_GLOW,
      uniforms: {
        uCore: { value: new THREE.Color() }, uMid: { value: new THREE.Color() },
        uOuter: { value: new THREE.Color() }, uIntensity: { value: 0.55 }, uPulse: { value: 0 },
      },
      transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, depthTest: false, side: THREE.DoubleSide,
    });
    const glow1 = new THREE.Mesh(new THREE.PlaneGeometry(1.25, 1.25), glowMat);
    glow1.renderOrder = -2; scene.add(glow1);
    const glow2Mat = glowMat.clone();
    const glow2 = new THREE.Mesh(new THREE.PlaneGeometry(2.0, 2.0), glow2Mat);
    glow2.renderOrder = -3; scene.add(glow2);

    // 3. DUST
    const dPos = new Float32Array(DUST_COUNT * 3);
    const dSizes = new Float32Array(DUST_COUNT);
    const dPhases = new Float32Array(DUST_COUNT);
    for (let i = 0; i < DUST_COUNT; i++) {
      const r = 0.8 + Math.random() * 0.6;
      const [x, y, z] = fibSphere(i, DUST_COUNT);
      dPos[i*3] = x * r; dPos[i*3+1] = y * r; dPos[i*3+2] = z * r;
      dSizes[i] = 1.0 + Math.random() * 2.5; dPhases[i] = Math.random();
    }
    const dGeom = new THREE.BufferGeometry();
    dGeom.setAttribute("position", new THREE.BufferAttribute(dPos, 3));
    dGeom.setAttribute("aSize",    new THREE.BufferAttribute(dSizes, 1));
    dGeom.setAttribute("aPhase",   new THREE.BufferAttribute(dPhases, 1));
    const dMat = new THREE.ShaderMaterial({
      vertexShader: VERT_DUST, fragmentShader: FRAG_DUST,
      uniforms: { uTime: { value: 0 }, uColor: { value: new THREE.Color() }, uAlpha: { value: 0.15 }, uScale: { value: 1.0 } },
      transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, depthTest: false,
    });
    scene.add(new THREE.Points(dGeom, dMat));

    // 4. HOLOGRAPHIC RINGS
    const ringCfg = [
      { r: 0.52, tiltX: 0.25,  tiltZ: 0.0,   speed:  0.35, segs: 128 },
      { r: 0.42, tiltX: -0.18, tiltZ: 0.12,  speed: -0.25, segs: 96 },
      { r: 0.64, tiltX: 0.40,  tiltZ: -0.08, speed:  0.18, segs: 160 },
      { r: 0.74, tiltX: -0.10, tiltZ: 0.30,  speed: -0.12, segs: 160 },
    ];
    const rings: { mesh: THREE.Line; speed: number }[] = [];
    for (const rc of ringCfg) {
      const pts: THREE.Vector3[] = [];
      for (let i = 0; i <= rc.segs; i++) {
        const a = (i / rc.segs) * Math.PI * 2;
        pts.push(new THREE.Vector3(
          Math.cos(a) * rc.r,
          Math.sin(a) * rc.r * Math.cos(rc.tiltX),
          Math.sin(a) * rc.r * Math.sin(rc.tiltX) + Math.cos(a) * rc.r * Math.sin(rc.tiltZ) * 0.3,
        ));
      }
      const rGeom = new THREE.BufferGeometry().setFromPoints(pts);
      const rMat = new THREE.LineBasicMaterial({ color: 0x00d4ff, transparent: true, opacity: 0.10, blending: THREE.AdditiveBlending });
      const ring = new THREE.Line(rGeom, rMat);
      scene.add(ring); rings.push({ mesh: ring, speed: rc.speed });
    }

    // 5. ARC TRAILS
    interface ArcData { geom: THREE.BufferGeometry; mat: THREE.ShaderMaterial; startDir: number[]; endDir: number[]; life: number; maxLife: number; active: boolean; }
    const arcs: ArcData[] = [];
    for (let i = 0; i < ARC_COUNT; i++) {
      const arcPos = new Float32Array(ARC_PTS * 3);
      const arcT = new Float32Array(ARC_PTS);
      for (let j = 0; j < ARC_PTS; j++) arcT[j] = j / (ARC_PTS - 1);
      const geom = new THREE.BufferGeometry();
      geom.setAttribute("position", new THREE.BufferAttribute(arcPos, 3));
      geom.setAttribute("aT",       new THREE.BufferAttribute(arcT, 1));
      const mat = new THREE.ShaderMaterial({
        vertexShader: VERT_ARC, fragmentShader: FRAG_ARC,
        uniforms: { uColor: { value: new THREE.Color() }, uAlpha: { value: 0 }, uScale: { value: 1.0 }, uHead: { value: 0 } },
        transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, depthTest: false,
      });
      scene.add(new THREE.Line(geom, mat));
      arcs.push({ geom, mat, startDir: [0,1,0], endDir: [1,0,0], life: 0, maxLife: 2, active: false });
    }

    const onResize = () => {
      if (!mount) return;
      const w = mount.clientWidth; const h = mount.clientHeight;
      camera.aspect = w / h; camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };
    onResize();
    window.addEventListener("resize", onResize);
    clockRef.current.start();

    const animate = () => {
      frameRef.current = requestAnimationFrame(animate);
      const dt = Math.min(clockRef.current.getDelta(), 0.05);
      const t = clockRef.current.elapsedTime;

      const c = curRef.current; const g = tgtRef.current;
      const r = 1 - Math.pow(0.04, dt);
      c.coreColor     = lerpV3(c.coreColor, g.coreColor, r);
      c.particleColor = lerpV3(c.particleColor, g.particleColor, r);
      c.glowColor     = lerpV3(c.glowColor, g.glowColor, r);
      c.coreIntensity = lerpN(c.coreIntensity, g.coreIntensity, r);
      c.particleAlpha = lerpN(c.particleAlpha, g.particleAlpha, r);
      c.orbitalSpeed  = lerpN(c.orbitalSpeed, g.orbitalSpeed, r);
      c.turbulence    = lerpN(c.turbulence, g.turbulence, r);
      c.pulseRate     = lerpN(c.pulseRate, g.pulseRate, r);
      c.pulseDepth    = lerpN(c.pulseDepth, g.pulseDepth, r);
      c.trailStrength = lerpN(c.trailStrength, g.trailStrength, r);
      c.arcFrequency  = lerpN(c.arcFrequency, g.arcFrequency, r);
      c.breathBlend   = lerpN(c.breathBlend, g.breathBlend, r);
      c.scaleTarget   = lerpN(c.scaleTarget, g.scaleTarget, r);
      c.dustAlpha     = lerpN(c.dustAlpha, g.dustAlpha, r);
      c.ringAlpha     = lerpN(c.ringAlpha, g.ringAlpha, r);

      const hb = heartbeat(t, c.pulseRate);
      const br = breathe(t, c.pulseRate);
      let pulse = hb * (1 - c.breathBlend) + br * c.breathBlend;
      const amp = ampRef.current;
      if (amp > 0.01) pulse = pulse * 0.15 + amp * 0.85;

      camera.position.x = Math.sin(t * 0.13) * 0.04;
      camera.position.y = Math.cos(t * 0.09) * 0.03;
      camera.lookAt(0, 0, 0);

      pMat.uniforms.uTime.value = t * c.orbitalSpeed;
      pMat.uniforms.uColor.value.setRGB(...c.particleColor);
      pMat.uniforms.uCoreCol.value.setRGB(...c.coreColor);
      pMat.uniforms.uAlpha.value = c.particleAlpha;
      pMat.uniforms.uPulse.value = pulse * c.pulseDepth;
      pMat.uniforms.uScale.value = c.scaleTarget;
      pMat.uniforms.uAudio.value = amp;
      pMat.uniforms.uTrail.value = c.trailStrength;

      const glowUpdater = (mat: THREE.ShaderMaterial, mul: number) => {
        mat.uniforms.uCore.value.setRGB(...c.coreColor);
        mat.uniforms.uMid.value.setRGB(...c.particleColor);
        mat.uniforms.uOuter.value.setRGB(...c.glowColor);
        // uIntensity is now passed raw — shader scales all layers by it
        mat.uniforms.uIntensity.value = c.coreIntensity * mul;
        mat.uniforms.uPulse.value = pulse;
      };
      glowUpdater(glowMat, 0.92); glowUpdater(glow2Mat, 0.48);
      glow1.quaternion.copy(camera.quaternion); glow2.quaternion.copy(camera.quaternion);

      dMat.uniforms.uTime.value = t;
      dMat.uniforms.uColor.value.setRGB(...c.particleColor);
      dMat.uniforms.uAlpha.value = c.dustAlpha;
      dMat.uniforms.uScale.value = c.scaleTarget;

      for (const rd of rings) {
        rd.mesh.rotation.y += rd.speed * dt * c.orbitalSpeed * 4;
        rd.mesh.rotation.x += rd.speed * dt * c.orbitalSpeed * 0.8;
        (rd.mesh.material as THREE.LineBasicMaterial).color.setRGB(...c.particleColor);
        (rd.mesh.material as THREE.LineBasicMaterial).opacity = c.ringAlpha * (0.6 + pulse * 0.4);
      }

      for (const arc of arcs) {
        if (arc.active) {
          arc.life += dt;
          if (arc.life >= arc.maxLife) { arc.active = false; arc.mat.uniforms.uAlpha.value = 0; continue; }
          const prog = arc.life / arc.maxLife;
          const fadeIn = Math.min(prog * 6, 1); const fadeOut = 1 - Math.max(0, (prog - 0.6) / 0.4);
          arc.mat.uniforms.uAlpha.value = fadeIn * fadeOut * c.trailStrength * 0.7;
          arc.mat.uniforms.uColor.value.setRGB(...c.particleColor);
          arc.mat.uniforms.uScale.value = c.scaleTarget;
          arc.mat.uniforms.uHead.value = prog;
          const posAttr = arc.geom.getAttribute("position") as THREE.BufferAttribute;
          for (let j = 0; j < ARC_PTS; j++) {
            const frac = j / (ARC_PTS - 1);
            const pt = slerp(arc.startDir, arc.endDir, frac);
            const bulge = 1.0 + Math.sin(frac * Math.PI) * 0.18;
            const R = 0.55 * bulge;
            posAttr.setXYZ(j, pt[0]*R, pt[1]*R, pt[2]*R);
          }
          posAttr.needsUpdate = true;
        }
        if (!arc.active && c.arcFrequency > 0 && Math.random() < c.arcFrequency * dt) {
          arc.active = true; arc.life = 0; arc.maxLife = 1.2 + Math.random() * 1.6;
          arc.startDir = randAxis(); arc.endDir = randAxis();
        }
      }

      renderer.render(scene, camera);
    };
    frameRef.current = requestAnimationFrame(animate);

    return () => {
      cancelAnimationFrame(frameRef.current);
      window.removeEventListener("resize", onResize);
      renderer.dispose();
      if (mount.contains(renderer.domElement)) mount.removeChild(renderer.domElement);
      pGeom.dispose(); pMat.dispose();
      glow1.geometry.dispose(); glowMat.dispose();
      glow2.geometry.dispose(); glow2Mat.dispose();
      dGeom.dispose(); dMat.dispose();
      for (const rd of rings) { rd.mesh.geometry.dispose(); (rd.mesh.material as THREE.Material).dispose(); }
      for (const a of arcs) { a.geom.dispose(); a.mat.dispose(); }
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return <div ref={mountRef} className="w-full h-full" style={{ background: "transparent" }} />;
}

// ─── State Labels ─────────────────────────────────────────────────────────────
const STATE_LABELS: Record<OrbState, string> = {
  idle: "Standing By",
  listening: "Listening",
  thinking: "Processing",
  speaking: "Speaking",
  error: "Error",
};

// ─── Main Jarvis Widget ───────────────────────────────────────────────────────
export function JarvisWidget() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [orbState, setOrbState] = useState<OrbState>("idle");
  const [isListening, setIsListening] = useState(false);
  const [audioAmplitude, setAudioAmplitude] = useState(0);
  const [location] = useLocation();

  const inputRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const recognitionRef = useRef<any>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const ampFrameRef = useRef<number>(0);

  // Auto-scroll
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // CTRL+J global toggle
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "j") {
        e.preventDefault();
        setOpen((v) => !v);
      }
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  // Focus input when opened
  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 100);
  }, [open]);

  // Amplitude from mic
  const startAmplitudeTrack = useCallback((stream: MediaStream) => {
    const ctx = new AudioContext();
    const src = ctx.createMediaStreamSource(stream);
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 256;
    src.connect(analyser);
    analyserRef.current = analyser;
    const data = new Uint8Array(analyser.frequencyBinCount);
    const tick = () => {
      analyser.getByteFrequencyData(data);
      const avg = data.reduce((a, b) => a + b, 0) / data.length;
      setAudioAmplitude(avg / 128);
      ampFrameRef.current = requestAnimationFrame(tick);
    };
    ampFrameRef.current = requestAnimationFrame(tick);
  }, []);

  const stopAmplitudeTrack = useCallback(() => {
    cancelAnimationFrame(ampFrameRef.current);
    setAudioAmplitude(0);
  }, []);

  // Send message
  const sendMessage = useCallback(async (text: string) => {
    if (!text.trim()) return;
    const userMsg: Message = { id: Date.now().toString(), role: "user", content: text };
    setMessages((prev) => [...prev, userMsg]);
    setOrbState("thinking");

    try {
      const res = await fetch("/api/jarvis/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: text,
          context: { page: location, timestamp: new Date().toISOString() },
        }),
      });
      const data = await res.json();
      const reply = data.reply || data.message || "I couldn't process that.";
      setOrbState("speaking");
      setMessages((prev) => [...prev, { id: (Date.now() + 1).toString(), role: "assistant", content: reply }]);

      // Text-to-speech if available
      if ("speechSynthesis" in window) {
        const utt = new SpeechSynthesisUtterance(reply);
        utt.rate = 0.95; utt.pitch = 0.85; utt.volume = 0.9;
        const voices = speechSynthesis.getVoices();
        const pref = voices.find(v => v.name.toLowerCase().includes("daniel") || v.name.toLowerCase().includes("alex") || v.lang === "en-GB");
        if (pref) utt.voice = pref;
        utt.onend = () => setOrbState("idle");
        speechSynthesis.speak(utt);
      } else {
        setTimeout(() => setOrbState("idle"), 2000);
      }
    } catch {
      setOrbState("error");
      setMessages((prev) => [...prev, { id: (Date.now() + 1).toString(), role: "assistant", content: "Connection error. Please try again." }]);
      setTimeout(() => setOrbState("idle"), 3000);
    }
  }, [location]);

  // Submit handler
  const handleSubmit = useCallback((e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim()) return;
    sendMessage(input);
    setInput("");
  }, [input, sendMessage]);

  // Voice input
  const toggleVoice = useCallback(async () => {
    if (isListening) {
      recognitionRef.current?.stop();
      stopAmplitudeTrack();
      setIsListening(false);
      setOrbState("idle");
      return;
    }

    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) return;

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      startAmplitudeTrack(stream);

      const rec = new SpeechRecognition();
      rec.continuous = false; rec.interimResults = false; rec.lang = "en-US";
      recognitionRef.current = rec;

      rec.onstart = () => { setIsListening(true); setOrbState("listening"); };
      rec.onresult = (e: any) => {
        const text = e.results[0]?.[0]?.transcript;
        if (text) { sendMessage(text); setInput(""); }
      };
      rec.onend = () => { setIsListening(false); stopAmplitudeTrack(); stream.getTracks().forEach(t => t.stop()); };
      rec.onerror = () => { setIsListening(false); stopAmplitudeTrack(); setOrbState("error"); setTimeout(() => setOrbState("idle"), 2000); };
      rec.start();
    } catch {
      setOrbState("error");
      setTimeout(() => setOrbState("idle"), 2000);
    }
  }, [isListening, startAmplitudeTrack, stopAmplitudeTrack, sendMessage]);

  return (
    <>
      {/* ── Full-screen Overlay ── */}
      {open && (
        <div
          className="fixed inset-0 z-[9999] flex flex-col"
          style={{ background: "#000000" }}
        >
          {/* Scanline overlay */}
          <div
            className="absolute inset-0 pointer-events-none"
            style={{
              zIndex: 1,
              opacity: 0.025,
              backgroundImage: "repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(0,190,255,0.08) 2px, rgba(0,190,255,0.08) 3px)",
              backgroundSize: "100% 4px",
            }}
          />

          {/* Header */}
          <div className="relative z-10 flex items-center justify-between px-6 py-4 border-b border-cyan-500/10">
            <div className="flex items-center gap-3">
              <div className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse" />
              <span className="text-cyan-400/60 text-xs font-mono tracking-[0.3em] uppercase">J.A.R.V.I.S.</span>
              <span className="text-cyan-500/30 text-xs font-mono">·</span>
              <span className="text-cyan-400/40 text-xs font-mono tracking-widest">{STATE_LABELS[orbState]}</span>
            </div>
            <button
              onClick={() => setOpen(false)}
              className="text-cyan-500/40 hover:text-cyan-400 transition-colors p-1"
            >
              <X size={18} />
            </button>
          </div>

          {/* Orb — center stage */}
          <div className="relative z-10 flex-1 flex flex-col">
            <div className="flex-1 flex items-center justify-center" style={{ minHeight: 0 }}>
              <div style={{ width: "min(420px, 60vw)", height: "min(420px, 60vw)" }}>
                <JarvisOrb orbState={orbState} audioAmplitude={audioAmplitude} />
              </div>
            </div>

            {/* Transcript — latest reply */}
            {messages.length > 0 && (
              <div className="px-8 pb-2 text-center" style={{ minHeight: "3.5rem" }}>
                {(() => {
                  const last = [...messages].reverse().find(m => m.role === "assistant");
                  return last ? (
                    <p className="text-cyan-300/70 text-sm font-mono leading-relaxed max-w-2xl mx-auto line-clamp-3">
                      {last.content}
                    </p>
                  ) : null;
                })()}
              </div>
            )}

            {/* Chat history toggle */}
            {messages.length > 0 && (
              <div className="px-6 pb-2 overflow-y-auto max-h-48 space-y-2">
                {messages.map((msg) => (
                  <div
                    key={msg.id}
                    className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
                  >
                    <div
                      className={`max-w-xs px-3 py-2 rounded-lg text-xs font-mono ${
                        msg.role === "user"
                          ? "bg-cyan-500/10 border border-cyan-500/20 text-cyan-200/80"
                          : "text-cyan-400/60"
                      }`}
                    >
                      {msg.content}
                    </div>
                  </div>
                ))}
                <div ref={messagesEndRef} />
              </div>
            )}

            {/* Input bar */}
            <div className="relative z-10 px-6 pb-6 pt-3 border-t border-cyan-500/10">
              <form onSubmit={handleSubmit} className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={toggleVoice}
                  className={`flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center transition-all border ${
                    isListening
                      ? "bg-cyan-500/20 border-cyan-400/60 text-cyan-300 animate-pulse"
                      : "bg-transparent border-cyan-500/20 text-cyan-500/50 hover:border-cyan-400/40 hover:text-cyan-400/70"
                  }`}
                >
                  {isListening ? <MicOff size={16} /> : <Mic size={16} />}
                </button>

                <input
                  ref={inputRef}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder="Ask JARVIS anything..."
                  className="flex-1 bg-transparent border border-cyan-500/20 rounded-lg px-4 py-2.5 text-sm text-cyan-200/80 placeholder-cyan-500/30 font-mono outline-none focus:border-cyan-400/40 transition-colors"
                  disabled={orbState === "thinking"}
                />

                <button
                  type="submit"
                  disabled={!input.trim() || orbState === "thinking"}
                  className="flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center border border-cyan-500/20 text-cyan-500/50 hover:border-cyan-400/40 hover:text-cyan-400/70 disabled:opacity-30 transition-all"
                >
                  <Send size={16} />
                </button>
              </form>
              <p className="text-center text-cyan-500/20 text-xs font-mono mt-2 tracking-widest">
                ESC TO DISMISS · CTRL+J TO TOGGLE
              </p>
            </div>
          </div>
        </div>
      )}

      {/* ── Floating Pill Button ── */}
      {!open && (
        <button
          onClick={() => setOpen(true)}
          className="fixed bottom-5 right-5 z-[9998] group flex items-center gap-2 px-3 py-2 rounded-full transition-all duration-300"
          style={{
            background: "rgba(0,0,0,0.85)",
            border: "1px solid rgba(0,229,255,0.25)",
            backdropFilter: "blur(12px)",
            boxShadow: "0 0 16px rgba(0,229,255,0.08), 0 2px 8px rgba(0,0,0,0.5)",
          }}
          title="Open JARVIS (Ctrl+J)"
        >
          {/* Mini orb dot */}
          <div className="relative w-5 h-5 flex items-center justify-center">
            <div
              className="absolute inset-0 rounded-full animate-ping"
              style={{ background: "rgba(0,229,255,0.15)", animationDuration: "2s" }}
            />
            <div
              className="w-3 h-3 rounded-full"
              style={{
                background: "radial-gradient(circle, rgba(140,225,255,1) 0%, rgba(0,200,255,0.8) 50%, rgba(0,100,200,0.3) 100%)",
                boxShadow: "0 0 8px rgba(0,229,255,0.6)",
              }}
            />
          </div>
          <span className="text-cyan-400/70 text-xs font-mono tracking-widest pr-1 group-hover:text-cyan-300/90 transition-colors">
            JARVIS
          </span>
        </button>
      )}
    </>
  );
}

export default JarvisWidget;
