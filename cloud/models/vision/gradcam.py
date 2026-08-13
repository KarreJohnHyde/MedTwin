import torch
import torch.nn.functional as F
import numpy as np
import cv2

class FPNGradCAM:
    """
    Grad-CAM implementation specifically designed for Feature Pyramid Network (FPN) backbones 
    in Faster R-CNN. Aggregates heatmaps across P2, P3, P4, and P5 layers.
    """
    def __init__(self, model):
        self.model = model
        self.fpn_layers = ['P2', 'P3', 'P4', 'P5']
        
    def generate_heatmap(self, input_image, target_class_idx, target_box_idx=0):
        """
        Generates the aggregated Grad-CAM heatmap.
        
        Args:
            input_image (Tensor): Input image tensor of shape [1, C, H, W]
            target_class_idx (int): The class index we want to explain.
            target_box_idx (int): The index of the bounding box prediction to explain.
            
        Returns:
            heatmap (numpy.ndarray): The final aggregated heatmap resized to input image dimensions.
        """
        self.model.eval()
        
        # Enable gradient calculation for inference since we need to backpropagate
        self.model.zero_grad()
        
        # Forward pass
        predictions = self.model(input_image)
        
        if len(predictions[0]['boxes']) == 0:
            return np.zeros((input_image.shape[2], input_image.shape[3]), dtype=np.float32)
            
        # Get the score of the target bounding box for the target class
        score = predictions[0]['scores'][target_box_idx]
        
        # Backpropagate to get gradients at FPN layers
        score.backward(retain_graph=True)
        
        _, _, img_height, img_width = input_image.shape
        aggregated_heatmap = np.zeros((img_height, img_width), dtype=np.float32)
        
        # Iterate over FPN layers and aggregate the heatmaps
        for layer_name in self.fpn_layers:
            gradients = self.model.get_gradients(layer_name)
            activations = self.model.get_activations(layer_name)
            
            if gradients is None or activations is None:
                continue
                
            # Pool the gradients across spatial dimensions (Global Average Pooling)
            weights = torch.mean(gradients, dim=[2, 3], keepdim=True)
            
            # Weight the activations
            weighted_activations = weights * activations
            
            # Sum across channels
            heatmap = torch.sum(weighted_activations, dim=1).squeeze().cpu().detach().numpy()
            
            # Apply ReLU to only keep positive influences
            heatmap = np.maximum(heatmap, 0)
            
            # Normalize heatmap
            if np.max(heatmap) > 0:
                heatmap = heatmap / np.max(heatmap)
                
            # Resize heatmap to match original image dimensions
            heatmap_resized = cv2.resize(heatmap, (img_width, img_height))
            
            # Accumulate
            aggregated_heatmap += heatmap_resized
            
        # Final normalization of aggregated heatmap
        if np.max(aggregated_heatmap) > 0:
            aggregated_heatmap = aggregated_heatmap / np.max(aggregated_heatmap)
            
        return aggregated_heatmap

    def overlay_heatmap(self, original_img_np, heatmap, alpha=0.5, colormap=cv2.COLORMAP_JET):
        """
        Overlays the Grad-CAM heatmap onto the original image.
        """
        heatmap_colored = cv2.applyColorMap(np.uint8(255 * heatmap), colormap)
        heatmap_colored = cv2.cvtColor(heatmap_colored, cv2.COLOR_BGR2RGB)
        
        original_img_np = (original_img_np * 255).astype(np.uint8)
        if len(original_img_np.shape) == 2 or original_img_np.shape[2] == 1:
            original_img_np = cv2.cvtColor(original_img_np, cv2.COLOR_GRAY2RGB)
            
        overlay = cv2.addWeighted(original_img_np, 1 - alpha, heatmap_colored, alpha, 0)
        return overlay
