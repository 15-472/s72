#!/usr/bin/env python

#based on export-scene.py and export-meshes.py from:
# https://github.com/15-466/15-466-f23-base5/tree/main/scenes
#which are, in turn, based on 'export-sprites.py' and 'glsprite.py' from TCHOW Rainbow.
#some reference also made to `export-mat-anim.py` from TCHOW Cubeship.

#Note: script meant to be run from blender 4.2.1, as:
# blender --background --python export-s72.py -- [...see below...]


import sys,re

args = []
for i in range(0,len(sys.argv)):
	if sys.argv[i] == '--':
		args = sys.argv[i+1:]

def usage():
	print("\n\nUsage:\nblender --background --python export-s72.py -- <infile.blend> <outfile.s72> [--collection collection] [--animate <minFrame> <maxFrame>]\nExports objects and transforms in a collection (default: master collection) to a scene'72 (JSON scene) file and associated buffer'72 (raw binary data) files.\n", file=sys.stderr)
	exit(1)

infile = None
s72file = None
collection_name = None
frames = None

i = 0
while i < len(args):
	arg = args[i]
	if arg.startswith('--'):
		if arg == '--collection':
			if i + 1 >= len(args):
				print(f"ERROR: --collection must be followed by a collection name.")
				usage();
			collection_name = args[i+1]
			i += 1
		elif arg == '--animate':
			if i + 2 >= len(args):
				print(f"ERROR: --animate must be followed by a min and max frame number.")
				usage();
			frames = (int(args[i+1]), int(args[i+2]))

			i += 2
		else:
			print(f"ERROR: unrecognized argument '{arg}'.")
			usage()
	elif infile == None:
		infile = arg
	elif s72file == None:
		s72file = arg
	else:
		print(f"ERROR: excess argument '{arg}'.")
		usage()
	i += 1

if infile == None:
	print(f"ERROR: missing input file name.")
	usage()

if s72file == None:
	print(f"ERROR: missing output file name.")
	usage()

if not s72file.endswith(".s72"):
	print("\n\nERROR: output filename ('" + s72file + "') does not end with '.s72'")
	exit(1)

b72base = s72file[0:-4]

print("Will export of objects in ",end="")
if collection_name:
	print("collection '" + collection_name + "'",end="")
else:
	print('master collection',end="")
print(" of '" + infile + "' to '" + s72file + "' (+ '" + b72base + "-*.b72'.")


import bpy
import mathutils
import struct
import math
import json
import os.path

#---------------------------------------------------------------------
#Traverse scene:

bpy.ops.wm.open_mainfile(filepath=infile)

if collection_name:
	if not collection_name in bpy.data.collections:
		print("ERROR: Collection '" + collection_name + "' does not exist in scene.")
		exit(1)
	collection = bpy.data.collections[collection_name]
else:
	collection = bpy.context.scene.collection

#set all collections as not excluded from the view:
def make_included(lc):
	if lc.exclude:
		#print(f"Note, marking scene '{lc.collection.name}' as included.")
		lc.exclude = False
	for child in lc.children:
		make_included(child)

make_included(bpy.context.view_layer.layer_collection)

out = []
out.append('["s72-v2",\n')

obj_to_ref = dict()
mesh_mode_to_attributes = dict()
attributes_mat_to_ref = dict()
camera_to_ref = dict()
material_to_ref = dict()
light_to_ref = dict()

#attempt to take all objects out of edit mode:
for obj in bpy.data.objects:
	if obj.type != "MESH": continue
	obj.select_set(True)
	bpy.context.view_layer.objects.active = obj
	bpy.ops.object.mode_set(mode = 'OBJECT')

#add triangulation modifiers to end of modifier stack for every mesh:
for obj in bpy.data.objects:
	if obj.type != "MESH": continue
	if len(obj.modifiers) == 0 or obj.modifiers[len(obj.modifiers)-1].type != 'TRIANGULATE':
		print(f"Adding 'triangulate' modifier to object {obj.name}.")

		bpy.ops.object.select_all(action='DESELECT')
		obj.select_set(True)
		bpy.context.view_layer.objects.active = obj
		bpy.ops.object.modifier_add(type='TRIANGULATE')
		mod = obj.modifiers[len(obj.modifiers)-1]
		mod.quad_method = 'SHORTEST_DIAGONAL'
		mod.ngon_method = 'BEAUTY'

