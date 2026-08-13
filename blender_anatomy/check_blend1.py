import bpy

bpy.ops.wm.open_mainfile(filepath=r"C:\blender_anatomy\Heart_anotomy.blend1")

print("--- MATERIALS IN ORIGINAL BLEND FILE ---")
for mat in bpy.data.materials:
    print(mat.name)
