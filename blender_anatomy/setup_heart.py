import bpy
import os

# ====================================================================
# 1. SETUP
# ====================================================================
FILE_PATH = r"d:\project\blender_anatomy\source\human_heart_3d_model.glb"
SCALE_FACTOR = 50.0

bpy.ops.object.select_all(action='SELECT')
bpy.ops.object.delete(use_global=False)

if not os.path.exists(FILE_PATH):
    print(f"ERROR: Cannot find the file at: {FILE_PATH}")
else:
    bpy.ops.import_scene.gltf(filepath=FILE_PATH)

    heart_root = bpy.context.active_object
    heart_root.name = "Realistic_Medical_Heart_COLOSSAL"

    # ====================================================================
    # 2. GEOMETRY CLEANUP
    # ====================================================================
    bpy.ops.object.select_all(action='DESELECT')
    for obj in bpy.context.scene.objects:
        if obj.type == 'MESH':
            bpy.context.view_layer.objects.active = obj
            obj.select_set(True)
            bpy.ops.object.mode_set(mode='EDIT')
            bpy.ops.mesh.select_all(action='SELECT')
            bpy.ops.mesh.normals_make_consistent(inside=False)
            bpy.ops.object.mode_set(mode='OBJECT')
            obj.select_set(False)

    # ====================================================================
    # 3. DIAGNOSTIC: print every material name so you can see what the
    #    GLB actually calls things. Check the Blender System Console after
    #    running this once — this tells you which keywords to route on.
    # ====================================================================
    print("\n--- MATERIALS FOUND IN THIS MODEL ---")
    all_mat_names = set()
    for obj in bpy.context.scene.objects:
        if obj.type == 'MESH' and obj.data.materials:
            for mat in obj.data.materials:
                if mat:
                    all_mat_names.add(mat.name)
    for name in sorted(all_mat_names):
        print(f"  - {name}")
    print("--------------------------------------\n")

    # ====================================================================
    # 4. SMART-TARGETING TEXTURE ENHANCEMENT
    # ====================================================================
    for obj in bpy.context.scene.objects:
        if obj.type == 'MESH' and obj.data.materials:
            for mat in obj.data.materials:
                if not mat or not mat.use_nodes:
                    continue

                if hasattr(mat, 'blend_method'):
                    mat.blend_method = 'OPAQUE'
                if hasattr(mat, 'shadow_method'):
                    mat.shadow_method = 'OPAQUE'
                mat.use_backface_culling = False

                nodes = mat.node_tree.nodes
                links = mat.node_tree.links

                principled = next((n for n in nodes if n.type == 'BSDF_PRINCIPLED'), None)
                if not principled:
                    continue

                # --- Mild global wetness (toned down from 1.0 -> 0.35) ---
                if 'Coat Weight' in principled.inputs:
                    principled.inputs['Coat Weight'].default_value = 0.35
                    principled.inputs['Coat Roughness'].default_value = 0.15
                elif 'Clearcoat' in principled.inputs:
                    principled.inputs['Clearcoat'].default_value = 0.35
                    principled.inputs['Clearcoat Roughness'].default_value = 0.15

                if 'Roughness' in principled.inputs and not principled.inputs['Roughness'].links:
                    principled.inputs['Roughness'].default_value = 0.35

                mat_name = mat.name.lower()

                # --- A. VALVES (tough, pale, fibrous connective tissue) ---
                if "valve" in mat_name:
                    principled.inputs['Base Color'].default_value = (0.85, 0.8, 0.75, 1.0)

                    valve_bump = nodes.new(type='ShaderNodeBump')
                    valve_bump.inputs['Strength'].default_value = 0.4
                    valve_bump.location = (principled.location.x - 300, principled.location.y - 200)

                    valve_noise = nodes.new(type='ShaderNodeTexNoise')
                    valve_noise.inputs['Scale'].default_value = 250.0
                    valve_noise.inputs['Detail'].default_value = 15.0
                    valve_noise.location = (valve_bump.location.x - 200, valve_bump.location.y)

                    links.new(valve_noise.outputs['Fac'], valve_bump.inputs['Height'])
                    links.new(valve_bump.outputs['Normal'], principled.inputs['Normal'])

                # --- B. ELECTRICAL / CONDUCTION SYSTEM ---
                elif "node" in mat_name or "nerve" in mat_name:
                    principled.inputs['Base Color'].default_value = (0.9, 0.8, 0.1, 1.0)
                    if 'Emission Color' in principled.inputs:
                        principled.inputs['Emission Color'].default_value = (0.8, 0.7, 0.1, 1.0)
                        if 'Emission Strength' in principled.inputs:
                            principled.inputs['Emission Strength'].default_value = 1.0

                # --- C. GREAT VESSELS (aorta, pulmonary artery/vein, vena cava) ---
                elif any(k in mat_name for k in
                         ["aort", "pulmon", "vessel", "artery", "vein", "cava", "vena"]):
                    is_vein = any(k in mat_name for k in ["vein", "cava", "vena", "pulmon_vein"])
                    if is_vein:
                        principled.inputs['Base Color'].default_value = (0.55, 0.35, 0.5, 1.0)  # bluish-purple
                    else:
                        principled.inputs['Base Color'].default_value = (0.75, 0.4, 0.4, 1.0)   # pinkish-red

                    if 'Roughness' in principled.inputs:
                        principled.inputs['Roughness'].default_value = 0.25
                    if 'Coat Weight' in principled.inputs:
                        principled.inputs['Coat Weight'].default_value = 0.5
                    elif 'Clearcoat' in principled.inputs:
                        principled.inputs['Clearcoat'].default_value = 0.5
                    # Smooth vessel wall - light noise bump only, no fiber overlay
                    vessel_noise = nodes.new(type='ShaderNodeTexNoise')
                    vessel_noise.inputs['Scale'].default_value = 40.0
                    vessel_bump = nodes.new(type='ShaderNodeBump')
                    vessel_bump.inputs['Strength'].default_value = 0.15
                    vessel_bump.location = (principled.location.x - 300, principled.location.y - 200)
                    vessel_noise.location = (vessel_bump.location.x - 200, vessel_bump.location.y)
                    links.new(vessel_noise.outputs['Fac'], vessel_bump.inputs['Height'])
                    links.new(vessel_bump.outputs['Normal'], principled.inputs['Normal'])

                # --- D. MAIN MUSCLE (myocardium) — deep red, fleshy, striated ---
                elif any(k in mat_name for k in ["muscle", "myocard", "heart", "ventric", "atri"]):
                    if 'Subsurface Weight' in principled.inputs:
                        principled.inputs['Subsurface Weight'].default_value = 0.35
                        principled.inputs['Subsurface Radius'].default_value = (1.0, 0.2, 0.1)
                    elif 'Subsurface' in principled.inputs:
                        principled.inputs['Subsurface'].default_value = 0.2
                        principled.inputs['Subsurface Radius'].default_value = (1.0, 0.2, 0.1)

                    geom = nodes.new(type='ShaderNodeNewGeometry')
                    geom.location = (principled.location.x - 800, principled.location.y + 400)

                    fiber_coord = nodes.new('ShaderNodeTexCoord')
                    fiber_coord.location = (geom.location.x - 600, geom.location.y)

                    fiber_mapping = nodes.new('ShaderNodeMapping')
                    fiber_mapping.location = (geom.location.x - 400, geom.location.y)
                    fiber_mapping.inputs['Scale'].default_value = (1.0, 1.0, 15.0)

                    fiber_noise = nodes.new('ShaderNodeTexNoise')
                    fiber_noise.location = (geom.location.x - 200, geom.location.y)
                    fiber_noise.inputs['Scale'].default_value = 12.0
                    fiber_noise.inputs['Detail'].default_value = 15.0

                    fiber_ramp = nodes.new('ShaderNodeValToRGB')
                    fiber_ramp.location = (geom.location.x, geom.location.y)
                    fiber_ramp.color_ramp.elements[0].position = 0.2
                    fiber_ramp.color_ramp.elements[0].color = (0.35, 0.05, 0.08, 1.0)
                    fiber_ramp.color_ramp.elements.new(0.5)
                    fiber_ramp.color_ramp.elements[1].color = (0.55, 0.12, 0.15, 1.0)
                    fiber_ramp.color_ramp.elements.new(0.8)
                    fiber_ramp.color_ramp.elements[2].color = (0.4, 0.05, 0.1, 1.0)

                    links.new(fiber_coord.outputs['Object'], fiber_mapping.inputs['Vector'])
                    links.new(fiber_mapping.outputs['Vector'], fiber_noise.inputs['Vector'])
                    links.new(fiber_noise.outputs['Fac'], fiber_ramp.inputs['Fac'])

                    try:
                        mix_color = nodes.new('ShaderNodeMix')
                        mix_color.data_type = 'RGBA'
                        fac_sock, a_sock, b_sock, out_sock = (
                            mix_color.inputs['Factor'], mix_color.inputs['A'],
                            mix_color.inputs['B'], mix_color.outputs['Result']
                        )
                    except Exception:
                        mix_color = nodes.new('ShaderNodeMixRGB')
                        fac_sock, a_sock, b_sock, out_sock = (
                            mix_color.inputs['Fac'], mix_color.inputs['Color1'],
                            mix_color.inputs['Color2'], mix_color.outputs['Color']
                        )

                    mix_color.location = (principled.location.x - 200, principled.location.y + 200)
                    mix_color.inputs[0].default_value = 0.5 if hasattr(mix_color.inputs[0], 'default_value') else None

                    existing_color_link = principled.inputs['Base Color'].links
                    if existing_color_link:
                        links.new(existing_color_link[0].from_socket, a_sock)
                    else:
                        a_sock.default_value = principled.inputs['Base Color'].default_value

                    links.new(fiber_ramp.outputs['Color'], b_sock)
                    links.new(geom.outputs['Backfacing'], fac_sock)
                    links.new(out_sock, principled.inputs['Base Color'])

                    outer_bump = nodes.new(type='ShaderNodeBump')
                    outer_bump.inputs['Strength'].default_value = 0.15
                    outer_bump.location = (principled.location.x - 400, principled.location.y - 300)

                    micro_noise = nodes.new(type='ShaderNodeTexNoise')
                    micro_noise.inputs['Scale'].default_value = 150.0
                    micro_noise.location = (outer_bump.location.x - 200, outer_bump.location.y)
                    links.new(micro_noise.outputs['Fac'], outer_bump.inputs['Height'])

                    existing_normal_link = principled.inputs['Normal'].links
                    if existing_normal_link:
                        links.new(existing_normal_link[0].from_socket, outer_bump.inputs['Normal'])

                    inner_bump = nodes.new(type='ShaderNodeBump')
                    inner_bump.inputs['Strength'].default_value = 0.6
                    inner_bump.location = (principled.location.x - 400, principled.location.y - 500)
                    links.new(fiber_noise.outputs['Fac'], inner_bump.inputs['Height'])

                    try:
                        mix_normal = nodes.new('ShaderNodeMix')
                        mix_normal.data_type = 'VECTOR'
                        n_fac_sock, n_a_sock, n_b_sock, n_out_sock = (
                            mix_normal.inputs['Factor'], mix_normal.inputs['A'],
                            mix_normal.inputs['B'], mix_normal.outputs['Result']
                        )
                    except Exception:
                        mix_normal = nodes.new('ShaderNodeMixRGB')
                        n_fac_sock, n_a_sock, n_b_sock, n_out_sock = (
                            mix_normal.inputs['Fac'], mix_normal.inputs['Color1'],
                            mix_normal.inputs['Color2'], mix_normal.outputs['Color']
                        )

                    mix_normal.location = (principled.location.x - 150, principled.location.y - 300)

                    links.new(geom.outputs['Backfacing'], n_fac_sock)
                    links.new(outer_bump.outputs['Normal'], n_a_sock)
                    links.new(inner_bump.outputs['Normal'], n_b_sock)
                    links.new(n_out_sock, principled.inputs['Normal'])

                else:
                    print(f"[unclassified material, left as-is]: {mat.name}")

    # ====================================================================
    # 5. HEARTBEAT ANIMATION
    # ====================================================================
    bpy.context.scene.frame_set(1)

    heart_root.scale = (SCALE_FACTOR, SCALE_FACTOR, SCALE_FACTOR)
    heart_root.keyframe_insert(data_path="scale", frame=1)
    heart_root.scale = (SCALE_FACTOR * 0.88, SCALE_FACTOR * 0.88, SCALE_FACTOR * 1.04)
    heart_root.keyframe_insert(data_path="scale", frame=5)
    heart_root.scale = (SCALE_FACTOR * 1.02, SCALE_FACTOR * 1.02, SCALE_FACTOR * 0.98)
    heart_root.keyframe_insert(data_path="scale", frame=8)
    heart_root.scale = (SCALE_FACTOR * 0.97, SCALE_FACTOR * 0.97, SCALE_FACTOR * 1.01)
    heart_root.keyframe_insert(data_path="scale", frame=12)
    heart_root.scale = (SCALE_FACTOR, SCALE_FACTOR, SCALE_FACTOR)
    heart_root.keyframe_insert(data_path="scale", frame=16)
    heart_root.scale = (SCALE_FACTOR, SCALE_FACTOR, SCALE_FACTOR)
    heart_root.keyframe_insert(data_path="scale", frame=32)

    if heart_root.animation_data and heart_root.animation_data.action:
        action = heart_root.animation_data.action
        curves = action.fcurves if hasattr(action, 'fcurves') else \
            action.layers[0].strips[0].channelbag(heart_root.animation_data.action_slot).fcurves
        for fcurve in curves:
            modifier = fcurve.modifiers.new(type='CYCLES')
            modifier.mode_before = 'REPEAT_OFFSET'
            modifier.mode_after = 'REPEAT_OFFSET'

    bpy.context.scene.frame_start = 1
    bpy.context.scene.frame_end = 32

    # ====================================================================
    # 6. AUTO-SWITCH VIEWPORT
    # ====================================================================
    for area in bpy.context.screen.areas:
        if area.type == 'VIEW_3D':
            for space in area.spaces:
                if space.type == 'VIEW_3D':
                    space.clip_end = max(space.clip_end, SCALE_FACTOR * 100)
                    space.shading.type = 'MATERIAL'

    print("SUCCESS: Colossal heart loaded, correctly-routed materials applied, animated!")

# Save the blend file and export to GLB for the dashboard!
bpy.ops.wm.save_as_mainfile(filepath=r"d:\project\blender_anatomy\Heart_anotomy.blend")
bpy.ops.export_scene.gltf(filepath=r"d:\project\blender_anatomy\MedTwin\frontend\assets\Heart.glb", export_format='GLB', export_animations=True)
