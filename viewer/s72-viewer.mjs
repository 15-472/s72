//built with reference to 'brdf-toy.html' from game-programming-f23 notes

import * as helpers from './gl-helpers.mjs';

function rgbe_to_rgb(r,g,b,e) {
	if (r === 0 && g === 0 && b === 0 && e=== 0) {
		return [0,0,0];
	} else {
		return [
			(r + 0.5) / 256 * (2**(e-128)),
			(g + 0.5) / 256 * (2**(e-128)),
			(b + 0.5) / 256 * (2**(e-128))
		];
	}
}

function uploadCube(gl, size, data) {
	console.assert(typeof size === 'number', "Cube size should be a number.");

	const cube = gl.createTexture();
	gl.bindTexture(gl.TEXTURE_CUBE_MAP, cube);

	if (data instanceof Float32Array) {
		const pageSize = size*size*3;
		console.assert(data.length === 6*pageSize, "RGB data is correct length for cube.");
		gl.texImage2D(gl.TEXTURE_CUBE_MAP_POSITIVE_X, 0, gl.RGB, size, size, 0, gl.RGB, gl.FLOAT, data.subarray(0*pageSize, 1*pageSize));
		gl.texImage2D(gl.TEXTURE_CUBE_MAP_NEGATIVE_X, 0, gl.RGB, size, size, 0, gl.RGB, gl.FLOAT, data.subarray(1*pageSize, 2*pageSize));
		gl.texImage2D(gl.TEXTURE_CUBE_MAP_POSITIVE_Y, 0, gl.RGB, size, size, 0, gl.RGB, gl.FLOAT, data.subarray(2*pageSize, 3*pageSize));
		gl.texImage2D(gl.TEXTURE_CUBE_MAP_NEGATIVE_Y, 0, gl.RGB, size, size, 0, gl.RGB, gl.FLOAT, data.subarray(3*pageSize, 4*pageSize));
		gl.texImage2D(gl.TEXTURE_CUBE_MAP_POSITIVE_Z, 0, gl.RGB, size, size, 0, gl.RGB, gl.FLOAT, data.subarray(4*pageSize, 5*pageSize));
		gl.texImage2D(gl.TEXTURE_CUBE_MAP_NEGATIVE_Z, 0, gl.RGB, size, size, 0, gl.RGB, gl.FLOAT, data.subarray(5*pageSize, 6*pageSize));

		if (gl.OES_texture_float_linear) {
			gl.texParameteri(gl.TEXTURE_CUBE_MAP, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
			gl.texParameteri(gl.TEXTURE_CUBE_MAP, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
		} else {
			gl.texParameteri(gl.TEXTURE_CUBE_MAP, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
			gl.texParameteri(gl.TEXTURE_CUBE_MAP, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
		}
	} else {
		console.log("TODO: support other texture types for cube map!");
	}
	gl.bindTexture(gl.TEXTURE_CUBE_MAP, null);

	return cube;
}

function placeholderRadianceCube(gl) {
	if (!(gl.placeholderRadianceCube)) {
		gl.placeholderRadianceCube = uploadCube(gl, 1, new Float32Array([
			1,0,0,
			0.5,0,0,
			0,1,0,
			0,0.5,0,
			0,0,1,
			0,0,0.5
		]));
	}
	return gl.placeholderRadianceCube;

}

function placeholderLambertianCube(gl) {
	if (!(gl.placeholderLambertainCube)) {
		gl.placeholderLambertianCube = uploadCube(gl, 1, new Float32Array([
			1,0,1,
			0.5,0,0.5,
			1,0,1,
			0.5,0,0.5,
			1,0,1,
			0.5,0,0.5
		]));
	}
	return gl.placeholderGGXCube;

}

function placeholderGGXCube(gl) {
	if (!(gl.placeholderGGXCube)) {
		gl.placeholderGGXCube = uploadCube(gl, 1, new Float32Array([
			1,1,0,
			0.5,0.5,0,
			1,1,0,
			0.5,0.5,0,
			1,1,0,
			0.5,0.5,0
		]));
	}
	return gl.placeholderGGXCube;
}


const MATRIX_SLAB = new ArrayBuffer(4 * 16 * 1024);
MATRIX_SLAB.freeList = [];
MATRIX_SLAB.offset = 0;

MATRIX_SLAB.alloc = function (from) {
	let offset = this.offset;
	this.offset += 4*16;
	const mat = new Float32Array(this, offset, 16);
	mat.offset = offset;
	if (typeof from !== "undefined") {
		mat.set(from);
	}
	return mat;
}
MATRIX_SLAB.free = function(mat) {
	if (mat.offset + 4*16 === this.offset) {
		this.offset -= 4*16;
	} else {
		throw new Error("out-of-order free?!");
	}
}
MATRIX_SLAB.freeAll = function() {
	this.offset = 0;
}


class UserCamera {
	constructor() {
		this.target = {x:0, y:0, z:0};
		this.radius = 2;
		this.azimuth = 0;
		this.elevation = 0;

		this.perspective = {
			vfov:60.0 / 180.0 * Math.PI,
			aspect:1.0,
			near:0.1
		};
	}
	makeFrame() {
		const ca = Math.cos(this.azimuth); const sa = Math.sin(this.azimuth);
		const ce = Math.cos(this.elevation); const se = Math.sin(this.elevation);
		const right = {x:ca, y:sa, z:0.0};
		const forward = {x:ce*-sa, y:ce*ca, z:se};
		const up = {x:-se*-sa, y:-se*ca, z:ce};
		return {
			right:right,
			forward:forward,
			up:up,
			at:{
				x:this.target.x - this.radius*forward.x,
				y:this.target.y - this.radius*forward.y,
				z:this.target.z - this.radius*forward.z
			},
		};
	}
	makeLOCAL_FROM_WORLD() {
		const frame = this.makeFrame();
		return MATRIX_SLAB.alloc([
			frame.right.x, frame.up.x,-frame.forward.x, 0.0,
			frame.right.y, frame.up.y,-frame.forward.y, 0.0,
			frame.right.z, frame.up.z,-frame.forward.z, 0.0,
			-dot(frame.right,frame.at), -dot(frame.up,frame.at), dot(frame.forward,frame.at), 1.0
		])
	}
	makeCLIP_FROM_LOCAL() {
		return perspective(this.perspective.vfov, this.perspective.aspect, this.perspective.near);
	}
};

function dot(a, b) {
	return a.x * b.x + a.y * b.y + a.z * b.z;
}
function cross(a, b) {
	return {
		x: a.y * b.z - a.z * b.y,
		y: a.z * b.x - a.x * b.z,
		z: a.x * b.y - a.y * b.x
	};
}
function normalize(vec) {
	var len = Math.sqrt(dot(vec, vec));
	return { x:vec.x / len, y:vec.y / len, z:vec.z / len };
}
function perspective(fovy, aspect, zNear) {
	var f = 1 / Math.tan(fovy/2);
	return MATRIX_SLAB.alloc([
		f / aspect, 0.0, 0.0, 0.0,
		0.0, f, 0.0, 0.0,
		0.0, 0.0, -1, -1,
		0.0, 0.0, -2*zNear, 0.0
	]);
}
function mul(A, B) {
	var out = MATRIX_SLAB.alloc();
	for (var r = 0; r < 4; ++r) {
		for (var c = 0; c < 4; ++c) {
			var val = 0.0;
			for (var k = 0; k < 4; ++k) {
				val += A[k * 4 + r] * B[c * 4 + k];
			}
			out[4 * c + r] = val;
		}
	}
	return out;
}

const SOURCES = {};

SOURCES.simple = {
	vertex:`
attribute vec3 Position;
attribute vec3 Normal;
attribute vec4 Color;
attribute vec4 Tangent;
attribute vec2 TexCoord;

uniform mat4 CLIP_FROM_LOCAL;
uniform mat4 LIGHT_FROM_LOCAL;
uniform mat4 LIGHT_FROM_LOCAL_NORMAL;

varying vec3 position;
varying vec3 normal;
varying vec4 color;
varying vec3 tangent;
varying vec3 bitangent;
varying vec2 texCoord;

void main() {
	position = vec3(LIGHT_FROM_LOCAL * vec4(Position, 1.0));
	normal = mat3(LIGHT_FROM_LOCAL_NORMAL) * Normal;
	color = Color;
	tangent = mat3(LIGHT_FROM_LOCAL) * vec3(Tangent);
	bitangent = Tangent.w * cross(normal, tangent);
	texCoord = TexCoord;

	gl_Position = CLIP_FROM_LOCAL * vec4(Position, 1.0);
}
`,
fragment:`
varying highp vec3 position;
varying highp vec3 normal;
varying mediump vec4 color;
varying highp vec3 tangent;
varying highp vec3 bitangent;
varying mediump vec2 texCoord;

void main() {
	highp vec3 n = normalize(normal);
	highp vec3 t = normalize(tangent);
	highp vec3 b = normalize(bitangent);
	highp vec3 light = mix(vec3(0,0,0), vec3(1,1,1), dot(n, vec3(0,0,1)) * 0.5 + 0.5);
	gl_FragColor = vec4(light * color.rgb, color.a);
}
`
};

SOURCES.environment = {
	vertex:`
attribute vec3 Position;
attribute vec3 Normal;
attribute vec4 Color;
attribute vec4 Tangent;
attribute vec2 TexCoord;

uniform mat4 CLIP_FROM_LOCAL;
uniform mat4 LIGHT_FROM_LOCAL;
uniform mat4 LIGHT_FROM_LOCAL_NORMAL;

varying vec3 position;
varying vec3 normal;
varying vec4 color;
varying vec3 tangent;
varying vec3 bitangent;
varying vec2 texCoord;

void main() {
	position = vec3(LIGHT_FROM_LOCAL * vec4(Position, 1.0));
	normal = mat3(LIGHT_FROM_LOCAL_NORMAL) * Normal;
	color = Color;
	tangent = mat3(LIGHT_FROM_LOCAL) * vec3(Tangent);
	bitangent = Tangent.w * cross(normal, tangent);
	texCoord = TexCoord;

	gl_Position = CLIP_FROM_LOCAL * vec4(Position, 1.0);
}
`,
fragment:`
varying highp vec3 position;
varying highp vec3 normal;
varying mediump vec4 color;
varying highp vec3 tangent;
varying highp vec3 bitangent;
varying mediump vec2 texCoord;

uniform sampler2D ALBEDO;
uniform sampler2D ROUGHNESS;
uniform sampler2D METALNESS;
uniform sampler2D NORMAL;
uniform sampler2D DISPLACEMENT;
uniform samplerCube LAMBERTIAN;
uniform samplerCube GGX;
uniform samplerCube RADIANCE; //redundant with ggx but useful for debugging

//based on https://www.shadertoy.com/view/4tXcWr
mediump vec3 srgb_from_linear(mediump vec3 v) {
	bvec3 cutoff = lessThan(v, vec3(0.0031308));
	mediump vec3 higher = vec3(1.055)*pow(v, vec3(1.0/2.4)) - vec3(0.055);
	mediump vec3 lower = v * vec3(12.92);
	return mix(higher, lower, vec3(cutoff));
}

void main() {
	highp vec3 n = normalize(normal);
	highp vec3 t = normalize(tangent);
	highp vec3 b = normalize(bitangent);

	mediump vec4 e = textureCube(RADIANCE, n);
	gl_FragColor = vec4(srgb_from_linear(e.rgb), 1.0);
}
`
};

SOURCES.pbr = {
	vertex:`
attribute vec3 Position;
attribute vec3 Normal;
attribute vec4 Color;
attribute vec4 Tangent;
attribute vec2 TexCoord;

uniform mat4 CLIP_FROM_LOCAL;
uniform mat4 LIGHT_FROM_LOCAL;
uniform mat4 LIGHT_FROM_LOCAL_NORMAL;

varying vec3 position;
varying vec3 normal;
varying vec4 color;
varying vec3 tangent;
varying vec3 bitangent;
varying vec2 texCoord;

void main() {
	position = vec3(LIGHT_FROM_LOCAL * vec4(Position, 1.0));
	normal = mat3(LIGHT_FROM_LOCAL_NORMAL) * Normal;
	color = Color;
	tangent = mat3(LIGHT_FROM_LOCAL) * vec3(Tangent);
	bitangent = Tangent.w * cross(normal, tangent);
	texCoord = TexCoord;

	gl_Position = CLIP_FROM_LOCAL * vec4(Position, 1.0);
}
`,
fragment:`
varying highp vec3 position;
varying highp vec3 normal;
varying mediump vec4 color;
varying highp vec3 tangent;
varying highp vec3 bitangent;
varying mediump vec2 texCoord;

uniform sampler2D ALBEDO;
uniform sampler2D ROUGHNESS;
uniform sampler2D METALNESS;
uniform sampler2D NORMAL;
uniform sampler2D DISPLACEMENT;
uniform samplerCube LAMBERTIAN;
uniform samplerCube GGX;
uniform samplerCube RADIANCE; //redundant with ggx but useful for debugging

//based on https://www.shadertoy.com/view/4tXcWr
mediump vec3 srgb_from_linear(mediump vec3 v) {
	bvec3 cutoff = lessThan(v, vec3(0.0031308));
	mediump vec3 higher = vec3(1.055)*pow(v, vec3(1.0/2.4)) - vec3(0.055);
	mediump vec3 lower = v * vec3(12.92);
	return mix(higher, lower, vec3(cutoff));
}

void main() {
	highp vec3 n = normalize(normal);
	highp vec3 t = normalize(tangent);
	highp vec3 b = normalize(bitangent);

	mediump vec4 e = textureCube(RADIANCE, n);
	gl_FragColor = vec4(srgb_from_linear(vec3(texCoord.rg, 0.0)), 1.0);
}
`
};



export class Viewer {
	constructor(canvas) {
		this.canvas = canvas;
		this.userCamera = new UserCamera();
		this.camera = this.userCamera;

		this.playing = false;
		this.playRate = 1.0;
		this.time = 0.0;

		const gl = this.gl = this.canvas.getContext('webgl', {
			antialias:false,
			colorSpace:"srgb",
		});
		if (!gl) {
			throw new Error("Failed to create WebGL context.");
		}

		this.gl.WEBGL_color_buffer_float = gl.getExtension("WEBGL_color_buffer_float");
		this.gl.OES_texture_float = gl.getExtension("OES_texture_float");
		this.gl.OES_texture_float_linear = gl.getExtension("OES_texture_float_linear");

		if (!this.gl.WEBGL_color_buffer_float) {
			console.log("WEBGL_color_buffer_float not supported; rgbe textures will not be mipmapped.");
		}
		if (!this.gl.OES_texture_float) {
			console.log("OES_texture_float not supported; rgbe textures will be clipped.");
		}
		if (!this.gl.OES_texture_float_linear) {
			console.log("OES_texture_float_linear not supported; rgbe textures will appear blocky.");
		}

		this.programs = {};
		for (let n of Object.keys(SOURCES)) {
			this.programs[n] = helpers.makeProgram(gl, SOURCES[n].vertex, SOURCES[n].fragment);
		}

		//default scene (before anything gets loaded):
		this.scene = Scene.default(gl, this.programs);
		this.scene.createBuffers(gl);

		//------------------------------------------------------------
		//events

		window.addEventListener('resize', () => { this.resize(); });

		
		this.canvas.addEventListener('wheel', (evt) => {
			this.camera.radius *= Math.pow(0.5, -0.005 * evt.deltaY);
			if (this.camera.radius < 0.1) this.camera.radius = 0.1;

			this.redraw();
			evt.preventDefault();
			return false;
		});

		window.addEventListener('keydown', (evt) => {
			if (evt.code === "Space") {
				this.pause();
			}
		});

		window.addEventListener('mousedown', (evt) => {
			var s = evt.target;
			if (s === this.canvas) {
				if (evt.shiftKey) {
					this.panning = {X:evt.clientX, Y:evt.clientY};
				} else {
					this.rolling = {X:evt.clientX, Y:evt.clientY, flip:Math.cos(this.camera.elevation) < 0.0};
				}
				evt.preventDefault();
				return false;
			}
		});

		window.addEventListener('mousemove', (evt) => {
			const X = evt.clientX;
			const Y = evt.clientY;
			if (this.panning) {
				const move = 2.0 * Math.tan(0.5 * this.camera.perspective.vfov) * this.camera.radius;
				const dx = -(X - this.panning.X) / this.canvas.clientWidth * this.camera.perspective.aspect * move;
				const dy = (Y - this.panning.Y) / this.canvas.clientHeight * move;

				this.panning.X = X;
				this.panning.Y = Y;

				const frame = this.camera.makeFrame();

				this.camera.target.x += frame.up.x * dy + frame.right.x * dx;
				this.camera.target.y += frame.up.y * dy + frame.right.y * dx;
				this.camera.target.z += frame.up.z * dy + frame.right.z * dx;
		
				this.redraw();
			}
			if (this.rolling) {
				const move = 2.0 * Math.PI / Math.max(this.canvas.clientHeight, this.canvas.clientWidth);

				const dx = -(X - this.rolling.X) * move * (this.rolling.flip ? -1.0 : 1.0);
				const dy = -(Y - this.rolling.Y) * move;

				this.rolling.X = X;
				this.rolling.Y = Y;

				this.camera.azimuth += dx;
				this.camera.elevation += dy;

				this.redraw();
			}
			evt.preventDefault();
			return false;
		});

		window.addEventListener('mouseup', (evt) => {
			delete this.panning;
			delete this.rolling;
		});

		//------------------------------------------------------------

		//get pixel density right:
		this.resize();

		//queue the first draw:
		this.redraw();
	}

	pause() {
		if (this.playing) {
			this.playing = false;
		} else {
			this.playing = true;
			this.redraw();
		}
	}

	load(url, callback) {
		const pending = this.pending = {
			target:this,
		};

		(async () => {
			let loaded = null;
			try {
				loaded = await Scene.from(this.gl, url, {programs: this.programs} );
			} catch (err) {
				callback(err);
				return;
			}
			if (this.pending === pending) {
				delete this.pending;
				this.scene.deleteBuffers(this.gl);
				this.scene = loaded;
				this.scene.createBuffers(this.gl);
	
				this.playing = false;
				delete this.prevTs;
				this.time = this.scene.minTime;
				this.scene.drive(this.time);
	
				this.redraw();
	
				if (callback) callback();
			}
		})();
	}

	resize() {
		const oldWidth = this.canvas.width;
		const oldHeight = this.canvas.height;
		const width = Math.round(this.canvas.clientWidth * window.devicePixelRatio);
		const height = Math.round(this.canvas.clientHeight * window.devicePixelRatio);
		this.canvas.width = width;
		this.canvas.height = height;

		if (this.canvas.width !== oldWidth || this.canvas.height !== oldHeight) {
			this.redraw();
		}
	}

	draw() {
		MATRIX_SLAB.freeAll();

		const width = parseInt(this.canvas.width);
		const height = parseInt(this.canvas.height);

		this.userCamera.perspective.aspect = width / height; //user camera always follows aspect

		let drawLeft, drawTop;
		let drawWidth, drawHeight;
		{ //determine letter/pillar-boxing:
			const scale = Math.min(width / this.camera.perspective.aspect, height);
			drawWidth = Math.round(scale * this.camera.perspective.aspect);
			drawHeight = Math.round(scale * 1.0);
			drawLeft = Math.floor((width - drawWidth) / 2);
			drawTop = Math.floor((height - drawHeight) / 2);
		}

		const gl = this.gl;
		
		if (width !== drawWidth || height !== drawHeight) {
			gl.disable(gl.SCISSOR_TEST);
			gl.viewport(0,0, width, height);
			gl.clearColor(0.1, 0.1, 0.1, 1.0);
			gl.clear(gl.COLOR_BUFFER_BIT);
		}

		gl.viewport(drawLeft, drawTop, drawWidth, drawHeight);
		gl.scissor(drawLeft, drawTop, drawWidth, drawHeight);
		gl.enable(gl.SCISSOR_TEST);

		gl.clearColor(0.0, 0.0, 0.0, 1.0);
		gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT | gl.STENCIL_BUFFER_BIT);
		gl.enable(gl.DEPTH_TEST);
		gl.useProgram(this.programs.simple);

		/*
		//backface culling likely to confuse folks, though it would be a nice debug option to have:
		gl.enable(gl.CULL_FACE);
		gl.cullFace(gl.BACK);
		*/

		const CLIP_FROM_WORLD = mul(
			this.camera.makeCLIP_FROM_LOCAL(),
			this.camera.makeLOCAL_FROM_WORLD()
		);

		const environment = this.scene.environment;

		const LIGHT_FROM_WORLD = environment.makeLOCAL_FROM_WORLD();
		const LIGHT_FROM_WORLD_NORMAL = environment.makeLOCAL_FROM_WORLD_NORMAL();

		const u = {
			CLIP_FROM_LOCAL:CLIP_FROM_WORLD,
			LIGHT_FROM_LOCAL:LIGHT_FROM_WORLD,
			LIGHT_FROM_LOCAL_NORMAL:LIGHT_FROM_WORLD_NORMAL,
			//2D textures:
			ALBEDO:[0],
			ROUGHNESS:[1],
			METALNESS:[2],
			NORMAL:[3],
			DISPLACEMENT:[4],
			//cubes:
			RADIANCE:[5],
			LAMBERTIAN:[6],
			GGX:[7],
		};

		gl.activeTexture(gl.TEXTURE0 + u.GGX[0]);
		gl.bindTexture(gl.TEXTURE_CUBE_MAP, environment.ggx.cube);

		gl.activeTexture(gl.TEXTURE0 + u.LAMBERTIAN[0]);
		gl.bindTexture(gl.TEXTURE_CUBE_MAP, environment.lambertian.cube);

		gl.activeTexture(gl.TEXTURE0 + u.RADIANCE[0]);
		gl.bindTexture(gl.TEXTURE_CUBE_MAP, environment.radiance.cube);

		gl.activeTexture(gl.TEXTURE0);

		this.scene.traverse(gl, u, CLIP_FROM_WORLD, LIGHT_FROM_WORLD, LIGHT_FROM_WORLD_NORMAL);
	}

	redraw() {
		if (this.redawPending) return;
		this.redrawPending = true;
		window.requestAnimationFrame((ts) => {
			let elapsed = 0.0;
			if ('prevTs' in this) {
				elapsed = (ts - this.prevTs) / 1000.0;
				delete this.prevTs;
			}

			if (this.playing) {
				this.time += this.playRate * elapsed;
				if (this.scene.minTime == this.scene.maxTime) {
					this.time = this.scene.minTime;
				} else {
					let time = this.time;
					time -= this.scene.minTime;
					time /= this.scene.maxTime - this.scene.minTime;
					time -= Math.floor(time);
					time *= this.scene.maxTime - this.scene.minTime;
					time += this.scene.minTime;
					this.time = time;
				}
				this.scene.drive(this.time);
			}

			delete this.redrawPending;
			this.draw();

			if (this.playing) {
				this.redraw();
				this.prevTs = ts;
			}
		});
	}

	makeUniforms() {
		const u = {};

		const frame = this.camera.makeFrame();

		u.CLIP_FROM_LOCAL = mul(
			perspective(this.camera.fovy, this.camera.aspect, this.camera.near),
			MATRIX_SLAB.alloc([
				frame.right.x, frame.up.x,-frame.forward.x, 0.0,
				frame.right.y, frame.up.y,-frame.forward.y, 0.0,
				frame.right.z, frame.up.z,-frame.forward.z, 0.0,
				-dot(frame.right,frame.at), -dot(frame.up,frame.at), dot(frame.forward,frame.at), 1.0
			])
		);

		return u;
	}
}

class Scene {
	constructor() {
		this.roots = [];
		this.cameras = []; //direct access to cameras
		this.drivers = []; //direct access to drivers
		this.environments = []; //direct access to environments

		//animation range (as per drivers):
		this.minTime = 0.0;
		this.maxTime = 0.0;
		
		this.b72s = {}; //loaded from b72 files, will be {arrayBuffer: , glBuffer:}
	}

	//drive animation to a given time:
	drive(time) {
		for (const driver of this.drivers) {
			driver.drive(time);
		}
	}

	//create gl buffers for all b72 files referenced by this scene:
	createBuffers(gl) {
		for (const b72 of Object.values(this.b72s)) {
			if (b72.glBuffer) continue;
			b72.glBuffer = gl.createBuffer();

			gl.bindBuffer(gl.ARRAY_BUFFER, b72.glBuffer);
			gl.bufferData(gl.ARRAY_BUFFER, b72.arrayBuffer, gl.STATIC_DRAW);
			gl.bindBuffer(gl.ARRAY_BUFFER, null);
		}
	}

	//remove all gl buffers associated with this scene:
	deleteBuffers(gl) {
		for (const b72 of Object.values(this.b72s)) {
			if (!b72.glBuffer) continue;
			gl.deleteBuffer(b72.glBuffer);
			delete b72.glBuffer;
		}
	}

	traverse(gl, u, CLIP_FROM_WORLD, LIGHT_FROM_WORLD, LIGHT_FROM_WORLD_NORMAL) {
		for (const root of this.roots) {
			root.traverse(gl, u, CLIP_FROM_WORLD, LIGHT_FROM_WORLD, LIGHT_FROM_WORLD_NORMAL);
		}
	}

	static async from(gl, url, {programs}) {
		console.log(`Fetching from '${url}'...`);
		const response = await fetch(url);
		console.log(`...getting body...`);
		const json = await response.json();
		console.log(`...have json!`);

		if (!Array.isArray(json)) throw new Error(`The top-level value is not an array.`);
		if (json[0] !== "s72-v1") throw new Error(`The first element is not "s72-v1".`);

		let b72s = {};

		function srcURL(src) {
			return new URL(src, new URL(url, document.location));
		}

		const loadB72 = (src) => {
			if (typeof src !== "string") throw new Error(`Expecting b72 src to be a string.`);
			//will actually trigger loads later!
			if (!(src in b72s)) b72s[src] = { url: srcURL(src) };
			return b72s[src];
		};

		let textures = {};

		const loadTexture = (desc, wantedType, wantedFormat) => {
			if (typeof desc.src !== "string") throw new Error(`Expecting "src" in texture.`);
			const src = desc.src;
			const type = ("type" in desc ? desc.type : "2D");
			const format = ("format" in desc ? desc.format : "linear");

			if (typeof wantedType !== "undefined" && type !== wantedType) {
				throw new Error(`Wanted texture of type "${wantedType}", got "${type}".`);
			}

			if (typeof wantedFormat !== "undefined" && format !== wantedFormat) {
				throw new Error(`Wanted texture of format "${wantedFormat}", got "${format}".`);
			}

			//check cache:
			const key = `${src}|${type}|${format}`;
			if (!(key in textures)) textures[key] = { url: srcURL(src), type, format };
			return textures[key];
		};

		const defaultMaterial = new Material();
		defaultMaterial.program = programs.simple;

		const loadMaterial = (index) => {
			const elt = json[index];
			if (elt.type !== "MATERIAL") throw new Error(`Trying to load a material from a type:"${elt.type}" element.`);
			if (elt.LOADED) return elt.LOADED; //could use a Symbol() here

			const loaded = elt.LOADED = new Material();
			loaded.name = elt.name;

			if ("normalMap" in elt) {
				loaded.normalMap = loadTexture(elt.normalMap.src, "2D");
			}
			if ("displacementMap" in elt) {
				loaded.displacementMap = loadTexture(elt.displacementMap.src, "2D");
			}

			const MATERIALS = {
				"pbr":() => {
					//TODO: parameters and program
					loaded.program = programs.pbr;
				},
				"lambertian":() => {
					//TODO: parameters and program
					loaded.program = programs.simple;
				},
				"mirror":() => {
					//TODO: program
					loaded.program = programs.simple;
				},
				"environment":() => { loaded.program = programs.environment },
				"simple":() => { loaded.program = programs.simple; }
			};

			let def;
			for (let n of Object.keys(MATERIALS)) {
				if (n in elt) {
					if (!(typeof def === "undefined")) throw new Error(`Material can't have both "${def}" and "${n}".`);
					def = n;
					MATERIALS[n]();
				}
			}
			if (typeof def === "undefined") throw new Error(`Material has no recognized definition (among: {${Object.keys(MATERIALS).join(", ")}}).`);

			console.log(`Loaded ${def} material.`);

			return loaded;
		};

		const loadMesh = (index) => {
			const elt = json[index];
			if (elt.type !== "MESH") throw new Error(`Trying to load a mesh from a type:"${elt.type}" element.`);
			if (elt.LOADED) return elt.LOADED; //could use a Symbol() here

			const loaded = elt.LOADED = new Mesh();
			loaded.name = elt.name;

			const TOPOLOGIES = {
				"POINT_LIST":gl.POINTS,
				"LINE_LIST":gl.LINES,
				"LINE_STRIP":gl.LINE_STRIP,
				"TRIANGLE_LIST":gl.TRIANGLES,
				"TRIANGLE_STRIP":gl.TRIANGLE_STRIP,
				"TRIANGLE_FAN":gl.TRIANGLE_FAN,
			};

			const FORMATS = {
				"R32_SFLOAT":         {size:1, type:gl.FLOAT, normalized:false},
				"R32G32_SFLOAT":      {size:2, type:gl.FLOAT, normalized:false},
				"R32G32B32_SFLOAT":   {size:3, type:gl.FLOAT, normalized:false},
				"R32G32B32A32_SFLOAT":{size:4, type:gl.FLOAT, normalized:false},
				"R8_UNORM":      {size:1, type:gl.UNSIGNED_BYTE, normalized:true},
				"R8G8_UNORM":    {size:2, type:gl.UNSIGNED_BYTE, normalized:true},
				"R8G8B8_UNORM":  {size:3, type:gl.UNSIGNED_BYTE, normalized:true},
				"R8G8B8A8_UNORM":{size:4, type:gl.UNSIGNED_BYTE, normalized:true},
			};

			const NAMES = {
				"POSITION":"Position",
				"NORMAL":"Normal",
				"COLOR":"Color",
				"TANGENT":"Tangent",
				"TEXCOORD":"TexCoord",
			};

			if (!(elt.topology in TOPOLOGIES)) throw new Error(`Unrecognized topology type '${elt.topology}'.`);
			loaded.topology = TOPOLOGIES[elt.topology];
			loaded.count = elt.count;
			if (elt.indices) throw new Error(`TODO: support indices.`);
			for (const name of Object.keys(elt.attributes)) {
				const attr = elt.attributes[name];
				if (!(attr.format in FORMATS)) throw new Error(`Unrecognized format '${attr.format}'.`);
				const f = FORMATS[attr.format];
				if (!(name in NAMES)) {
					console.warn(`Ignoring "${name}" attribute.`);
					continue;
				}
				const outName = NAMES[name];
				loaded.attributes[outName] = {
					src:loadB72(attr.src),
					offset:attr.offset,
					stride:attr.stride,
					size:f.size,
					type:f.type,
					normalized:f.normalized
				};
			}
			if ("material" in elt) {
				loaded.material = loadMaterial(elt.material);
			} else {
				loaded.material = defaultMaterial;
			}
			return loaded;
		};

		const loadCamera = (index) => {
			const elt = json[index];
			if (elt.type !== "CAMERA") throw new Error(`Trying to load a camera from a type:"${elt.type}" element.`);

			if (elt.LOADED) return elt.LOADED; //could use a Symbol() here

			const loaded = elt.LOADED = new Camera();
			loaded.name = elt.name;

			let haveProjection = false;
			if ("perspective" in elt) {
				haveProjection = true;
				const persp = elt.perspective;
				loaded.perspective = { };
				for (const attr of ['aspect', 'vfov', 'near', 'far']) {
					if (!(attr in persp)) {
						if (attr === 'far') continue; //'far' not required
						throw new Error(`Camera.perspective.${attr} is required.`);
					}
					if (typeof persp[attr] !== 'number') throw new Error(`Camera.perspective.${attr} should be a number, got ${JSON.stringify(persp[attr])}.`);
					loaded.perspective[attr] = persp[attr];
				}
			}
			//TODO: other projection types, once defined

			if (!haveProjection) {
				throw new Error(`Camera requires some sort of projection.`);
			}

			return loaded;
		};

		const loadEnvironment = (index) => {
			const elt = json[index];
			if (elt.type !== "ENVIRONMENT") throw new Error(`Trying to load an environment from a type:"${elt.type}" element.`);

			if (elt.LOADED) return elt.LOADED; //could use a Symbol() here

			const loaded = elt.LOADED = new Environment();
			loaded.name = elt.name;

			if (!("radiance" in elt)) throw new Error(`Environment must have a radiance.`);
			loaded.radiance = loadTexture(elt.radiance, "cube");

			//TODO: kick off texture loads with "well known names" for processed cubes
			loaded.lambertian = placeholderLambertianCube(gl);
			loaded.ggx = placeholderGGXCube(gl);

			return loaded;
		};

		


		const loadNode = (index) => {
			const elt = json[index];
			if (elt.type !== "NODE") throw new Error(`Trying to load a node from a type:"${elt.type}" element.`);

			if (elt.LOADED) return elt.LOADED; //could use a Symbol() here

			const loaded = elt.LOADED = new Node();
			loaded.name = elt.name;

			//do translation, rotation, scale properties:
			for (const arr of ['translation', 'rotation', 'scale']) {
				if (!(arr in elt)) continue;
				const src = elt[arr];
				if (!Array.isArray(src)) throw new Error(`Node.${arr} is not an array.`);
				const dst = loaded[arr];
				if (src.length !== dst.length) throw new Error(`Node.${arr} has length ${src.length}, expected ${dst.length}.`);
				for (let i = 0; i < dst.length; ++i) {
					if (typeof src[i] !== 'number') throw new Error(`Node.${arr}[${i}] is not of type number.`);
					dst[i] = src[i];
				}
			}

			if (elt.mesh) loaded.mesh = loadMesh(elt.mesh);
			if (elt.camera) loaded.camera = loadCamera(elt.camera);
			if (elt.environment) loaded.environment = loadEnvironment(elt.environment);

			if (elt.children) {
				for (const idx of elt.children) {
					loaded.children.push(loadNode(idx));
				}
			}

			return loaded;
			
		};

		const loadScene = (index) => {
			const elt = json[index];
			if (elt.type !== "SCENE") throw new Error(`Trying to load a scene from a type:"${elt.type}" element.`);

			const loaded = new Scene();
			loaded.name = elt.name;

			for (let rootIdx of elt.roots) {
				loaded.roots.push(loadNode(rootIdx));
			}

			return loaded;
		};

		const loadDriver = (index) => {
			const elt = json[index];
			if (elt.type !== "DRIVER") throw new Error(`Trying to load a driver from a type:"${elt.type}" element.`);

			const loaded = new Driver();
			loaded.name = elt.name;

			loaded.node = loadNode(elt.node);

			if (typeof elt.channel !== 'string') throw new Error(`Driver.channel should be a string; got ${typeof elt.channel}.`);
			loaded.channel = elt.channel;
			if (!Array.isArray(elt.times)) throw new Error(`Driver.times should be an array.`);
			loaded.times = elt.times;
			if (!Array.isArray(elt.values)) throw new Error(`Driver.values should be an array.`);
			loaded.values = elt.values;

			if ("interpolation" in elt) {
				loaded.interpolation = elt.interpolation;
			}

			const SIZES = {
				"translation":3,
				"rotation":4,
				"scale":3
			};
			if (!(elt.channel in SIZES)) throw new Error(`Driver.channel isn't of a supported type.`);
			if (SIZES[loaded.channel] * elt.times.length !== elt.values.length) throw new Error(`Times/values size mis-match for ${loaded.channel} expected ${elt.times.length}*${SIZES[loaded.channel]}, got ${elt.values.length}.`);

			return loaded;
		};

		let scene = null;
		let driverIndices = [];

		//load top-level objects ("SCENE" + "DRIVER"):
		for (let i = 1; i < json.length; ++i) {
			const type = json[i].type;
			if (type === "SCENE") {
				if (scene !== null) {
					console.warn(`Multiple "SCENE" elements found; ignoring all but the first.`);
					continue;
				}
				scene = loadScene(i);
			} else if (type === "NODE") {
				//loaded recursively by scene and (maybe) driver?
			} else if (type === "MESH") {
				//loaded recursively by node
			} else if (type === "CAMERA") {
				//loaded recursively by node
			} else if (type === "MATERIAL") {
				//loaded recursively by mesh
			} else if (type === "ENVIRONMENT") {
				//loaded recursively by node
			} else if (type === "DRIVER") {
				driverIndices.push(i);
			} else {
				console.warn(`Did not recognize type '${type}'!`);
			}
		}

		//load drivers (now that scene has been loaded):
		scene.minTime = Infinity;
		scene.maxTime = -Infinity;
		for (let i of driverIndices) {
			const driver = loadDriver(i);
			scene.drivers.push(driver);
			if (driver.times.length) {
				scene.minTime = Math.min(scene.minTime, driver.times[0]);
				scene.maxTime = Math.max(scene.maxTime, driver.times[driver.times.length-1]);
			}
		}
		if (scene.minTime > scene.maxTime) {
			scene.minTime = scene.maxTime = 0.0;
		}

		//find cameras + environments:
		for (const root of scene.roots) {
			let stack = [];
			function push(node) {
				if (node.MARKED) return; //avoid cycles
				node.MARKED = true;
				if (node.camera) {
					if (node.camera.parents.length > 0) {
						console.warn(`Camera ${node.camera.name} has multiple paths to it in the graph.`);
					} else {
						for (const s of stack) {
							node.camera.parents.push(s.node);
						}
						node.camera.parents.push(node);
						scene.cameras.push(node.camera);
					}
				}
				if (node.environment) {
					if (node.environment.parents.length > 0) {
						console.warn(`Environment ${node.environment.name} has multiple paths to it in the graph.`);
					} else {
						for (const s of stack) {
							node.environment.parents.push(s.node);
						}
						node.environment.parents.push(node);
						scene.environments.push(node.environment);
					}
				}
				stack.push({node:node, nextChild:0});
			}
			push(root);
			while (stack.length) {
				let back = stack[stack.length-1];
				if (back.nextChild < back.node.children.length) {
					//advance to next child:
					push(back.node.children[back.nextChild]);
					back.nextChild += 1;
				} else {
					//ran out of children:
					delete back.node.MARKED;
					stack.pop();
				}
			}
		}

		if (scene.environments.length > 0) {
			if (scene.environments.length > 1) {
				console.warn("Ignoring all environments except the first.");
			}
			scene.environment = scene.environments[0];
		} else {
			console.log("No environments specified; creating a default environment.");
			scene.environment = Environment.default(gl);
		}

		//record (+load) b72s:
		scene.b72s = b72s;

		for (const b72 of Object.values(b72s)) {
			const response = await fetch(b72.url);
			b72.arrayBuffer = await response.arrayBuffer();
			//console.log(`Got '${b72.url}', ${b72.arrayBuffer.byteLength} bytes.`);
		}

		//record (+load) textures:
		scene.textures = textures;

		for (const texture of Object.values(textures)) {
			const response = await fetch(texture.url);
			const blob = await response.blob();
			const bitmap = await createImageBitmap(blob, {colorSpaceConversion:"none"});
			const width = bitmap.width;
			const height = bitmap.height;

			const canvas = new OffscreenCanvas(width,height);
			const ctx = canvas.getContext('2d');
			ctx.drawImage(bitmap, 0, 0);
			let rgba = ctx.getImageData(0,0, width, height).data;

			if (texture.format === "rgbe") {
				//convert data to rgb:
				const rgb = new Float32Array(width*height*3);
				for (let px = 0; px < width * height; ++px) {
					let [r,g,b] = rgbe_to_rgb(rgba[4*px+0], rgba[4*px+1], rgba[4*px+2], rgba[4*px+3]);
					rgb[3*px+0] = r;
					rgb[3*px+1] = g;
					rgb[3*px+2] = b;
				}
				texture.rgb = rgb;
			} else if (texture.format === "linear") {
				//leave data as-is
				texture.rgba = data;
			} else {
				throw new Error(`Unknown texture format "${texture.format}".`);
			}

			if (texture.type === "cube") {
				if (width * 6 !== height) throw new Error(`Cube texture from ${texture.url} has dimensions ${width}x${height} (height is not 6*width).`);

				texture.size = width;
				if ("rgb" in texture) {
					texture.cube = uploadCube(gl, texture.size, texture.rgb);
				} else {
					texture.cube = uploadCube(gl, texture.size, texture.rgba);
				}

			} else if (texture.type === "2D") {
				texture.width = width;
				texture.height = height;
			} else {
				throw new Error(`Unknown texture type "${texture.type}".`);
			}
		}


		return scene;
	}

	static default(gl, programs) {
		const scene = new Scene();

		const defaultMaterial = new Material();
		defaultMaterial.program = programs.simple;

		//build a mesh:
		const b72 = { }; //will put data here
		scene.b72s["placeholder"] = b72;

		const mesh = new Mesh();
		mesh.topology = gl.TRIANGLES;
		mesh.count = 6;
		mesh.attributes = {
			Position:{src:b72, offset:0,  stride:28, size:3, type:gl.FLOAT,         normalized:false},
			Normal:  {src:b72, offset:12, stride:28, size:3, type:gl.FLOAT,         normalized:false},
			Color:   {src:b72, offset:24, stride:28, size:4, type:gl.UNSIGNED_BYTE, normalized:true}
		};
		mesh.material = defaultMaterial;

		b72.arrayBuffer = new ArrayBuffer(mesh.count * 28);
		{ //fill in some vertices:
			const view = new DataView(b72.arrayBuffer);

			let offset = 0;
			function vertex(x,y,z, nx,ny,nz, r,g,b,a) {
				view.setFloat32(offset, x, true); offset += 4;
				view.setFloat32(offset, y, true); offset += 4;
				view.setFloat32(offset, z, true); offset += 4;
				view.setFloat32(offset, nx, true); offset += 4;
				view.setFloat32(offset, ny, true); offset += 4;
				view.setFloat32(offset, nz, true); offset += 4;
				view.setUint8(offset, r); offset += 1;
				view.setUint8(offset, g); offset += 1;
				view.setUint8(offset, b); offset += 1;
				view.setUint8(offset, a); offset += 1;
			}
	
			vertex(0,0,0, 0,0,1, 0x22,0x22,0x22,0xff);
			vertex(1,0,0, 0,0,1, 0xff,0x00,0x00,0xff);
			vertex(0,1,0, 0,0,1, 0x00,0xff,0x00,0xff);

			vertex(0,0,0, 0,0,1, 0x22,0x22,0x22,0xff);
			vertex(1,0,0, 0,0,1, 0xff,0x00,0x00,0xff);
			vertex(0,0,1, 0,0,1, 0x00,0x00,0xff,0xff);


			console.assert(offset === b72.arrayBuffer.byteLength, "Estimated vertex count properly.");
		}


		{
			const node = new Node();
			node.mesh = mesh;
			scene.roots.push(node);
		}
		{
			const node = new Node();
			node.mesh = mesh;
			node.translation[0] = 1.0;
			scene.roots.push(node);
		}
		{
			const node = new Node();
			node.mesh = mesh;
			node.translation[1] = 1.0;
			node.rotation = [0,1,0,0]; //180 degrees around y-axis
			scene.roots.push(node);
		}

		scene.environment = Environment.default(gl);

		return scene;
	}
}

class Material {
	constructor() {
		this.program = null;
	}
}

class Mesh {
	constructor() {
		this.topology = null;
		this.count = 0;
		this.attributes = { };
		this.material = null;
	}

	draw(gl, u) {
		if (this.count === 0) return;
		gl.useProgram(this.material.program);
		helpers.setUniforms(gl, this.material.program, u);
		const unbind = helpers.bindAttributes(gl, this.material.program, this.attributes);
		gl.drawArrays(this.topology, 0, this.count);
		unbind();
	}
}

class Camera {
	constructor() {
		this.perspective = {
			vfov:60.0 / 180.0 * Math.PI,
			aspect:1.0,
			near:0.1,
			far:1000.0
		};

		this.parents = []; //chain of nodes to this camera
	}
	makeLOCAL_FROM_WORLD() {
		let LOCAL_FROM_WORLD = MATRIX_SLAB.alloc([1,0,0,0, 0,1,0,0, 0,0,1,0, 0,0,0,1]);
		for (let p of this.parents) {
			const LOCAL_FROM_PARENT = p.makeLOCAL_FROM_PARENT();
			LOCAL_FROM_WORLD = mul(LOCAL_FROM_PARENT, LOCAL_FROM_WORLD);
		}
		return LOCAL_FROM_WORLD;
	}
	//projection matrix:
	makeCLIP_FROM_LOCAL() {
		//TODO: use non-infinite if this.far is set
		return perspective(this.perspective.vfov, this.perspective.aspect, this.perspective.near);
	}
}


class Environment {
	constructor() {
		this.radiance = null;
		this.lambertian = null;
		this.ggx = null;
		this.parents = []; //chain of nodes to this environment
	}
	makeLOCAL_FROM_WORLD() {
		let LOCAL_FROM_WORLD = MATRIX_SLAB.alloc([1,0,0,0, 0,1,0,0, 0,0,1,0, 0,0,0,1]);
		for (let p of this.parents) {
			const LOCAL_FROM_PARENT = p.makeLOCAL_FROM_PARENT();
			LOCAL_FROM_WORLD = mul(LOCAL_FROM_PARENT, LOCAL_FROM_WORLD);
		}
		return LOCAL_FROM_WORLD;
	}
	makeLOCAL_FROM_WORLD_NORMAL() {
		//TODO: proper inverse transpose for non-uniform scale
		return this.makeLOCAL_FROM_WORLD();
	}

	static default(gl) {
		const ret = new Environment();
		ret.radiance = {cube:placeholderRadianceCube(gl)};
		ret.lambertian = {cube:placeholderLambertianCube(gl)};
		ret.ggx = {cube:placeholderGGXCube(gl)};

		return ret;
	}
}



class Node {
	constructor() {
		this.name = null;
		this.translation = [0,0,0];
		this.rotation = [0,0,0,1];
		this.scale = [1,1,1];
		this.children = [];
		//this.mesh
		//this.camera
	}
	makePARENT_FROM_LOCAL() {
		//quat -> rotation matrix from https://en.wikipedia.org/wiki/Quaternions_and_spatial_rotation
		const qi = this.rotation[0];
		const qj = this.rotation[1];
		const qk = this.rotation[2];
		const qr = this.rotation[3];
		const rot = [ //note:row-major, will transpose below
			1 - 2*(qj*qj + qk*qk),     2*(qi*qj - qk*qr),     2*(qi*qk + qj*qr),
			    2*(qi*qj + qk*qr), 1 - 2*(qi*qi + qk*qk),     2*(qj*qk - qi*qr),
			    2*(qi*qk - qj*qr),     2*(qj*qk + qi*qr), 1 - 2*(qi*qi + qj*qj)
		];
		const scale = this.scale;
		return MATRIX_SLAB.alloc([
			scale[0] * rot[0], scale[0] * rot[3], scale[0] * rot[6],0,
			scale[1] * rot[1], scale[1] * rot[4], scale[1] * rot[7],0,
			scale[2] * rot[2], scale[2] * rot[5], scale[2] * rot[8],0,
			this.translation[0], this.translation[1],this.translation[2],1
		]);
	}
	makeLOCAL_FROM_PARENT() {
		//quat -> rotation matrix from https://en.wikipedia.org/wiki/Quaternions_and_spatial_rotation
		const qi =-this.rotation[0];
		const qj =-this.rotation[1];
		const qk =-this.rotation[2];
		const qr = this.rotation[3];
		const ir = [ //note:row-major, will transpose below
			1 - 2*(qj*qj + qk*qk),     2*(qi*qj - qk*qr),     2*(qi*qk + qj*qr),
			    2*(qi*qj + qk*qr), 1 - 2*(qi*qi + qk*qk),     2*(qj*qk - qi*qr),
			    2*(qi*qk - qj*qr),     2*(qj*qk + qi*qr), 1 - 2*(qi*qi + qj*qj)
		];
		const is = [1.0 / this.scale[0], 1.0 / this.scale[1], 1.0 / this.scale[2]];
		const it = [-this.translation[0], -this.translation[1], -this.translation[2]];
		return MATRIX_SLAB.alloc([
			is[0]*ir[0], is[0]*ir[3], is[0]*ir[6], 0,
			is[1]*ir[1], is[1]*ir[4], is[1]*ir[7], 0,
			is[2]*ir[2], is[2]*ir[5], is[2]*ir[8], 0,
			is[0]*(ir[0]*it[0] + ir[1]*it[1] + ir[2]*it[2]),
				is[1]*(ir[3]*it[0] + ir[4]*it[1] + ir[5]*it[2]),
				is[2]*(ir[6]*it[0] + ir[7]*it[1] + ir[8]*it[2]),
				1
		]);
	}
	traverse(gl, u, CLIP_FROM_PARENT, LIGHT_FROM_PARENT, LIGHT_FROM_PARENT_NORMAL) {
		const PARENT_FROM_LOCAL = this.makePARENT_FROM_LOCAL();
		const PARENT_FROM_LOCAL_NORMAL = PARENT_FROM_LOCAL; //TODO: inverse transpose! (otherwise non-uniform scale won't behave right)

		const CLIP_FROM_LOCAL = mul(CLIP_FROM_PARENT, PARENT_FROM_LOCAL);
		const LIGHT_FROM_LOCAL = mul(LIGHT_FROM_PARENT, PARENT_FROM_LOCAL);
		const LIGHT_FROM_LOCAL_NORMAL = mul(LIGHT_FROM_PARENT_NORMAL, PARENT_FROM_LOCAL_NORMAL);

		if (this.mesh) {
			u.CLIP_FROM_LOCAL = CLIP_FROM_LOCAL;
			u.LIGHT_FROM_LOCAL = LIGHT_FROM_LOCAL;
			u.LIGHT_FROM_LOCAL_NORMAL = LIGHT_FROM_LOCAL_NORMAL;
			this.mesh.draw(gl, u);
		}

		for (const child of this.children) {
			child.traverse(gl, u, CLIP_FROM_LOCAL, LIGHT_FROM_LOCAL, LIGHT_FROM_LOCAL_NORMAL);
		}

		MATRIX_SLAB.free(LIGHT_FROM_LOCAL_NORMAL);
		MATRIX_SLAB.free(LIGHT_FROM_LOCAL);
		MATRIX_SLAB.free(CLIP_FROM_LOCAL);
		MATRIX_SLAB.free(PARENT_FROM_LOCAL);
	}
}


class Driver {
	constructor() {
		this.node = null;
		this.channel = "translation";
		this.times = [];
		this.values = [];
		this.interpolation = "LINEAR";

		//cached index for last drive()
		this.index = 0;
	}
	drive(time) {
		if (this.times.length === 0) return; //can't drive if no times
		if (this.node === null) return; //can't drive if no node

		let target;
		if (this.channel === "translation") {
			target = this.node.translation;
		} else if (this.channel === "rotation") {
			target = this.node.rotation;
		} else if (this.channel === "scale") {
			target = this.node.scale;
		} else {
			return; //can't drive if channel not recognized
		}

		//find the left index of a range containing 'time' (if in times):
		while (this.index > 0 && time < this.times[this.index]) this.index -= 1;
		while (this.index + 1 < this.times.length && this.times[this.index + 1] < time) this.index += 1;

		const i0 = this.index;
		const i1 = Math.min(this.index + 1, this.times.length-1);

		const t0 = this.times[i0];
		const t1 = this.times[i1];
		let v0 = this.values.slice(i0 * target.length, (i0+1) * target.length);
		const v1 = this.values.slice(i1 * target.length, (i1+1) * target.length);

		//console.log(`t[${i0}] = ${t0}, t[${i1}] = ${t1}, time = ${time}, v0 = ${v0}, v1 = ${v1}`);

		if (time <= t0) {
			v0.forEach((v,i) => { target[i] = v; });
		} else if (time >= t1) {
			v1.forEach((v,i) => { target[i] = v; });
		} else {
			if (this.interpolation === "STEP") {
				v0.forEach((v,i) => { target[i] = v; });
			} else if (this.interpolation === "SLERP") {
				//based on glm's quat::slerp (glm/ext/quaternion_common.inl)
				const amt = (time - t0) / (t1 - t0);
				let cos_theta = v0[0] * v1[0] + v0[1] * v1[1] + v0[2] * v1[2] + v0[3] * v1[3];
				if (cos_theta < 0) { //opposite direction
					v0 = v0.map(x => -x);
					cos_theta = -cos_theta;
				}
				if (cos_theta > 1 - 1e-7) {
					//when very small angle, use linear:
					v0.forEach((v,i) => { target[i] = amt * (v1[i] - v) + v; });
				} else {
					const theta = Math.acos(cos_theta);
					const amt0 = Math.sin((1-amt) * theta) / Math.sin(theta);
					const amt1 = Math.sin(amt * theta) / Math.sin(theta);
					v0.forEach((v,i) => { target[i] = amt0 * v + amt1 * v1[i]; });
				}
			} else if (this.interpolation === "LINEAR") {
				const amt = (time - t0) / (t1 - t0);
				v0.forEach((v,i) => { target[i] = amt * (v1[i] - v) + v; });
			} else {
				//unknown interpolation type
				v0.forEach((v,i) => { target[i] = v; });
			}
		}

	}
}
