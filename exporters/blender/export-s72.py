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
fresh_idx = 1
obj_to_idx = dict()

def write_node(obj, extra_children = []):
	global out
	global fresh_idx
	global obj_to_idx

	assert obj not in obj_to_idx
	idx = fresh_idx
	fresh_idx += 1
	obj_to_idx[obj] = idx

	if len(obj.children):
		print("Children: ", obj.children)

	children = []
	for child in obj.children:
		children.append(write_node(child))


	if obj.parent == None:
		parent_from_world = mathutils.Matrix()
	else:
		parent_from_world = obj.parent.matrix_world.copy()
		parent_from_world.invert()
	
	(t, r, s) = (parent_from_world @ obj.matrix_world).decompose()


	out.append('{\n'
		+ f'\t"type":"NODE",\n'
		+ f'\t"name":{json.dumps(obj.name)}",\n'
		+ f'\t"translation":[{t.x},{t.y},{t.z}],\n'
		+ f'\t"rotation":[{r.x},{r.y},{r.z},{r.w}],\n'
		+ f'\t"scale":[{s.x},{s.y},{s.z}],\n'
		+ f'\t"children":{json.dumps(children + extra_children)},\n'
		+ '}')

	return idx

def write_nodes(from_collection, indent = ''):
	print(f"{indent}{{ '{from_collection.name}':")
	roots = []
	global obj_to_idx
	for obj in from_collection.objects:
		#has a parent, will be emitted by write_node(parent)
		if obj.parent: continue

		#already written (maybe as part of an instance?)
		if obj in obj_to_idx:
			roots.append(obj_to_idx[obj])
			continue

		assert obj not in obj_to_idx

		if obj.type == 'EMPTY' and obj.instance_collection:
			extra_children = write_nodes(obj.instance_collection, indent + '  ')
		else:
			extra_children = []

		idx = write_node(obj, extra_children)
		roots.append(idx)

		if obj.type == 'MESH':
			pass #write_mesh(obj)
		elif obj.type == 'CAMERA':
			pass #write_camera(obj)
		elif obj.type == 'LIGHT':
			pass #write_light(obj)
		elif obj.type == 'EMPTY' and obj.instance_collection:
			pass #handled above already?
		else:
			print('Skipping ' + obj.type)
			pass


	for child in from_collection.children:
		roots += write_nodes(child, indent + '  ')
	
	print(f"{indent}}}")
	return roots


roots = write_nodes(collection)
print(f"Roots: {roots}")
