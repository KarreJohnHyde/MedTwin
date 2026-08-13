import sys, json

def print_glb_materials(filepath):
    with open(filepath, 'rb') as f:
        magic = f.read(4)
        if magic != b'glTF':
            print("Not a GLB")
            return
        version = int.from_bytes(f.read(4), 'little')
        length = int.from_bytes(f.read(4), 'little')
        
        chunk0_len = int.from_bytes(f.read(4), 'little')
        chunk0_type = f.read(4)
        
        if chunk0_type != b'JSON':
            print("First chunk is not JSON")
            return
            
        json_data = f.read(chunk0_len)
        data = json.loads(json_data.decode('utf-8'))
        
        print(f"--- MATERIALS IN {filepath} ---")
        for mat in data.get('materials', []):
            print(f"  - {mat.get('name', 'unnamed')}")

print_glb_materials(r'c:\blender_anatomy\MedTwin\frontend\assets\Heart.glb')
print_glb_materials(r'c:\blender_anatomy\MedTwin\frontend\assets\Brain.glb')
