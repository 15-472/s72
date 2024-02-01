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
	var warned = bindAttributes.warned || (bindAttributes.warned = {});
	var na = gl.getProgramParameter(program, gl.ACTIVE_ATTRIBUTES);
	for (const name of Object.keys(program.attributes)) {
		const a = program.attributes[name];
		if (!(name in attributes)) {
			//warn if not specified:
			if (!(name in warned)) {
				console.warn("Attribute '" + name + "' used in shaders but not specified.");
				warned[name] = true;
			}
			gl.disableVertexAttribArray(a.location);
			gl.vertexAttrib4f(loc, 0.0, 0.0, 0.0, 1.0);
		} else {
			const value = attributes[name];
			gl.bindBuffer(gl.ARRAY_BUFFER, value.src.glBuffer);
			gl.vertexAttribPointer(a.location, value.size, value.type, value.normalized, value.stride, value.offset);
			gl.enableVertexAttribArray(a.location);
		}
	}
}


export function setUniforms(gl, program, uniforms) {
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
		if (u.type === gl.FLOAT) {
			if (value.length !== 1) {
				throw new Error("Uniform '" + name + "' is a float, but value given is of length " + value.length);
			}
			gl.uniform1fv(u.location, value);
		} else if (u.type === gl.FLOAT_VEC2) {
			if (value.length !== 2) {
				throw new Error("Uniform '" + name + "' is a vec2, but value given is of length " + value.length);
			}
			gl.uniform2fv(u.location, value);
		} else if (u.type === gl.FLOAT_VEC3) {
			if (value.length !== 3) {
				throw new Error("Uniform '" + name + "' is a vec3, but value given is of length " + value.length);
			}
			gl.uniform3fv(u.location, value);
		} else if (u.type === gl.FLOAT_VEC4) {
			if (value.length !== 4) {
				throw new Error("Uniform '" + name + "' is a vec4, but value given is of length " + value.length);
			}
			gl.uniform4fv(u.location, value);
		} else if (u.type === gl.INT) {
			if (value.length !== 1) {
				throw new Error("Uniform '" + name + "' is a int, but value given is of length " + value.length);
			}
			gl.uniform1iv(u.location, value);
		} else if (u.type === gl.INT_VEC2) {
			if (value.length !== 2) {
				throw new Error("Uniform '" + name + "' is a ivec2, but value given is of length " + value.length);
			}
			gl.uniform2iv(u.location, value);
		} else if (u.type === gl.INT_VEC3) {
			if (value.length !== 3) {
				throw new Error("Uniform '" + name + "' is a ivec3, but value given is of length " + value.length);
			}
			gl.uniform3iv(u.location, value);
		} else if (u.type === gl.INT_VEC4) {
			if (value.length !== 4) {
				throw new Error("Uniform '" + name + "' is a ivec4, but value given is of length " + value.length);
			}
			gl.uniform4iv(u.location, value);
		} else if (u.type === gl.FLOAT_MAT2) {
			if (value.length !== 2*2) {
				throw new Error("Uniform '" + name + "' is a mat2, but value given is of length " + value.length);
			}
			gl.uniformMatrix2fv(u.location, false, value);
		} else if (u.type === gl.FLOAT_MAT3) {
			if (value.length !== 3*3) {
				throw new Error("Uniform '" + name + "' is a mat3, but value given is of length " + value.length);
			}
			gl.uniformMatrix3fv(u.location, false, value);
		} else if (u.type === gl.FLOAT_MAT4) {
			if (value.length !== 4*4) {
				throw new Error("Uniform '" + name + "' is a mat4, but value given is of length " + value.length);
			}
			gl.uniformMatrix4fv(u.location, false, value);
		} else if (u.type === gl.SAMPLER_2D) {
			if (value.length !== 1) {
				throw new Error("Uniform '" + name + "' is a sampler2D, but value given is of length " + value.length);
			}
			gl.uniform1iv(u.location, value);

		} else {
			throw new Error("Uniform '" + name + "' has a type '" + u.type + "' not supported by this code.");
		}
	}
}
