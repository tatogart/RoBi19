// Classic R6 character layout. Offsets are relative to the HumanoidRootPart
// (torso centre); the character faces -Z when ry = 0.
import { CFrame, Color3, Vector3 } from './types.js';
import { createInstance } from './instances.js';

export const LIMBS = [
  { name: 'HumanoidRootPart', size: [2, 2, 1], off: [0, 0, 0], color: 'torso', hidden: true },
  { name: 'Torso', size: [2, 2, 1], off: [0, 0, 0], color: 'torso' },
  { name: 'Head', size: [2, 1, 1], off: [0, 1.5, 0], color: 'head' },
  { name: 'Left Arm', size: [1, 2, 1], off: [-1.5, 0, 0], color: 'leftArm' },
  { name: 'Right Arm', size: [1, 2, 1], off: [1.5, 0, 0], color: 'rightArm' },
  { name: 'Left Leg', size: [1, 2, 1], off: [-0.5, -2, 0], color: 'leftLeg' },
  { name: 'Right Leg', size: [1, 2, 1], off: [0.5, -2, 0], color: 'rightLeg' },
];

export function rootCFrame(x, y, z, ry) {
  const cf = CFrame.Angles(0, ry, 0);
  cf.x = x; cf.y = y; cf.z = z;
  return cf;
}

// Builds the server-side character Model (parts + Humanoid).
export function buildCharacter(name, bodyColors, cf) {
  const model = createInstance('Model');
  model.Name = name;
  model._isCharacter = true;
  for (const l of LIMBS) {
    const p = createInstance('Part');
    p.Name = l.name;
    p._p.Size = new Vector3(...l.size);
    p._p.Color = Color3.fromHex((bodyColors && bodyColors[l.color]) || '#a3a2a5');
    p._p.Anchored = false;
    p._p.CanCollide = l.name !== 'HumanoidRootPart';
    if (l.hidden) p._p.Transparency = 1;
    p._p.CFrame = cf.mul(new CFrame(...l.off));
    p.Parent = model;
    if (l.name === 'HumanoidRootPart') model._p.PrimaryPart = p;
  }
  const hum = createInstance('Humanoid');
  hum.Parent = model;
  return model;
}

// Moves all limbs to follow a root CFrame without firing change events.
export function poseCharacter(model, cf) {
  for (const l of LIMBS) {
    const p = model.FindFirstChild(l.name);
    if (p) p._p.CFrame = cf.mul(new CFrame(...l.off));
  }
}
