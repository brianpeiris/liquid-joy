/* global THREE, WEBVR, CANNON, Stats */
const { STATIC } = CANNON.Body;
var container, stats;

var camera, scene, renderer, controllers;

var light, pointLight, ambientLight;

var effect;

var clock = new THREE.Clock();

const world = new CANNON.World();
world.gravity.set(0, -0.02, 0);
world.broadphase = new CANNON.NaiveBroadphase();
world.solver.iterations = 10;

const groundShape = new CANNON.Plane();
const groundBody = new CANNON.Body({ type: STATIC, mass: 0 });
groundBody.position.set(0, 0.63, 0);
groundBody.quaternion.setFromAxisAngle(new CANNON.Vec3(1, 0, 0), -Math.PI / 2);
groundBody.addShape(groundShape);
world.add(groundBody);

const shape = new CANNON.Sphere(0.04);
const bodies = [];
const body = new CANNON.Body({ mass: 1, shape });
body.position.set(0, 1.5, -0.5);
world.add(body);
bodies.push(body);

var path = "textures/";
var format = ".tga.jpg";
var urls = [
  path + "ss_rt" + format,
  path + "ss_lf" + format,
  path + "ss_dn" + format,
  path + "ss_up" + format,
  path + "ss_bk" + format,
  path + "ss_ft" + format
];
var cubeTextureLoader = new THREE.CubeTextureLoader();
var reflectionCube = cubeTextureLoader.load(urls);

init();

function init() {
  container = document.getElementById("container");

  camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.01, 100);
  camera.position.set(0, 1, 1);

  scene = new THREE.Scene();
  scene.background = reflectionCube;
  scene.add(camera);

  light = new THREE.DirectionalLight(0xffffff);
  light.position.set(0.3, 0.4, 0.5);
  scene.add(light);

  pointLight = new THREE.PointLight(0xff3300);
  pointLight.position.set(0, 0, -5);
  scene.add(pointLight);

  ambientLight = new THREE.AmbientLight(0x080808);
  scene.add(ambientLight);

  effect = new THREE.MarchingCubes(36, generateMaterial());
  effect.position.set(0, 1.0, -0.5);
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
    { obj: renderer.vr.getController(0), body: new CANNON.Body({ mass: 1, shape }) },
    { obj: renderer.vr.getController(1), body: new CANNON.Body({ mass: 1, shape }) }
  ];
  bodies.push(controllers[0].body);
  bodies.push(controllers[1].body);
  world.add(controllers[0].body);
  world.add(controllers[1].body);
  scene.add(controllers[0].obj);
  scene.add(controllers[1].obj);

  renderer.setAnimationLoop(animate);

  container.appendChild(renderer.domElement);
  container.appendChild(WEBVR.createButton(renderer));

  stats = new Stats();
  container.appendChild(stats.dom);

  window.addEventListener("resize", onWindowResize, false);
}

function onWindowResize() {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();

  renderer.setSize(window.innerWidth, window.innerHeight);
}

function generateMaterial() {
  return new THREE.MeshStandardMaterial({ color: 0x550000, envMap: reflectionCube, roughness: 0.1, metalness: 1.0 });
}

const localBody = new THREE.Vector3();
function updateCubes(object, time, numblobs, floor) {
  object.reset();

  const subtract = 12;
  const strength = 0.2;

  /*
  var i, ballx, bally, ballz, subtract, strength;
  time = time / 2;

  for (i = 0; i < numblobs; i++) {
    ballx = Math.sin(i + 1.26 * time * (1.03 + 0.5 * Math.cos(0.21 * i))) * 0.27 + 0.5;
    bally = Math.abs(Math.cos(i + 1.12 * time * Math.cos(1.22 + 0.1424 * i))) * 0.77; // dip into the floor
    ballz = Math.cos(i + 1.32 * time * 0.1 * Math.sin(0.92 + 0.53 * i)) * 0.27 + 0.5;

    object.addBall(ballx, bally, ballz, strength, subtract);
  }
  */

  for (const body of bodies) {
    localBody.copy(body.position);
    effect.worldToLocal(localBody);
    localBody.multiplyScalar(0.5);
    localBody.addScalar(0.5);
    const { x, y, z } = localBody;
    object.addBall(x, y, z, strength, subtract);
  }

  if (floor) object.addPlaneY(2, 12);
}

const sub = new THREE.Vector3();
function animate() {
  const elapsed = clock.getElapsedTime();
  for (const controller of controllers) {
    sub.copy(controller.obj.position);
    sub.sub(controller.body.position);
    sub.multiplyScalar(10);
    controller.body.velocity.copy(sub);
  }
  world.step(1 / 60, elapsed);
  updateCubes(effect, elapsed, 10, true);
  renderer.render(scene, camera);
  stats.update();
}
