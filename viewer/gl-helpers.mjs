//gl-helpers.js from game-programming-f23 web page
// based on MDN WebGL tutorials

function readScript(script) {
	var ret = "";
	var currentChild = script.firstChild;
	 
	while(currentChild) {
		if (currentChild.nodeType == currentChild.TEXT_NODE) {
			ret += currentChild.textContent;
		}
		currentChild = currentChild.nextSibling;
	}
	return ret;
}

export function compileShader(gl, shaderType, source) {
	const shader = gl.createShader(shaderType);
	gl.shaderSource(shader, source);
	gl.compileShader(shader);
	if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
		throw new Error("Failed to compile shader: " + gl.getShaderInfoLog(shader));
	}
	return shader;
}

export function makeProgram(gl, vertexSrc, fragmentSrc) {
	var program = gl.createProgram();

	var vertexShader = compileShader(gl, gl.VERTEX_SHADER, vertexSrc);
	var fragmentShader = compileShader(gl, gl.FRAGMENT_SHADER, fragmentSrc);

	gl.attachShader(program, vertexShader);
	gl.attachShader(program, fragmentShader);
	
	gl.linkProgram(program);

	if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
		throw new Error("Unable to link shader program.");
	}

	//store information about program attributes:
	program.attributes = {};
	var na = gl.getProgramParameter(program, gl.ACTIVE_ATTRIBUTES);
	for (var i = 0; i < na; ++i) {
		var a = gl.getActiveAttrib(program, i);
		program.attributes[a.name] = {
			location:gl.getAttribLocation(program, a.name),
			type:a.type,
			size:a.size
		};
	}

	//store information about program uniforms:
	program.uniforms = {};
	var nu = gl.getProgramParameter(program, gl.ACTIVE_UNIFORMS);
	for (var i = 0; i < nu; ++i) {
		var u = gl.getActiveUniform(program, i);
		program.uniforms[u.name] = {
			location:gl.getUniformLocation(program, u.name),
			type:u.type,
			size:u.size
		};
	}

	return program;
}

export function bindAttributes(gl, program, attributes) {
	let warned = bindAttributes.warned || (bindAttributes.warned = {});
	let enabled = [];
	for (const name of Object.keys(program.attributes)) {
		const a = program.attributes[name];
		if (!(name in attributes)) {
			//warn if not specified:
			if (!(name in warned)) {
				console.warn("Attribute '" + name + "' used in shaders but not specified.");
				warned[name] = true;
			}
			gl.disableVertexAttribArray(a.location);
			gl.vertexAttrib4f(a.location, 0.0, 0.0, 0.0, 1.0);
		} else {
			const value = attributes[name];
			gl.bindBuffer(gl.ARRAY_BUFFER, value.src.glBuffer);
			gl.vertexAttribPointer(a.location, value.size, value.type, value.normalized, value.stride, value.offset);
			gl.enableVertexAttribArray(a.location);
			enabled.push(a.location);
		}
	}

	return function unbind() {
		for (let loc of enabled) {
			gl.disableVertexAttribArray(loc);
		}
	};
}


//make a table of uniform types to assist in compact-ish uniform-setting code:
const UNIFORM_TYPES_STR = {
	"FLOAT":       { per:1, name:"float", func:(gl,u,value) => { gl.uniform1fv(u.location, value); } },
	"FLOAT_VEC2":  { per:2, name:"vec2",  func:(gl,u,value) => { gl.uniform2fv(u.location, value); } },
	"FLOAT_VEC3":  { per:3, name:"vec3",  func:(gl,u,value) => { gl.uniform3fv(u.location, value); } },
	"FLOAT_VEC4":  { per:4, name:"vec4",  func:(gl,u,value) => { gl.uniform4fv(u.location, value); } },
	"INT":      { per:1, name:"int",   func:(gl,u,value) => { gl.uniform1iv(u.location, value); } },
	"INT_VEC2": { per:2, name:"ivec2", func:(gl,u,value) => { gl.uniform2iv(u.location, value); } },
	"INT_VEC3": { per:3, name:"ivec3", func:(gl,u,value) => { gl.uniform3iv(u.location, value); } },
	"INT_VEC4": { per:4, name:"ivec4", func:(gl,u,value) => { gl.uniform4iv(u.location, value); } },
	"UNSIGNED_INT":      { per:1, name:"uint",  func:(gl,u,value) => { gl.uniform1uiv(u.location, value); } },
	"UNSIGNED_INT_VEC2": { per:2, name:"uvec2", func:(gl,u,value) => { gl.uniform2uiv(u.location, value); } },
	"UNSIGNED_INT_VEC3": { per:3, name:"uvec3", func:(gl,u,value) => { gl.uniform3uiv(u.location, value); } },
	"UNSIGNED_INT_VEC4": { per:4, name:"uvec4", func:(gl,u,value) => { gl.uniform4uiv(u.location, value); } },
	"FLOAT_MAT2":  { per:2*2, name:"mat2", func:(gl,u,value) => { gl.uniformMatrix2fv(u.location, false, value); } },
	"FLOAT_MAT3":  { per:3*3, name:"mat3", func:(gl,u,value) => { gl.uniformMatrix3fv(u.location, false, value); } },
	"FLOAT_MAT4":  { per:4*4, name:"mat4", func:(gl,u,value) => { gl.uniformMatrix4fv(u.location, false, value); } },
	"SAMPLER_2D":  { per:1,   name:"sampler2D",   func:(gl,u,value) => { gl.uniform1iv(u.location, value); } },
	"SAMPLER_CUBE":{ per:1,   name:"samplerCube", func:(gl,u,value) => { gl.uniform1iv(u.location, value); } },
};

//the above, but fixed up with gl.* constants
const UNIFORM_TYPES = { };

export function setUniforms(gl, program, uniforms) {
	if (Object.keys(UNIFORM_TYPES).length == 0) {
		for (const key of Object.keys(UNIFORM_TYPES_STR)) {
			UNIFORM_TYPES[gl[key]] = UNIFORM_TYPES_STR[key];
		}
	}

	gl.useProgram(program);

	var warned = setUniforms.warned || (setUniforms.warned = {});
	for (const name of Object.keys(uniforms)) {
		//warn about unused uniforms:
		if (!(name in program.uniforms)) {
			if (!(name in warned)) {
				console.warn("Uniform '" + name + "' specified, but not used in shaders.");
				warned[name] = true;
			}
		}
	}

	for (let name of Object.keys(program.uniforms)) {
		const u = program.uniforms[name];

		if (!(name in uniforms)) {
			//error if not specified:
			throw new Error("Uniform '" + name + "' used in shaders but not specified.");
		}
		const value = uniforms[name];

		if (u.type in UNIFORM_TYPES) {
			const ut = UNIFORM_TYPES[u.type];

			if (u.size === 1) {
				if (value.length != ut.per) {
					throw new Error(`Uniform '${name}' is a ${ut.name}, but value given is of length ${value.length}.`);
				}
			} else {
				if (value.length % ut.per !== 0 || value.length > ut.per * u.size) {
					throw new Error(`Uniform '${name}' is a ${ut.name}[${u.size}], but value given is of length ${value.length}.`);
				}
			}
			ut.func(gl, u, value);
		} else {
			throw new Error("Uniform '" + name + "' has a type '" + u.type + "' not supported by this code.");
		}
	}
}
