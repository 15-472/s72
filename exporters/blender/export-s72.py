#!/usr/bin/env python

#based on export-scene.py and export-meshes.py from:
# https://github.com/15-466/15-466-f23-base5/tree/main/scenes
#which are, in turn, based on 'export-sprites.py' and 'glsprite.py' from TCHOW Rainbow.
#some reference also made to `export-mat-anim.py` from TCHOW Cubeship.

#Note: script meant to be run from blender 4.x, as:
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


out = []
out.append('["s72-v1",\n')

fresh_idx = 1
obj_to_idx = dict()
mesh_to_idx = dict()
camera_to_idx = dict()

#suggested by https://stackoverflow.com/questions/70282889/to-mesh-in-blender-3
dg = bpy.context.evaluated_depsgraph_get()

def write_mesh(obj):
	global out, fresh_idx, mesh_to_idx

	dg_obj = obj.evaluated_get(dg)
	mesh = dg_obj.data

	#this assumes same mesh always used with the same modifier stack.
	if mesh in mesh_to_idx: return mesh_to_idx[mesh]

	b72file = f"{b72base}.{obj.data.name}.b72"
	rel_b72file = os.path.relpath(b72file, start=os.path.dirname(s72file))

	print(f"Writing mesh '{obj.data.name}' to '{b72file}'...")

	idx = fresh_idx
	fresh_idx += 1
	mesh_to_idx[mesh] = idx

	mesh = dg_obj.to_mesh(preserve_all_data_layers=True, depsgraph=dg)

	#compute normals (respecting face smoothing):
	mesh.calc_normals_split()

	colors = None
	if len(mesh.vertex_colors) == 0:
		print(f"No vertex colors on mesh '{mesh.name}', storing 0xffffffff for all vertices.")
	else:
		colors = mesh.vertex_colors.active.data
		if len(mesh.vertex_colors) != 1:
			print(f"WARNING: multiple vertex color layers on '{mesh.name}'; using the active one ('{mesh.vertex_colors.active.name}') in export.")

	count = 0
	attribs = []
	for tri in mesh.loop_triangles:
		for i in range(0,3):
			loop = mesh.loops[tri.loops[i]]
			assert loop.vertex_index == tri.vertices[i]
			vertex = mesh.vertices[loop.vertex_index]
			normal = loop.normal.x
			if colors != None: color = colors[tri.loops[i]]
			else: color = (1.0, 1.0, 1.0)

			attribs.append(struct.pack('fff', vertex.co.x, vertex.co.y, vertex.co.z))
			attribs.append(struct.pack('fff', loop.normal.x, loop.normal.y, loop.normal.z))
			def c(v):
				s = int(v * 255)
				if s < 0: return 0
				if s > 255: return 255
				return s
			attribs.append(struct.pack('BBBB', c(color[0]), c(color[1]), c(color[2]), 255))
			count += 1

	dg_obj.to_mesh_clear()

	with open(b72file, 'wb') as f:
		for b in attribs:
			f.write(b)

	out.append('{\n')
	out.append(f'\t"type":"MESH",\n')
	out.append(f'\t"name":{json.dumps(obj.data.name)},\n')
	out.append(f'\t"topology":"TRIANGLE_LIST",\n')
	out.append(f'\t"count":{count},\n')
	out.append(f'\t"attributes":{{\n')
	out.append(f'\t\t"POSITION":{{ "src":{json.dumps(rel_b72file)}, "offset":0, "stride":28, "format":"R32G32B32_SFLOAT" }},\n')
	out.append(f'\t\t"NORMAL":{{ "src":{json.dumps(rel_b72file)}, "offset":12, "stride":28, "format":"R32G32B32_SFLOAT" }},\n')
	out.append(f'\t\t"COLOR":{{ "src":{json.dumps(rel_b72file)}, "offset":24, "stride":28, "format":"R8G8B8A8_UNORM" }}\n')
	out.append(f'\t}}\n')
	out.append('},\n')

	return idx



def write_camera(obj):
	global out, fresh_idx, camera_to_idx

	camera = obj.data
	if camera in camera_to_idx: return camera_to_idx[camera]

	print(f"Writing camera '{obj.data.name}'...")

	idx = fresh_idx
	fresh_idx += 1
	camera_to_idx[camera] = idx

	out.append('{')
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
	
	return idx



def write_node(obj, extra_children=[]):
	global out, fresh_idx, obj_to_idx

	if obj in obj_to_idx:
		assert obj_to_idx[obj] != None #no cycles!
		return obj_to_idx[obj]

	obj_to_idx[obj] = None

	children = []
	for child in obj.children:
		children.append(write_node(child))

	mesh = None
	camera = None
	if obj.type == 'MESH':
		mesh = write_mesh(obj)
	elif obj.type == 'CAMERA':
		camera = write_camera(obj)
	elif obj.type == 'LIGHT':
		pass #TODO
	elif obj.type == 'EMPTY' and obj.instance_collection:
		children += write_nodes(obj.instance_collection)
	else:
		print(f"ignoring object data of type '{obj.type}'.")


	idx = fresh_idx
	fresh_idx += 1
	obj_to_idx[obj] = idx

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
		out.append(f',\n\t"mesh":{mesh}')
	if camera != None:
		out.append(f',\n\t"camera":{camera}')

	children += extra_children
	if len(children) > 0:
		out.append(f',\n\t"children":{json.dumps(children + extra_children)}')
	out.append('\n},\n')

	return idx

def write_nodes(from_collection):
	roots = []
	global obj_to_idx
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
	for node, idx in obj_to_idx.items():
		node_channels[node] = ([], [], [])
	
	times = []
	
	for frame in range(frames[0], frames[1]+1):
		bpy.context.scene.frame_set(frame, subframe=0.0)
		time = (frame - frames[0]) / bpy.context.scene.render.fps
		times.append(f'{time:.3f}')
		for node, idx in obj_to_idx.items():
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
	for node, idx in obj_to_idx.items():
		for c in range(0,2):
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
			out.append(f'\t"node":{idx},\n')
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
