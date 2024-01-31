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
	var na = gl.getProgramParameter(program, gl.ACTIVE_ATTRIBUTES);
	for (var i = 0; i < na; ++i) {
		var a = gl.getActiveAttrib(program, i);
		program[a.name] = {
			location:gl.getAttribLocation(program, a.name),
			type:a.type,
			size:a.size
		};
	}

	//store information about program uniforms:
	var nu = gl.getProgramParameter(program, gl.ACTIVE_UNIFORMS);
	for (var i = 0; i < nu; ++i) {
		var u = gl.getActiveUniform(program, i);
		program[u.name] = {
			location:gl.getUniformLocation(program, u.name),
			type:a.type,
			size:a.size
		};
	}

	return program;
}

export function bindAttributes(gl, program, attributes) {
	var warned = bindAttributes.warned || (bindAttributes.warned = {});
	var na = gl.getProgramParameter(program, gl.ACTIVE_ATTRIBUTES);
	for (var i = 0; i < na; ++i) {
		var a = gl.getActiveAttrib(program, i);
		var loc = gl.getAttribLocation(program, a.name);

		if (!(a.name in attributes)) {
			//warn if not specified:
			if (!(a.name in warned)) {
				console.warn("Attribute '" + a.name + "' used in shaders but not specified.");
				warned[a.name] = true;
			}
			gl.disableVertexAttribArray(loc);
			gl.vertexAttrib4f(loc, 0.0, 0.0, 0.0, 1.0);
		} else {
			var value = attributes[a.name];
			gl.bindBuffer(gl.ARRAY_BUFFER, value.src.glBuffer);
			gl.vertexAttribPointer(loc, value.size, value.type, value.normalized, value.stride, value.offset);
			gl.enableVertexAttribArray(loc);
		}
	}
}


export function setUniforms(gl, program, uniforms) {
	gl.useProgram(program);

	var warned = setUniforms.warned || (setUniforms.warned = {});
	for (var name in uniforms) {
		//warn about unused uniforms:
		if (!(name in program)) {
			if (!(name in warned)) {
				console.warn("Uniform '" + name + "' specified, but not used in shaders.");
				warned[name] = true;
			}
		}
	}

	var nu = gl.getProgramParameter(program, gl.ACTIVE_UNIFORMS);
	for (var i = 0; i < nu; ++i) {
		var u = gl.getActiveUniform(program, i);
		var loc = gl.getUniformLocation(program, u.name);

		if (!(u.name in uniforms)) {
			//error if not specified:
			throw new Error("Uniform '" + u.name + "' used in shaders but not specified.");
		}
		var value = uniforms[u.name];
		if (u.type === gl.FLOAT) {
			if (value.length !== 1) {
				throw new Error("Uniform '" + u.name + "' is a float, but value given is of length " + value.length);
			}
			gl.uniform1fv(loc, value);
		} else if (u.type === gl.FLOAT_VEC2) {
			if (value.length !== 2) {
				throw new Error("Uniform '" + u.name + "' is a vec2, but value given is of length " + value.length);
			}
			gl.uniform2fv(loc, value);
		} else if (u.type === gl.FLOAT_VEC3) {
			if (value.length !== 3) {
				throw new Error("Uniform '" + u.name + "' is a vec3, but value given is of length " + value.length);
			}
			gl.uniform3fv(loc, value);
		} else if (u.type === gl.FLOAT_VEC4) {
			if (value.length !== 4) {
				throw new Error("Uniform '" + u.name + "' is a vec4, but value given is of length " + value.length);
			}
			gl.uniform4fv(loc, value);
		} else if (u.type === gl.INT) {
			if (value.length !== 1) {
				throw new Error("Uniform '" + u.name + "' is a int, but value given is of length " + value.length);
			}
			gl.uniform1iv(loc, value);
		} else if (u.type === gl.INT_VEC2) {
			if (value.length !== 2) {
				throw new Error("Uniform '" + u.name + "' is a ivec2, but value given is of length " + value.length);
			}
			gl.uniform2iv(loc, value);
		} else if (u.type === gl.INT_VEC3) {
			if (value.length !== 3) {
				throw new Error("Uniform '" + u.name + "' is a ivec3, but value given is of length " + value.length);
			}
			gl.uniform3iv(loc, value);
		} else if (u.type === gl.INT_VEC4) {
			if (value.length !== 4) {
				throw new Error("Uniform '" + u.name + "' is a ivec4, but value given is of length " + value.length);
			}
			gl.uniform4iv(loc, value);
		} else if (u.type === gl.FLOAT_MAT2) {
			if (value.length !== 2*2) {
				throw new Error("Uniform '" + u.name + "' is a mat2, but value given is of length " + value.length);
			}
			gl.uniformMatrix2fv(loc, false, value);
		} else if (u.type === gl.FLOAT_MAT3) {
			if (value.length !== 3*3) {
				throw new Error("Uniform '" + u.name + "' is a mat3, but value given is of length " + value.length);
			}
			gl.uniformMatrix3fv(loc, false, value);
		} else if (u.type === gl.FLOAT_MAT4) {
			if (value.length !== 4*4) {
				throw new Error("Uniform '" + u.name + "' is a mat4, but value given is of length " + value.length);
			}
			gl.uniformMatrix4fv(loc, false, value);
		} else if (u.type === gl.SAMPLER_2D) {
			if (value.length !== 1) {
				throw new Error("Uniform '" + u.name + "' is a sampler2D, but value given is of length " + value.length);
			}
			gl.uniform1iv(loc, value);

		} else {
			throw new Error("Uniform '" + u.name + "' has a type '" + u.type + "' not supported by this code.");
		}
	}
}

/* example usage:
function init() {
	var canvas = document.getElementsByTagName("canvas")[0];

	//Create webgl context:
	(function createContext() {
		var attribs = { antialias:false };
		window.gl = canvas.getContext('webgl', attribs) || canvas.getContext("experimental-webgl", attribs);

		if (!window.gl) {
			throw new Error("Cannot create webgl context");
		}
	})();

	program = makeProgram("vertexShader", "fragmentShader");

	var attributes = makeAttributes();
	uploadAttributes(program, attributes);

	window.program = program;

	//rendering loop:
	var previous = NaN;
	window.time = 0.0;
	function render(timestamp) {
		gl.clearColor(0.5, 0.5, 0.5, 1.0);
		gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT | gl.STENCIL_BUFFER_BIT);

		gl.enable(gl.DEPTH_TEST);

		if (isNaN(previous)) {
			previous = timestamp;
		}
		var elapsed = (timestamp - previous) / 1000.0;
		previous = timestamp;

		if(elapsed > .1) elapsed = .1;

		window.time += elapsed;
		window.elapsed = elapsed;

		gl.useProgram(program);

		setUniforms(program, makeUniforms());

		bindAttributes(program, attributes);
		gl.drawArrays(gl.TRIANGLE_STRIP, 0, attributes.count);

		window.requestAnimationFrame(render);
	};

	window.requestAnimationFrame(render);
}
*/
