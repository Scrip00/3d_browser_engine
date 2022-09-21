var vs = `
attribute vec4 position;
void main() {
  gl_Position = position;
}
`;
var fs = `
precision highp float;
uniform sampler2D u_texture;
uniform vec2 camDir;
uniform vec3 camPos;
uniform float time;
uniform bool isMoving;
uniform float sampleFrames;
#define MAX_DIST 1000.
#define CORRECTION .01
#define MAX_REF 100
vec3 light = -normalize(vec3(-0.5, -1., -0.75));

vec2 boxIntersection(in vec3 ro, in vec3 rd, vec3 boxSize, out vec3 outNormal) {
  vec3 m = 1.0 / rd; // can precompute if traversing a set of aligned boxes
  vec3 n = m * ro;   // can precompute if traversing a set of aligned boxes
  vec3 k = abs(m) * boxSize;
  vec3 t1 = -n - k;
  vec3 t2 = -n + k;
  float tN = max(max(t1.x, t1.y), t1.z);
  float tF = min(min(t2.x, t2.y), t2.z);
  if(tN > tF || tF < 0.0)
    return vec2(-1.0); // no intersection
  outNormal = -sign(rd) * step(t1.yzx, t1.xyz) * step(t1.zxy, t1.xyz);
  return vec2(tN, tF);
}

vec2 sphIntersect(in vec3 ro, in vec3 rd, float ra) {
  float b = dot(ro, rd);
  float c = dot(ro, ro) - ra * ra;
  float h = b * b - c;
  if(h < 0.0)
    return vec2(-1.0);
  h = sqrt(h);
  return vec2(-b - h, -b + h);
}

vec2 plaIntersect(in vec3 ro, in vec3 rd, in vec4 p) {
  return vec2(-(dot(ro, p.xyz) + p.w) / dot(rd, p.xyz));
}

bool minDist(vec2 d1, vec2 d2) {
  return d2.x > 0. && d1.x > d2.x;
}

float random(vec2 st) {
  return fract(sin(dot(st.xy, vec2(12.9898, 78.233))) * 43758.5453123);
}

vec3 rand(vec2 st) {
  vec3 rand = vec3(random(st), random(st + vec2(1.0)), random(st + vec2(10.0)));
  float theta = rand.x * 2.0 * 3.14159265;
  float v = rand.y;
  float phi = acos(2.0 * v - 1.0);
  float r = pow(rand.z, 1.0 / 3.0);
  float x = r * sin(phi) * cos(theta);
  float y = r * sin(phi) * sin(theta);
  float z = r * cos(phi);
  return vec3(x, y, z);
}

void rayMat(out vec3 ro, out vec3 rd, vec3 n, vec2 d, out vec3 col, vec4 mat, float randN) {
  if(d.x == MAX_DIST || d.x == -1.)
    return;
  if(mat.a == -1.) {
    col *= mat.rgb;
    ro += rd * (d.x - CORRECTION);
    rd = reflect(rd, n);
  } else if(mat.a == -2.) {
    col *= mat.rgb;
    float coef = 1.2;
    if(d.x > d.y) {
      ro += rd * (d.x + CORRECTION);
      rd = refract(rd, n, coef);
    } else {
      if(random(vec2(ro.x + randN + time, ro.y + randN + time)) > dot(n, -rd)) {
        ro += rd * (d.x - CORRECTION);
        rd = reflect(rd, n);
      } else {
        ro += rd * (d.y + CORRECTION);
        rd = refract(rd, n, 2. - coef);
      }
    }
  } else if(mat.a >= 0. && mat.a <= 1.) {
    col *= mat.rgb;
    ro += rd * (d.x - CORRECTION);
    vec3 diff = rand(vec2(ro.x + randN + time, ro.y + randN + time));
    diff = normalize(diff * dot(diff, n));
    vec3 reflect = reflect(rd, n);
    rd = mix(diff, reflect, mat.a);
  } else if(mat.a == -3.) {
    col *= mat.rgb;
    rd.x = -2.;
  }
}

vec2 map(out vec3 ro, out vec3 rd, out vec3 col, int rand) {
  vec2 d;
  vec3 tempN;
  vec3 n;
  vec4 mat, tempMat;
  vec2 minD = vec2(MAX_DIST);

  vec3 planeN = vec3(0., 1., 0.);
  d = plaIntersect(ro, rd, vec4(planeN, 1.));
  tempMat = vec4(1., .8, .8, 0.1);
  if(minDist(minD, d)) {
    mat = tempMat;
    minD = d;
    n = planeN;
  }

  d = sphIntersect(ro - vec3(0., 0., 4.), rd, 1.);
  tempMat = vec4(.8, .1, .1, -3.);
  if(minDist(minD, d)) {
    mat = tempMat;
    minD = d;
    n = normalize(ro + rd * d.x - vec3(0., 0., 4.));
  }

  d = sphIntersect(ro - vec3(1., 0., 2.), rd, 1.);
  tempMat = vec4(.8, .1, .1, -2.);
  if(minDist(minD, d)) {
    mat = tempMat;
    minD = d;
    n = normalize(ro + rd * d.x - vec3(1., 0., 2.));
  }

  d = boxIntersection(ro - vec3(4., 0., 5.), rd, vec3(1.), tempN);
  tempMat = vec4(.65, .3, .47, -2.);
  if(minDist(minD, d)) {
    mat = tempMat;
    minD = d;
    n = tempN;
  }

  d = boxIntersection(ro - vec3(8., 0., 5.), rd, vec3(1.), tempN);
  tempMat = vec4(.65, .3, .47, -1.);
  if(minDist(minD, d)) {
    mat = tempMat;
    minD = d;
    n = tempN;
  }

  rayMat(ro, rd, n, minD, col, mat, float(rand));

  return minD;
}

vec3 getSky(in vec3 rd) {
  return vec3(0.31, 0.63, 0.98) * 0.01 + vec3(pow(max(dot(rd, light), 0.), 128.)) * 10.;
}

vec3 traceRay(in vec3 ro, in vec3 rd, int rand) {
  vec3 col = vec3(1.);
  vec3 n;
  vec2 d;
  for(int i = 0; i < MAX_REF; i++) {
    d = map(ro, rd, col, rand);
    if(rd.x == -2.)
      return col;
    if(d.x < 0.0 || d.x == MAX_DIST)
      return getSky(rd) * col;
  }
  return col;
}

void main() {

  vec2 iResolution = vec2(600, 600);

  vec2 uv = (gl_FragCoord.xy - .5 * iResolution.xy) / iResolution.y;

  vec3 col = vec3(0);

  vec3 ro = camPos;
  float sens = 10.;

  vec3 lookat = vec3(0., 0., 1.);

  lookat.xz *= mat2(cos(camDir.x * sens), -sin(camDir.x * sens), sin(camDir.x * sens), cos(camDir.x * sens));

  float vang = camDir.y;

  if(vang > 3.14 / 2.)
    vang = 3.14 / 2.;
  if(vang < -3.14 / 2.)
    vang = -3.14 / 2.;

  vec3 camRot = vec3(lookat.x, lookat.y, lookat.z);
  lookat.y = camRot.y * cos(vang) + pow(pow(camRot.x, 2.) + pow(camRot.z, 2.), 0.5) * sin(vang);
  float len = pow(pow(camRot.x, 2.) + pow(camRot.z, 2.), 0.5) * cos(vang) - camRot.y * sin(vang);
  lookat.x = camRot.x / pow(pow(camRot.x, 2.) + pow(camRot.z, 2.), 0.5) * len;
  lookat.z = camRot.z / pow(pow(camRot.x, 2.) + pow(camRot.z, 2.), 0.5) * len;

  lookat += ro;

  float zoom = 1.;

  vec3 f = normalize(lookat - ro);
  vec3 r = normalize(cross(vec3(0., 1., 0.), f));
  vec3 u = cross(f, r);

  vec3 c = ro + f * zoom;
  vec3 i = c + uv.x * r + uv.y * u;
  vec3 rd = i - ro;

  const int numSamples = 256;
  for(int i = 0; i < numSamples; i++) {
    col += traceRay(ro, normalize(rd), i);
  }
  col /= vec3(numSamples);

  float white = 1.0; // gamma correction
  col *= white * 16.0;
  col = (col * (1.0 + col / white / white)) / (1.0 + col);

  if(!isMoving) {
    vec2 coord = gl_FragCoord.xy / iResolution.xy;
    vec4 pixel = texture2D(u_texture, coord);
    col = mix(pixel.rgb, col, sampleFrames);
  }

  gl_FragColor = vec4(col, 1.0);
}
`;

