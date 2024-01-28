# Scene'72 (`.s72`), a format for animated 3D scenes

Scene'72 is a JSON-based format for storing animated 3D scenes used in the course 15-472/672/772: Real-Time Graphics.
Using JSON comes with some upsides (e.g., human-readability, widespread tool support, and extensibility)
and some downsides (e.g., larger file sizes and slow loading), which we will seek to mitigate by referencing external files for bulk data.

For example files see the [`examples`](examples) subdirectory.

The `.s72` format is somewhat inspired by <a href="https://registry.khronos.org/glTF/specs/2.0/glTF-2.0.html">glTF</a>.

## Conventions

Scene'72 scenes are **z-up** and their scene units are **meters**.

## External Files

Note that scene'72 files may reference Binary'72 (or Buffer'72 if you'd like) files are raw binary data blobs, and are generally named with a `.b72` extension.
These files have no fixed layout -- the data is accessed with the offsets and formats given by objects in the associated scene'72 file.
(Think of them as "things your code will probably almost immediately put in vertex buffers".)


## File Structure

Scene'72 files are UTF8-encoded <a href="https://json.org">JSON</a>, and are generally named with a <code>.s72</code> extension.

The top-level value of a scene'72 file is always an array, and the first element of the array is always the string `"s72-v1"`.
Code that writes scene'72 files should write the top-level array such that the first nine bytes of a scene'72 file are exactly `["s72-v1"` in order to make it easy for utilities to recognize the file type.