#suggested by https://stackoverflow.com/questions/70282889/to-mesh-in-blender-3
dg = bpy.context.evaluated_depsgraph_get()

def write_material(mat):
	global out, material_to_ref

	if mat == None: return None

	if mat in material_to_ref: return material_to_ref[mat]

	desc = []
	desc.append('{\n')
	desc.append(f'\t"type":"MATERIAL",\n')
	desc.append(f'\t"name":{json.dumps(mat.name)},\n')
	#TODO: normal map?
	#TODO: displacement map?

	node_tree = mat.node_tree
	def find_linked(to_node, to_socket):
		for link in node_tree.links:
			if link.to_node == to_node and link.to_socket == to_socket:
				return link.from_node
		return None
	
	def texture_path(tex):
		assert tex.type == 'TEX_IMAGE'
		image = tex.image

		if image.filepath == '':
			print(f"Material {mat.name} uses image {image} with no external path.")
			exit(1)

		path = bpy.path.abspath(image.filepath)
		rel_path = os.path.relpath(path, start=os.path.dirname(s72file))
		return rel_path
	
	def do_texture_or_constant(property, node, input, end):
		desc.append(f'\t\t{json.dumps(property)}:')
		if input.is_linked:
			tex = find_linked(node, input)
			assert tex != None
			if tex.type != 'TEX_IMAGE':
				print(f"Material '{mat.name}' does not have an image connected to the '{input.name}' port.")
				exit(1)
			path = texture_path(tex)
			desc.append(f'{{ "src":{json.dumps(path)} }}{end}')
		else:
			val = input.default_value
			if type(val) is float:
				desc.append(f"{val:.6g}{end}")
			else:
				desc.append(f"[ {val[0]:.6g}, {val[1]:.6g}, {val[2]:.6g} ]{end}")

	if mat.name.startswith("pbr:"):
		desc.append('\t"pbr":{\n')
		output = mat.node_tree.get_output_node('ALL')
		bsdf = find_linked(output, output.inputs['Surface'])
		if bsdf == None or bsdf.type != 'BSDF_PRINCIPLED':
			print(f"Material '{mat.name}' claims to be a pbr material but doesn't have a principled bsdf connected to the shader output.")
			exit(1)

		assert bsdf.type == 'BSDF_PRINCIPLED'
		do_texture_or_constant('albedo', bsdf, bsdf.inputs['Base Color'], ',\n')

		do_texture_or_constant('roughness', bsdf, bsdf.inputs['Roughness'], ',\n')
		do_texture_or_constant('metalness', bsdf, bsdf.inputs['Metallic'], '\n')

		desc.append('\t}\n')
	elif mat.name.startswith("lambertian:"):
		desc.append('\t"lambertian":{\n')
		output = mat.node_tree.get_output_node('ALL')
		bsdf = find_linked(output, output.inputs['Surface'])
		if bsdf == None or bsdf.type != 'BSDF_DIFFUSE':
			print(f"Material '{mat.name}' claims to be a lambertian material but doesn't have a diffuse bsdf connected to the shader output.")
			if bsdf: print(f"   has '{bsdf.type}' instead")
			exit(1)

		assert bsdf.type == 'BSDF_DIFFUSE'
		do_texture_or_constant('albedo', bsdf, bsdf.inputs['Color'], '\n')

		desc.append('\t}\n')
	elif mat.name.startswith("mirror:"):
		desc.append('\t"mirror":{}\n')
	elif mat.name.startswith("environment:"):
		desc.append('\t"environment":{}\n')
	else:
		#unrecognized materials treated as simple (and not written):
		print(f"Material '{mat.name}' doesn't start with a recognized prefix; treating as default material.")
		return None
	desc.append('},\n')

	out += desc

	material_to_ref[mat] = mat.name
	return mat.name

