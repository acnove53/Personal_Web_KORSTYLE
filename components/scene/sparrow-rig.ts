import * as THREE from "three";
import {
  sparrowCell,
  sparrowColumns,
  sparrowFrame,
  sparrowPartCell,
  sparrowRows,
  type SparrowPart,
} from "./sparrow-painting";

// A sparrow built from separate painted parts, each hung from its joint. Poses are plain numbers, so any
// controller (the flock, a lab page) can drive the same rig.

export type WingMode = "folded" | "tucked" | "flap";

export type RigPose = {
  headAngle: number; // radians, positive tips the beak down
  headLook: number; // 1 faces forward, -1 looks back over the shoulder
  tailAngle: number; // radians, positive lifts the tail
  tailFan: number; // 0 closed, 1 fanned
  wingMode: WingMode;
  wingFrame: number; // 0 (up) to 4 (down), while flapping
  wingFrameFar: number;
  wingAngle: number; // extra rotation about the shoulder, radians (positive swings the tip up and back)
  legs: 0 | 1 | 2; // hidden, gripping, trailing
  bodyPitch: number; // radians, positive lifts the beak
  bodyScaleX: number;
  bodyScaleY: number;
  fluff: number; // 0..1
  shiver: number; // radians added to the body's roll
};

export function restPose(): RigPose {
  return {
    headAngle: 0, headLook: 1, tailAngle: 0, tailFan: 0,
    wingMode: "folded", wingFrame: 2, wingFrameFar: 2, wingAngle: 0,
    legs: 1, bodyPitch: 0, bodyScaleX: 1, bodyScaleY: 1, fluff: 0, shiver: 0,
  };
}

const vertexShader = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

// Reads one cell of the sheet and breaks the edge up a little, like dry brush on paper.
const fragmentShader = /* glsl */ `
  uniform sampler2D uMap;
  uniform vec2 uCell;
  uniform vec2 uGrid;
  uniform float uOpacity;
  uniform float uShade;
  uniform float uSeed;
  varying vec2 vUv;

  float hash(vec2 p) {
    return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
  }

  void main() {
    vec2 atlasUv = vec2((uCell.x + vUv.x) / uGrid.x, 1.0 - (uCell.y + 1.0 - vUv.y) / uGrid.y);
    vec4 texel = texture2D(uMap, atlasUv);
    float grain = hash(floor(vUv * 260.0) + uSeed);
    float alpha = texel.a * mix(0.88, 1.0, grain) * uOpacity * (1.0 - 0.22 * uShade);
    vec3 rgb = texel.a > 0.001 ? texel.rgb / texel.a : vec3(0.0);
    rgb = mix(rgb, vec3(0.2, 0.13, 0.1), uShade * 0.45);
    gl_FragColor = vec4(rgb, alpha);
    #include <colorspace_fragment>
    gl_FragColor.rgb *= gl_FragColor.a;
  }
`;

export type SparrowAssets = {
  texture: THREE.Texture;
  geometries: Map<string, THREE.PlaneGeometry>;
  dispose: () => void;
};

