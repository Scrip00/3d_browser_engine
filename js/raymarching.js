"use strict";

function main(shader) {
    // Get A WebGL context
    /** @type {HTMLCanvasElement} */
    const canvas = document.querySelector("#canvas");
    const gl = canvas.getContext("webgl");
    if (!gl) {
        return;
    }

    const vs = `
    // an attribute will receive data from a buffer
    attribute vec4 a_position;

    // all shaders have a main function
    void main() {

      // gl_Position is a special variable a vertex shader
      // is responsible for setting
      gl_Position = a_position;
    }
  `;

    const fs = `
    precision highp float;
    uniform vec2 camDir;
    uniform vec3 camPos;
    uniform float time;
    #define MAX_DIST 100000.

    vec2 boxIntersection(in vec3 ro, in vec3 rd, vec3 boxSize, out vec3 outNormal){
        vec3 m = 1.0/rd; // can precompute if traversing a set of aligned boxes
        vec3 n = m*ro;   // can precompute if traversing a set of aligned boxes
        vec3 k = abs(m)*boxSize;
        vec3 t1 = -n - k;
        vec3 t2 = -n + k;
        float tN = max( max( t1.x, t1.y ), t1.z );
        float tF = min( min( t2.x, t2.y ), t2.z );
        if( tN>tF || tF<0.0) return vec2(-1.0); // no intersection
        outNormal = -sign(rd)*step(t1.yzx,t1.xyz)*step(t1.zxy,t1.xyz);
        return vec2(tN, tF);
    }

    vec2 sphIntersect(in vec3 ro, in vec3 rd, float ra) {
        float b = dot(ro, rd);
        float c = dot(ro, ro) - ra * ra;
        float h = b * b - c;
        if(h < 0.0) return vec2(-1.0);
        h = sqrt(h);
        return vec2(-b - h, -b + h);
    }

    vec2 plaIntersect(in vec3 ro, in vec3 rd, in vec4 p) {
        return vec2(-(dot(ro,p.xyz)+p.w)/dot(rd,p.xyz));
    }

    bool minDist(vec2 d1, vec2 d2) {
        return d2.x > 0. && d1.x > d2.x;
    }

    vec2 map(in vec3 ro, in vec3 rd, out vec3 n) {
        vec2 d;
        vec3 tempN;
        vec2 minD = vec2(MAX_DIST);

        vec3 planeN = vec3(0., 1., 0.);
        d = plaIntersect(ro, rd, vec4(planeN, 1.));
        if (minDist(minD, d)) {
            minD = d;
            n = planeN;
        }

        d = sphIntersect(ro - vec3(0., 0., 4.), rd, 1.);
        if (minDist(minD, d)) {
            minD = d;
            n = normalize(ro + rd * d.x - vec3(0., 0., 4.));
        }

        d = boxIntersection(ro - vec3(4., 0., 5.), rd, vec3(1.), tempN);
        if (minDist(minD, d)) {
            minD = d;
            n = tempN;
        }
        return minD;
    }
    
    vec3 traceRay(vec3 ro, vec3 rd) {
        vec3 n;
        vec2 d = map(ro, rd, n);
        vec3 light = -normalize(vec3(-0.5, -1., -0.75));
        if (d.x < 0.0 || d.x == MAX_DIST) return vec3(0.31, 0.63, 0.98) + vec3(pow(max(dot(rd, light), 0.), 64.));
        vec3 p = ro + rd * d.x;
        float diffuse = max(dot(n, light), 0.);
        return vec3(diffuse);
    }
    
    void main() {
    
        vec2 iResolution = vec2(600, 600);
    
        vec2 uv = (gl_FragCoord.xy - .5 * iResolution.xy) / iResolution.y;
    
        vec3 col = vec3(0);
    
        vec3 ro = camPos;
        float sens = 10.;

        vec3 lookat = vec3(0., 0., 1.);

        lookat.yx *= mat2(cos(camDir.y * sens), -sin(camDir.y * sens), sin(camDir.y * sens), cos(camDir.y * sens));
        lookat.xz *= mat2(cos(camDir.x * sens), -sin(camDir.x * sens), sin(camDir.x * sens), cos(camDir.x * sens));

        float vang = camDir.y;

        if (vang > 3.14 / 2.) vang = 3.14 / 2.;
        if (vang < -3.14 / 2.) vang = -3.14 / 2.;

        vec3 camRot = vec3(lookat.x, lookat.y, lookat.z);
        lookat.y = camRot.y * cos(vang) + pow(pow(camRot.x, 2.) + pow(camRot.z, 2.), 0.5) * sin(vang);
        float len = pow(pow(camRot.x, 2.) + pow(camRot.z, 2.), 0.5) * cos(vang) - camRot.y * sin(vang);
        lookat.x = camRot.x / pow(pow(camRot.x, 2.) + pow(camRot.z, 2.), 0.5) * len;
        lookat.z = camRot.z / pow(pow(camRot.x, 2.) + pow(camRot.z, 2.), 0.5) * len;

        lookat += ro;
    
        float zoom = 1.;
        
        vec3 f = normalize(lookat-ro);
        vec3 r = normalize(cross(vec3(0., 1., 0.), f));
        vec3 u = cross(f, r);
        
        vec3 c = ro + f*zoom;
        vec3 i = c + uv.x*r + uv.y*u;
        vec3 rd = i-ro;

        col = traceRay(ro, normalize(rd));
    
        col = pow(col, vec3(.4545));	// gamma correction
    
        gl_FragColor = vec4(col, 1.0);
    }
  `;

    // setup GLSL program
    let vertexShader = createShader(gl, gl.VERTEX_SHADER, vs);
    let fragmentShader = createShader(gl, gl.FRAGMENT_SHADER, fs);

    let program = createProgram(gl, vertexShader, fragmentShader);

    // look up where the vertex data needs to go.
    const positionAttributeLocation = gl.getAttribLocation(program, "a_position");
    const timeAttributeLocation = gl.getUniformLocation(program, "time");
    const camPositionAttributeLocation = gl.getUniformLocation(program, "camPos");
    const camDirectionAttributeLocation = gl.getUniformLocation(program, "camDir");
    // Create a buffer to put three 2d clip space points in
    const positionBuffer = gl.createBuffer();

    // Bind it to ARRAY_BUFFER (think of it as ARRAY_BUFFER = positionBuffer)
    gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);

    // fill it with a 2 triangles that cover clipspace
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([
        -1, -1,  // first triangle
        1, -1,
        -1, 1,
        -1, 1,  // second triangle
        1, -1,
        1, 1,
    ]), gl.STATIC_DRAW);

    resizeCanvasToDisplaySize(gl.canvas);
    canvas.width = canvas.clientWidth;
    canvas.heigth = canvas.clientHeight;

    // Tell WebGL how to convert from clip space to pixels
    gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);

    // Tell it to use our program (pair of shaders)
    gl.useProgram(program);

    // Turn on the attribute
    gl.enableVertexAttribArray(positionAttributeLocation);

    // Bind the position buffer.
    gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);

    // Tell the attribute how to get data out of positionBuffer (ARRAY_BUFFER)
    gl.vertexAttribPointer(
        positionAttributeLocation,
        2,          // 2 components per iteration
        gl.FLOAT,   // the data is 32bit floats
        false,      // don't normalize the data
        0,          // 0 = move forward size * sizeof(type) each iteration to get the next position
        0,          // start at the beginning of the buffer
    );

    drawFrame(gl);

    var fps = 60;

    var intervalID = window.setInterval(animate, 1000 / fps);
    var time = 0;
    var camPos = [0.0, 1.0, 0.0];
    var vsd = [false, false, false, false, false, false]; // w s a d crtl shift
    var camDir = [0.0, 0.0]; // x y angles
    var sensitiveness = 0.001;
    var curX = 0, curY = 0;
    let sens = 10;
    gl.uniform3f(camPositionAttributeLocation, camPos[0], camPos[1], camPos[2]);
    gl.uniform2f(camDirectionAttributeLocation, camDir[0], camDir[1]);

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

    function animate() {
        gl.uniform1f(timeAttributeLocation, time);

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
        }
        if (vsd[1]) {
            camPos[2] += Math.cos(-camDir[0] * 10. + Math.PI) * speed;
            camPos[0] -= Math.sin(-camDir[0] * 10. + Math.PI) * speed;
        }
        if (vsd[2]) {
            camPos[2] += Math.cos(-camDir[0] * 10. + Math.PI / 2) * speed;
            camPos[0] -= Math.sin(-camDir[0] * 10. + Math.PI / 2) * speed;
        }
        if (vsd[3]) {
            camPos[2] += Math.cos(-camDir[0] * 10. + Math.PI * 1.5) * speed;
            camPos[0] -= Math.sin(-camDir[0] * 10. + Math.PI * 1.5) * speed;
        }
        if (vsd[4]) camPos[1] -= 0.1;
        if (vsd[5]) camPos[1] += 0.1;

        document.onmousemove = function (e) {
            camDir[0] += curX * sensitiveness;
            camDir[1] += curY * sensitiveness * sens;
            if (camDir[1] > Math.PI / 2) camDir[1] = Math.PI / 2;
            if (camDir[1] < -Math.PI / 2) camDir[1] = -Math.PI / 2;
            curX = 0, curY = 0;
        };
        gl.uniform2f(camDirectionAttributeLocation, -camDir[0], -camDir[1]);

        gl.uniform3f(camPositionAttributeLocation, camPos[0], camPos[1], camPos[2]);
        drawFrame(gl);
        time += 0.01;
    }
}

function drawFrame(gl) {
    gl.drawArrays(
        gl.TRIANGLES,
        0,     // offset
        6,     // num vertices to process
    );
}

function normalize(camDir) {
    for (var i = 0; i < camDir.length; i++) {
        if (camDir[i] < 0.001) camDir[i] = 0;
    }
    let len = Math.sqrt(camDir[0] ** 2 + camDir[1] ** 2 + camDir[2] ** 2);
    if (len < 1) {
        for (var i = 0; i < camDir.length; i++) {
            camDir[i] *= 2;
        }
    }
    camDir[0] /= len;
    camDir[1] /= len;
    camDir[2] /= len;
    return camDir;
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

main();