/* global THREE, WEBVR, CANNON, _ */
const { STATIC } = CANNON.Body;
var container;

var camera, scene, renderer, controllers;

var effect;

var clock = new THREE.Clock();

const world = new CANNON.World();
const GRAVITY = -0.005;
world.gravity.set(0, GRAVITY, 0);
world.broadphase = new CANNON.NaiveBroadphase();
world.solver.iterations = 10;

const boundaryShape = new CANNON.Plane();
const boundaryMaterial = new CANNON.Material();
let boundary = new CANNON.Body({ type: STATIC, mass: 0, material: boundaryMaterial, shape: boundaryShape });
boundary.position.set(0, 0.75, 0);
boundary.quaternion.setFromAxisAngle(new CANNON.Vec3(1, 0, 0), -Math.PI / 2 + 0.05);
world.add(boundary);
boundary = new CANNON.Body({ type: STATIC, mass: 0, material: boundaryMaterial, shape: boundaryShape });
boundary.position.set(0, 0, 0);
boundary.quaternion.setFromAxisAngle(new CANNON.Vec3(1, 0, 0), Math.PI);
world.add(boundary);
boundary = new CANNON.Body({ type: STATIC, mass: 0, material: boundaryMaterial, shape: boundaryShape });
boundary.position.set(0, 0, -1.0);
boundary.quaternion.setFromAxisAngle(new CANNON.Vec3(0, 0, 1), Math.PI);
world.add(boundary);
boundary = new CANNON.Body({ type: STATIC, mass: 0, material: boundaryMaterial, shape: boundaryShape });
boundary.position.set(-0.5, 0, -0.5);
boundary.quaternion.setFromAxisAngle(new CANNON.Vec3(0, 1, 0), Math.PI / 2);
world.add(boundary);
boundary = new CANNON.Body({ type: STATIC, mass: 0, material: boundaryMaterial, shape: boundaryShape });
boundary.position.set(0.5, 0, -0.5);
boundary.quaternion.setFromAxisAngle(new CANNON.Vec3(0, 1, 0), -Math.PI / 2);
world.add(boundary);
boundary = new CANNON.Body({ type: STATIC, mass: 0, material: boundaryMaterial, shape: boundaryShape });
boundary.position.set(0, 1.65, 0);
boundary.quaternion.setFromAxisAngle(new CANNON.Vec3(1, 0, 0), Math.PI / 2);
world.add(boundary);

const bodies = [];
const buffers = [];
const listener = new THREE.AudioListener();

const shape = new CANNON.Sphere(0.04);
const material = new CANNON.Material();
world.addContactMaterial(new CANNON.ContactMaterial(boundaryMaterial, material, { restitution: 0.5 }));
function addBall(pos) {
  const body = new CANNON.Body({ mass: 1, shape, material });
  body.position.copy(pos);
  body.position.y -= 0.1;
  world.add(body);
  const ball = { isBall: true, body, color: new THREE.Color("green") };
  ball.audio = new THREE.PositionalAudio(listener);
  bodies.push(ball);
  body.addEventListener("collide", () => {
    if (!ball.audio || !buffers.length) return;
    ball.audio.setBuffer(buffers[Math.floor(Math.random() * buffers.length)]);
    ball.audio.detune = (Math.random() - 0.5) * 2 * 600;
    const volume = THREE.Math.clamp(body.velocity.length() * 10, 0.1, 1);
    if (ball.audio.isPlaying) ball.audio.stop();
    ball.audio.setVolume(volume);
    ball.audio.play();
  });
}
addBall(new THREE.Vector3(0, 1.6, -0.5));

function addButton(color, pos, handler) {
  const pivot = new CANNON.Body({ type: STATIC, mass: 0 });
  pivot.position.copy(pos);
  world.add(pivot);
  const body = new CANNON.Body({ mass: 1, shape });
  body.position.copy(pos);
  world.add(body);
  world.addConstraint(new CANNON.PointToPointConstraint(pivot, CANNON.Vec3.ZERO, body, CANNON.Vec3.ZERO, 0.05));
  const ball = { body, color: new THREE.Color(color) };
  ball.audio = new THREE.PositionalAudio(listener);
  bodies.push(ball);
  body.addEventListener(
    "collide",
    _.debounce(
      () => {
        if (!ball.audio || !buffers.length) return;
        ball.audio.setBuffer(buffers[Math.floor(Math.random() * buffers.length)]);
        ball.audio.detune = (Math.random() - 0.5) * 2 * 600;
        const volume = THREE.Math.clamp(body.velocity.length() * 10, 0.1, 1);
        if (ball.audio.isPlaying) ball.audio.stop();
        ball.audio.setVolume(volume);
        ball.audio.play();
        handler();
      },
      200,
      { leading: true, trailing: false }
    )
  );
  return ball;
}
addButton("yellow", new THREE.Vector3(0.4, 1.0, -0.4), () => {
  addBall(new THREE.Vector3(0, 1.6, -0.5));
});
const gravityButton = addButton("purple", new THREE.Vector3(0.4, 1, -0.2), () => {
  if (world.gravity.y === 0) {
    world.gravity.y = GRAVITY;
    gravityButton.color.setStyle("purple");
  } else {
    gravityButton.color.setStyle("grey");
    world.gravity.y = 0;
    for (const body of bodies) {
      if (!body.isBall) continue;
      body.body.applyImpulse(new CANNON.Vec3(0, 0.01, 0), CANNON.Vec3.ZERO);
    }
  }
});