var canvas = document.querySelector("canvas");
var gl = canvas.getContext("webgl");
let vertexShader = createShader(gl, gl.VERTEX_SHADER, vs);
let fragmentShader = createShader(gl, gl.FRAGMENT_SHADER, fs);

let program = createProgram(gl, vertexShader, fragmentShader);

// РОман хонсалес И Мария Выблюдосивна ПРЕДСТАВЛЮЯТ

var positionLocation = gl.getAttribLocation(program, "position");
const positionAttributeLocation = gl.getAttribLocation(program, "a_position");
const timeAttributeLocation = gl.getUniformLocation(program, "time");
const camPositionAttributeLocation = gl.getUniformLocation(program, "camPos");
const camDirectionAttributeLocation = gl.getUniformLocation(program, "camDir");
const isMovingAttributeLocation = gl.getUniformLocation(program, "isMoving");
const sampleFramesAttributeLocation = gl.getUniformLocation(program, "sampleFrames");
// we don't need to look up the texture's uniform location because
// we're only using 1 texture. Since the uniforms default to 0
// it will use texture 0.

resizeCanvasToDisplaySize(gl.canvas);
canvas.width = canvas.clientWidth;
canvas.heigth = canvas.clientHeight;

// put in a clipspace quad
var buffer = gl.createBuffer();
gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([
  -1, -1,
  1, -1,
  -1, 1,
  -1, 1,
  1, -1,
  1, 1,
]), gl.STATIC_DRAW);


