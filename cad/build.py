"""Exact B-rep export, bounded assembly checks and tessellation. No generated code execution."""
import csv
from datetime import datetime, timezone
import json
import math
import sys
from pathlib import Path

from build123d import Align, Axis, Box, Color, Compound, Cylinder, Pos, RegularPolygon, Rot, extrude, export_step, export_stl, import_step


def primitive(p):
    if p["type"] == "box":
        shape = Box(*p["size"])
    elif p["type"] == "hex":
        shape = Pos(0, 0, -p["length"] / 2) * extrude(RegularPolygon(p["radius"], 6), amount=p["length"])
    else:
        shape = Cylinder(p["radius"], p["length"])
        if p.get("axis") == "x":
            shape = Rot(0, 90, 0) * shape
    return Pos(*p["at"]) * shape


def build(spec):
    parts = {}
    for component in spec["components"]:
        solids = [primitive(p) for p in component["add"]]
        part = solids[0]
        for solid in solids[1:]:
            part = part + solid
        for cut in component["cut"]:
            part = part - primitive(cut)
        if not part.is_valid or part.volume <= 0:
            raise ValueError("Invalid solid: " + component["id"])
        part.label = component["id"]
        part.color = Color(component["color"])
        parts[component["id"]] = part
    return parts


def moved_lid(part, pivot, angle):
    return part.rotate(Axis(tuple(pivot), (1, 0, 0)), angle)


def analyze(parts, spec, angles=(0, 55, 110)):
    static = []
    ids = list(parts)
    for i, a in enumerate(ids):
        for b in ids[i + 1:]:
            overlap = parts[a] & parts[b]
            volume = abs(overlap.volume) if overlap else 0
            if volume > 0.001:
                static.append({"a": a, "b": b, "volume_mm3": round(volume, 6)})
    pivot = spec["joints"][0]["pivot"]
    motion = []
    for angle in angles:
        lid = moved_lid(parts["lid"], pivot, angle)
        collisions = []
        for key, other in parts.items():
            if key == "lid":
                continue
            overlap = lid & other
            volume = abs(overlap.volume) if overlap else 0
            if volume > 0.001:
                collisions.append({"part": key, "volume_mm3": round(volume, 6)})
        motion.append({"angle_deg": angle, "collisions": collisions})
    p = spec["parameters"]
    return {"method": "OpenCascade solid intersections and minimum distances", "static_collisions": static,
            "sampled_motion": motion, "motion_note": "Three sampled poses only; not a continuous collision proof or a dynamics simulation.",
            "clearances_mm": {"base_to_lid_closed": round(parts["base"].distance_to(parts["lid"]), 6),
                              "pin_to_lid": round(parts["pin"].distance_to(parts["lid"]), 6),
                              "pin_radial_design": p["pinClearance"]},
            "passed": not static and not any(p["collisions"] for p in motion)}


def write(spec, out, revision):
    out.mkdir(parents=True, exist_ok=True)
    prefix = "assembly-" + revision
    parts = build(spec)
    assembly = Compound(label=spec["parameters"]["name"], children=list(parts.values()))
    names = {"step": prefix + ".step", "stl": prefix + ".stl", "source": prefix + "-source.json", "bom": prefix + "-bom.csv", "mesh": prefix + "-mesh.json"}
    if not export_step(assembly, str(out / names["step"])):
        raise RuntimeError("STEP export failed")
    if not export_stl(assembly, str(out / names["stl"])):
        raise RuntimeError("STL export failed")
    # Real import of the exported file: catches empty/broken exchange artifacts.
    imported = import_step(str(out / names["step"]))
    expected_volume = sum(part.volume for part in parts.values())
    if abs(imported.volume - expected_volume) > max(0.01, expected_volume * 1e-6):
        raise RuntimeError("STEP round-trip volume mismatch")
    meshes, properties = [], []
    for c in spec["components"]:
        part = parts[c["id"]]
        vertices, triangles = part.tessellate(0.15, 0.25)
        meshes.append({"id": c["id"], "positions": [n for v in vertices for n in (v.X, v.Y, v.Z)], "triangles": [i for face in triangles for i in face]})
        properties.append({"id": c["id"], "volume_mm3": round(part.volume, 4), "estimated_mass_g": round(part.volume * c["density"] / 1000, 3), "solids": len(part.solids())})
    checks = analyze(parts, spec)
    report = {"schemaVersion": 1, "revision": revision, "builtAt": datetime.now(timezone.utc).isoformat(), "digest": spec["digest"], "engine": "build123d 0.13.0 / OpenCascade", "files": names, "checks": checks, "properties": properties,
              "estimated_mass_g": round(sum(p["estimated_mass_g"] for p in properties), 3), "mass_note": "Solid-volume estimate using example material densities; excludes print infill and supplier tolerances.",
              "step_roundtrip": {"passed": True, "volume_mm3": imported.volume, "solids": len(imported.solids())}, "notes": spec["notes"]}
    (out / names["source"]).write_text(json.dumps(spec, indent=2))
    (out / names["mesh"]).write_text(json.dumps({"digest": spec["digest"], "meshes": meshes}, separators=(",", ":")))
    with (out / names["bom"]).open("w", newline="") as stream:
        writer = csv.DictWriter(stream, fieldnames=["part", "description", "quantity", "material"])
        writer.writeheader()
        writer.writerows(spec["bom"])
    # Publish the report last: its presence means all exports and checks finished.
    report_file = out / (prefix + "-report.json")
    temp = report_file.with_suffix(".tmp")
    temp.write_text(json.dumps(report, indent=2))
    temp.replace(report_file)
    print(json.dumps(report, indent=2), flush=True)
    if not checks["passed"]:
        raise RuntimeError("Assembly checks found interference. Inspect the report before using this design.")
    return report


if __name__ == "__main__":
    source, destination, revision = sys.argv[1:]
    write(json.loads(Path(source).read_text()), Path(destination), revision)