def write_attribs(obj, mode):
	global mesh_mode_to_attributes

	assert obj.type == 'MESH'

	if (obj.data, mode) in mesh_mode_to_attributes:
		return mesh_mode_to_attributes[(obj.data, mode)]

	
	bpy.ops.object.select_all(action='DESELECT')
	obj.select_set(True)
	bpy.context.view_layer.objects.active = obj
	bpy.ops.object.mode_set(mode = 'OBJECT')

	#Alternative way to get mesh (vs evaluated_get, below)
	#if len(obj.modifiers):
	#	print(f"{obj.name}: applying modifiers:")
	#	while len(obj.modifiers):
	#		print(f"    {obj.modifiers[0].name}")
	#		bpy.ops.object.modifier_apply(modifier=obj.modifiers[0].name, single_user=True)
	#mesh = obj.data

	mesh = obj.evaluated_get(dg).to_mesh(preserve_all_data_layers=True, depsgraph=dg)

	b72file = f"{b72base}.{obj.data.name}.{mode}.b72"
	rel_b72file = os.path.relpath(b72file, start=os.path.dirname(s72file))

	print(f"Writing mesh '{obj.data.name}' to '{b72file}' (mode '{mode}')...")

	do_texcoord = False
	do_tangent = False
	if mode == 'pnTt':
		do_texcoord = True
		do_tangent = True
	else:
		raise RuntimeError(f"  Invalid mode '{mode}' in write_attribs.")

	#compute normals (respecting face smoothing):
	#NOT supported (or needed?) for 4.1
	if 'calc_normals_split' in dir(mesh): mesh.calc_normals_split()

	#Color export not being used, but if it were brought back it should use color_attributes, as per this code for 15-466-f24-base2:
	#colors = None
	#if len(obj.data.color_attributes) == 0:
	#	print("WARNING: trying to export color data, but object '" + name + "' does not have color data; will output 0xffffffff")
	#else:
	#	colors = obj.data.color_attributes.active_color;
	#	if len(obj.data.color_attributes) != 1:
	#		print("WARNING: object '" + name + "' has multiple vertex color layers; only exporting '" + colors.name + "'")

	#and also use something like this for lookup:
	# col = None
	# if colors != None and colors.domain == 'POINT':
	#	col = colors.data[poly.vertices[i]].color
	#elif colors != None and colors.domain == 'CORNER':
	#	col = colors.data[poly.loop_indices[i]].color
	#else:
	#	col = (1.0, 1.0, 1.0, 1.0)

	if len(mesh.uv_layers) == 0 and (do_texcoord or do_tangent):
		print(f"  WARNING: '{mesh.name}' has no texture uv layer, but tangents and/or texture coordinates were requested. Using (1,0,0) tangents and/or (0,0) texcoords.")
	else:
		if do_tangent:
			try:
				mesh.calc_tangents(uvmap = mesh.uv_layers.active.name)
			except RuntimeError as e:
				print(f"  Failed to compute tangents for {mesh.name}. Reported error:\n{e}\nThis is often because the mesh contains n-gon faces. Remove these by hand or add a modifier like 'triangulate'.")
				exit(1)
		if len(mesh.uv_layers) != 1:
			print(f"  WARNING: multiple uv layers on '{mesh.name}'; using the active one ('{mesh.uv_layers.active.name}') for export.")

	count = 0
	attribs = []
	for tri in mesh.loop_triangles:
		for i in range(0,3):
			loop = mesh.loops[tri.loops[i]]
			assert loop.vertex_index == tri.vertices[i]
			vertex = mesh.vertices[loop.vertex_index]
			normal = loop.normal.x

			attribs.append(struct.pack('fff', vertex.co.x, vertex.co.y, vertex.co.z))
			attribs.append(struct.pack('fff', loop.normal.x, loop.normal.y, loop.normal.z))

			if do_tangent:
				if len(mesh.uv_layers) != 0: tangent = (loop.tangent[0], loop.tangent[1], loop.tangent[2], loop.bitangent_sign)
				else: tangent = (1.0, 0.0, 0.0, 1.0)
				attribs.append(struct.pack('ffff', tangent[0], tangent[1], tangent[2], tangent[3]))
				
			if do_texcoord:
				if len(mesh.uv_layers) != 0: uv = mesh.uv_layers.active.uv[loop.index].vector
				else: uv = (0.0, 0.0)
				attribs.append(struct.pack('ff', uv[0], uv[1]))

			#if len(mesh.vertex_colors) != 0: color = mesh.vertex_colors.active.data[loop.index].color
			#else: color = (1.0, 1.0, 1.0)
			#def c(v):
			#	s = int(v * 255)
			#	if s < 0: return 0
			#	if s > 255: return 255
			#	return s
			#attribs.append(struct.pack('BBBB', c(color[0]), c(color[1]), c(color[2]), 255))

			count += 1

	#dg_obj.to_mesh_clear()

	with open(b72file, 'wb') as f:
		for b in attribs:
			f.write(b)

	class Attributes:
		def __init__(self):
			self.attributes = ""
			self.count = 0

	attributes = []
	attributes.append('{\n')
	stride = 4*3 + 4*3
	if do_tangent: stride += 4*4
	if do_texcoord: stride += 4*2
	#if do_color: stride += 4*1

	offset = 0
	attributes.append(f'\t\t"POSITION":{{ "src":{json.dumps(rel_b72file)}, "offset":{offset}, "stride":{stride}, "format":"R32G32B32_SFLOAT" }}')
	offset += 4*3
	attributes.append(f',\n\t\t"NORMAL":{{ "src":{json.dumps(rel_b72file)}, "offset":{offset}, "stride":{stride}, "format":"R32G32B32_SFLOAT" }}')
	offset += 4*3
	if do_tangent:
		attributes.append(f',\n\t\t"TANGENT":{{ "src":{json.dumps(rel_b72file)}, "offset":{offset}, "stride":{stride}, "format":"R32G32B32A32_SFLOAT" }}')
		offset += 4*4
	if do_texcoord:
		attributes.append(f',\n\t\t"TEXCOORD":{{ "src":{json.dumps(rel_b72file)}, "offset":{offset}, "stride":{stride}, "format":"R32G32_SFLOAT" }}')
		offset += 4*2
	#attributes.append(f',\n\t\t"COLOR":{{ "src":{json.dumps(rel_b72file)}, "offset":{offset}, "stride":{stride}, "format":"R8G8B8A8_UNORM" }}')
	#offset += 4*1

	assert offset == stride

	attributes.append('\n\t}')

	val = Attributes()
	val.attributes = ''.join(attributes)
	val.count = count

	mesh_mode_to_attributes[(obj.data, mode)] = val
	return val

