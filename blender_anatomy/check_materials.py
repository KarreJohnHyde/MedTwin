import bpy

print("--- MATERIALS ---")
for mat in bpy.data.materials:
    print(mat.name)
    if mat.use_nodes:
        for node in mat.node_tree.nodes:
            if node.type == 'TEX_IMAGE':
                img = node.image
                print("  Texture:", img.name if img else "None")
