import bpy
import os
addon_path = 'C:/blender_anatomy/antigravity-blender-mcp/src/blender-addon/mcp_connector_v2.py'
bpy.ops.preferences.addon_install(filepath=addon_path)
bpy.ops.preferences.addon_enable(module='mcp_connector_v2')
bpy.ops.wm.save_userpref()
print('Addon installed and enabled successfully!')
