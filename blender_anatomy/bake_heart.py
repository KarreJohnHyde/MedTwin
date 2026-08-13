import bpy
import os
import math

FILE_PATH = r"d:\project\blender_anatomy\source\human_heart_3d_model.glb"
ASSETS_DIR = r"d:\project\blender_anatomy\MedTwin\frontend\assets"
SCALE_FACTOR = 50.0

# 1. SETUP
bpy.ops.object.select_all(action='SELECT')
bpy.ops.object.delete(use_global=False)
bpy.ops.import_scene.gltf(filepath=FILE_PATH)

heart_root = bpy.context.active_object
heart_root.name = "Realistic_Medical_Heart_COLOSSAL"

# 2. GET ALL MESHES
mesh_objs = [obj for obj in bpy.context.scene.objects if obj.type == 'MESH']
if not mesh_objs:
    print("ERROR: No meshes found!")
    import sys
    sys.exit()

for mesh_obj in mesh_objs:
    bpy.context.view_layer.objects.active = mesh_obj
    mesh_obj.select_set(True)
    bpy.ops.object.mode_set(mode='EDIT')
    bpy.ops.mesh.select_all(action='SELECT')
    bpy.ops.mesh.normals_make_consistent(inside=False)
    bpy.ops.object.mode_set(mode='OBJECT')
    mesh_obj.select_set(False)

# 3. APPLY PROCEDURAL MUSCLE SHADER TO ALL MESHES
for mesh_obj in mesh_objs:
    mat = mesh_obj.data.materials[0]
    if not mat.use_nodes:
        mat.use_nodes = True

    mat.blend_method = 'OPAQUE'
    mat.use_backface_culling = False

    nodes = mat.node_tree.nodes
    links = mat.node_tree.links

    principled = next((n for n in nodes if n.type == 'BSDF_PRINCIPLED'), None)
    if principled:
        # Wetness
        if 'Coat Weight' in principled.inputs:
            principled.inputs['Coat Weight'].default_value = 0.35
            principled.inputs['Coat Roughness'].default_value = 0.15
        elif 'Clearcoat' in principled.inputs:
            principled.inputs['Clearcoat'].default_value = 0.35
            principled.inputs['Clearcoat Roughness'].default_value = 0.15

        if 'Roughness' in principled.inputs and not principled.inputs['Roughness'].links:
            principled.inputs['Roughness'].default_value = 0.35

        # Base Color (Muscle)
        geom = nodes.new(type='ShaderNodeNewGeometry')
        fiber_coord = nodes.new('ShaderNodeTexCoord')
        fiber_mapping = nodes.new('ShaderNodeMapping')
        fiber_mapping.inputs['Scale'].default_value = (1.0, 1.0, 15.0)
        fiber_noise = nodes.new('ShaderNodeTexNoise')
        fiber_noise.inputs['Scale'].default_value = 12.0
        fiber_noise.inputs['Detail'].default_value = 15.0
        
        fiber_ramp = nodes.new('ShaderNodeValToRGB')
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
            fac_sock, a_sock, b_sock, out_sock = mix_color.inputs['Factor'], mix_color.inputs['A'], mix_color.inputs['B'], mix_color.outputs['Result']
        except:
            mix_color = nodes.new('ShaderNodeMixRGB')
            fac_sock, a_sock, b_sock, out_sock = mix_color.inputs['Fac'], mix_color.inputs['Color1'], mix_color.inputs['Color2'], mix_color.outputs['Color']

        if hasattr(mix_color.inputs[0], 'default_value'):
            mix_color.inputs[0].default_value = 0.5
            
        existing_color_link = principled.inputs['Base Color'].links
        if existing_color_link:
            links.new(existing_color_link[0].from_socket, a_sock)
        else:
            a_sock.default_value = principled.inputs['Base Color'].default_value

        links.new(fiber_ramp.outputs['Color'], b_sock)
        links.new(geom.outputs['Backfacing'], fac_sock)
        links.new(out_sock, principled.inputs['Base Color'])

        # Bump maps
        outer_bump = nodes.new(type='ShaderNodeBump')
        outer_bump.inputs['Strength'].default_value = 0.15
        micro_noise = nodes.new(type='ShaderNodeTexNoise')
        micro_noise.inputs['Scale'].default_value = 150.0
        links.new(micro_noise.outputs['Fac'], outer_bump.inputs['Height'])
        
        existing_normal_link = principled.inputs['Normal'].links
        if existing_normal_link:
            links.new(existing_normal_link[0].from_socket, outer_bump.inputs['Normal'])

        inner_bump = nodes.new(type='ShaderNodeBump')
        inner_bump.inputs['Strength'].default_value = 0.6
        links.new(fiber_noise.outputs['Fac'], inner_bump.inputs['Height'])

        try:
            mix_normal = nodes.new('ShaderNodeMix')
            mix_normal.data_type = 'VECTOR'
            n_fac_sock, n_a_sock, n_b_sock, n_out_sock = mix_normal.inputs['Factor'], mix_normal.inputs['A'], mix_normal.inputs['B'], mix_normal.outputs['Result']
        except:
            mix_normal = nodes.new('ShaderNodeMixRGB')
            n_fac_sock, n_a_sock, n_b_sock, n_out_sock = mix_normal.inputs['Fac'], mix_normal.inputs['Color1'], mix_normal.inputs['Color2'], mix_normal.outputs['Color']

        links.new(geom.outputs['Backfacing'], n_fac_sock)
        links.new(outer_bump.outputs['Normal'], n_a_sock)
        links.new(inner_bump.outputs['Normal'], n_b_sock)
        links.new(n_out_sock, principled.inputs['Normal'])

