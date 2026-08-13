import bpy
import sys

# Get output path from command line arguments
output_path = sys.argv[-1]

# Ensure all objects are selectable and visible for export
for obj in bpy.context.scene.objects:
    obj.hide_set(False)
    obj.select_set(True)

bpy.context.view_layer.objects.active = bpy.context.scene.objects[0] if len(bpy.context.scene.objects) > 0 else None

# Export to GLB
bpy.ops.export_scene.gltf(
    filepath=output_path,
    export_format='GLB',
    export_materials='EXPORT',
    export_normals=True,
    export_tangents=True
)
print("Exported to " + output_path)
