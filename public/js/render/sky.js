// Sky dome with procedural clouds, sun/moon, day-night lighting driven by the Lighting service.
import * as THREE from 'three';

const skyVert = /* glsl */`
varying vec3 vDir;
void main() {
  vDir = normalize(position);
  vec4 p = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  gl_Position = p.xyww;
}`;

const skyFrag = /* glsl */`
uniform vec3 topColor;
uniform vec3 horizonColor;
uniform vec3 groundColor;
uniform vec3 sunDir;
uniform float night;
uniform float time;
uniform float clouds;
varying vec3 vDir;

float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float noise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1, 0)), u.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), u.x), u.y);
}
float fbm(vec2 p) {
  float v = 0.0, a = 0.5;
  for (int i = 0; i < 5; i++) { v += a * noise(p); p *= 2.03; a *= 0.5; }
  return v;
}
void main() {
  vec3 d = normalize(vDir);
  float h = d.y;
  vec3 col = h > 0.0 ? mix(horizonColor, topColor, pow(h, 0.55)) : mix(horizonColor, groundColor, pow(-h, 0.4));
  // sun & moon
  float sd = dot(d, normalize(sunDir));
  col += vec3(1.0, 0.9, 0.7) * pow(max(sd, 0.0), 800.0) * 4.0 * (1.0 - night);
  col += vec3(1.0, 0.8, 0.5) * pow(max(sd, 0.0), 12.0) * 0.25 * (1.0 - night);
  float md = dot(d, -normalize(sunDir));
  col += vec3(0.9, 0.95, 1.0) * smoothstep(0.9985, 0.999, md) * night;
  // stars
  if (h > 0.0 && night > 0.0) {
    vec2 sp = d.xz / (d.y + 0.2) * 180.0;
    float s = step(0.997, hash(floor(sp)));
    col += vec3(s) * night * smoothstep(0.0, 0.3, h);
  }
  // clouds on a plane above the camera
  if (h > 0.02 && clouds > 0.0) {
    vec2 cp = d.xz / h * 1.6 + vec2(time * 0.012, time * 0.004);
    float c = fbm(cp);
    c = smoothstep(0.48, 0.78, c) * smoothstep(0.02, 0.25, h) * clouds;
    vec3 cloudCol = mix(vec3(1.0), vec3(0.25, 0.28, 0.38), night);
    col = mix(col, cloudCol, c * 0.9);
  }
  gl_FragColor = vec4(col, 1.0);
  #include <colorspace_fragment>
}`;

export class Environment {
  constructor(scene, renderer) {
    this.scene = scene;
    this.renderer = renderer;
    this.uniforms = {
      topColor: { value: new THREE.Color(0x3d8be0) },
      horizonColor: { value: new THREE.Color(0xbfdcf5) },
      groundColor: { value: new THREE.Color(0x6d7680) },
      sunDir: { value: new THREE.Vector3(0.3, 0.8, 0.2) },
      night: { value: 0 },
      time: { value: 0 },
      clouds: { value: 1 },
    };
    const dome = new THREE.Mesh(
      new THREE.SphereGeometry(5000, 32, 16),
      new THREE.ShaderMaterial({ uniforms: this.uniforms, vertexShader: skyVert, fragmentShader: skyFrag, side: THREE.BackSide, depthWrite: false }),
    );
    dome.frustumCulled = false;
    dome.renderOrder = -1000;
    this.dome = dome;
    scene.add(dome);

    this.hemi = new THREE.HemisphereLight(0xd8e8ff, 0x8a7a66, 1.1);
    scene.add(this.hemi);
    this.ambient = new THREE.AmbientLight(0x464646, 0.6);
    scene.add(this.ambient);
    this.sun = new THREE.DirectionalLight(0xfff4e0, 2.2);
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(2048, 2048);
    const sc = this.sun.shadow.camera;
    sc.left = -120; sc.right = 120; sc.top = 120; sc.bottom = -120; sc.near = 1; sc.far = 800;
    this.sun.shadow.bias = -0.0004;
    this.sun.shadow.normalBias = 0.05;
    scene.add(this.sun);
    scene.add(this.sun.target);
    scene.fog = new THREE.Fog(0xc0c0c0, 0, 100000);
    this.focus = new THREE.Vector3();
  }