var path = "textures/";
var format = ".jpg";
var urls = [
  path + "px" + format,
  path + "nx" + format,
  path + "py" + format,
  path + "ny" + format,
  path + "pz" + format,
  path + "nz" + format
];
var cubeTextureLoader = new THREE.CubeTextureLoader();
var reflectionCube = cubeTextureLoader.load(urls);

init();

function init() {
  container = document.getElementById("container");

  const audioLoader = new THREE.AudioLoader();
  audioLoader.load("splash.mp3", buffer => buffers.push(buffer));
  audioLoader.load("splash2.mp3", buffer => buffers.push(buffer));
  audioLoader.load("podington-bear-memory-wind.mp3", buffer => {
    const music = new THREE.Audio(listener);
    music.setBuffer(buffer);
    music.setLoop(true);
    music.setVolume(0.05);
    music.play();
  });

  camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.01, 100);
  camera.position.set(0, 1, 1);
  camera.add(listener);

  scene = new THREE.Scene();
  scene.background = reflectionCube;
  scene.add(camera);

  const light = new THREE.DirectionalLight(0xff3300);
  light.position.set(1, 0.5, -1);
  scene.add(light);

  effect = new THREE.MarchingCubes(36, generateMaterial(), false, true);
  effect.position.set(0, 1.2, -0.5);
  effect.scale.setScalar(0.5);

  scene.add(effect);

  renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.gammaOutput = true;
  renderer.vr.enabled = true;
  renderer.setPixelRatio(window.devicePixelRatio);
  renderer.setSize(window.innerWidth, window.innerHeight);

  renderer.domElement.style.position = "absolute";
  renderer.domElement.style.top = "0px";
  renderer.domElement.style.left = "0px";

  controllers = [
    {
      obj: renderer.vr.getController(0),
      body: new CANNON.Body({ mass: 0, shape }),
      held: { offset: new THREE.Vector3() }
    },
    {
      obj: renderer.vr.getController(1),
      body: new CANNON.Body({ mass: 0, shape }),
      held: { offset: new THREE.Vector3() }
    }
  ];
  bodies.push({ body: controllers[0].body, color: new THREE.Color("red") });
  bodies.push({ body: controllers[1].body, color: new THREE.Color("blue") });
  world.add(controllers[0].body);
  world.add(controllers[1].body);
  scene.add(controllers[0].obj);
  scene.add(controllers[1].obj);

  controllers[0].obj.addEventListener("selectstart", () => {
    controllers[0].pressed = true;
  });
  controllers[0].obj.addEventListener("selectend", () => {
    controllers[0].pressed = false;
  });
  controllers[1].obj.addEventListener("selectstart", () => {
    controllers[1].pressed = true;
  });
  controllers[1].obj.addEventListener("selectend", () => {
    controllers[1].pressed = false;
  });

  renderer.setAnimationLoop(animate);

  container.appendChild(renderer.domElement);
  container.appendChild(WEBVR.createButton(renderer));

  //stats = new Stats();
  //container.appendChild(stats.dom);

  window.addEventListener("resize", onWindowResize, false);
}

function onWindowResize() {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();

  renderer.setSize(window.innerWidth, window.innerHeight);
}

function generateMaterial() {
  return new THREE.MeshStandardMaterial({
    color: "white",
    envMap: reflectionCube,
    roughness: 0.1,
    metalness: 0.9,
    vertexColors: THREE.VertexColors
  });
}

const localBody = new THREE.Vector3();
function updateCubes(object) {
  object.reset();

  const subtract = 12;
  const strength = 0.25;

  for (const body of bodies) {
    localBody.copy(body.body.position);
    effect.worldToLocal(localBody);
    localBody.multiplyScalar(0.5);
    localBody.addScalar(0.5);
    const { x, y, z } = localBody;
    object.addBall(x, y, z, strength, subtract, body.color);
  }

  object.addPlaneY(strength, subtract);
}

const rotatedOffset = new THREE.Vector3();
const quatConj = new THREE.Quaternion();
function animate() {
  const elapsed = clock.getElapsedTime();
  for (const controller of controllers) {
    if (!controller.pressed && controller.held.body) {
      controller.held.body = null;
    }
    if (!controller.held.body && controller.pressed) {
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
  }
  world.step(1 / 60, elapsed);
  for (const body of bodies) {
    if (!body.audio) continue;
    body.audio.position.copy(body.body.position);
    body.audio.updateMatrixWorld();
  }
  updateCubes(effect);
  renderer.render(scene, camera);
  //stats.update();
}
