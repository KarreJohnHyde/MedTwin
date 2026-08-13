import bpy
import sys
import json
import threading
import asyncio

try:
    import websockets
except ImportError:
    print("Warning: 'websockets' library not found. Please install it in Blender's Python environment to enable live telemetry.")

# Global state
current_bpm = 72
target_obj = "Heart" if bpy.data.objects.get("Heart") else "MyHeartModel"

def apply_lub_dub_cycle(obj_name, bpm=72, fps=24):
    """
    Creates an infinite 'lub-dub' heartbeat animation on a 3D model in Blender.
    It uses non-destructive F-Curve modifiers (Cycles) to repeat the beat.
    """
    # 1. Target the specific object
    obj = bpy.data.objects.get(obj_name)
    if not obj:
        print(f"Error: Object '{obj_name}' not found in the scene!")
        return

    # 2. Clear previous animation data to avoid overlapping conflicts
    if obj.animation_data:
        obj.animation_data_clear()

    # 3. Calculate frames for one full heartbeat cycle based on BPM
    frames_per_beat = max(1, int((60.0 / bpm) * fps))
    
    # 4. The "Lub-Dub" rhythm mapping
    keyframes = [
        (0.00, 1.00, 1.00, 1.00),  # Resting
        (0.15, 0.94, 0.94, 1.04),  # "Lub": First minor contraction
        (0.25, 1.01, 1.01, 0.99),  # Brief rebound/relaxation
        (0.40, 0.85, 0.85, 1.08),  # "Dub": Main forceful ventricular contraction
        (0.65, 1.00, 1.00, 1.00),  # Recovery back to resting volume
        (1.00, 1.00, 1.00, 1.00)   # Hold resting state until the next beat triggers
    ]

    # 5. Insert the keyframes onto the timeline
    for pct, sx, sy, sz in keyframes:
        frame_num = int(pct * frames_per_beat) + 1
        obj.scale = (sx, sy, sz)
        obj.keyframe_insert(data_path="scale", index=-1, frame=frame_num)

    # 6. Smooth the curves and create an infinite loop using F-Modifiers
    if obj.animation_data and obj.animation_data.action:
        for fcurve in obj.animation_data.action.fcurves:
            for kp in fcurve.keyframe_points:
                kp.interpolation = 'BEZIER'
                kp.easing = 'EASE_IN_OUT'
            
            modifier = fcurve.modifiers.new(type='CYCLES')
            modifier.mode_before = 'REPEAT'
            modifier.mode_after = 'REPEAT'

    print(f"Success: {bpm} BPM heartbeat applied to '{obj_name}'.")

def check_bpm_update():
    global current_bpm
    if not hasattr(check_bpm_update, "last_applied_bpm"):
        check_bpm_update.last_applied_bpm = -1

    if current_bpm != check_bpm_update.last_applied_bpm:
        apply_lub_dub_cycle(target_obj, bpm=current_bpm)
        check_bpm_update.last_applied_bpm = current_bpm

    return 1.0  # Check every 1 second

async def ws_listener():
    global current_bpm
    uri = "ws://localhost:8001/ws/patient/PT-001"
    while True:
        try:
            async with websockets.connect(uri) as websocket:
                print(f"Connected to Live Telemetry at {uri}")
                while True:
                    msg = await websocket.recv()
                    data = json.loads(msg)
                    if data.get("type") == "fusion_update":
                        new_bpm = data.get("heart_rate", current_bpm)
                        if new_bpm != current_bpm:
                            print(f"Live Telemetry Update: {new_bpm} BPM")
                            current_bpm = new_bpm
        except Exception as e:
            print(f"WebSocket disconnected ({e}). Retrying in 3 seconds...")
            await asyncio.sleep(3)

def run_ws_thread():
    if "websockets" not in sys.modules:
        return
    loop = asyncio.new_event_loop()
    asyncio.set_event_loop(loop)
    loop.run_until_complete(ws_listener())

if __name__ == "__main__":
    apply_lub_dub_cycle(obj_name=target_obj, bpm=72, fps=24)
    
    # Start WebSocket background listener
    t = threading.Thread(target=run_ws_thread, daemon=True)
    t.start()
    
    # Register the check timer in Blender's main thread
    if hasattr(bpy.app, 'timers'):
        if not bpy.app.timers.is_registered(check_bpm_update):
            bpy.app.timers.register(check_bpm_update)

