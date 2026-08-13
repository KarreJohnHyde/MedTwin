import torch
import torch.nn as nn
from torchvision.models.detection import fasterrcnn_resnet50_fpn, FasterRCNN_ResNet50_FPN_Weights
from torchvision.models.detection.faster_rcnn import FastRCNNPredictor

class MedTwinVisionModel(nn.Module):
    """
    Faster R-CNN model with ResNet50-FPN backbone for MedTwin.
    Designed to detect skeletal and organ abnormalities (e.g., Fracture, Lesion).
    """
    def __init__(self, num_classes=5, pretrained=False):
        """
        Args:
            num_classes (int): Number of classes (including background).
                               0: Background, 1: Fracture, 2: Pneumonia, 
                               3: Lung Opacity, 4: Bone Lesion
            pretrained (bool): Whether to use COCO pre-trained weights.
        """
        super(MedTwinVisionModel, self).__init__()
        # Load a pre-trained Faster R-CNN model with ResNet50-FPN backbone
        # Do not download weights at API startup.  Callers can opt in to COCO
        # weights for experimentation, but clinical inference needs a local,
        # task-specific checkpoint.
        weights = FasterRCNN_ResNet50_FPN_Weights.DEFAULT if pretrained else None
        self.model = fasterrcnn_resnet50_fpn(weights=weights, weights_backbone=None)
        
        # Get the number of input features for the classifier
        in_features = self.model.roi_heads.box_predictor.cls_score.in_features
        
        # Replace the pre-trained head with a new one
        self.model.roi_heads.box_predictor = FastRCNNPredictor(in_features, num_classes)
        
        # We need to register hooks to the FPN layers for Grad-CAM
        self.gradients = {}
        self.activations = {}
        
    def _save_gradient(self, name):
        def backward_hook(module, grad_in, grad_out):
            self.gradients[name] = grad_out[0].detach()
        return backward_hook

    def _save_activation(self, name):
        def forward_hook(module, input, output):
            self.activations[name] = output.detach()
        return forward_hook

    def register_fpn_hooks(self):
        """
        Registers forward and backward hooks to the FPN output layers.
        FPN layers in torchvision ResNet50 are typically 0, 1, 2, 3 (P2 to P5).
        """
        fpn = self.model.backbone.fpn
        
        # The FPN layer typically has inner_blocks and layer_blocks. 
        # For Grad-CAM, we want the outputs of the layer_blocks (which produce the final P layers).
        for i, module in enumerate(fpn.layer_blocks):
            name = f'P{i+2}' # P2, P3, P4, P5
            module.register_forward_hook(self._save_activation(name))
            module.register_full_backward_hook(self._save_gradient(name))
            
    def forward(self, images, targets=None):
        """
        Args:
            images (list[Tensor]): images to be processed
            targets (list[Dict[Tensor]]): ground-truth boxes present in the image (optional)
            
        Returns:
            result (list[BoxList] or dict[Tensor]): the output from the model.
        """
        return self.model(images, targets)

    def get_activations(self, layer_name):
        return self.activations.get(layer_name)

    def get_gradients(self, layer_name):
        return self.gradients.get(layer_name)

if __name__ == "__main__":
    # Test model initialization
    model = MedTwinVisionModel(num_classes=5)
    model.register_fpn_hooks()
    print("MedTwin Vision Model initialized successfully.")
