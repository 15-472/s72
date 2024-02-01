BLENDER=~/blender-4.0.2-linux-x64/blender
EXPORT_PY=../../exporters/blender/export-s72.py

../sg-Articulation.s72 : scene-graphs.blend $(EXPORT_PY)
	$(BLENDER) --background --python '$(EXPORT_PY)' -- '$<' --collection Articulation --animate 1 91 '$@'
