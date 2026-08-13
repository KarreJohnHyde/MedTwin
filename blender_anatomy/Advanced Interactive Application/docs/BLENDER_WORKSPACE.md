# MedTwin Blender Workspace Decision

## Renderer architecture

The workspace uses one Three.js `WebGLRenderer` per leaf in the split tree. This keeps every viewport's scene, camera, orbit target, zoom, and model lifecycle independent and makes resize behavior predictable.

The supported cap is six simultaneous viewport leaves (`MAX_VIEWPORTS = 6`). The preset toolbar exposes 1, 2, 4, and 6-area layouts. A shared renderer with scissored viewports is deferred until measured target-hardware profiling shows that six renderer contexts are insufficient.

## Layout model

The workspace is a recursive binary split tree:

- A leaf owns an organ/model context and one Three.js viewer.
- A split owns an axis, ratio, and two child nodes.
- Closing a leaf collapses its empty parent into the remaining sibling.
- Joining a divider keeps the side selected by the Ctrl-drag direction.
- Divider ratios are clamped to 20–80%, with runtime pixel-aware constraints targeting a 200px minimum area.

The serialized tree is keyed by synthetic patient session and includes `REGISTRY_VERSION`. A registry-version mismatch or malformed tree invalidates the saved layout and restores a safe single-area workspace.

## Camera model

Each leaf owns its own `PerspectiveCamera` and `OrbitControls`. Resizing changes only the camera aspect and renderer dimensions for that leaf. Camera commands are addressed by leaf ID and cover anterior, posterior, lateral, superior, cross-section, and reset views.

## Interaction reference

- Registry click: load into the focused area.
- Registry drag: load into the drop-target area.
- Viewport menu or right-click: split, maximize, or join/close.
- Divider drag: resize adjacent child areas.
- Ctrl/Cmd + divider drag: join areas in the drag direction.
- Ctrl/Cmd + Space: maximize or restore focused area.
- `R`: reset focused camera.
- `[` / `]`: toggle the registry and context panels.
- Space: run inference for the focused patient/organ/model context.
- Left/Right: scrub the forecast timeline.
