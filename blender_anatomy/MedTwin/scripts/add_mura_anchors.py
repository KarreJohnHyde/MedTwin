import os
import json
import struct

def patch_glb(file_path):
    with open(file_path, "rb") as f:
        magic = f.read(4)
        if magic != b'glTF':
            raise Exception("Not a GLB file")
        
        version = struct.unpack('<I', f.read(4))[0]
        length = struct.unpack('<I', f.read(4))[0]
        
        json_chunk_len = struct.unpack('<I', f.read(4))[0]
        json_chunk_type = f.read(4)
        if json_chunk_type != b'JSON':
            raise Exception("Expected JSON chunk")
            
        json_data = f.read(json_chunk_len)
        
        # Read the rest (which could be the BIN chunk)
        rest = f.read()

    gltf = json.loads(json_data.decode("utf-8"))
    
    mura_categories = [
        "XR_WRIST", "XR_ELBOW", "XR_FINGER", 
        "XR_FOREARM", "XR_HAND", "XR_HUMERUS", "XR_SHOULDER"
    ]
    
    if "nodes" not in gltf:
        gltf["nodes"] = []
        
    start_index = len(gltf["nodes"])
    new_nodes_indices = []
    
    # Adding arbitrary offsets so they are not all at the origin
    # e.g., mapping them roughly around the skeleton bounds 
    # Just generic translations for testing as discussed.
    offsets = [
        [0.2, 1.0, 0],   # WRIST
        [0.2, 1.2, 0],   # ELBOW
        [0.2, 0.9, 0],   # FINGER
        [0.2, 1.1, 0],   # FOREARM
        [0.2, 0.95, 0],  # HAND
        [0.2, 1.4, 0],   # HUMERUS
        [0.2, 1.5, 0],   # SHOULDER
    ]
    
    for i, cat in enumerate(mura_categories):
        node = {
            "name": cat,
            "translation": offsets[i]
        }
        gltf["nodes"].append(node)
        new_nodes_indices.append(start_index + i)
        
    # Append to default scene
    scene_idx = gltf.get("scene", 0)
    if "scenes" in gltf and len(gltf["scenes"]) > scene_idx:
        scene = gltf["scenes"][scene_idx]
        if "nodes" not in scene:
            scene["nodes"] = []
        scene["nodes"].extend(new_nodes_indices)
        
    # Serialize JSON
    new_json_data = json.dumps(gltf, separators=(',', ':')).encode("utf-8")
    
    # Pad to 4-byte boundary with spaces
    padding = (4 - (len(new_json_data) % 4)) % 4
    new_json_data += b' ' * padding
    
    new_json_chunk_len = len(new_json_data)
    
    # Calculate new total length
    # 12 (header) + 8 (json chunk header) + new_json_chunk_len + len(rest)
    new_length = 12 + 8 + new_json_chunk_len + len(rest)
    
    print(f"Old length: {length}, New length: {new_length}")
    print(f"Added {len(mura_categories)} MURA anchors to {file_path}")
    
    # Write output
    with open(file_path, "wb") as f:
        f.write(b'glTF')
        f.write(struct.pack('<I', version))
        f.write(struct.pack('<I', new_length))
        
        f.write(struct.pack('<I', new_json_chunk_len))
        f.write(b'JSON')
        f.write(new_json_data)
        
        f.write(rest)

if __name__ == "__main__":
    glb_path = os.path.join(
        os.path.dirname(__file__), 
        "..", "..", "Advanced Interactive Application", "public", "Skeleton.glb"
    )
    patch_glb(os.path.abspath(glb_path))
