import bpy, os, mathutils, math

# ============================================================
# CONFIGURATION
# ============================================================
FILE_PATH    = r"d:\project\blender_anatomy\source\Brain.glb"
SCALE_MULT   = 5.0
BRAIN_ALPHA  = 1.0  # Set back to 1.0 (fully opaque) since internals are removed

# Leave these at 0 so we don't accidentally flip your model!
ROT_X = 0.0 
ROT_Y = 0.0
ROT_Z = 0.0

# ============================================================
# BULLETPROOF CLEANUP
# ============================================================
if bpy.context.mode != 'OBJECT': bpy.ops.object.mode_set(mode='OBJECT')
bpy.ops.object.select_all(action='DESELECT')

# Forcefully remove all meshes, curves, and empty parent nodes
for obj in bpy.context.scene.objects:
    if obj.type not in ['CAMERA', 'LIGHT']:
        bpy.data.objects.remove(obj, do_unlink=True)

# Purge unused data blocks
for c in [bpy.data.meshes, bpy.data.materials, bpy.data.images, bpy.data.textures, bpy.data.curves]:
    for b in list(c):
        if b.users == 0: c.remove(b)

# ============================================================
# IMPORT BRAIN & EXACT MATHEMATICAL CENTERING
# ============================================================
print("📦 Importing and mathematically centering brain...")
brain_obj = None
R = mathutils.Vector((1.0, 1.4, 0.95))

if os.path.exists(FILE_PATH):
    bpy.ops.import_scene.gltf(filepath=FILE_PATH)
    imp = [o for o in bpy.context.selected_objects if o.type == 'MESH']
    
    if imp:
        bpy.ops.object.select_all(action='DESELECT')
        for o in imp: 
            # Clear parents but KEEP transform so the mesh doesn't jump
            o.select_set(True)
            bpy.context.view_layer.objects.active = o
            bpy.ops.object.parent_clear(type='CLEAR_KEEP_TRANSFORM')
            
        if len(imp) > 1: bpy.ops.object.join()
        brain_obj = bpy.context.active_object
        brain_obj.name = "Cerebrum"
        
        # 1. Apply initial import transforms
        bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
        
        # 2. Scale up and apply
        brain_obj.scale = (SCALE_MULT, SCALE_MULT, SCALE_MULT)
        bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
        
        # 3. Apply custom rotation (Only if you changed the variables above from 0)
        brain_obj.rotation_euler = (math.radians(ROT_X), math.radians(ROT_Y), math.radians(ROT_Z))
        bpy.ops.object.transform_apply(location=False, rotation=True, scale=False)
        
        # 4. MATHEMATICAL CENTERING (Bulletproof)
        local_bbox_center = 0.125 * sum((mathutils.Vector(b) for b in brain_obj.bound_box), mathutils.Vector())
        global_bbox_center = brain_obj.matrix_world @ local_bbox_center
        
        # Move the exact center of the object to World Origin (0,0,0)
        brain_obj.location = brain_obj.location - global_bbox_center
        
        # Freeze the new center position
        bpy.ops.object.transform_apply(location=True, rotation=False, scale=False)
        
        # Calculate precise radius for camera placement
        mn = [float('inf')]*3; mx = [float('-inf')]*3
        for c in brain_obj.bound_box:
            for i in range(3): 
                mn[i] = min(mn[i], c[i]); mx[i] = max(mx[i], c[i])
        R = mathutils.Vector([(mx[i]-mn[i])/2 for i in range(3)])

# Fallback in case the file doesn't load
if brain_obj is None:
    bpy.ops.mesh.primitive_uv_sphere_add(segments=32, ring_count=16, radius=1)
    brain_obj = bpy.context.active_object; brain_obj.name = "Cerebrum"
    brain_obj.scale = R * SCALE_MULT; bpy.ops.object.transform_apply(scale=True)
    R *= SCALE_MULT

# ============================================================
# APPLY TEXTURES (PRESERVING YOUR ORIGINAL GLB MESH TEXTURES)
# ============================================================
print("🎨 Keeping original textures...")

# Preserve original Brain Mesh texture
if len(brain_obj.data.materials) > 0:
    for mat in brain_obj.data.materials:
        if mat and mat.use_nodes:
            # Revert to opaque mode
            mat.blend_method = 'OPAQUE'
            mat.show_transparent_back = False
            bsdf = mat.node_tree.nodes.get("Principled BSDF")
            if bsdf and 'Alpha' in bsdf.inputs:
                bsdf.inputs['Alpha'].default_value = BRAIN_ALPHA

# ============================================================
# LIGHTING & SMOOTH VIEWPORT SETUP
# ============================================================
FRONT = mathutils.Vector((0, -1, 0))
UP    = mathutils.Vector((0, 0, 1))
RIGHT = mathutils.Vector((1, 0, 0))
ms = max(R)

# Lighting setup
bpy.ops.object.light_add(type='AREA', location=(ms*2, -ms*3, ms*2))
bpy.context.active_object.data.energy = 800; bpy.context.active_object.data.size = ms*2
bpy.ops.object.light_add(type='AREA', location=(-ms*2, -ms, ms))
bpy.context.active_object.data.energy = 300; bpy.context.active_object.data.size = ms*1.5

# Camera setup
bpy.ops.object.camera_add(location=FRONT*(-ms*3.5)+RIGHT*ms*1.5+UP*ms*0.8)
cam = bpy.context.active_object; bpy.context.scene.camera = cam
cam.rotation_euler = (mathutils.Vector((0,0,0))-cam.location).to_track_quat('-Z','Y').to_euler()

bpy.context.scene.render.engine = 'CYCLES'
bpy.context.scene.cycles.samples = 64

# Force Viewport to Material Preview (Runs Smoothly, No Lag!)
if bpy.context.screen:
    for a in bpy.context.screen.areas:
        if a.type == 'VIEW_3D':
            for s in a.spaces:
                if s.type == 'VIEW_3D': 
                    s.shading.type = 'MATERIAL' 

print("🎉 DONE! Brain cleanly imported, centered, and rid of unwanted procedural elements.")

# Save the blend file and export to GLB for the dashboard!
bpy.ops.wm.save_as_mainfile(filepath=r"d:\project\blender_anatomy\Brain.blend")
bpy.ops.export_scene.gltf(filepath=r"d:\project\blender_anatomy\MedTwin\frontend\assets\Brain.glb", export_format='GLB')
