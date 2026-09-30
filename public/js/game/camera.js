// Classic follow camera: right-drag to orbit, wheel to zoom, first person when
// fully zoomed in, optional Shift Lock, and pull-in when walls block the view.
import * as THREE from 'three';

export class FollowCamera {
  constructor(camera, world) {
    this.camera = camera;
    this.world = world;
    this.yaw = 0; // radians; camera looks along -Z when yaw = 0
    this.pitch = -0.35;
    this.zoom = 14;
    this.targetZoom = 14;
    this.minZoom = 0.5;
    this.maxZoom = 120;
    this.shiftLock = false;
    this.sensitivity = 1;
    this.focus = new THREE.Vector3();
    this.firstPerson = false;
  }

  rotate(dx, dy) {
    this.yaw -= dx * 0.0055 * this.sensitivity;
    this.pitch -= dy * 0.0055 * this.sensitivity;
    this.pitch = Math.max(-1.45, Math.min(1.35, this.pitch));
  }

  zoomBy(steps) {
    this.targetZoom = Math.max(this.minZoom, Math.min(this.maxZoom, this.targetZoom * Math.pow(1.15, steps)));
  }

  // Direction the camera looks along the ground (unit, xz).
  get forward() { return new THREE.Vector3(-Math.sin(this.yaw), 0, -Math.cos(this.yaw)); }
  get right() { return new THREE.Vector3(Math.cos(this.yaw), 0, -Math.sin(this.yaw)); }

  update(dt, head) {
    this.zoom += (this.targetZoom - this.zoom) * Math.min(1, dt * 12);
    this.focus.lerp(head, Math.min(1, dt * 25));
    const dir = new THREE.Vector3(
      Math.sin(this.yaw) * Math.cos(this.pitch),
      -Math.sin(this.pitch),
      Math.cos(this.yaw) * Math.cos(this.pitch),
    );
    let focus = this.focus.clone();
    if (this.shiftLock && this.zoom > 1) focus.add(this.right.multiplyScalar(1.75));
    this.firstPerson = this.zoom < 1;
    // Phones held upright see much less sideways, so pull the camera back.
    let dist = this.firstPerson ? 0 : this.zoom * (this.camera.aspect < 1 ? 1.7 : 1);
    if (dist > 0 && this.world) {
      const hit = this.world.raycast(focus, dir, dist + 0.5);
      if (hit < dist + 0.5) dist = Math.max(0.5, hit - 0.5);
    }
    this.camera.position.copy(focus).addScaledVector(dir, dist);
    const look = focus.clone().addScaledVector(dir, -1);
    this.camera.lookAt(look);
  }
}