gl.enableVertexAttribArray(positionLocation);
gl.vertexAttribPointer(positionLocation, 2, gl.FLOAT, false, 0, 0);

// make 2 1x1 pixel textures and put a red pixel the first one
var tex1 = gl.createTexture();
gl.bindTexture(gl.TEXTURE_2D, tex1);
gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.canvas.width, gl.canvas.height, 0, gl.RGBA,
  gl.UNSIGNED_BYTE, null);
gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
var tex2 = gl.createTexture();
gl.bindTexture(gl.TEXTURE_2D, tex2);
gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.canvas.width, gl.canvas.height, 0, gl.RGBA,
  gl.UNSIGNED_BYTE, null);
gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

// make a framebuffer for tex1
var fb1 = gl.createFramebuffer();
gl.bindFramebuffer(gl.FRAMEBUFFER, fb1);
// attach tex1
gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0,
  gl.TEXTURE_2D, tex1, 0);
// check this will actually work
if (gl.checkFramebufferStatus(gl.FRAMEBUFFER) !==
  gl.FRAMEBUFFER_COMPLETE) {
  alert("this combination of attachments not supported");
}

// make a framebuffer for tex2
var fb2 = gl.createFramebuffer();
gl.bindFramebuffer(gl.FRAMEBUFFER, fb2);
// attach tex2
gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0,
  gl.TEXTURE_2D, tex2, 0);
// check this will actually work
if (gl.checkFramebufferStatus(gl.FRAMEBUFFER) !==
  gl.FRAMEBUFFER_COMPLETE) {
  alert("this combination of attachments not supported");
}
var fps = 60;

var time = 0;
var camPos = [0.0, 1.0, 0.0];
var vsd = [false, false, false, false, false, false]; // w s a d crtl shift
var camDir = [0.0, 0.0]; // x y angles
var prevCamDir = [0.0, 0.0];
var sensitiveness = 0.001;
var curX = 0, curY = 0;
let sens = 10;
var isMoving = 0;
let framesStill = 0;

canvas.requestPointerLock = canvas.requestPointerLock ||
  canvas.mozRequestPointerLock;

document.exitPointerLock = document.exitPointerLock ||
  document.mozExitPointerLock;

canvas.onclick = function () {
  canvas.requestPointerLock();
};

// pointer lock event listeners

// Hook pointer lock state change events for different browsers
document.addEventListener('pointerlockchange', lockChangeAlert, false);
document.addEventListener('mozpointerlockchange', lockChangeAlert, false);

function lockChangeAlert() {
  if (document.pointerLockElement === canvas ||
    document.mozPointerLockElement === canvas) {
    console.log('The pointer lock status is now locked');
    document.addEventListener("mousemove", updatePosition, false);
  } else {
    console.log('The pointer lock status is now unlocked');
    document.removeEventListener("mousemove", updatePosition, false);
  }
}

function updatePosition(e) {
  curX = e.movementX;
  curY += e.movementY;
}

var last = 0; // timestamp of the last render() call
function render(now) {
  // each 2 seconds call the createNewObject() function
  if (!last || now - last >= 1000 / fps) {
    last = now;
    renderScene();
  }
  requestAnimationFrame(render);
}

