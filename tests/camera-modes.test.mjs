import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { ShopCamera3D } from '../src/game/presentation/three/ShopCamera3D.ts';
import { cameraRelativeMovement, THREE_VIEW } from '../src/game/presentation/three/ThreeRules.ts';

const anchor = { x: 450, y: 735 };
function camera(mode) {
  const rig = new ShopCamera3D(1100, 800);
  rig.update(16, [anchor]); rig.setMode(mode, 1); rig.update(16, [anchor]); return rig;
}
test('camera starts in shared oblique mode and solo can select both perspective modes', () => {
  const rig = new ShopCamera3D(1100, 800);
  assert.equal(rig.mode, 'OBLIQUE'); assert.ok(rig.camera instanceof THREE.OrthographicCamera);
  assert.equal(rig.setMode('FIRST_PERSON', 1), true); assert.ok(rig.camera instanceof THREE.PerspectiveCamera);
  assert.equal(rig.setMode('THIRD_PERSON', 1), true); assert.equal(rig.mode, 'THIRD_PERSON');
  assert.equal(rig.setMode('OBLIQUE', 1), true); assert.ok(rig.camera instanceof THREE.OrthographicCamera);
});
test('co-op cannot select a camera that would lose the other player', () => {
  const rig = new ShopCamera3D(1100, 800);
  assert.equal(rig.setMode('FIRST_PERSON', 2), false); assert.equal(rig.setMode('THIRD_PERSON', 2), false); assert.equal(rig.mode, 'OBLIQUE');
});
test('selecting current mode is idempotent', () => {
  const rig = camera('FIRST_PERSON'); const before = rig.camera.position.clone();
  assert.equal(rig.setMode('FIRST_PERSON', 1), false); assert.ok(rig.camera.position.equals(before));
});
test('first-person eye follows the actual ground anchor exactly and hides own avatar', () => {
  const rig = camera('FIRST_PERSON');
  assert.equal(rig.camera.position.x, anchor.x * 0.01); assert.equal(rig.camera.position.z, anchor.y * 0.01);
  assert.equal(rig.camera.position.y, THREE_VIEW.eyeHeight); assert.equal(rig.avatarVisible, false);
  assert.deepEqual(anchor, { x: 450, y: 735 });
});
test('third-person camera sits behind player and keeps player in view', () => {
  const rig = camera('THIRD_PERSON');
  assert.ok(rig.camera.position.z > anchor.y * 0.01); assert.equal(rig.avatarVisible, true);
  const screen = rig.project(anchor, THREE_VIEW.thirdPersonTargetHeight);
  assert.equal(screen.visible, true); assert.ok(Math.abs(screen.x - 550) < 1e-8); assert.ok(Math.abs(screen.y - 400) < 1e-8);
});
test('third-person camera retracts before opaque furniture instead of clipping through it', () => {
  const rig = camera('THIRD_PERSON');
  const wall = new THREE.Mesh(new THREE.BoxGeometry(2, 2, 0.2), new THREE.MeshBasicMaterial());
  wall.position.set(anchor.x * 0.01, 0.8, anchor.y * 0.01 + 1); wall.updateMatrixWorld(true);
  rig.setBlockers([wall]); rig.update(16, [anchor]);
  assert.ok(rig.camera.position.z < wall.position.z - 0.1);
  wall.geometry.dispose(); wall.material.dispose();
});
test('mouse look rotates first-person view and clamps extreme vertical motion', () => {
  const rig = camera('FIRST_PERSON'); const before = rig.camera.getWorldDirection(new THREE.Vector3());
  rig.look(100, 100000); rig.update(16, [anchor]);
  const after = rig.camera.getWorldDirection(new THREE.Vector3());
  assert.ok(after.x > before.x); assert.ok(Math.abs(after.y + Math.sin(THREE_VIEW.maxPitch)) < 1e-8);
  rig.look(0, -100000); rig.update(16, [anchor]);
  assert.ok(Math.abs(rig.camera.getWorldDirection(new THREE.Vector3()).y + Math.sin(THREE_VIEW.minPitch)) < 1e-8);
});
test('oblique mode ignores mouse look and invalid mouse deltas', () => {
  const rig = new ShopCamera3D(1100, 800); const yaw = rig.yaw; rig.look(100, 100); assert.equal(rig.yaw, yaw);
  rig.setMode('FIRST_PERSON', 1); rig.look(NaN, 100); assert.equal(rig.yaw, yaw);
});
test('camera-relative movement matches forward and strafe for all yaw directions', () => {
  for (const yaw of [0, Math.PI / 2, Math.PI, -Math.PI / 2]) {
    const forward = cameraRelativeMovement(0, -1, yaw); const right = cameraRelativeMovement(1, 0, yaw);
    assert.ok(Math.abs(forward.x - Math.sin(yaw)) < 1e-8); assert.ok(Math.abs(forward.y - Math.cos(yaw)) < 1e-8);
    assert.ok(Math.abs(forward.x * right.x + forward.y * right.y) < 1e-8);
  }
});
test('camera-relative diagonals stay normalized', () => {
  const movement = cameraRelativeMovement(Math.SQRT1_2, -Math.SQRT1_2, 0.723);
  assert.ok(Math.abs(Math.hypot(movement.x, movement.y) - 1) < 1e-8);
});
test('perspective projection hides anchors behind the camera and keeps visible anchors', () => {
  const rig = camera('FIRST_PERSON');
  assert.equal(rig.project({ x: anchor.x, y: anchor.y - 100 }, THREE_VIEW.eyeHeight).visible, true);
  assert.equal(rig.project({ x: anchor.x, y: anchor.y + 100 }, THREE_VIEW.eyeHeight).visible, false);
});
test('paused perspective camera does not move when player anchor changes', () => {
  const rig = camera('FIRST_PERSON'); const before = rig.camera.position.clone();
  rig.update(0, [{ x: 900, y: 120 }]); assert.ok(rig.camera.position.equals(before));
});

