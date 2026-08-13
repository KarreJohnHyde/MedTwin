import trimesh
import numpy as np
import torch
import os

def preprocess_mesh_to_voxel(filepath, pitch=0.05):
    """
    Load a 3D mesh and convert it to a boolean voxel grid tensor.
    
    Args:
        filepath (str): Path to the .glb or .obj file
        pitch (float): Spatial resolution of the voxel grid
        
    Returns:
        torch.Tensor: Tensor of shape (1, 1, D, H, W)
    """
    if not os.path.exists(filepath):
        raise FileNotFoundError(f"Mesh file not found: {filepath}")
        
    # Load the exported mesh (e.g., from Blender)
    # force='mesh' forces scene objects to be loaded as a single mesh
    mesh = trimesh.load(filepath, force='mesh')
    
    # If the loaded object is a Scene, we can dump it to a single mesh
    if isinstance(mesh, trimesh.Scene):
        mesh = trimesh.util.concatenate(
            tuple(trimesh.Trimesh(vertices=g.vertices, faces=g.faces)
                for g in mesh.geometry.values())
        )
    
    # Convert mesh to a voxel grid based on a defined spatial pitch
    voxel_grid = mesh.voxelized(pitch=pitch)
    
    # Extract the dense 3D boolean/float matrix
    voxel_matrix = voxel_grid.matrix.astype(np.float32)
    
    # PyTorch 3D CNNs expect shape: (Batch, Channels, Depth, Height, Width)
    tensor = torch.tensor(voxel_matrix)
    tensor = tensor.unsqueeze(0).unsqueeze(0) 
    
    return tensor

if __name__ == "__main__":
    # Test block
    test_file = "../next-dashboard/public/assets/Heart.glb"
    if os.path.exists(test_file):
        print(f"Testing voxelization on {test_file}...")
        try:
            tensor = preprocess_mesh_to_voxel(test_file, pitch=0.5)
            print(f"Success! Tensor shape: {tensor.shape}")
        except Exception as e:
            print(f"Voxelization failed: {e}")
    else:
        print("Test file not found.")