export function createSparrowAssets(atlas: HTMLCanvasElement): SparrowAssets {
  const texture = new THREE.CanvasTexture(atlas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.premultiplyAlpha = true;
  texture.anisotropy = 4;
  const geometries = new Map<string, THREE.PlaneGeometry>();
  return {
    texture,
    geometries,
    dispose: () => {
      texture.dispose();
      for (const geometry of geometries.values()) geometry.dispose();
      geometries.clear();
    },
  };
}

type PartMesh = { mesh: THREE.Mesh; material: THREE.ShaderMaterial; part: SparrowPart };

export type SparrowRig = {
  // Positioned at the bird's feet; scale.x = -1 turns it to face left.
  root: THREE.Group;
  opacity: { value: number };
  setPose: (pose: RigPose) => void;
  dispose: () => void;
};

export function createSparrowRig(assets: SparrowAssets, size: number, seed: number): SparrowRig {
  const unit = size / sparrowCell;
  const [feetX, feetY] = sparrowFrame.feet;
  // Cell pixels (x right, y down) -> the rig's frame (feet at the origin, y up).
  const toLocal = (x: number, y: number) => new THREE.Vector3((x - feetX) * unit, (feetY - y) * unit, 0);
  const cellCentre = toLocal(sparrowCell / 2, sparrowCell / 2);
  const opacity = { value: 0 };
  const owned: PartMesh[] = [];

  const root = new THREE.Group();
  root.visible = false;
  const hip = toLocal(...sparrowFrame.hip);
  const bodyGroup = new THREE.Group();
  bodyGroup.position.copy(hip);
  root.add(bodyGroup);

  function makePart(part: SparrowPart, pivot: [number, number] | null, parent: THREE.Group, parentOrigin: THREE.Vector3, order: number, shade = 0) {
    const pivotLocal = pivot ? toLocal(pivot[0], pivot[1]) : cellCentre.clone();
    const key = `${pivot ? pivot.join(",") : "centre"}`;
    let geometry = assets.geometries.get(key);
    if (!geometry) {
      geometry = new THREE.PlaneGeometry(size, size);
      geometry.translate(cellCentre.x - pivotLocal.x, cellCentre.y - pivotLocal.y, 0);
      assets.geometries.set(key, geometry);
    }
    const { column, row } = sparrowPartCell(part);
    const material = new THREE.ShaderMaterial({
      uniforms: {
        uMap: { value: assets.texture },
        uCell: { value: new THREE.Vector2(column, row) },
        uGrid: { value: new THREE.Vector2(sparrowColumns, sparrowRows) },
        uOpacity: opacity,
        uShade: { value: shade },
        uSeed: { value: seed * 13.7 + order },
      },
      vertexShader,
      fragmentShader,
      transparent: true,
      premultipliedAlpha: true,
      // The sparrows are painted over the scene, so roots and limbs never cut them off.
      depthTest: false,
      depthWrite: false,
      toneMapped: false,
      side: THREE.DoubleSide,
    });
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.copy(pivotLocal).sub(parentOrigin);
    mesh.frustumCulled = false;
    mesh.renderOrder = 20 + order;
    parent.add(mesh);
    const entry = { mesh, material, part };
    owned.push(entry);
    return entry;
  }

  const legs = makePart("legsPerch", null, root, new THREE.Vector3(), 0);
  const tail = makePart("tail", sparrowFrame.tail, bodyGroup, hip, 1);
  const wingFar = makePart("wingFolded", sparrowFrame.shoulder, bodyGroup, hip, 2, 1);
  const body = makePart("body", [186, 228], bodyGroup, hip, 3);
  const head = makePart("head", sparrowFrame.neck, bodyGroup, hip, 4);
  const wingNear = makePart("wingFolded", sparrowFrame.shoulder, bodyGroup, hip, 5);

  const wingCells: SparrowPart[] = ["wingUp", "wingUpMid", "wingLevel", "wingDownMid", "wingDown"];
  const setCell = (entry: PartMesh, part: SparrowPart) => {
    if (entry.part === part) return;
    entry.part = part;
    const { column, row } = sparrowPartCell(part);
    (entry.material.uniforms.uCell.value as THREE.Vector2).set(column, row);
  };
  const clampFrame = (frame: number) => THREE.MathUtils.clamp(Math.round(frame), 0, 4);

  function setPose(pose: RigPose) {
    head.mesh.rotation.z = -pose.headAngle;
    const look = Math.abs(pose.headLook) < 0.14 ? 0.14 * (pose.headLook < 0 ? -1 : 1) : pose.headLook;
    head.mesh.scale.x = look;

    tail.mesh.rotation.z = -pose.tailAngle;
    setCell(tail, pose.tailFan > 0.5 ? "tailFan" : "tail");

    bodyGroup.rotation.z = pose.bodyPitch + pose.shiver;
    bodyGroup.scale.set(pose.bodyScaleX, pose.bodyScaleY, 1);
    body.mesh.scale.set(1 + pose.fluff * 0.08, 1 + pose.fluff * 0.1, 1);

    if (pose.wingMode === "folded") {
      setCell(wingNear, "wingFolded");
      wingFar.mesh.visible = false;
      wingNear.mesh.rotation.z = pose.wingAngle;
      wingNear.mesh.scale.setScalar(1 + pose.fluff * 0.06);
    } else if (pose.wingMode === "tucked") {
      setCell(wingNear, "wingTucked");
      setCell(wingFar, "wingTucked");
      wingFar.mesh.visible = true;
      wingNear.mesh.rotation.z = wingFar.mesh.rotation.z = pose.wingAngle;
      wingNear.mesh.scale.setScalar(1);
      wingFar.mesh.scale.setScalar(1);
    } else {
      const near = THREE.MathUtils.clamp(pose.wingFrame, 0, 4);
      const far = THREE.MathUtils.clamp(pose.wingFrameFar, 0, 4);
      setCell(wingNear, wingCells[clampFrame(near)]);
      setCell(wingFar, wingCells[clampFrame(far)]);
      wingFar.mesh.visible = true;
      // Between sheet frames the wing swings a little, so the beat does not step.
      wingNear.mesh.rotation.z = pose.wingAngle - (near - Math.round(near)) * 0.22;
      wingFar.mesh.rotation.z = pose.wingAngle - (far - Math.round(far)) * 0.22 + 0.05;
      wingNear.mesh.scale.setScalar(1);
      wingFar.mesh.scale.setScalar(0.96);
    }

    legs.mesh.visible = pose.legs !== 0;
    if (pose.legs !== 0) setCell(legs, pose.legs === 1 ? "legsPerch" : "legsTrail");
  }

  setPose(restPose());

  return {
    root,
    opacity,
    setPose,
    dispose: () => {
      for (const entry of owned) entry.material.dispose();
    },
  };
}
