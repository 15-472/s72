# Scene'72 (`.s72`), a format for animated 3D scenes

Scene'72 is a JSON-based format for storing animated 3D scenes used in the course 15-472/672/772: Real-Time Graphics.
Using JSON comes with some upsides (e.g., human-readability, widespread tool support, and extensibility)
and some downsides (e.g., larger file sizes and slow loading), which we will seek to mitigate by referencing external files for bulk data.

For example files see the [`examples`](examples) subdirectory.

The `.s72` format is somewhat inspired by <a href="https://registry.khronos.org/glTF/specs/2.0/glTF-2.0.html">glTF</a>.

## Conventions

Scene'72 scenes are **z-up**, lengths are **meters**, and times are **seconds**.

## External Files

Note that scene'72 files may reference binary'72 (or buffer'72 if you'd like) files.
These are raw binary data blobs, and are generally named with a `.b72` extension.
These files have no fixed layout -- the data is accessed with the offsets and formats given by objects in the associated scene'72 file.
(Think of them as "things your code will probably almost immediately put in vertex buffers".)


## File Structure

Scene'72 files are UTF8-encoded <a href="https://json.org">JSON</a>, and are generally named with a <code>.s72</code> extension.

The top-level value of a scene'72 file is always an array, and the first element of the array is always the string `"s72-v1"`.
Code that writes scene'72 files should write the top-level array such that the first nine bytes of a scene'72 file are exactly `["s72-v1"` in order to make it easy for utilities to recognize the file type.

### Objects
The remainder of the array is filled with JSON objects with (at least) a `"type"` and `"name"` property:
```js
/* ... */
{
	"type":"...",
	"name":"first object",
	/* ... */
/* ... */
```

Properties (all objects):
- `"type":"..."` gives the object type as a string; specific object types are documented below. A scene'72 loader that finds an object with an unrecognized `type` should emit a warning and may emit an error.
- `"name":"..."` gives the object name as a string; object names must be unique within their type. However, scene'72 loaders are not required to check for uniqueness (nor does any aspect of the file format require uniqueness).

**Referencing objects:**
When objects reference other objects in the array they do so by index in the top-level array.
Note that `0` is always an invalid object reference (since the first element of the array is the "magic value" denoting the filetype).

### *Scene* Objects
Every scene'72 file contains exactly one *scene* object, which defines global properties of the scene:
```js
/* ... */
{
	"type":"SCENE",
	"name":"Cube Pyramid",
	"roots":[2,3]
},
/* ... */
```

*Scene* objects must have their `type` property set to `"SCENE"`.
They include the following *scene*-specific properties:
- `"roots":[...]` (required) -- array of references to *node*s at which to start drawing the scene.

### *Node* Objects
The structure of a *scene* is determined by a graph of transformation *node*s:
```js
/* ... */
{
	"type":"NODE",
	"name":"bottom",
	"translation":[0,0,0],
	"rotation":[0,0,0,1],
	"scale":[1,1,1],
	"children":[2,3,4,5],
	"camera":7,
	"mesh":2
},
/* ... */
```
*Node* objects have their `type` property set to `"NODE"`.
They include the following *node*-specific properties:
 - <code>"translation":[<var>tx</var>,<var>ty</var>,<var>tz</var>]</code> (optional; default is `[0,0,0]`) -- the translation part of the node's transform, as a 3-element array of numbers.
 - <code>"rotation":[<var>rx</var>,<var>ry</var>,<var>rz</var>,<var>rw</var>]</code> (optional; default is `[0,0,0,1]`) -- the rotation part of the node's transform, as a unit quaternion (where `rw` is the scalar part of the quaternion).
 - <code>"scale":[<var>sx</var>,<var>sy</var>,<var>sz</var>]</code> (optional; default is `[1,1,1]`) -- the scale part of the node's transform, as a 3-element array of axis-aligned scale factors.
 - `"children":[...]` (optional; default is `[]`) -- array of references to *node*s which should be instanced as children of this transformation.
 - <code>"mesh":<var>i</var></code> (optional) -- reference to a *mesh* to instance at this node.
 - <code>"camera":<var>i</var></code> (optional) -- reference to a *camera* to instance at this node.

The transformation from the local space of a <em>node</em> to the local space of its parent node is given by applying its scale, rotation, and translation values (in that order):
```math
M_{\textrm{parent-from-local}} = T * R * S
```

