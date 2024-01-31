//built with reference to 'brdf-toy.html' from game-programming-f23 notes

import * as helpers from './gl-helpers.mjs';

class Camera {
	constructor() {
		this.target = {x:0, y:0, z:0};
		this.radius = 2;
		this.azimuth = 0;
		this.elevation = 0;

		this.fovy = 60.0;
		this.aspect = 1.0; //will update layer
		this.near = 0.1;
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
	var f = 1 / Math.tan(fovy/2 * Math.PI / 180.0);
	return new Float32Array([
		f / aspect, 0.0, 0.0, 0.0,
		0.0, f, 0.0, 0.0,
		0.0, 0.0, -1, -1,
		0.0, 0.0, -2*zNear, 0.0
	]);
}
function mul(A, B) {
	var out = new Float32Array(16);
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


const vertexSrc = `
attribute vec3 Position;
attribute vec3 Normal;
attribute vec4 Color;

uniform mat4 CLIP_FROM_LOCAL;

varying vec3 position;
varying vec3 normal;
varying vec4 color;

void main() {
	position = Position;
	normal = Normal;
	color = Color;

	gl_Position = CLIP_FROM_LOCAL * vec4(Position, 1.0);
}
`;

const fragmentSrc = `
varying highp vec3 position;
varying highp vec3 normal;
varying mediump vec4 color;

void main() {
	highp vec3 n = normalize(normal);
	highp vec3 light = mix(vec3(0,0,0), vec3(1,1,1), dot(n, vec3(0,0,1)) * 0.5 + 0.5);
	gl_FragColor = vec4(color.rgb * light, color.a);
}
`;

export class Viewer {
	constructor(canvas) {
		this.canvas = canvas;
		this.camera = new Camera();

		const gl = this.gl = this.canvas.getContext('webgl', {
			antialias:false,
		});
		if (!gl) {
			throw new Error("Failed to create WebGL context.");
		}

		this.program = helpers.makeProgram(gl, vertexSrc, fragmentSrc);

		//default scene (before anything gets loaded):
		this.scene = Scene.default(gl);
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
				const move = 2.0 * Math.tan(0.5 * this.camera.fovy / 180.0 * Math.PI) * this.camera.radius;
				const dx = -(X - this.panning.X) / this.canvas.clientWidth * this.camera.aspect * move;
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
		console.log("draw");

		const width = parseInt(this.canvas.width);
		const height = parseInt(this.canvas.height);

		this.camera.aspect = width / height;

		const gl = this.gl;

		gl.viewport(0,0,width,height);

		gl.clearColor(0.0, 0.0, 0.0, 1.0);
		gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT | gl.STENCIL_BUFFER_BIT);
		gl.enable(gl.DEPTH_TEST);
		gl.useProgram(this.program);


		const frame = this.camera.makeFrame();

		const CLIP_FROM_WORLD = mul(
			perspective(this.camera.fovy, this.camera.aspect, this.camera.near),
			new Float32Array([
				frame.right.x, frame.up.x,-frame.forward.x, 0.0,
				frame.right.y, frame.up.y,-frame.forward.y, 0.0,
				frame.right.z, frame.up.z,-frame.forward.z, 0.0,
				-dot(frame.right,frame.at), -dot(frame.up,frame.at), dot(frame.forward,frame.at), 1.0
			])
		);

		const u = {
			CLIP_FROM_LOCAL:CLIP_FROM_WORLD
		};

		/*helpers.setUniforms(gl, this.program, u);
		helpers.bindAttributes(gl, this.program, this.attributes);
		gl.drawArrays(gl.TRIANGLES, 0, this.attributes.count);
		*/

		this.scene.traverse(gl, this.program, u, CLIP_FROM_WORLD);
	}

	redraw() {
		if (this.redawPending) return;
		this.redrawPending = true;
		window.requestAnimationFrame(() => {
			delete this.redrawPending;
			this.draw();
		});
	}

	makeUniforms() {
		const u = {};

		const frame = this.camera.makeFrame();

		u.CLIP_FROM_LOCAL = mul(
			perspective(this.camera.fovy, this.camera.aspect, this.camera.near),
			new Float32Array([
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
		
		this.b72s = {}; //loaded from b72 files, will be {arrayBuffer: , glBuffer:}
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

	traverse(gl, program, u, CLIP_FROM_WORLD) {
		for (const root of this.roots) {
			root.traverse(gl, program, u, CLIP_FROM_WORLD);
		}
	}

	static async from(url) {
		console.log("LOAD ATTEMPT");
	}

	static default(gl) {
		const scene = new Scene();

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

		return scene;
	}
}

class Mesh {
	constructor() {
		this.topology = null;
		this.count = 0;
		this.attributes = { };
	}

	draw(gl, program) {
		if (this.count === 0) return;

		helpers.bindAttributes(gl, program, this.attributes);
		gl.drawArrays(this.topology, 0, this.count);

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
	traverse(gl, program, u, CLIP_FROM_PARENT) {
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
		const PARENT_FROM_LOCAL = new Float32Array([
			rot[0],rot[3],rot[6],0,
			rot[1],rot[4],rot[7],0,
			rot[2],rot[5],rot[8],0,
			this.translation[0], this.translation[1],this.translation[2],1
		]);

		const CLIP_FROM_LOCAL = mul(CLIP_FROM_PARENT, PARENT_FROM_LOCAL);

		if (this.mesh) {
			u.CLIP_FROM_LOCAL = CLIP_FROM_LOCAL;
			helpers.setUniforms(gl, program, u);
			this.mesh.draw(gl, program);
		}

		for (const child of this.children) {
			child.traverse(gl, program, u, CLIP_FROM_LOCAL);
		}
	}
}