def write_mesh(obj):
	global out, attributes_mat_to_ref

	material_ref = write_material(obj.active_material)

	attributes = write_attribs(obj, 'pnTt')

	if (attributes, material_ref) in attributes_mat_to_ref:
		return attributes_mat_to_ref[(attributes, material_ref)]
	
	attributes_mat_to_ref[(attributes, material_ref)] = obj.data.name

	out.append('{\n')
	out.append(f'\t"type":"MESH",\n')
	out.append(f'\t"name":{json.dumps(obj.data.name)},\n')
	out.append(f'\t"topology":"TRIANGLE_LIST",\n')
	out.append(f'\t"count":{attributes.count},\n')
	out.append(f'\t"attributes":{attributes.attributes}')

	if material_ref == None:
		out.append('\n')
	else:
		out.append(',\n')
		out.append(f'\t"material":{json.dumps(material_ref)}\n')

	out.append('},\n')

	return obj.data.name


def write_light(obj):
	global out, light_to_ref

	light = obj.data
	if light in light_to_ref: return light_to_ref[light]

	print(f"Writing light '{obj.data.name}'...")

	light_to_ref[light] = light.name

	out.append('{\n')
	out.append(f'\n\t"type":"LIGHT"')
	out.append(f',\n\t"name":{json.dumps(obj.data.name)}')
	out.append(f',\n\t"tint":[{light.color.r:.6g}, {light.color.g:.6g}, {light.color.b:.6g}]')

	if light.type == 'POINT':
		out.append(',\n\t"sphere":{')
		out.append(f'\n\t\t"radius":{light.shadow_soft_size:.6g}')
		out.append(f',\n\t\t"power":{light.energy:.6g}')
		if "limit" in light: out.append(f',\n\t\t"limit":{light["limit"]:.6g}')
		out.append('\n\t}')
	elif light.type == 'SPOT':
		out.append(',\n\t"spot":{')
		out.append(f'\n\t\t"radius":{light.shadow_soft_size:.6g}')
		out.append(f',\n\t\t"power":{light.energy:.6g}')
		if "limit" in light: out.append(f',\n\t\t"limit":{light["limit"]:.6g}')
		out.append(f',\n\t\t"fov":{light.spot_size:.6g}')
		out.append(f',\n\t\t"blend":{light.spot_blend:.6g}')
		out.append('\n\t}')
	elif light.type == 'SUN':
		out.append(',\n\t"sun":{')
		out.append(f'\n\t\t"angle":{light.angle:.6g}')
		out.append(f',\n\t\t"strength":{light.energy:.6g}')
		out.append('\n\t}')
	else:
		print(f"WARNING: Unsupported light type {light.type} will result in empty \"LIGHT\" version.")
	
	if "shadow" in light: out.append(f',\n\t"shadow":{light["shadow"]}')
	out.append('\n},\n')

	return obj.data.name



