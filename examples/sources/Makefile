BLENDER=~/blender-4.2.1-linux-x64/blender
EXPORT_PY=../../exporters/blender/export-s72.py
A72_TO_B72_JS=a72-to-b72.mjs
CUBE_UTILITY=../../../A2-ref/bin/cube

all : \
	../lights-Mix.s72 \
	../sg-Articulation.s72 \
	../sg-Support.s72 \
	../sg-Containment.s72 \
	../sg-Grouping.s72 \
	../sphereflake.s72 \
	../rotation.s72 \
	../env-cube.b72 \
	../materials.s72 \
	../ox_bridge_morning.png \


../lights-Mix.s72 : lights.blend $(EXPORT_PY)
	$(BLENDER) --background --python '$(EXPORT_PY)' -- '$<' --collection Mix '$@'

../sg-Articulation.s72 : scene-graphs.blend $(EXPORT_PY)
	$(BLENDER) --background --python '$(EXPORT_PY)' -- '$<' --collection Articulation --animate 1 91 '$@'

../sg-Support.s72 : scene-graphs.blend $(EXPORT_PY)
	$(BLENDER) --background --python '$(EXPORT_PY)' -- '$<' --collection Support '$@'

../sg-Containment.s72 : scene-graphs.blend $(EXPORT_PY)
	$(BLENDER) --background --python '$(EXPORT_PY)' -- '$<' --collection Containment '$@'

../sg-Grouping.s72 : scene-graphs.blend $(EXPORT_PY)
	$(BLENDER) --background --python '$(EXPORT_PY)' -- '$<' --collection Grouping --animate 1 51 '$@'

../sphereflake.s72 : sphereflake.blend $(EXPORT_PY)
	$(BLENDER) --background --python '$(EXPORT_PY)' -- '$<' --collection Base '$@'

../rotation.s72 : rotation.blend $(EXPORT_PY)
	$(BLENDER) --background --python '$(EXPORT_PY)' -- '$<' --animate 0 48 '$@'

../materials.s72 : materials.blend $(EXPORT_PY)
	$(BLENDER) --background --python '$(EXPORT_PY)' -- '$<' '$@'

../ox_bridge_morning.lambertian.png : ../ox_bridge_morning.png $(CUBE_UTILITY)
	$(CUBE_UTILITY) '$<' --lambertian '$@'

../ox_bridge_morning.png : ox_bridge_morning_8k.hdr $(CUBE_UTILITY)
	$(CUBE_UTILITY) '$<' --latlon-to-cube '$@'

ox_bridge_morning_8k.hdr :
	wget 'https://dl.polyhaven.org/file/ph-assets/HDRIs/hdr/8k/ox_bridge_morning_8k.hdr'


../env-cube.b72 : env-cube.a72 $(A72_TO_B72_JS)
	node '$(A72_TO_B72_JS)' '$<' '$@'