function renderScene() {
  gl.useProgram(program);
  // render tex1 to the tex2

  // input to fragment shader
  gl.bindTexture(gl.TEXTURE_2D, tex1);

  // output from fragment shader
  gl.bindFramebuffer(gl.FRAMEBUFFER, fb2);
  gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);
  gl.drawArrays(gl.TRIANGLES, 0, 6);

  // render to canvas so we can see it
  gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);
  // input to fragment shader, the texture we just rendered to
  gl.bindTexture(gl.TEXTURE_2D, tex2);
  gl.drawArrays(gl.TRIANGLES, 0, 6);

  gl.uniform1f(timeAttributeLocation, time);
  isMoving = 0;

  document.onkeydown = function (e) {
    switch (e.code) {
      case "KeyW": vsd[0] = true; break;
      case "KeyS": vsd[1] = true; break;
      case "KeyA": vsd[2] = true; break;
      case "KeyD": vsd[3] = true; break;
      case "ControlLeft": vsd[4] = true; break;
      case "ShiftLeft": vsd[5] = true; break;
    }
  };
  document.onkeyup = function (e) {
    switch (e.code) {
      case "KeyW": vsd[0] = false; break;
      case "KeyS": vsd[1] = false; break;
      case "KeyA": vsd[2] = false; break;
      case "KeyD": vsd[3] = false; break;
      case "ControlLeft": vsd[4] = false; break;
      case "ShiftLeft": vsd[5] = false; break;
    }
  };
  var speed = 0.1;
  if (vsd[0]) {
    camPos[2] += Math.cos(-camDir[0] * 10.) * speed;
    camPos[0] -= Math.sin(-camDir[0] * 10.) * speed;
    isMoving = 1;
  }
  if (vsd[1]) {
    camPos[2] += Math.cos(-camDir[0] * 10. + Math.PI) * speed;
    camPos[0] -= Math.sin(-camDir[0] * 10. + Math.PI) * speed;
    isMoving = 1;
  }
  if (vsd[2]) {
    camPos[2] += Math.cos(-camDir[0] * 10. + Math.PI / 2) * speed;
    camPos[0] -= Math.sin(-camDir[0] * 10. + Math.PI / 2) * speed;
    isMoving = 1;
  }
  if (vsd[3]) {
    camPos[2] += Math.cos(-camDir[0] * 10. + Math.PI * 1.5) * speed;
    camPos[0] -= Math.sin(-camDir[0] * 10. + Math.PI * 1.5) * speed;
    isMoving = 1;
  }
  if (vsd[4]) {
    camPos[1] -= 0.1;
    isMoving = 1;
  }
  if (vsd[5]) {
    camPos[1] += 0.1;
    isMoving = 1;
  }

  document.onmousemove = function (e) {
    camDir[0] += curX * sensitiveness;
    camDir[1] += curY * sensitiveness * sens;
    if (camDir[1] > Math.PI / 2) camDir[1] = Math.PI / 2;
    if (camDir[1] < -Math.PI / 2) camDir[1] = -Math.PI / 2;
    curX = 0, curY = 0;
  };

  if (prevCamDir[0] != camDir[0] || prevCamDir[1] != camDir[1]) {
    isMoving = 1;
  }

  gl.uniform2f(camDirectionAttributeLocation, -camDir[0], -camDir[1]);

  gl.uniform3f(camPositionAttributeLocation, camPos[0], camPos[1], camPos[2]);
  gl.uniform1i(isMovingAttributeLocation, isMoving);
  gl.uniform1f(sampleFramesAttributeLocation, 1.0 / framesStill);
  time += 0.01;
  if (isMoving == 1) {
    framesStill = 1;
  } else {
    framesStill++;
  }

  // swap which texture we are rendering from and to
  var t = tex1;
  tex1 = tex2;
  tex2 = t;

  var f = fb1;
  fb1 = fb2;
  fb2 = f;
  prevCamDir[0] = camDir[0];
  prevCamDir[1] = camDir[1];
}
function createShader(gl, type, source) {
  let shader = gl.createShader(type);
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  let success = gl.getShaderParameter(shader, gl.COMPILE_STATUS);
  if (success) {
    return shader;
  }
  console.log(gl.getShaderInfoLog(shader));
  gl.deleteShader(shader);
}

function createProgram(gl, vertexShader, fragmentShader) {
  let program = gl.createProgram();
  gl.attachShader(program, vertexShader);
  gl.attachShader(program, fragmentShader);
  gl.linkProgram(program);
  let success = gl.getProgramParameter(program, gl.LINK_STATUS);
  if (success) {
    return program;
  }

  console.log(gl.getProgramInfoLog(program));
  gl.deleteProgram(program);
}

function resizeCanvasToDisplaySize(canvas, multiplier) {
  multiplier = multiplier || 1;
  const width = canvas.clientWidth * multiplier | 0;
  const height = canvas.clientHeight * multiplier | 0;
  if (canvas.width !== width || canvas.height !== height) {
    canvas.width = width;
    canvas.height = height;
    return true;
  }
  return false;
}

requestAnimationFrame(render);