// Here I put my constants
const MAX_RAYS = 1000 // Max raymarching steps
const MAX_DIST = 1000.0 // Max distance for the rays
const HIT_DIST = 0.01 // Distance at which ray is considered to be collided with an onbject

var canvas = document.getElementById("canvas");
var canvasWidth = canvas.width;
var canvasHeight = canvas.height;
var ctx = canvas.getContext("2d");
var canvasData = ctx.getImageData(0, 0, canvasWidth, canvasHeight);

function drawPixel(x, y, r, g, b, a) {
    var index = (x + y * canvasWidth) * 4;

    canvasData.data[index + 0] = r;
    canvasData.data[index + 1] = g;
    canvasData.data[index + 2] = b;
    canvasData.data[index + 3] = a;
}

function updateCanvas() {
    ctx.putImageData(canvasData, 0, 0);
}

class vec3 {
    constructor(x, y, z) {
        this.x = parseFloat(x);
        this.y = parseFloat(y);
        this.z = parseFloat(z);
    }
    normalize() {
        var m = Math.sqrt(this.x * this.x + this.y * this.y + this.z * this.z);
        if (m > 0) {
            return new vec3(this.x / m, this.y / m, this.z / m);
        }
    }
    multiplyByN(a) {
        return new vec3(this.x * a, this.y * a, this.z * a);
    }
}

function sum(a, b) {
    return new vec3(a.x + b.x, a.y + b.y, a.z + b.z);
}

function substract(a, b) {
    return new vec3(a.x - b.x, a.y - b.y, a.z - b.z);
}

class vec4 {
    constructor(x, y, z, w) {
        this.x = parseFloat(x);
        this.y = parseFloat(y);
        this.z = parseFloat(z);
        this.w = parseFloat(w);
    }
    xyz() {
        return new vec3(this.x, this.y, this.z);
    }
}

function vec_length(x) {
    return Math.sqrt(x.x ** 2 + x.y ** 2 + x.z ** 2);
}

function getDist(p) {
    var s = new vec4(0, 1, 6, 1);

    var sphereDist = vec_length(substract(p, s.xyz())) - s.w;
    var planeDist = p.y;

    d = Math.min(sphereDist, planeDist);
    return d;
}

function rayMarch(ro, rd) {
    var dO = 0.0;

    for (let i = 0; i < MAX_RAYS; i++) {
        var p = sum(ro, rd.multiplyByN(dO));
        var dS = getDist(p);
        dO += dS;
        if (dO > MAX_DIST || dS < HIT_DIST) break;
    }

    return dO;
}

function render() {
    var ro = new vec3(0, 1, 1);
    for (let x = 0; x < canvasWidth; x++) {
        for (let y = 0; y < canvasHeight; y++) {
            var rd = new vec3((x - canvasWidth / 2) / canvasWidth, -(y - canvasHeight / 2) / canvasWidth, 1).normalize();
            var d = 256 - rayMarch(ro, rd);
            drawPixel(x, y, d, d, d, 256.0);
        }
    }
    updateCanvas();
}

(function () {
    render();
})();