def write_camera(obj):
	global out, camera_to_ref

	camera = obj.data
	if camera in camera_to_ref: return camera_to_ref[camera]

	print(f"Writing camera '{obj.data.name}'...")

	camera_to_ref[camera] = obj.data.name

	out.append('{\n')
	out.append(f'\n\t"type":"CAMERA"')
	out.append(f',\n\t"name":{json.dumps(obj.data.name)}')

	if obj.data.sensor_fit != 'VERTICAL':
		print(f"WARNING: camera FOV for '{obj.data.name}' may not match in exported file because camera is not in vertical-fit mode.")

	if obj.data.type == 'PERSP':
		vfov = 2.0 * math.atan2(0.5*camera.sensor_height, camera.lens)
		#NOTE: could also use the "sensor size" here if wanted to have some capability to make different-aspect cameras; but that isn't what blender does:
		aspect = bpy.context.scene.render.resolution_x / bpy.context.scene.render.resolution_y
		out.append(f',\n\t"perspective":{{\n')
		out.append(f'\t\t"aspect":{aspect:.6g},\n')
		out.append(f'\t\t"vfov":{vfov:.6g},\n')
		out.append(f'\t\t"near":{camera.clip_start:.6g},\n')
		out.append(f'\t\t"far":{camera.clip_end:.6g}\n')
		out.append(f'\t}}')
	#someday: elif obj.data.type == 'ORTHO':
	else:
		print("WARNING: Unsupported camera type '" + obj.data.type + "'!");
	out.append('\n},\n')
	
	return obj.data.name

def write_environment(obj):
	global out
	
	assert obj.name.startswith("!environment:")

	src = obj.name[len("!environment:"):]

	out.append('{\n')
	out.append(f'\t"type":"ENVIRONMENT",\n')
	out.append(f'\t"name":{json.dumps(src)},\n')
	out.append(f'\t"radiance":{{"src":{json.dumps(src)}, "type":"cube", "format":"rgbe"}}\n')
	out.append('},\n')

	return src

def write_node(obj, extra_children=[]):
	global out, obj_to_ref

	if obj in obj_to_ref:
		assert obj_to_ref[obj] != None #no cycles!
		return obj_to_ref[obj]

	obj_to_ref[obj] = None

	mesh = None
	camera = None
	environment = None
	light = None
	children = []

	if obj.name.startswith("!environment:"):
		#special handling for "!environment:" object -- creates an "ENVIRONMENT" object.
		src = obj.name[len("!environment:"):]
		print(f"Note: interpreting object '{obj.name}' as placing an environment from cube '{src}' in the scene; will skip all children, meshes, etc!")
		environment = write_environment(obj)
	else:

		for child in obj.children:
			children.append(write_node(child))

		if obj.type == 'MESH':
			mesh = write_mesh(obj)
		elif obj.type == 'CAMERA':
			camera = write_camera(obj)
		elif obj.type == 'LIGHT':
			light = write_light(obj)
		elif obj.type == 'EMPTY':
			if obj.instance_collection:
				children += write_nodes(obj.instance_collection)
		else:
			print(f"ignoring object data of type '{obj.type}'.")

	obj_to_ref[obj] = obj.name

	if obj.parent == None:
		parent_from_world = mathutils.Matrix()
	else:
		parent_from_world = obj.parent.matrix_world.copy()
		parent_from_world.invert()
	
	(t, r, s) = (parent_from_world @ obj.matrix_world).decompose()


	out.append('{')
	out.append(f'\n\t"type":"NODE"')
	out.append(f',\n\t"name":{json.dumps(obj.name)}')
	out.append(f',\n\t"translation":[{t.x:.6g},{t.y:.6g},{t.z:.6g}]')
	out.append(f',\n\t"rotation":[{r.x:.6g},{r.y:.6g},{r.z:.6g},{r.w:.6g}]')
	out.append(f',\n\t"scale":[{s.x:.6g},{s.y:.6g},{s.z:.6g}]')
	if mesh != None:
		out.append(f',\n\t"mesh":{json.dumps(mesh)}')
	if camera != None:
		out.append(f',\n\t"camera":{json.dumps(camera)}')
	if environment != None:
		out.append(f',\n\t"environment":{json.dumps(environment)}')
	if light != None:
		out.append(f',\n\t"light":{json.dumps(light)}')

	children += extra_children
	if len(children) > 0:
		out.append(f',\n\t"children":{json.dumps(children)}')
	out.append('\n},\n')

	return obj.name

