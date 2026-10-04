// Rendered characters: avatar mesh, interpolation, name tags, health bars,
// chat bubbles and the classic "fall apart" death.
import * as THREE from 'three';
import { buildAvatar, buildPet, animatePet } from '../render/avatar.js';

const NAME_COLORS = ['#fd2943', '#01a2ff', '#02b857', '#6b327c', '#da8541', '#f5cd30', '#e8baC8', '#d7c59a'];
export function nameColor(name) {
  // The classic chat name colour hash.
  let v = 0;
  for (let i = 0; i < name.length; i++) {
    const c = name.charCodeAt(i);
    let r = name.length - i;
    if (name.length % 2 === 1) r -= 1;
    v += r % 4 >= 2 ? -c : c;
  }
  return NAME_COLORS[((v % NAME_COLORS.length) + NAME_COLORS.length) % NAME_COLORS.length];
}

export class CharacterView {
  constructor(scene, overlay, info, isLocal) {
    this.scene = scene;
    this.info = info;
    this.userId = info.userId;
    this.isLocal = isLocal;
    this.av = buildAvatar(info.avatar, { pet: false });
    this.group = this.av.group;
    this.group.visible = false;
    scene.add(this.group);
    // The pet is its own object that follows the player around.
    this.pet = this.av.look.pet ? buildPet(this.av.look.pet) : null;
    if (this.pet) { this.pet.visible = false; scene.add(this.pet); this.petVel = 0; }
    this.pos = new THREE.Vector3();
    this.target = new THREE.Vector3();
    this.ry = 0;
    this.targetRy = 0;
    this.anim = 'idle';
    this.speed = 0;
    this.dead = false;
    this.modelId = null;
    this.forceField = null;
    this.health = 100;
    this.maxHealth = 100;
    this.scale = 1; // Humanoid.BodyScale (a giant admin)
    // HTML overlay: name + health bar + bubbles
    this.tag = document.createElement('div');
    this.tag.className = 'name-tag';
    this.tag.innerHTML = `<div class="bubbles"></div><div class="nt-name"></div><div class="nt-health"><div></div></div>`;
    this.tag.querySelector('.nt-name').textContent = info.name;
    overlay.append(this.tag);
    this.bubbles = this.tag.querySelector('.bubbles');
    this.debris = null;
  }

  spawn(cf) {
    this.dead = false;
    this.clearDebris();
    this.group.visible = true;
    this.pos.set(cf[0], cf[1], cf[2]);
    this.target.copy(this.pos);
    // yaw from rotation matrix (look vector = -Z column)
    this.ry = this.targetRy = Math.atan2(cf[5], cf[11]) || 0;
    this.health = this.maxHealth;
  }

  setState(p, ry, anim) {
    this.target.set(p[0], p[1], p[2]);
    this.targetRy = ry;
    this.anim = anim;
    if (!this.group.visible && !this.dead) { this.group.visible = true; this.pos.copy(this.target); this.ry = ry; }
  }

  setForceField(on) {
    if (on && !this.forceField) {
      const m = new THREE.Mesh(new THREE.SphereGeometry(3.4, 24, 16), new THREE.MeshBasicMaterial({ color: 0x5ab4ff, transparent: true, opacity: 0.18, blending: THREE.AdditiveBlending, depthWrite: false }));
      m.position.y = -0.3;
      m.scale.set(0.8, 1, 0.8);
      this.group.add(m);
      this.forceField = m;
    } else if (!on && this.forceField) {
      this.forceField.removeFromParent();
      this.forceField.geometry.dispose();
      this.forceField.material.dispose();
      this.forceField = null;
    }
  }

  setLimbColor(name, color) {
    const l = this.av.limbs[name];
    if (!l) return;
    const mats = [].concat(l.material);
    for (const m of mats) { if (m.map) { m.map = null; } m.color.setRGB(color.R, color.G, color.B); m.needsUpdate = true; }
  }

  setLimbTransparency(name, t) {
    const l = this.av.limbs[name];
    if (!l) return;
    for (const m of [].concat(l.material)) { m.transparent = t > 0; m.opacity = 1 - t; }
  }

  emote(e) { this.av.setEmote(e); }

  // The Tool this character holds (null for none).
  setTool(tool) {
    this.av.setTool(tool ? tool._p.ToolModel : '', tool ? '#' + tool._p.Color.toHex().replace('#', '') : '');
  }

  // Called each frame. Remote characters interpolate towards their target.
  update(dt) {
    if (this.dead) { this.updateDebris(dt); return; }
    if (!this.isLocal) {
      const before = this.pos.clone();
      const k = Math.min(1, dt * 14);
      if (this.pos.distanceToSquared(this.target) > 400) this.pos.copy(this.target);
      else this.pos.lerp(this.target, k);
      let d = this.targetRy - this.ry;
      d = Math.atan2(Math.sin(d), Math.cos(d));
      this.ry += d * k;
      const moved = Math.hypot(this.pos.x - before.x, this.pos.z - before.z);
      this.speed = this.speed * 0.8 + (moved / Math.max(dt, 1e-3)) * 0.2;
    }
    this.group.position.copy(this.pos);
    this.group.rotation.set(0, this.ry, 0);
    if (this.group.scale.x !== this.scale) this.group.scale.setScalar(this.scale);
    // 'drive:#rrggbb' = sitting in a go-kart of that colour.
    const driving = typeof this.anim === 'string' && this.anim.startsWith('drive');
    this.av.setKart(driving ? this.anim.slice(6) || '#c4281c' : '');
    const state = driving ? 'sit' : this.anim === 'walk' && this.speed < 0.5 && !this.isLocal ? 'idle' : this.anim;
    this.av.animate(state, dt, this.isLocal ? this.speed : Math.max(this.speed, state === 'walk' ? 12 : 0));
    if (this.forceField) this.forceField.material.opacity = 0.14 + Math.sin(performance.now() / 150) * 0.06;
    this.updatePet(dt);
  }

