// Here I put my constants
const MAX_RAYS = 100 // Max raymarching steps
const MAX_DIST = 100.0 // Max distance for the rays
const HIT_DIST = 0.01 // Distance at which ray is considered to be collided with an onbject

var canvas = document.getElementById("canvas");
var canvasWidth = canvas.width;
var canvasHeight = canvas.height;
var ctx = canvas.getContext("2d");
var canvasData = ctx.getImageData(0, 0, canvasWidth, canvasHeight);
var time = 0;

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

const Vec2 = function (x=0, y=0) {
    if( x.type === 'vec2' ) return x  
    const v = Object.create( Vec2.prototype )
    if( Array.isArray( x ) ) {
      v.x = x[0]; v.y = x[1]; 
    } else if( y === undefined ) {
      v.x = v.y = x
    }else{
      v.x = x; v.y = y; 
    }
  
    return v
  }
  
  Vec2.prototype = {
    type: 'vec2',
      emit() { return "vec2(" + this.x + "," + this.y + ")" },
    emit_decl() { return ""; },
    copy() {
      return Vec2( this.x, this.y )
    }
  }

class vec3 {
    constructor(x, y, z) {
        this.x = parseFloat(x);
        this.y = parseFloat(y);
        this.z = parseFloat(z);
    }
    normalize() {
        var m = vec_length(this);
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

function substractVec3FromNum(a, b) {
    return new vec3(a - b.x, a - b.y, a - b.z);
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
    return Math.sqrt(x.x * x.x + x.y * x.y + x.z * x.z);
}

function dot(a, b) {
    return a.x * b.x + a.y * b.y + a.z * b.z;
}

function getDist(p) {
    var s = new vec4(0, 1, 6, 1);

    var sphereDist = vec_length(substract(p, s.xyz())) - s.w;
    var planeDist = p.y;

    d = Math.min(sphereDist, planeDist);
    return d;
}

function getNormal(p) {
    var d = getDist(p);
    var acc = 0.01;

    var n = substractVec3FromNum(d, new vec3(
        getDist(substract(p, new vec3(acc, 0, 0))),
        getDist(substract(p, new vec3(0, acc, 0))),
        getDist(substract(p, new vec3(0, 0, acc)))
    ));

    return n.normalize();
}

function getLight(p) {
    var lightPos = new vec3(3, 5, 2);
    var l = substract(lightPos, p).normalize();
    var n = getNormal(p);
    var dif = dot(n, l);
    var d = rayMarch(sum(p, n.multiplyByN(0.1)), l);
    if (d < vec_length(substract(lightPos, p))) {
        dif *= 0.1
    }
    return dif;
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
    ctx.clearRect(0, 0, canvasWidth, canvasHeight)
    var ro = new vec3(0, 1, 1);
    for (let x = 0; x < canvasWidth; x++) {
        for (let y = 0; y < canvasHeight; y++) {
            var rd = new vec3((x - canvasWidth / 2) / canvasWidth, -(y - canvasHeight / 2) / canvasWidth, 1).normalize();
            var d = rayMarch(ro, rd)
            var p = sum(ro, rd.multiplyByN(d));
            var col = getLight(p) * 256;
            drawPixel(x, y, col, col, col, 256.0);
        }
    }
    updateCanvas();
}

(function () {
    render();
})();