def write_nodes(from_collection):
	roots = []
	for obj in from_collection.objects:
		#has a parent, will be emitted by write_node(parent)
		if obj.parent: continue
		roots.append( write_node(obj) )

	#handle nested collections:
	for child in from_collection.children:
		roots += write_nodes(child)
	
	return roots

#-----------------------------------------------------
# Actually write out the scene:

#if frame range specified, put everything at starting frame:
if frames != None: bpy.context.scene.frame_set(frames[0], subframe=0.0)

#write the scene:
roots = write_nodes(collection)

#handle writing "DRIVER" objects by sampling every frame:
if frames != None:
	node_channels = dict()
	for node, ref in obj_to_ref.items():
		node_channels[node] = ([], [], [])
	
	times = []
	
	for frame in range(frames[0], frames[1]+1):
		bpy.context.scene.frame_set(frame, subframe=0.0)
		time = (frame - frames[0]) / bpy.context.scene.render.fps
		times.append(f'{time:.3f}')
		for node, ref in obj_to_ref.items():
			if node.parent == None:
				parent_from_world = mathutils.Matrix()
			else:
				parent_from_world = node.parent.matrix_world.copy()
				parent_from_world.invert()
	
			(t, r, s) = (parent_from_world @ node.matrix_world).decompose()
			node_channels[node][0].append(t)
			node_channels[node][1].append(r)
			node_channels[node][2].append(s)
	
	times = '[' + ','.join(times) + ']'
	for node, ref in obj_to_ref.items():
		for c in range(0,3):
			driven = False
			if c == 0 or c == 2:
				for v in node_channels[node][c]:
					if (v - node_channels[node][c][0]).length > 0.0001:
						driven = True
			elif c == 1:
				for v in node_channels[node][c]:
					if v.rotation_difference(node_channels[node][c][0]).angle > 0.0001:
						driven = True
			if not driven: continue
			channel = ["translation", "rotation", "scale"][c]
			print(f"Writing \"{channel}\" driver for '{node.name}'.")

			out.append('{\n')
			out.append(f'\t"type":"DRIVER",\n')
			out.append(f'\t"name":{json.dumps(node.name + "-" + channel)},\n')
			out.append(f'\t"node":{json.dumps(ref)},\n')
			out.append(f'\t"channel":{json.dumps(channel)},\n')
			out.append(f'\t"times":{times},\n')
			values = []
			for v in node_channels[node][c]:
				if c == 0 or c == 2:
					assert len(v) == 3
					values.append(f'{v.x:.6g},{v.y:.6g},{v.z:.6g}')
				elif c == 1:
					assert len(v) == 4
					values.append(f'{v.x:.6g},{v.y:.6g},{v.z:.6g},{v.w:.6g}')
				else:
					assert c < 3
			values = '[' + ', '.join(values) + ']'
			out.append(f'\t"values":{values},\n')
			if c == 1:
				out.append(f'\t"interpolation":"SLERP"\n')
			else:
				out.append(f'\t"interpolation":"LINEAR"\n')
			out.append('},\n')




out.append('{\n'
	+ f'\t"type":"SCENE",\n'
	+ f'\t"name":{json.dumps(args[0])},\n'
	+ f'\t"roots":{json.dumps(roots)}\n'
	+ '}\n'
)

out.append(']')

print(f"Writing '{s72file}'.")
with open(s72file, 'wb') as f:
	for s in out:
		f.write(s.encode('utf-8'))
