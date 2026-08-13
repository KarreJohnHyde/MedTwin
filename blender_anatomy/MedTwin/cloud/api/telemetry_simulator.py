import asyncio
import json
import logging
import random
import time
from typing import Callable, Awaitable

logger = logging.getLogger("medtwin.simulator")

class TelemetrySimulator:
    """
    High-Throughput Telemetry Simulator
    Simulates thousands of concurrent edge device connections sending MQTT/REST 
    payloads to stress-test the backend async queues and models.
    """
    def __init__(self, callback: Callable[[dict], Awaitable[None]]):
        self.callback = callback
        self.active_tasks = []
        self.is_running = False

    async def _simulate_device(self, device_id: str, hz: float):
        """Simulates a single edge device emitting telemetry at a specific frequency."""
        patient_id = f"PT-SIM-{device_id.split('-')[-1]}"
        logger.info(f"Device {device_id} connected. Emitting at {hz}Hz.")
        
        while self.is_running:
            # Generate synthetic ECG wave (noisy sine)
            t = time.time()
            hr = random.uniform(60, 150)
            ecg_sample = [math.sin(t * hr/60 * math.PI * 2 + i*0.1) + random.gauss(0, 0.1) for i in range(100)]
            
            payload = {
                "patient_id": patient_id,
                "device_id": device_id,
                "timestamp": t,
                "heart_rate": hr,
                "ecg_window": ecg_sample,
                "spo2": random.uniform(90, 100),
                "simulated": True
            }
            
            try:
                await self.callback(payload)
            except Exception as e:
                logger.error(f"Simulator callback failed for {device_id}: {e}")
                
            await asyncio.sleep(1.0 / hz)

    async def start_swarm(self, num_devices: int = 100, hz: float = 1.0):
        """Start a massive swarm of simulated devices."""
        if self.is_running:
            logger.warning("Swarm is already running.")
            return
            
        import math # required for sin
        global math
        
        self.is_running = True
        logger.info(f"Starting telemetry swarm: {num_devices} devices @ {hz}Hz")
        
        for i in range(num_devices):
            device_id = f"DEV-SIM-{str(i).zfill(4)}"
            task = asyncio.create_task(self._simulate_device(device_id, hz))
            self.active_tasks.append(task)
            
            # Stagger startup to avoid instant thundering herd
            await asyncio.sleep(random.uniform(0.01, 0.1))

    async def stop_swarm(self):
        """Stop all simulated devices."""
        self.is_running = False
        for task in self.active_tasks:
            task.cancel()
        self.active_tasks = []
        logger.info("Telemetry swarm stopped.")
