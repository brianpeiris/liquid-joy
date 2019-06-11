/* global THREE, WEBVR, CANNON, _ */

const { STATIC } = CANNON.Body;
const { ZERO, UNIT_X, UNIT_Y, UNIT_Z } = CANNON.Vec3;

let camera, scene, renderer, marchingCubes;
const controllers = [];

const world = new CANNON.World();
const GRAVITY = -0.005;

const boundaryMaterial = new CANNON.Material();
const ballShape = new CANNON.Sphere(0.04);
const bodies = [];

const splashBuffers = [];
const listener = new THREE.AudioListener();

function playSplash(body, audio, done) {
  return () => {
    if (!splashBuffers.length) return;
    if (audio.isPlaying) audio.stop();
    audio.setBuffer(splashBuffers[Math.floor(Math.random() * splashBuffers.length)]);
    audio.detune = (Math.random() - 0.5) * 2 * 600;
    const volume = THREE.Math.clamp(body.velocity.length() * 20, 0.1, 2);
    audio.setVolume(volume);
    audio.play();
    if (done) done();
  };
}

const addBoundary = (() => {
  const boundaryShape = new CANNON.Plane();
  return (x, y, z, axis, angle) => {
    const boundary = new CANNON.Body({ type: STATIC, mass: 0, material: boundaryMaterial, shape: boundaryShape });
    boundary.position.set(x, y, z);
    boundary.quaternion.setFromAxisAngle(axis, angle);
    world.add(boundary);
  };
})();

const addBall = (() => {
  const material = new CANNON.Material();
  world.addContactMaterial(new CANNON.ContactMaterial(boundaryMaterial, material, { restitution: 0.5 }));
  return pos => {
    const body = new CANNON.Body({ mass: 1, shape: ballShape, material });
    body.position.copy(pos);
    world.add(body);

    const ball = { isBall: true, body, color: new THREE.Color("green") };
    const audio = new THREE.PositionalAudio(listener);
    bodies.push(ball);

    body.addEventListener("collide", playSplash(body, audio));
  };
})();

function addButton(color, pos, handler) {
  const pivot = new CANNON.Body({ type: STATIC, mass: 0 });
  pivot.position.copy(pos);
  world.add(pivot);

  const body = new CANNON.Body({ mass: 1, shape: ballShape });
  body.position.copy(pos);
  world.add(body);

  world.addConstraint(new CANNON.PointToPointConstraint(pivot, ZERO, body, ZERO, 0.05));

  const ball = { body, color: new THREE.Color(color) };
  const audio = new THREE.PositionalAudio(listener);
  bodies.push(ball);

  handler = handler.bind(ball);
  body.addEventListener(
    "collide",
    _.debounce(playSplash(body, audio, handler), 200, { leading: true, trailing: false })
  );
  return ball;
}

function loadAudio() {
  const audioLoader = new THREE.AudioLoader();
  audioLoader.load("sounds/splash.mp3", buffer => splashBuffers.push(buffer));
  audioLoader.load("sounds/splash2.mp3", buffer => splashBuffers.push(buffer));
  audioLoader.load("sounds/podington-bear-memory-wind.mp3", buffer => {
    const music = new THREE.Audio(listener);
    music.setBuffer(buffer);
    music.setLoop(true);
    music.setVolume(0.1);
    music.play();
  });
}

function loadEnvMap() {
  const path = "textures/";
  const format = ".jpg";
  const urls = [
    path + "px" + format,
    path + "nx" + format,
    path + "py" + format,
    path + "ny" + format,
    path + "pz" + format,
    path + "nz" + format
  ];
  const cubeTextureLoader = new THREE.CubeTextureLoader();
  return cubeTextureLoader.load(urls);
}

function initController(id, color) {
  const obj = renderer.vr.getController(id);
  const body = new CANNON.Body({ mass: 0, shape: ballShape });
  const controller = {
    obj,
    body,
    pressed: false,
    held: { body: null, offset: new THREE.Vector3() }
  };

  controllers.push(controller);
  bodies.push({ body, color: new THREE.Color(color) });
  world.add(body);
  scene.add(obj);

  obj.addEventListener("selectstart", () => {
    controller.pressed = true;
  });
  obj.addEventListener("selectend", () => {
    controller.pressed = false;
  });
}

function initRenderer() {
  renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.gammaOutput = true;
  renderer.vr.enabled = true;
  renderer.setPixelRatio(window.devicePixelRatio);
  renderer.setSize(window.innerWidth, window.innerHeight);

  renderer.domElement.style.position = "absolute";
  renderer.domElement.style.top = "0px";
  renderer.domElement.style.left = "0px";

  renderer.setAnimationLoop(animate);

  const container = document.getElementById("container");
  container.appendChild(renderer.domElement);
  container.appendChild(WEBVR.createButton(renderer));
}

