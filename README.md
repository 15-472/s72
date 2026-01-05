# Scene'72 (`.s72`), a format for animated 3D scenes

Scene'72 is a JSON-based format for storing animated 3D scenes used in the course 15-472/672/772: Real-Time Graphics.
Using JSON comes with some upsides (e.g., human-readability, widespread tool support, and extensibility)
and some downsides (e.g., larger file sizes and slow loading), which we will seek to mitigate by referencing external files for bulk data.

For example files see the [`examples`](examples) subdirectory.

The `.s72` format is somewhat inspired by <a href="https://registry.khronos.org/glTF/specs/2.0/glTF-2.0.html">glTF</a>.

## Conventions

Scene'72 scenes are **z-up**, lengths are **meters**, and times are **seconds**. The texture coordinate origin is in the **lower left** of an image (though cube maps have a different interpretation; see the material section below).

## External Files

Note that scene'72 files may reference binary'72 (or buffer'72 if you'd like) files.
These are raw binary data blobs, and are generally named with a `.b72` extension.
These files have no fixed layout -- the data is accessed with the offsets and formats given by objects in the associated scene'72 file.
(Think of them as "things your code will probably almost immediately put in vertex buffers".)


## File Structure

Scene'72 files are UTF8-encoded <a href="https://json.org">JSON</a>, and are generally named with a <code>.s72</code> extension.

The top-level value of a scene'72 file is always an array, and the first element of the array is always the string `"s72-v2"`.
Code that writes scene'72 files should write the top-level array such that the first nine bytes of a scene'72 file are exactly `["s72-v2"` in order to make it easy for utilities to recognize the file type.

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
- `"name":"..."` gives the object name as a string; object names must be unique within their type.

**Referencing objects:**
When objects reference other objects in the array they do so by name.

### *Scene* Objects
Every scene'72 file contains exactly one *scene* object, which defines global properties of the scene:
```js
/* ... */
{
	"type":"SCENE",
	"name":"Cube Pyramid",
	"roots":["node A","node B"]
},
/* ... */
```

*Scene* objects must have their `type` property set to `"SCENE"`.
They include the following *scene*-specific properties:
- `"roots":[...]` (optional, default is `[]`) -- array of references to *node*s at which to start drawing the scene.

(Note: a scene with empty `"roots"` is permitted but boring; nothing to draw!)

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
	"children":["rug","chair","table","carton"],
	"camera":"main-camera",
	"mesh":"room",
	"environment":"outdoors",
	"light":"lamp1"
},
/* ... */
```
*Node* objects have their `type` property set to `"NODE"`.
They include the following *node*-specific properties:
 - <code>"translation":[<var>tx</var>,<var>ty</var>,<var>tz</var>]</code> (optional; default is `[0,0,0]`) -- the translation part of the node's transform, as a 3-element array of numbers.
 - <code>"rotation":[<var>rx</var>,<var>ry</var>,<var>rz</var>,<var>rw</var>]</code> (optional; default is `[0,0,0,1]`) -- the rotation part of the node's transform, as a unit quaternion (where `rw` is the scalar part of the quaternion).
 - <code>"scale":[<var>sx</var>,<var>sy</var>,<var>sz</var>]</code> (optional; default is `[1,1,1]`) -- the scale part of the node's transform, as a 3-element array of axis-aligned scale factors.
 - `"children":[...]` (optional; default is `[]`) -- array of references to *node*s which should be instanced as children of this transformation.
 - <code>"mesh":<var>name</var></code> (optional) -- reference to a *mesh* to instance at this node.
 - <code>"camera":<var>name</var></code> (optional) -- reference to a *camera* to instance at this node.
 - <code>"environment":<var>name</var></code> (optional) -- reference to an *enviroment* to instance at this node.
 - <code>"light":<var>name</var></code> (optional) -- reference to a *light* to instance at this node.

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
		"POSITION": { "src":"cube.b72", "offset":0,  "stride":48, "format":"R32G32B32_SFLOAT" },
		"NORMAL":   { "src":"cube.b72", "offset":12, "stride":48, "format":"R32G32B32_SFLOAT" },
		"TANGENT":  { "src":"cube.b72", "offset":24, "stride":48, "format":"R32G32B32A32_SFLOAT" },
		"TEXCOORD": { "src":"cube.b72", "offset":40, "stride":48, "format":"R32G32_SFLOAT" },
	},
	"material":"dull-red",
},
/* ... */
```
*Mesh* objects have their `type` property set to `"MESH"`.
They include the following *mesh*-specific properties:
- `"topology":"..."` (required) -- the primitive type and layout used in the mesh.
Valid values are <a href="https://registry.khronos.org/vulkan/specs/1.3-extensions/man/html/VkPrimitiveTopology.html">VkPrimitiveTopology</a> identifiers without the prefix (e.g., `"TRIANGLE_LIST"`).
- <code>"count":<var>N</var></code> (required) -- the number of vertices in the mesh.
- `"indices":{ ... }` (optional) -- if specified, a data stream containing indices for indexed drawing commands.
- `"attributes":{ ... }` (required) -- named data streams containing the mesh attributes.
- <code>"material":<var>name</var></code> (optional) -- reference to a material to use for this mesh. If not specified, the mesh should be drawn with the default material.