test('first-person view follows sideways position without changing mouse viewing direction', () => {
  const rig = camera('FIRST_PERSON'); const before = rig.camera.position.clone(); const yaw = rig.yaw;
  rig.update(16, [{ x: anchor.x + 100, y: anchor.y }]);
  assert.ok(Math.abs(rig.camera.position.x - before.x - 1) < 1e-8);
  assert.ok(Math.abs(rig.camera.position.z - before.z) < 1e-8); assert.equal(rig.yaw, yaw);
});

test('third-person camera rotates behind sideways movement while keeping the character visible', () => {
  const rig = camera('THIRD_PERSON');
  for (let i = 1; i <= 120; i++) rig.update(16, [{ x: anchor.x + i, y: anchor.y }]);
  assert.ok(Math.abs(rig.yaw - Math.PI / 2) < 0.001);
  assert.ok(rig.camera.position.x < (anchor.x + 120) * 0.01); assert.equal(rig.avatarVisible, true);
});

test('third-person auto-follow preserves a held movement basis rather than causing an orbit', () => {
  const rig = camera('THIRD_PERSON'); const basis = rig.yaw; const position = { ...anchor };
  for (let i = 0; i < 120; i++) {
    const direction = cameraRelativeMovement(-1, 0, basis);
    position.x += direction.x; position.y += direction.y; rig.update(16, [position]);
  }
  assert.ok(Math.abs(position.x - anchor.x + 120) < 1e-8); assert.ok(Math.abs(position.y - anchor.y) < 1e-8);
});

test('manual mouse look temporarily overrides third-person automatic rotation', () => {
  const rig = camera('THIRD_PERSON'); rig.look(100, 0); const yaw = rig.yaw;
  rig.update(100, [{ x: anchor.x + 10, y: anchor.y }]); assert.equal(rig.yaw, yaw);
});

test('third-person camera never hides the avatar when squeezed against a wall', () => {
  const rig = camera('THIRD_PERSON');
  const wall = new THREE.Mesh(new THREE.BoxGeometry(2, 2, 0.1), new THREE.MeshBasicMaterial());
  wall.position.set(anchor.x * 0.01, 0.8, anchor.y * 0.01 + 0.35); wall.updateMatrixWorld(true);
  rig.setBlockers([wall]); rig.update(16, [anchor]);
  assert.equal(rig.avatarVisible, true); assert.ok(rig.camera.position.y > THREE_VIEW.characterHeight);
  wall.geometry.dispose(); wall.material.dispose();
});