*Note:* the structure of the graph on *node* objects induced by their `children` arrays is not restricted by this specification.
Thus, e.g., there may be multiple paths from the root of the scene to a given *node*. (Effectively, instancing entire transformation sub-trees.)
However, implementations may choose to reject files containing *cyclic* transformation graphs.

### *Mesh* objects
Drawable geometry in the scene is represented by *mesh* objects:
```js
/* ... */
{
	"type":"MESH",
	"name":"cube",
	"topology":"TRIANGLE_LIST",
	"count":12,
	"indices": { "src":"cube.b72", "offset":576, "format":"UINT32" },
	"attributes":{
		"POSITION":{ "src":"cube.b72", "offset":0,  "stride":28, "format":"R32G32B32_SFLOAT" },
		"NORMAL":  { "src":"cube.b72", "offset":12, "stride":28, "format":"R32G32B32_SFLOAT" },
		"COLOR":   { "src":"cube.b72", "offset":24, "stride":28, "format":"R8G8B8A8_UNORM" }
	}
},
/* ... */
```
*Mesh* objects have their `type` property set to `"MESH"`.
They include the following *mesh*-specific properties:
- `"topology":"..."` (required) -- the primitive type and layout used in the mesh.
Valid values are <a href="https://registry.khronos.org/vulkan/specs/1.3-extensions/man/html/VkPrimitiveTopology.html">VkPrimitiveTopology</a> identifiers without the prefix (e.g., `"TRIANGLE_LIST"`).
- <code>"count":<var>N</var></code> (required) -- the number of vertices in the mesh.
- `"indices":{ ... }` (optional -- if specified, a data stream containing indices for indexed drawing commands.
- `"attributes":{ ... }` (required) -- named data streams containing the mesh attributes.

**Mesh attributes.**
Mesh *attribute*s are data streams used to define the mesh vertices.
*Attribute* stream names should follow the naming convention used by <a href="https://registry.khronos.org/glTF/specs/2.0/glTF-2.0.html#meshes-overview">glTF</a> (e.g., using `"POSITION"` for the position stream, `"NORMAL"` for vertex normals, `"COLOR"` for vertex colors, and so on).
However, stream formats are not restricted by the glTF conventions.

*Attribute*s have the following properties:
- `"src":"..."` (required) -- file to read data from. Note that the path is specified relative to the ".s72" file.
- <code>"offset":<var>N</var></code> (required) -- byte offset from the start of the file for the first element of this attribute stream.
- <code>"stride":<var>S</var></code> (required) -- bytes between the starts of subsequent elements of this attribute stream.</li>
- `"format":"..."` (required) -- format of the stored attribute. Valid strings are <a href="https://registry.khronos.org/vulkan/specs/1.3-extensions/man/html/VkFormat.html">VkFormat</a> identifiers without the prefix, e.g., `R32G32B32_SFLOAT`.

**Note about attribute formats:**
There are an absurd number of possible <code>VkFormat</code> values.
Scene'72 loaders are not required to support any particular formats, and should emit a warning or error upon encountering a format they do not support.
However, a scene'72 loader should support as many formats as possible -- ideally, every format with a check mark in the `VK_FORMAT_FEATURE_VERTEX_BUFFER_BIT` column in the <a href="https://registry.khronos.org/vulkan/specs/1.3-extensions/html/vkspec.html#features-required-format-support">format support tables</a>.
Our example files use the `R32G32B32_FLOAT` and `R8G8B8A8_UNORM` formats; so these are a good place to start.

If a *mesh* contains an `indices` property, it is an <em>indexed</em> mesh -- its vertex stream must be constructed by reading indices from the specified data stream and using these to access the vertex stream.
Otherwise its vertex stream must be drawn sequentially from the attributes array.
(See <a href="https://registry.khronos.org/vulkan/specs/1.3-extensions/html/vkspec.html#drawing-primitive-shading">Programmable Primitive Shading</a> for the Vulkan specification's lists of indexed and non-indexed drawing commands.)

Index streams are defined similarly to attribute streams with two differences:
- `"format"` must be a <a href="https://registry.khronos.org/vulkan/specs/1.3-extensions/man/html/VkIndexType.html">VkIndexType</a> identifier without the common prefix (e.g., "UINT32").
- `"stride"` must be omitted -- indices are always tightly packed.

In index streams, the all-ones index (e.g., `0xffffffff` for `"format":"UINT32"` streams) is used to indicate primitive restart.

**Note about index formats:**
An scene'72 loader must support `"UINT32"` format, and may support other formats.

### *Camera* Objects
*Camera* objects define projection parameters of cameras in the scene:
```js
/* ... */
{
	"type":"camera",
	"name":"main view",
	"perspective":{
		"aspect": 1.777,
		"vfov": 1.04719,
		"near": 0.1,
		"far":10.0
	}
},
/* ... */
```
*Camera* objects have their `type` property set to `"CAMERA"`.
They include the following *camera*-specific properties:
- `"perspective":{...}` (optional) -- defines that the camera uses perspective projection. Contains child properties:
  - <code>"aspect":<var>a</var></code> (required) -- image aspect ratio (width / height).
  - <code>"vfov":<var>r</var></code> (required) -- vertical field of view in radians.
  - <code>"near":<var>z</var></code> (required) -- near clipping plane distance.
  - <code>"far":<var>z</var></code> (optional) -- far clipping plane distance; if omitted, use an infinite perspective matrix.

Scene'72 cameras look down their local -z axis with +y being upward and +x being rightward in the image plane.

*Camera* objects must define *some* projection; so even though `"perspective"` is marked as "optional" above it is de-facto required unless you decide to add (say) `"orthographic"` cameras.

If rendering through a camera that does not match the output image aspect ratio, a scene'72 viewer should letter- or pillar-box the output image.


### *Driver* Objects
*Driver* objects drive (animate) properties of other objects:
```js
/* ... */
{
	"type":"DRIVER",
	"name":"camera move",
	"node":12,
	"channel":"translation",
	"times":[0, 1, 2, 3, 4],
	"values":[0,0,0, 0,0,1, 0,1,1, 1,1,1, 0,0,0],
	"interpolation":"LINEAR"
},
/* ... */
```
*Driver* objects have their `type` property set to `"DRIVER"`.
They include the following *driver*-specific properties:
- <code>"node":<var>i</var></code> (required) -- reference to the node whose property should be animated by this driver.
- `"channel":"..."` (required) -- name of an animation channel; implies a data width (see below).
- `"times":[...]` (required) -- array of numbers giving keyframe times.
- `"values":[...]` (required) -- array of numbers giving keyframe values.
- `"interpolation":"..."` (optional; default is `"LINEAR"`) -- interpolation mode for the data (see below).


The values in the `values` array are grouped into 1D-4D vectors depending on the channel type and interpolation scheme.
For example, a 3D channel with $n$ times will have $3n$ `values`, which should be considered as $n$ 3-vectors.

The possible `channel` values and their meanings are as follows:
- 3D `channel`s: `"translation"`, `"scale"`. Meaning: set the associated component of the target node.
- 4D `channel`s: `"rotation"`. Meaning: set the `rotation` of the target node as a quaternion.

The meaning of `interpolation` is as follows:
- `"STEP"` the output value in the middle of a time interval is the value at the beginning of that interval.
- `"LINEAR"` the output value in the middle of a time interval is a linear mix of the starting and ending values.
- `"SLERP"` the output value in the middle of a time interval is a "spherical linear interpolation" between the starting and ending values. (Doesn't make sense for 1D signals or non-normalized signals.)

Extrapolation is always constant.

The effect of applying *driver* objects should be as if the objects are applied in the order they appear in the file.
I.e., later *driver* objects may override earlier *driver* objects that drive the same properties.


## Features Under Consideration
These features are not yet standard, but are under consideration as potentially useful.

### *Data* Objects
*Data* objects define embedded data.
```js
/* ... */
{
	"type":"DATA",
	"name":"animation curves",
	"data":[ 0,0, 1,0, 2,1, 3,1, 4,0 ]
}
```
*Data* objects have their `type` property set to `"DATA"`.
They include the following *data*-specific properties:
- `"data":[...]` (required) -- an array of numbers.

Anywhere a `.b72` file can be referenced, one can instead use the index of a *data* object.
This should be the same as a `.b72` file containing the bytes corresponding to the numbers in `data` array represented as system-endian 32-bit floating point numbers.
(Notably, this makes *data* objects pretty useless for mesh indices.)
