# Examples

## Basic Scene Graphs
- `sg-Articulation.s72`/`sg-Articulation.*.b72` [open in viewer](https://15-472.github.io/s72/?https://raw.githubusercontent.com/15-472/s72/main/examples/sg-Articulation.s72) (has animation)
- `sg-Support.s72`/`sg-Support.*.b72` [open in viewer](https://15-472.github.io/s72/?https://raw.githubusercontent.com/15-472/s72/main/examples/sg-Support.s72)
- `sg-Grouping.s72`/`sg-Grouping.*.b72` [open in viewer](https://15-472.github.io/s72/?https://raw.githubusercontent.com/15-472/s72/main/examples/sg-Grouping.s72) (has animation)
- `sg-Containment.s72`/`sg-Containment.*.b72` [open in viewer](https://15-472.github.io/s72/?https://raw.githubusercontent.com/15-472/s72/main/examples/sg-Containment.s72)

Exported from [sources/scene-graphs.blend](sources/scene-graphs.blend) by [sources/Makefile](sources/Makefile) using [../exporters/blender/export-s72.py](../exporters/blender/export-s72.py).
Blender file and exported products (c) 2024 Jim McCann; released under a [CC BY-ND 4.0](https://creativecommons.org/licenses/by-nd/4.0/) license.

## Sphereflake
- `sphereflake.s72`/`sphereflake.*.b72` [open in viewer](https://15-472.github.io/s72/?https://raw.githubusercontent.com/15-472/s72/main/examples/sphereflake.s72)

An extreme demonstration of instancing.

Exported from [sources/sphereflake.blend](sources/sphereflake.blend) by [sources/Makefile](sources/Makefile) using [../exporters/blender/export-s72.py](../exporters/blender/export-s72.py).
Blender file and exported products (c) 2024 Jim McCann; released under a [CC BY-ND 4.0](https://creativecommons.org/licenses/by-nd/4.0/) license.

## Rotation
- `rotation.s72`/`rotation.*.b72` [open in viewer](https://15-472.github.io/s72/?https://raw.githubusercontent.com/15-472/s72/main/examples/rotation.s72)

Tests animation of rotations (good for checking `"SLERP"` interpolation mode).

Exported from [sources/rotation.blend](sources/rotation.blend) by [sources/Makefile](sources/Makefile) using [../exporters/blender/export-s72.py](../exporters/blender/export-s72.py).
Blender file and exported products (c) 2024 Jim McCann; released under a [CC BY-ND 4.0](https://creativecommons.org/licenses/by-nd/4.0/) license.

## Environment Cube Test
- `env-cube.s72`/`env-cube.b72`/`env-cube.png` [open in viewer](https://15-472.github.io/s72/?https://raw.githubusercontent.com/15-472/s72/main/examples/env-cube.s72)

A cube with the `"environment"` material and bent normals. Should display environment map stored in [`env-cube.png`](env-cube.png) clearly on its faces.

Created by hand with the help of the [a72-to-b72](sources/a72-to-b72.mjs) utility by Jim McCann. The s72, b72, texture, and all filtered versions of the texture are released into the public domain. Use as you see fit.

## Materials Test
- `materials.s72`/`materials.*.b72`/`ox_bridge_morning*.png`/`wood_floor_deck*.png` [open in viewer](https://15-472.github.io/s72/?https://raw.githubusercontent.com/15-472/s72/main/examples/materials.s72)

A scene showing some simple examples of the various material types.

Created from [sources/materials.blend](sources/materials.blend) by [sources/Makefile](sources/Makefile) using [../exporters/blender/export-s72.py](../exporters/blender/export-s72.py).
Blender file by Jim McCann. Blender file and exported products are released under a [CC0](https://creativecommons.org/publicdomain/zero/1.0/) license.
Uses texture [Wood Floor Deck](https://polyhaven.com/a/wood_floor_deck) by Dimitrios Savva.
Uses HDRI [Ox Bridge Morning](https://polyhaven.com/a/ox_bridge_morning) by Dimitrios Savva and Jarod Guest.


## Lights Tests
- `lights-Mix.s72`/`lights-Mix.*.b72` [open in viewer](https://15-472.github.io/s72/?https://raw.githubusercontent.com/15-472/s72/main/examples/lights-Mix.s72)
- `lights-Parameters.s72`/`lights-Parameters.*.b72` [open in viewer](https://15-472.github.io/s72/?https://raw.githubusercontent.com/15-472/s72/main/examples/lights-Parameters.s72)
- `lights-Spot-Shadows.s72`/`lights-Spot-Shadows.*.b72` [open in viewer](https://15-472.github.io/s72/?https://raw.githubusercontent.com/15-472/s72/main/examples/lights-Spot-Shadows.s72)

An example scene with a mix of different light types, along with a scene with specific light parameter sweeps for sphere and spot lights, and a scene with different shadow resolutions for (animated!) spot lights.

Created from [sources/lights.blend](sources/lights.blend) by [sources/Makefile](sources/Makefile) using [../exporters/blender/export-s72.py](../exporters/blender/export-s72.py).
Blender file and exported products (c) 2024 Jim McCann; released under a [CC BY-ND 4.0](https://creativecommons.org/licenses/by-nd/4.0/) license.


## Origin Check
- `origin-check.s72`/`origin-check.*.b72` [open in viewer](https://15-472.github.io/s72/?https://raw.githubusercontent.com/15-472/s72/main/examples/origin-check.s72)

Created from [sources/origin-check.blend](sources/origin-check.blend) by [sources/Makefile](sources/Makefile) using [../exporters/blender/export-s72.py](../exporters/blender/export-s72.py).
Blender file, texture file, and exported products created in 2024 by Jim McCann; placed in the public domain.


## Color Check
- `color-check.s72`/`color-check.*.b72` [open in viewer](https://15-472.github.io/s72/?https://raw.githubusercontent.com/15-472/s72/main/examples/color-check.s72)

A grid of color chips meant to check color and lighting for lambertian materials. In linear color, should be 1.0, 0.5, 0.1 (rows) and R,G,B,Grey (columns). The lighting is a distant point light with power 3.1415926 (i.e., the 1.0 materials should be exactly full-scale if no tone mapping is applied).

Created from [sources/color-check.blend](sources/color-check.blend) by [sources/Makefile](sources/Makefile) using [../exporters/blender/export-s72.py](../exporters/blender/export-s72.py).
Blender file, texture file, and exported products created in 2026 by Jim McCann; placed in the public domain.
