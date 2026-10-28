"""Small, CPU-only validation jobs. No model inference, GPU or remote API."""
import json
import sys
from pathlib import Path

tool, destination = sys.argv[1:]
out = Path(destination)
out.mkdir(parents=True, exist_ok=True)
if tool == "cad":
    from build123d import Box, Cylinder, Pos, export_step, export_stl
    # A reproducible plate, not a text-generation or FEM claim.
    plate = Box(60, 40, 5)
    for x in (-20, 20):
        for y in (-10, 10):
            plate -= Pos(x, y, 0) * Cylinder(3, 10)
    export_step(plate, str(out / "dino-mounting-plate.step"))
    export_stl(plate, str(out / "dino-mounting-plate.stl"))
    result = {"tool": tool, "sample": "mounting plate", "dimensions_mm": [60, 40, 5], "holes_mm": 6, "volume_mm3": plate.volume}
elif tool == "mujoco":
    import mujoco
    import numpy as np
    xml = '<mujoco><option timestep="0.002"/><worldbody><geom type="plane" size="1 1 .1"/><body pos="0 0 1"><freejoint/><geom type="sphere" size=".05" mass=".1"/></body></worldbody></mujoco>'
    model = mujoco.MjModel.from_xml_string(xml)
    data = mujoco.MjData(model)
    for _ in range(1000):
        mujoco.mj_step(model, data)
    if not np.isfinite(data.qpos).all():
        raise RuntimeError("Simulation produced non-finite state")
    (out / "dino-drop-test.xml").write_text(xml)
    result = {"tool": tool, "sample": "sphere drop", "steps": 1000, "seconds": float(data.time), "position": data.qpos[:3].tolist(), "finite": True}
else:
    raise ValueError("Unknown sample")
(out / f"{tool}-receipt.json").write_text(json.dumps(result, indent=2))
print(json.dumps(result, indent=2), flush=True)
print(f"Artifacts: {out}", flush=True)
