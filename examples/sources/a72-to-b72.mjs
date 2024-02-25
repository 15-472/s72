#!/usr/bin/env node

if (process.argv.length != 4) {
	console.log("Usage:\n\tnode a72-to-b72.mjs <input.a72> <output.b72>\nConvert from an JSON representation of attribute data (array of objects with s72 \"attributes\" members but with \"data\" arrays) to binary data blobs.");
	process.exit(1);
}

const IN_A72 = process.argv[2];
const OUT_B72 = process.argv[3];

console.log(`Converting '${IN_A72}' to '${OUT_B72}'..`);

import fs from 'node:fs';

const a72 = JSON.parse(fs.readFileSync(IN_A72, {encoding:'utf8'}));

console.assert(Array.isArray(a72), "Input should be an array.");

console.assert(a72[0] === "a72-v1", "First element of input array should be 'a72-v1'.");

//remove "a72-v1" from array:
a72.shift();

function to_uint8_norm(v) {
	if (!Number.isFinite(v)) {
		console.warn(`Trying to write ${v} as a uint8; will be written as zero.`);
		v = 0;
	}
	v = Math.round(Math.min(1, Math.max(0, v)) * 255);
	console.assert(0 <= v && v <= 255, "Clamping works.");
	return v;
}

let FORMATS = {
	"R32G32_SFLOAT":{ srcNumbers:2, dstBytes:4*2,
		write:(src, srcOffset, dst, dstOffset) => {
			dst.writeFloatLE(src[srcOffset+0], dstOffset + 0);
			dst.writeFloatLE(src[srcOffset+1], dstOffset + 4);
		}
	},
	"R32G32B32_SFLOAT":{ srcNumbers:3, dstBytes:4*3,
		write:(src, srcOffset, dst, dstOffset) => {
			dst.writeFloatLE(src[srcOffset+0], dstOffset + 0);
			dst.writeFloatLE(src[srcOffset+1], dstOffset + 4);
			dst.writeFloatLE(src[srcOffset+2], dstOffset + 8);
		}
	},
	"R32G32B32A32_SFLOAT":{  srcNumbers:4, dstBytes:4*4,
		write:(src, srcOffset, dst, dstOffset) => {
			dst.writeFloatLE(src[srcOffset+0], dstOffset + 0);
			dst.writeFloatLE(src[srcOffset+1], dstOffset + 4);
			dst.writeFloatLE(src[srcOffset+2], dstOffset + 8);
			dst.writeFloatLE(src[srcOffset+3], dstOffset + 12);
		}
	},
	"R8G8B8A8_UNORM":{  srcNumbers:4, dstBytes:4*1,
		write:(src, srcOffset, dst, dstOffset) => {
			dst.writeUInt8(to_uint8_norm(src[srcOffset+0]), dstOffset + 0);
			dst.writeUInt8(to_uint8_norm(src[srcOffset+1]), dstOffset + 1);
			dst.writeUInt8(to_uint8_norm(src[srcOffset+2]), dstOffset + 2);
			dst.writeUInt8(to_uint8_norm(src[srcOffset+3]), dstOffset + 3);
		}
	},
};

//determine buffer size:
let bufferBytes = 0;
let attribBytes = 0;
for (const mesh of a72) {
	console.assert(typeof(mesh) === "object", "Other elements of input array should be objects.");
	console.assert(typeof(mesh.count) === "number", "Each input array element should have 'count' (vertex count) number.");
	console.assert(typeof(mesh.attributes) === "object", "Each input array element should have 'attributes' (vertex attributes) object.");
	for (const n of Object.keys(mesh.attributes)) {
		const a = mesh.attributes[n];
		console.assert(a.format in FORMATS, `Attribute '${n}' has format '${a.format}' which should be in the FORMATS array.`);
		const f = FORMATS[a.format];
		bufferBytes = Math.max(bufferBytes, a.offset + a.stride * (mesh.count - 1) + f.dstBytes);
		attribBytes += mesh.count * f.dstBytes;
	}
}

console.log(`Buffer will be ${bufferBytes} bytes.`);
if (attribBytes !== bufferBytes) {
	console.warn(`  NOTE: attributes will write ${attribBytes} (which is not exactly the number of bytes in the buffer!)`);
}

//copy data to buffer:
const buffer = Buffer.alloc(bufferBytes, 0);
for (const mesh of a72) {
	for (const n of Object.keys(mesh.attributes)) {
		const a = mesh.attributes[n];
		const f = FORMATS[a.format];
		console.assert(f.srcNumbers * mesh.count === a.data.length, `Attribute '${n}' data length should match count.`);
		for (let i = 0; i < mesh.count; ++i) {
			f.write(a.data, i * f.srcNumbers, buffer, a.offset + i * a.stride);
		}
	}
}

//write buffer:
fs.writeFileSync(OUT_B72, buffer);
console.log(`Wrote '${OUT_B72}'.`);