  // Follows a spot behind and to the side of the player, turns where it walks.
  updatePet(dt) {
    const pet = this.pet;
    if (!pet) return;
    if (!this.group.visible || this.dead) { pet.visible = this.dead && pet.visible; return; }
    const side = 2.4, back = 2.2;
    const tx = this.pos.x + Math.cos(this.ry) * side + Math.sin(this.ry) * back;
    const tz = this.pos.z - Math.sin(this.ry) * side + Math.cos(this.ry) * back;
    const groundY = this.pos.y - 3 * this.scale;
    if (!pet.visible || Math.hypot(pet.position.x - tx, pet.position.z - tz) > 40) {
      pet.position.set(tx, groundY, tz);
      pet.visible = true;
    }
    const dx = tx - pet.position.x, dz = tz - pet.position.z;
    const dist = Math.hypot(dx, dz);
    const k = Math.min(1, dt * (dist > 6 ? 6 : 3.5));
    pet.position.x += dx * k;
    pet.position.z += dz * k;
    const moving = Math.min(1, dist / 1.5);
    const target = dist > 0.6 ? Math.atan2(-dx, -dz) : this.ry;
    let d = target - pet.rotation.y;
    d = Math.atan2(Math.sin(d), Math.cos(d));
    pet.rotation.y += d * Math.min(1, dt * 8);
    animatePet(pet, dt, moving);
    const baseY = groundY + (pet.userData.offsetY || 0);
    pet.position.y += (baseY - pet.position.y) * Math.min(1, dt * 12);
  }

  // Project the tag above the head.
  updateTag(camera, w, h, hideName) {
    const p = this.pos.clone();
    p.y += 3.2 * this.scale;
    const v = p.clone().project(camera);
    const dist = camera.position.distanceTo(p);
    const visible = this.group.visible && v.z < 1 && dist < 110 * Math.max(1, this.scale);
    this.tag.style.display = visible ? 'block' : 'none';
    if (!visible) return;
    this.tag.style.transform = `translate(${(v.x * 0.5 + 0.5) * w}px, ${(-v.y * 0.5 + 0.5) * h}px) translate(-50%, -100%)`;
    // Humanoid.NameDisplayDistance: the game can hide names (0 = never shown)
    hideName = hideName || dist > (this.nameDist ?? 100) * Math.max(1, this.scale);
    this.tag.querySelector('.nt-name').style.display = hideName ? 'none' : '';
    const hb = this.tag.querySelector('.nt-health');
    const frac = this.maxHealth > 0 ? this.health / this.maxHealth : 0;
    hb.style.display = !hideName && frac < 1 && !this.dead ? 'block' : 'none';
    hb.firstChild.style.width = Math.max(0, frac * 100) + '%';
    hb.firstChild.style.background = frac > 0.5 ? '#29d157' : frac > 0.2 ? '#f5cd30' : '#e8413c';
  }

  bubble(text) {
    const b = document.createElement('div');
    b.className = 'bubble';
    b.textContent = text;
    this.bubbles.append(b);
    while (this.bubbles.children.length > 3) this.bubbles.firstChild.remove();
    setTimeout(() => b.classList.add('fade'), 7000);
    setTimeout(() => b.remove(), 8000);
  }

  // Death: limbs fly apart and fall.
  die(groundY) {
    if (this.dead) return;
    this.dead = true;
    this.setForceField(false);
    this.group.visible = false;
    this.debris = [];
    this.groundY = groundY;
    const world = new THREE.Vector3();
    const q = new THREE.Quaternion();
    this.group.updateMatrixWorld(true);
    for (const [name, mesh] of Object.entries(this.av.limbs)) {
      const clone = mesh.clone(true);
      mesh.getWorldPosition(world);
      mesh.getWorldQuaternion(q);
      clone.position.copy(world);
      clone.quaternion.copy(q);
      clone.scale.copy(mesh.getWorldScale(new THREE.Vector3()));
      this.scene.add(clone);
      const out = world.clone().sub(this.pos).setY(0).normalize();
      this.debris.push({
        obj: clone,
        v: new THREE.Vector3(out.x * (4 + Math.random() * 6), 6 + Math.random() * 8, out.z * (4 + Math.random() * 6)),
        w: new THREE.Vector3(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5).multiplyScalar(8),
        half: name === 'Torso' ? 1 : 0.5,
      });
    }
  }

  updateDebris(dt) {
    if (!this.debris) return;
    for (const d of this.debris) {
      d.v.y -= 196.2 * 0.35 * dt;
      d.obj.position.addScaledVector(d.v, dt);
      const floor = this.groundY + d.half;
      if (d.obj.position.y < floor) {
        d.obj.position.y = floor;
        d.v.y = Math.abs(d.v.y) * 0.25;
        d.v.x *= 0.6; d.v.z *= 0.6; d.w.multiplyScalar(0.6);
      }
      d.obj.rotation.x += d.w.x * dt; d.obj.rotation.y += d.w.y * dt; d.obj.rotation.z += d.w.z * dt;
    }
  }

  clearDebris() {
    if (!this.debris) return;
    for (const d of this.debris) d.obj.removeFromParent();
    this.debris = null;
  }

  dispose() {
    this.clearDebris();
    this.setForceField(false);
    if (this.pet) { this.pet.removeFromParent(); this.pet.traverse((o) => { if (o.geometry) o.geometry.dispose(); }); this.pet = null; }
    this.group.removeFromParent();
    this.av.dispose();
    this.tag.remove();
  }
}