  // Applies Lighting service properties.
  apply(lighting) {
    const p = lighting._p;
    const t = ((p.ClockTime % 24) + 24) % 24;
    const a = ((t - 6) / 12) * Math.PI; // 0 at 6am, PI at 6pm
    const sunDir = new THREE.Vector3(-Math.cos(a) * 0.55, Math.sin(a), -0.45).normalize();
    this.uniforms.sunDir.value.copy(sunDir);
    const day = THREE.MathUtils.clamp(sunDir.y * 3 + 0.25, 0, 1);
    const dusk = THREE.MathUtils.clamp(1 - Math.abs(sunDir.y) * 5, 0, 1) * (sunDir.y > -0.2 ? 1 : 0);
    const night = 1 - day;
    this.uniforms.night.value = night;
    const sky = new THREE.Color(p.SkyColor.R, p.SkyColor.G, p.SkyColor.B);
    const top = sky.clone().multiplyScalar(0.8).lerp(new THREE.Color(0x05070f), night);
    const horizon = sky.clone().lerp(new THREE.Color(0xffffff), 0.55).lerp(new THREE.Color(0xff9a5a), dusk * 0.6).lerp(new THREE.Color(0x141a2c), night);
    this.uniforms.topColor.value.copy(top);
    this.uniforms.horizonColor.value.copy(horizon);
    this.uniforms.groundColor.value.copy(horizon.clone().multiplyScalar(0.6));

    const brightness = Math.max(0, p.Brightness);
    // The sun (or moon at night) casts the shadows.
    const lightDir = sunDir.y > -0.05 ? sunDir : sunDir.clone().negate();
    this.lightDir = lightDir;
    this.sun.color.set(0xfff4e0).lerp(new THREE.Color(0xffae70), dusk * 0.7).lerp(new THREE.Color(0x8fa6d8), night);
    this.sun.intensity = (0.35 + day * 0.85) * brightness * (sunDir.y > -0.05 ? 1 : 0.35);
    const oa = p.OutdoorAmbient, am = p.Ambient;
    this.hemi.color.setRGB(0.75 + oa.R * 0.3, 0.8 + oa.G * 0.3, 0.9 + oa.B * 0.3).multiplyScalar(0.5 + day * 0.7);
    this.hemi.groundColor.setRGB(oa.R * 0.7, oa.G * 0.65, oa.B * 0.6);
    this.hemi.intensity = 0.35 + day * 0.55;
    this.ambient.color.setRGB(am.R, am.G, am.B);
    this.ambient.intensity = 0.8;
    this.renderer.toneMappingExposure = 0.9 + day * 0.15;

    const fogEnd = p.FogEnd;
    if (fogEnd < 10000) {
      this.scene.fog.color.setRGB(p.FogColor.R, p.FogColor.G, p.FogColor.B);
      this.scene.fog.near = p.FogStart;
      this.scene.fog.far = Math.max(p.FogStart + 1, fogEnd);
      this.uniforms.horizonColor.value.lerp(this.scene.fog.color, 0.7);
    } else {
      this.scene.fog.color.copy(horizon);
      this.scene.fog.near = 800;
      this.scene.fog.far = 4000;
    }
    this.updateSun();
  }

  setFocus(v) {
    this.focus.copy(v);
    this.updateSun();
  }

  updateSun() {
    const d = this.lightDir || new THREE.Vector3(0.3, 0.8, 0.2);
    // Snap to a grid to avoid shadow swimming.
    const f = this.focus;
    const fx = Math.round(f.x / 4) * 4, fy = Math.round(f.y / 4) * 4, fz = Math.round(f.z / 4) * 4;
    this.sun.position.set(fx + d.x * 300, fy + d.y * 300, fz + d.z * 300);
    this.sun.target.position.set(fx, fy, fz);
    this.sun.target.updateMatrixWorld();
  }

  update(dt, camera) {
    this.uniforms.time.value += dt;
    if (camera) this.dome.position.copy(camera.position);
  }
}
