import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { STLLoader } from "three/examples/jsm/loaders/STLLoader.js";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
export async function preview(canvas, url, name) {
  if (!/\.(stl|glb)$/i.test(name))
    throw Error(
      "Preview supports STL and self-contained GLB; download STEP for native CAD.",
    );
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.setSize(canvas.clientWidth, canvas.clientHeight, false);
  const scene = new THREE.Scene();
  scene.background = new THREE.Color("#171817");
  const camera = new THREE.PerspectiveCamera(
    45,
    canvas.clientWidth / canvas.clientHeight,
    0.01,
    10000,
  );
  const controls = new OrbitControls(camera, canvas);
  controls.enableDamping = false;
  scene.add(new THREE.HemisphereLight(0xffffff, 0x444444, 3));
  const light = new THREE.DirectionalLight(0xffffff, 3);
  light.position.set(3, 5, 4);
  scene.add(light);
  let object;
  if (/\.stl$/i.test(name)) {
    const geometry = await new STLLoader().loadAsync(url);
    object = new THREE.Mesh(
      geometry,
      new THREE.MeshStandardMaterial({ color: "#f47b43", roughness: 0.65 }),
    );
  } else if (/\.glb$/i.test(name)) {
    object = (await new GLTFLoader().loadAsync(url)).scene;
  } else
    throw Error(
      "Preview supports STL and self-contained GLB. STEP remains available for download.",
    );
  scene.add(object);
  const bounds = new THREE.Box3().setFromObject(object);
  const center = bounds.getCenter(new THREE.Vector3());
  const size = bounds.getSize(new THREE.Vector3()).length() || 1;
  object.position.sub(center);
  camera.near = size / 1000;
  camera.far = size * 100;
  camera.position.set(size, size * 0.7, size);
  camera.updateProjectionMatrix();
  controls.target.set(0, 0, 0);
  controls.update();
  const draw = () => renderer.render(scene, camera);
  controls.addEventListener("change", draw);
  const resize = new ResizeObserver(() => {
    renderer.setSize(canvas.clientWidth, canvas.clientHeight, false);
    camera.aspect = canvas.clientWidth / canvas.clientHeight;
    camera.updateProjectionMatrix();
    draw();
  });
  resize.observe(canvas);
  draw();
  return {
    reset() {
      camera.position.set(size, size * 0.7, size);
      controls.target.set(0, 0, 0);
      controls.update();
      draw();
    },
    dispose() {
      resize.disconnect();
      controls.dispose();
      object.traverse((o) => {
        o.geometry?.dispose();
        if (o.material) {
          for (const m of [].concat(o.material)) {
            for (const value of Object.values(m))
              if (value?.isTexture) value.dispose();
            m.dispose();
          }
        }
      });
      renderer.dispose();
    },
  };
}