**Mesh attributes.**
Mesh *attribute*s are data streams used to define the mesh vertices.
*Attribute* stream names should follow the naming convention used by <a href="https://registry.khronos.org/glTF/specs/2.0/glTF-2.0.html#meshes-overview">glTF</a> (e.g., using `"POSITION"` for the position stream, `"NORMAL"` for vertex normals, `"TEXCOORD"` for texture coordinates, `"TANGENT"` for tangent (xyz) + bitangent sign (w), and so on).
However, stream formats are not restricted by the glTF conventions (and, indeed, `"TEXCOORD"` is suffixed with an index in glTF but not in our example files).

*Attribute*s have the following properties:
- `"src":"..."` (required) -- file to read data from. Note that the path is specified relative to the ".s72" file.
- <code>"offset":<var>N</var></code> (required) -- byte offset from the start of the file for the first element of this attribute stream.
- <code>"stride":<var>S</var></code> (required) -- bytes between the starts of subsequent elements of this attribute stream.</li>
- `"format":"..."` (required) -- format of the stored attribute. Valid strings are <a href="https://registry.khronos.org/vulkan/specs/1.3-extensions/man/html/VkFormat.html">VkFormat</a> identifiers without the prefix, e.g., `R32G32B32_SFLOAT`.

**Note about attribute formats:**
There are an absurd number of possible <code>VkFormat</code> values.
Scene'72 loaders are not required to support any particular formats, and should emit a warning or error upon encountering a format they do not support.
However, a scene'72 loader should support as many formats as possible -- ideally, every format with a check mark in the `VK_FORMAT_FEATURE_VERTEX_BUFFER_BIT` column in the <a href="https://registry.khronos.org/vulkan/specs/1.3-extensions/html/vkspec.html#features-required-format-support">format support tables</a>.
Our example files use the `R32G32_SFLOAT`, `R32G32B32_SFLOAT`, `R32G32B32A32_SFLOAT`, and `R8G8B8A8_UNORM` formats; so these are a good place to start.

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
	"type":"CAMERA",
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
	"node":"camera transform",
	"channel":"translation",
	"times":[0, 1, 2, 3, 4],
	"values":[0,0,0, 0,0,1, 0,1,1, 1,1,1, 0,0,0],
	"interpolation":"LINEAR"
},
/* ... */
```
*Driver* objects have their `type` property set to `"DRIVER"`.
They include the following *driver*-specific properties:
- <code>"node":<var>ref</var></code> (required) -- reference to the node whose property should be animated by this driver.
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

### *Material* Objects
*Material* objects specify how meshes that reference them are shaded:
```js
/* ... */
{
	"type":"MATERIAL",
	"name":"boring blue",
	"normalMap":{ "src":"normal.png" },
	"displacementMap":{ "src":"displacement.png" },
	"pbr":{
		"albedo": [0.5, 0.5, 0.85],
		/* xor */
		"albedo": { "src":"blue.png" },

		"roughness": 0.5,
		/* xor */
		"roughness": { "src":"roughness-map.png" },

		"metalness": 0.0,
		/* xor */
		"metalness": { "src":"metalness-map.png" }
	},
	/* xor */
	"lambertian": {
		"albedo": [0.5, 0.5, 0.85],
		/* xor */
		"albedo": { "src":"blue.png" }
	},
	/* xor */
	"mirror": { /* no parameters */ },
	/* xor */
	"environment": { /* no parameters */ },
},
/* ... */
```
*Material* objects have their `type` property set to `"MATERIAL"`.
They include the following *material*-specific properties:
- <code>"normalMap":<var>T</var></code> (optional) -- reference to a 2D texture to use as a tangent-space normal map. Reconstructed normal is $TBN * (2 * (r,g,b) - 1)$, where $TBN$ is the tangent-space basis. Not specifying should be the same as specifying a constant $(0.5,0.5,1)$ normal map (i.e., all normals point along the $N$ vector of tangent space).
- <code>"displacementMap":<var>T</var></code> (optional) -- reference to a 2D texture to use as a displacement map. (The $r$ channel of the texture stores displacement, with displacement 1 at the surface of the object and displacement 0 apparently below the surface of the object by 0.035 tcus, where one tcu is the distance on the surface corresponding to the width of the texture given the current texture coordinate gradient.) Not specifying should be the same as specifying a constant $1$ displacement map.
- Exactly one of:
  - `"pbr"` -- a physically-based metallic/roughness material,
  - `"lambertian"` -- a lambertian (diffuse) material,
  - `"mirror"` -- a perfect mirror material,
  - or `"environment"` -- a material that copies the environment in the normal direction.

The `"pbr"` material uses a physically-based BRDF defined as per <a href="https://blog.selfshadow.com/publications/s2013-shading-course/karis/s2013_pbs_epic_notes_v2.pdf">Epic Games' SIGGRAPH 2013 Talk</a> (with lambertian diffuse + ggx specular).
The available parameters for the model are:
 - `"albedo"` (optional, default is `[1,1,1]`) -- constant albedo value or albedo map 2D *texture* (if a texture, uses the $(r,g,b)$ channels).
 - `"roughness"` (optional, default is `1.0`) -- constant roughness value or roughness map 2D *texture* (if a texture, uses the $r$ channel).
 - `"metalness"` (optional, default is `0.0`) -- constant metalness value or metalness map 2D *texture* (if a texture, uses the $r$ channel).

The `"lambertian"` material is a basic Lambertian diffuse material, with one parameter:
 - `"albedo"` -- same as in `"pbr"`.

The `"mirror"` material uses a perfect mirror BRDF. It has no parameters.

The `"environment"` material looks up the environment in the direction of the normal. (This is a BRDF with a Dirac delta along $n$.) It has no parameters.

*Note:* the "default material" (the material used for meshes that do not indicate otherwise) is a `"lambertian"` material with albedo `[0.8, 0.8, 0.8]` and no displacement map or normal map. It does not have a name or index and cannot be otherwise referenced.

*Texture*s have the following properties:
 - `"src"` (required) -- location (relative to the `.s72` file) from which to load the texture. ".png" and ".jpg" textures are supported.
 - `"type"` (optional default value is `"2D"`) -- the texture type
   - `"2D"` -- simple 2D texture
   - `"cube"` -- cube map texture, stored as a vertical stack of faces (from top to bottom in the image: $+x$, $-x$, $+y$, $-y$, $+z$, $-z$)
 - `"format":...` (optional, default value is `"linear"`) -- how to map image byte values $c \in [0,255]$ to texture values $c'$ (note that `"format"` has priority over any metadata present in an image file)
   - `"linear"` -- map linearly ( $rgba' \gets rgba / 255$ )
   - `"srgb"` -- map via the <a href="https://registry.khronos.org/DataFormat/specs/1.3/dataformat.1.3.html#TRANSFER_SRGB">SRGB EOTF</a>
   - `"rgbe"` -- use shared-exponent RGBE as per <a href="https://www.radiance-online.org/cgi-bin/viewcvs.cgi/ray/src/common/color.c?revision=2.33&view=markup#l188">radiance</a>'s HDR format. ( $rgb' \gets 2^{a - 128}*\frac{ rgb + 0.5 }{ 256 }$ )

It is an error to reference a texture that does not have a channel required by a referencing material (e.g., to supply a one-channel texture as an albedo; or to supply a texture image without an alpha channel when setting the format to `"rgbe"`).

2D textures should always have their wrap mode set to repeat to allow for tiling.

The sense of the faces of the cube map is as described in both <a href="https://registry.khronos.org/vulkan/specs/1.3/html/chap16.html#_cube_map_face_selection_and_transformations">the Vulkan specification</a> and <a href="https://www.khronos.org/opengl/wiki/Cubemap_Texture">the OpenGL Wiki</a>. Note also that the order of the faces matches the layer number order of the images in the Vulkan specification.

For cube maps used in s72 the texture coordinate origin is in the upper-left corner of each face (this is different to regular textures in s72, which have a lower-left texture coordinate origin).
This means that, for example, the upper-left texel in a cubemap image is at the $+x$, $+y$, $+z$ corner of the cube.

*Note:* If viewing the cube faces standing at the origin and looking in the $+y$ direction in scene'72's by-convention right-handed, $z$-up world, the order of the faces (top-to-bottom in the image) is right ($+x$), left ($-x$), front ($+y$), back ($-y$), top ($+z$), bottom ($-z$).

### *Environment* Objects
*Environment* objects specify light probe images used to illuminate materials:
```js
/* ... */
{
	"type":"ENVIRONMENT",
	"name":"sky",
	"radiance": {"src":"sky.png", "type":"cube", "format":"rgbe"}
},
/* ... */
```
*Environment* objects have their `type` property set to `"ENVIRONMENT"`.

They include the following *environment*-specific properties:
 - <code>"radiance":<var>T</var></code> -- (required) -- cube map texture giving radiance (in watts per steradian per square meter in each spectral band) incoming from the environment.

The lighting from an *Environment* object applies to all objects in the scene.

NOTE: Given an environment cubemap named `cubemap.png`, implementations reading or writing associated cubemaps should use filenames `cubemap.1.png` ... `cubemap.N.png` for pre-convolved GGX specular mipmap levels 1..N (with level 0 as the original image) and `cubemap.lambertian.png` for the pre-convolved lambertian cubemap.

NOTE: It is recommended that s72 files not include non-uniform scales in the transformation of *Environment*s. Implementations may choose to approximate non-uniform scales by a uniform scale with the same volume change. (Given that environments are distant, this effectively just ignores the scale entirely.)

### *Light* Objects
*Light* objects specify light sources used to illuminate (and shadow) the scene:
```js
/* ... */
{
	"type":"LIGHT",
	"name":"yellow-sun",
	"tint":[1.0, 1.0, 0.9],
	"sun":{
		"angle":0.00918,
		"strength":10.0
	},
	/* xor */
	"sphere":{
		"radius":0.1,
		"power":60.0,
		"limit":4.0
	},
	/* xor */
	"spot":{
		"radius":0.5,
		"power":60.0,
		"fov":0.785,
		"blend":0.15,
		"limit":11.0
	},
	"shadow":256
},
/* ... */
```

*Light* objects have their `type` property set to `"LIGHT"`.
They include the following *light*-specific definitions:
- `"tint"` (optional, default is `[1,1,1]`) -- color of the light; multiplied by the energy given in the light definition.
- `"shadow"` (optional, default is `0`) -- if non-zero, gives the resolution of the shadows to use with this light. If zero, disables shadowing from this light. (The meaning of this resolution is implementation-defined, but is intended to mean approximately "the side length of the shadow map.")
- Exactly one light definition:
  - `"sun"` -- a distant, directional light;
  - `"sphere"` -- a spherical area light;
  - or `"spot"` -- a spherical area light with limited emission directions.


A `"sun"` light is a distant directional light pointing along the local $-z$ axis. Properties:
- `"angle"` (required) -- every surface element sees the sun light as coming from a disc of this angular diameter. (`"angle"` is in radians and will be at most $\pi$. )
- `"strength"` (required) -- energy per area emitted by the light, in watts per square meter. (Note: multiply by the `"tint"` of the light to get actual per-primary energy.)

NOTE: *Sun* lights are distant directional lights, so they look the same to all surface patches (that is to say, there is no falloff in intensity).

A `"sphere"` light is a spherical area light. Points on the surface emit light uniformly in all visible directions. Properties:
- `"radius"` (required) -- the radius of the sphere in local scene units.
- `"power"` (required) -- the total power emitted by the light, in watts. (Note: multiply by the `"tint"` of the light to get actual per-primary power.)
- `"limit"` (optional) -- distance at which the light's falloff is driven to zero (see equation below).

A `"spot"` light is a spherical area light which emits light only in a cone around its $-z$ axis. Properties:
- `"radius"` (required) -- the radius of the sphere in local scene units.
- `"power"` (required) -- the total power that would be emitted by the light if it were a `"sphere"` light, in watts. (Note: multiply by the `"tint"` of the light to get actual per-primary power.)
- `"limit"` (optional) -- distance at which the light's falloff is driven to zero (see equation below).
- `"fov"` (required) -- field of view of the light's cone, in radians.
- `"blend"` (required) -- factor controlling smooth falloff at edge of light cone.

A point within $(fov * (1-blend))/2$ radians of a *spot*'s $-z$ axis is fully illuminated by that *spot* (i.e., is illuminated as if by a sphere light with the same parameters).
A point outside $fov/2$ radians of a *spot*'s $-z$ axis is not illuminated by that *spot*.
A point between $(fov * (1-blend))/2$ and $fov/2$ radians of a *spot*'s $-z$ axis is lit with a linear (w.r.t. angle) blend between full and no illumination.

NOTE: *Spot* light power is defined as it is so that changing the `"fov"` and `"blend"` (or, for that matter, changing the type of the light to `"sphere"`) do not change the brightness of areas lit by the light.

NOTE: It is recommended that s72 files not include non-uniform scales in the transformation of lights. Implementations may choose to approximate non-uniform scales by a uniform scale with the same volume change.


#### The `"limit"` Parameter.
Because s72 is aimed at real-time applications, its (non-distant) lights, `"sphere"` and `"spot"`, have a limit parameter that limits their influence.

How to implement this cutoff is a decision for an individual implementation.
One method that produces a smooth transition (inspired by [Real Shading in Unreal Engine 4](https://blog.selfshadow.com/publications/s2013-shading-course/karis/s2013_pbs_epic_notes_v2.pdf)) is to add an additional attenuation factor to the light of $\max(0, 1 - (d / limit)^4 )$, where $d$ is the distance to the center of the light.