The remainder of the array is filled with JSON objects with (at least) a `"type"` and `"name"` property:
```
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

When objects reference other objects in the array they do so by index in the top-level array.
Note that `0` is always an invalid object reference (since the first element of the array is the "magic value" denoting the filetype).


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

The structure of a *scene* is determined by a DAG of transformation *node*s:
```
/* ... */
{
	"type":"NODE",
	"name":"bottom",
	"translation":[0,0,0],
	"rotation":[0,0,0,1],
	"scale":[1,1,1],
	"children":[2,3,4,5],
	"camera":7,
	"mesh":2,
},
/* ... */
```
*Node* objects have their `type` property set to `"NODE"`.
The include the following *node*-specific properties:
 - `"translation":[<var>tx</var>,<var>ty</var>,<var>tz</var>]` (optional; default is `[0,0,0]`) -- the translation part of the node's transform, as a 3-element array of numbers.
 - `"rotation":[<var>rx</var>,<var>ry</var>,<var>rz</var>,<var>rw</var>]` (optional; default is `[0,0,0,1]`) -- the rotation part of the node's transform, as a unit quaternion (where `rw` is the scalar part of the quaternion).
 - `"scale":[<var>sx</var>,<var>sy</var>,<var>sz</var>]` (optional; default is `[1,1,1]`) -- the scale part of the node's transform, as a 3-element array of axis-aligned scale factors.
 - `"children":[...]` (optional; default is `[]`) -- array of references to <em>node</em>s which should be instanced as children of this transformation.
 - `"mesh":<var>i</var>` (optional) -- reference to a *mesh* to instance at this node.
 - `"camera":<var>i</var></code>` (optional) -- reference to a *camera* to instance at this node.

The transformation from the local space of a <em>node</em> to the local space of its parent node is given by applying its scale, rotation, and translation values (in that order):
$$
M_{\textrm_{parent_from_local}} = T * R * S
$$

<p>
<b>Note on instancing:</b>
Scene'72 is DAG-structured, not tree-structured.
This means that not only can <em>mesh</em>es be instanced by referencing them from multiple nodes, so can <em>node</em>s.
This allows you to define cool fractal-y (/<a href="https://en.wikipedia.org/wiki/L-system">L-system</a>-y) geometries!
</p>

<pre><code>...
{
	"type":"MESH",
	"name":"cube",
	"topology":"TRIANGLE_LIST",
	"count":12,
	"indices": { "src":"cube.b72", "offset":576, "format":"UINT32" },
	"attributes":{
		"POSITION":{ "src":"cube.b72", "offset":0,  "stride":24, "format":"R32G32B32_SFLOAT" },
		"NORMAL":  { "src":"cube.b72", "offset":12, "stride":24, "format":"R32G32B32_SFLOAT" },
		"COLOR":   { "src":"cube.b72", "offset":20, "stride":24, "format":"R8G8B8A8_UNORM" },
	}
},
...</code></pre>

<p>
<em>Mesh</em>es define the drawable elements in the scene.
Notice that many <em>node</em>s may reference the same mesh; so it may well be drawn multiple times in the scene with different transformations.
</p>
<p>
<em>Mesh</em> properties:
</p>
<ul>
<li><code>"type":"MESH"</code> (required) -- indicates that this object defines a <em>mesh</em>.</li>
<li><code>"name":"cube"</code> (required) -- name of the <em>mesh</em>.</li>
<li><code>"topology":"..."</code> (required) -- the primitive type and layout used in the mesh.
Valid strings are <a href="https://registry.khronos.org/vulkan/specs/1.3-extensions/man/html/VkPrimitiveTopology.html">VkPrimitiveTopology</a> value names without the prefix (e.g., <code>"TRIANGLE_LIST"</code>).</li>
<li><code>"count":<var>N</var></code> (required) -- the number of vertices in the mesh.</li>
<li><code>"indices":{ ... }</code> (optional) -- if specified, a data stream containing indices for indexed drawing commands.</li>
<li><code>"attributes":{ ... }</code> (required) -- named data streams.</li>
</ul>

<p>
Mesh attributes are defined by named data streams.
Currently, meshes must have data streams named <code>"POSITION"</code>, <code>"NORMAL"</code>, and <code>"COLOR"</code>.
In future revisions of the format we may add more named streams, likely using the same naming convention as <a href="https://registry.khronos.org/glTF/specs/2.0/glTF-2.0.html#meshes-overview">glTF</a>.
https://registry.khronos.org/vulkan/specs/1.3-extensions/html/vkspec.html#drawing-primitive-shading">glTF</a>.
Your code must ignore attribute streams it does not recognize, and should print a warning.
</p>
<p>
Attribute streams must have the following properties:
</p>
<ul>
<li><code>"src":"..."</code> (required) -- file to read data from. Note that the path is specified relative to the ".s72" file!</li>
<li><code>"offset":<var>N</var></code> (required) -- byte offset from the start of the file for the first element of this attribute stream.</li>
<li><code>"stride":<var>S</var></code> (required) -- bytes between the starts of subsequent elements of this attribute stream.</li>
<li><code>"format":"..."</code> (required) -- format of the stored attribute. Valid strings are <a href="https://registry.khronos.org/vulkan/specs/1.3-extensions/man/html/VkFormat.html">VkFormat</a> value names without the prefix, e.g., <code>R32G32B32_SFLOAT</code>.
However, see note below about what formats you actually need to support!</li>
</ul>
<p>
<b>Note about formats:</b>
There are an absurd number of possible <code>VkFormat</code> values.
However, not all of them are guaranteed to be usable in vertex buffers (see the <code>VK_FORMAT_FEATURE_VERTEX_BUFFER_BIT</code> column in <a href="https://registry.khronos.org/vulkan/specs/1.3-extensions/html/vkspec.html#features-required-format-support">these tables</a>).
For A1, you are only required to support <code>"format":"R32G32B32_SFLOAT"</code> and <code>"format":"R8G8B8A8_UNORM"</code> attribute streams.
</p>

<p>
If the mesh contains an <code>indices</code> property, it is an <em>indexed</em> mesh -- its vertex stream should be constructed by reading indices from the specified data stream and using these to access the vertex stream.
Otherwise its vertex stream should be drawn sequentially.
(See <a href="https://registry.khronos.org/vulkan/specs/1.3-extensions/html/vkspec.html#drawing-primitive-shading">Programmable Primitive Shading</a> for the Vulkan specification's lists of indexed and non-indexed drawing commands.)
</p>

<p>
Index data streams are defined similarly to attribute data streams with two differences:
</p>
<ul>
<li><code>"format"</code> must use values from <a href="https://registry.khronos.org/vulkan/specs/1.3-extensions/man/html/VkIndexType.html">VkIndexType</a> without the common prefix (e.g., "UINT32").</li>
<li><code>"stride"</code> must be omitted -- indices are always tightly packed.</li>
</ul>
<p>
Also, for the purposes of this assignment, you need only support <code>"format":"UINT16"</code> and <code>"format":"UINT32"</code> data streams.
</p>

<pre><code>...
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
...</code></pre>

<p>
<em>Camera</em>s define the projection parameters of cameras in the scene.
</p>
<p>
<em>Camera</em> properties:
</p>
<ul>
<li><code>"type":"CAMERA"</code> (required) -- indicates that this object defines a <em>camera</em>.</li>
<li><code>"name":"cube"</code> (required) -- name of the <em>camera</em>.</li>
<li><code>"perspective":{...}</code> (optional) -- defines that the camera uses perspective projection.<br>
	Properties:
	<ul>
	<li><code>"aspect":<var>a</var></code> (required) -- image aspect ratio (width / height).</li>
	<li><code>"vfov":<var>r</var></code> (required) -- vertical field of view in radians.</li>
	<li><code>"near":<var>z</var></code> (required) -- near clipping plane distance.</li>
	<li><code>"far":<var>z</var></code> (optional) -- far clipping plane distance (if omitted, use an infinite perspective matrix).</li>
	</ul>
</li>
</ul>
<p>
We will use the convention of cameras that look down their local -z axis with +y being up and +x being rightward in the image plane.
Be aware that Vulkan uses a different convention for the normalized device coordinate axis directions and (in the case of z) ranges;
so be aware that copying code that builds a projection matrix for OpenGL may not work.
</p>

<p>
<em>Camera</em> objects must define <em>some</em> projection; so even though <code>"perspective"</code> is marked as "optional" above it is de-facto required unless you decide to add (say) <code>"orthographic"</code> cameras.
</p>

<p>
You can decide how to handle rendering from a camera whose specified aspect does not match the window size.
My suggestion is to use the scissor rectangle to letter- or pillar-box the image as needed.
</p>

<p>
<b>Camera instancing note:</b>
While mesh and node instances are very useful, camera instances make naming/selecting cameras annoying.
Your code may ignore any camera which is has more than one path from the scene root (i.e., any camera which would be visited more than once during a scene DAG traversal).
</p>

<pre><code>...
{
	"type":"driver",
	"name":"orbit camera",
	"perspective":{
		"aspect": 1.777,
		"vfov": 1.04719,
		"near": 0.1,
		"far":10.0
	}
},
...</code></pre>