print("Procedural shader applied to all meshes.")

# 4. PREPARE FOR BAKING
print("--- BAKING TEXTURES ---")
bpy.context.scene.render.engine = 'CYCLES'
bpy.context.scene.cycles.samples = 16 

bpy.ops.object.select_all(action='DESELECT')

for idx, mesh_obj in enumerate(mesh_objs):
    bpy.context.view_layer.objects.active = mesh_obj
    mesh_obj.select_set(True)

    def bake_map(bake_type, img_name, is_color=True):
        img = bpy.data.images.new(img_name, width=1024, height=1024)
        if not is_color:
            img.colorspace_settings.name = 'Non-Color'
            
        tex_node = mesh_obj.data.materials[0].node_tree.nodes.new('ShaderNodeTexImage')
        tex_node.name = f"Bake_{img_name}"
        tex_node.image = img
        
        mesh_obj.data.materials[0].node_tree.nodes.active = tex_node
        for n in mesh_obj.data.materials[0].node_tree.nodes: n.select = False
        tex_node.select = True
        
        bpy.context.scene.cycles.bake_type = bake_type
        if bake_type == 'DIFFUSE':
            bpy.context.scene.render.bake.use_pass_direct = False
            bpy.context.scene.render.bake.use_pass_indirect = False
            bpy.context.scene.render.bake.use_pass_color = True
            
        print(f"Baking {bake_type} for mesh {idx}...")
        bpy.ops.object.bake(type=bake_type, save_mode='EXTERNAL')
        filepath = os.path.join(ASSETS_DIR, f"{img_name}.png")
        img.save_render(filepath=filepath)
        return img

    diffuse_img = bake_map('DIFFUSE', f'Heart_Diffuse_{idx}', True)
    normal_img = bake_map('NORMAL', f'Heart_Normal_{idx}', False)

    # CREATE SIMPLE MATERIAL WITH BAKED MAPS
    new_mat = bpy.data.materials.new(name=f"Baked_Heart_Mat_{idx}")
    new_mat.use_nodes = True
    new_nodes = new_mat.node_tree.nodes
    new_links = new_mat.node_tree.links
    new_nodes.clear()

    new_principled = new_nodes.new('ShaderNodeBsdfPrincipled')
    new_principled.location = (0, 0)

    out_node = new_nodes.new('ShaderNodeOutputMaterial')
    out_node.location = (300, 0)
    new_links.new(new_principled.outputs['BSDF'], out_node.inputs['Surface'])

    diff_node = new_nodes.new('ShaderNodeTexImage')
    diff_node.image = diffuse_img
    diff_node.location = (-300, 100)
    new_links.new(diff_node.outputs['Color'], new_principled.inputs['Base Color'])

    norm_node = new_nodes.new('ShaderNodeTexImage')
    norm_node.image = normal_img
    norm_node.image.colorspace_settings.name = 'Non-Color'
    norm_node.location = (-600, -200)

    norm_map = new_nodes.new('ShaderNodeNormalMap')
    norm_map.location = (-300, -200)
    new_links.new(norm_node.outputs['Color'], norm_map.inputs['Color'])
    new_links.new(norm_map.outputs['Normal'], new_principled.inputs['Normal'])

    if 'Coat Weight' in new_principled.inputs:
        new_principled.inputs['Coat Weight'].default_value = 0.35
        new_principled.inputs['Coat Roughness'].default_value = 0.15
    elif 'Clearcoat' in new_principled.inputs:
        new_principled.inputs['Clearcoat'].default_value = 0.35
        new_principled.inputs['Clearcoat Roughness'].default_value = 0.15

    mesh_obj.data.materials.clear()
    mesh_obj.data.materials.append(new_mat)
    mesh_obj.select_set(False)

print("Applied baked material to all meshes!")

# 6. HEARTBEAT ANIMATION
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

print("SUCCESS: Animated and baked!")

# 7. EXPORT
bpy.ops.wm.save_as_mainfile(filepath=r"d:\project\blender_anatomy\Heart_anotomy.blend")
bpy.ops.export_scene.gltf(filepath=r"d:\project\blender_anatomy\MedTwin\frontend\assets\Heart.glb", export_format='GLB', export_animations=True)