function initMarchingCubes(envMap) {
  const marchingCubesMaterial = new THREE.MeshStandardMaterial({
    color: "white",
    envMap,
    roughness: 0.1,
    metalness: 0.9,
    vertexColors: THREE.VertexColors
  });
  marchingCubes = new THREE.MarchingCubes(36, marchingCubesMaterial, false, true);
  marchingCubes.position.set(0, 1.2, -0.5);
  marchingCubes.scale.setScalar(0.5);
  scene.add(marchingCubes);
}

function toggleGravity() {
  if (world.gravity.y === 0) {
    world.gravity.y = GRAVITY;
    this.color.setStyle("purple");
  } else {
    this.color.setStyle("grey");
    world.gravity.y = 0;
    for (const body of bodies) {
      if (!body.isBall) continue;
      body.body.applyImpulse(new CANNON.Vec3(0, 0.01, 0), ZERO);
    }
  }
}

function init() {
  loadAudio();

  world.gravity.set(0, GRAVITY, 0);
  world.broadphase = new CANNON.NaiveBroadphase();
  world.solver.iterations = 10;

  camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.01, 100);
  camera.position.set(0, 1, 1);
  camera.add(listener);

  const envMap = loadEnvMap();

  scene = new THREE.Scene();
  scene.background = envMap;
  scene.add(camera);

  const light = new THREE.DirectionalLight(0xff3300);
  light.position.set(1, 0.5, -1);
  scene.add(light);

  addBoundary(0, 0.75, 0, UNIT_X, -Math.PI / 2 + 0.05);
  addBoundary(0, 0, 0, UNIT_X, Math.PI);
  addBoundary(0, 0, -1, UNIT_Z, Math.PI);
  addBoundary(-0.5, 0, -0.5, UNIT_Y, Math.PI / 2);
  addBoundary(0.5, 0, -0.5, UNIT_Y, -Math.PI / 2);
  addBoundary(0, 1.65, 0, UNIT_X, Math.PI / 2);

  addBall(new THREE.Vector3(0, 1.6, -0.5));

  addButton("yellow", new THREE.Vector3(0.4, 1.0, -0.4), () => addBall(new THREE.Vector3(0, 1.6, -0.5)));
  addButton("purple", new THREE.Vector3(0.4, 1, -0.2), toggleGravity);

  initMarchingCubes(envMap);

  initRenderer();

  initController(0, "red");
  initController(1, "blue");

  window.addEventListener("resize", onWindowResize, false);
}

function onWindowResize() {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();

  renderer.setSize(window.innerWidth, window.innerHeight);
}

const updateCubes = (() => {
  const localBody = new THREE.Vector3();
  return () => {
    marchingCubes.reset();

    const subtract = 12;
    const strength = 0.25;

    for (const body of bodies) {
      localBody.copy(body.body.position);
      marchingCubes.worldToLocal(localBody);
      localBody.multiplyScalar(0.5);
      localBody.addScalar(0.5);
      const { x, y, z } = localBody;
      marchingCubes.addBall(x, y, z, strength, subtract, body.color);
    }

    marchingCubes.addPlaneY(strength, subtract);
  };
})();

const updateController = (() => {
  const rotatedOffset = new THREE.Vector3();
  const quatConj = new THREE.Quaternion();

  return controller => {
    if (!controller.pressed && controller.held.body) {
      controller.held.body = null;
    }

    if (controller.pressed && !controller.held.body) {
      for (const body of bodies) {
        if (!body.isBall) continue;
        if (body.body.position.distanceTo(controller.obj.position) < 0.15) {
          controller.held.body = body.body;
          controller.held.offset.subVectors(body.body.position, controller.obj.position);
          quatConj.copy(controller.obj.quaternion);
          controller.held.offset.applyQuaternion(quatConj.conjugate());
          break;
        }
      }
    }

    controller.body.position.copy(controller.obj.position);

    if (controller.held.body) {
      rotatedOffset.copy(controller.held.offset);
      rotatedOffset.applyQuaternion(controller.obj.quaternion);
      rotatedOffset.add(controller.obj.position);
      rotatedOffset.subVectors(rotatedOffset, controller.held.body.position);
      controller.held.body.velocity.copy(rotatedOffset);
    }
  };
})();

const animate = (() => {
  const clock = new THREE.Clock();

  return () => {
    const delta = clock.getDelta();

    for (const controller of controllers) {
      updateController(controller);
    }

    world.step(delta, clock.elapsedTime);

    for (const body of bodies) {
      if (!body.audio) continue;
      body.audio.position.copy(body.body.position);
      body.audio.updateMatrixWorld();
    }

    updateCubes();

    renderer.render(scene, camera);
  };
})();

init();
