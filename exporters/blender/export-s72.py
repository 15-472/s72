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

if len(args) != 2:
	print("\n\nUsage:\nblender --background --python export-s72.py -- <infile.blend>[:collection] <outfile.s72>\nExports objects and transforms in a collection (default: master collection) to a scene'72 (JSON scene) file and associated buffer'72 (raw binary data) files.\n")
	exit(1)

infile = args[0]
collection_name = None
m = re.match(r'^(.*?):(.+)$', infile)
if m:
	infile = m.group(1)
	collection_name = m.group(2)
s72file = args[1]

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


roots = write_nodes(collection)
print(f"Roots: {roots}")

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
