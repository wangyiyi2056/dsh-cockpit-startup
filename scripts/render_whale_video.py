"""Bake the whale into cockpit footage, using source pixels for every position.

Requires Python 3.10+, numpy, Pillow, ffmpeg and ffprobe. Run from any directory:
    python3 scripts/render_whale_video.py
The immutable source is kept separately from the generated delivery video.
"""
from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path
import hashlib
import json
import math
import re
import subprocess

import numpy as np
from PIL import Image, ImageDraw, ImageFilter

ROOT = Path(__file__).resolve().parents[1]


@dataclass(frozen=True)
class Composition:
    width: int = 1344
    height: int = 768
    fps: int = 24
    duration: int = 16
    # The cockpit's projector is centred at (672, 587) in the source footage.
    projector: tuple[int, int] = (672, 587)
    whale_center: tuple[int, int] = (672, 310)
    whale_scale: float = 510


SPEC = Composition()


def smooth(value: float | np.ndarray) -> float | np.ndarray:
    value = np.clip(value, 0, 1)
    return value * value * (3 - 2 * value)


def silhouette_mask() -> np.ndarray:
    """Rasterize the existing cubic whale paths with their even-odd holes."""
    traces = json.loads((ROOT / "src/scene/whale-traces.json").read_text())
    mask = np.zeros((512, 512), dtype=bool)
    for trace in traces:
        tokens = re.findall(r"[MCZ]|-?\d+(?:\.\d+)?", trace["d"])
        points: list[tuple[float, float]] = []
        cursor = (0.0, 0.0)
        index = 0
        while index < len(tokens):
            command = tokens[index]
            index += 1
            if command == "M":
                cursor = (float(tokens[index]), float(tokens[index + 1]))
                points.append(cursor)
                index += 2
            elif command == "C":
                x1, y1, x2, y2, x3, y3 = map(float, tokens[index:index + 6])
                x0, y0 = cursor
                for step in range(1, 13):
                    t = step / 12
                    u = 1 - t
                    points.append((u**3*x0 + 3*u*u*t*x1 + 3*u*t*t*x2 + t**3*x3,
                                   u**3*y0 + 3*u*u*t*y1 + 3*u*t*t*y2 + t**3*y3))
                cursor = (x3, y3)
                index += 6
            elif command != "Z":
                raise ValueError(f"Unsupported whale path command: {command}")
        contour = Image.new("1", (512, 512))
        ImageDraw.Draw(contour).polygon(points, fill=1)
        mask ^= np.asarray(contour, dtype=bool)
    return mask


class WhaleAnimation:
    """Deterministic particle positions and light, evaluated at absolute time."""

    def __init__(self) -> None:
        mask = silhouette_mask()
        points = [(x, y) for y in range(65, 420, 7)
                  for x in range(16, 485, 7) if mask[y, x]]
        self.points = np.asarray(points, dtype=float)
        count = len(points)
        rng = np.random.default_rng(20261107)
        self.variation = rng.random(count)
        self.wind = rng.uniform(-1, 1, count)
        self.delay = (1 - self.points[:, 0]/512)*0.9 + rng.random(count)*0.18
        self.stays = np.arange(count) % 5 == 0
        self.spark = np.arange(count) % 43 == 0
        self.base = ((self.points - (250, 242))/512 * SPEC.whale_scale
                     + SPEC.whale_center)
        # Stars stay within the glass canopy, clear of its mechanical frame.
        star_y = rng.uniform(45, 350, count)
        half_span = 455 - star_y * 0.52
        self.targets = np.column_stack((672 + rng.uniform(-1, 1, count)*half_span, star_y))
        self.sky_mask = Image.new("L", (SPEC.width, SPEC.height))
        ImageDraw.Draw(self.sky_mask).polygon(
            [(180, 0), (1164, 0), (950, 320), (826, 530), (518, 530), (394, 320)],
            fill=255,
        )

    def render(self, time: float) -> Image.Image:
        layer = Image.new("RGB", (SPEC.width, SPEC.height))
        draw = ImageDraw.Draw(layer)
        formed = smooth((time - 0.65 - self.variation*0.55) / 1.25)
        flight = smooth((time - 5.2 - self.delay) / 3.25)
        closing = 1 - float(smooth((time - 14.5) / 1.5))
        start = self.base.copy()
        start[:, 0] += (1 - formed) * self.wind * 30
        start[:, 1] += (1 - formed) * (self.variation - 0.5) * 48
        start[:, 1] += math.sin(time*0.9)*2
        rest = 1 - flight
        control1 = start + np.column_stack((self.wind*35, -65-self.variation*45))
        control2 = self.targets + np.column_stack((self.wind*55, np.full(len(start), 28)))
        positions = (rest[:, None]**3*start + 3*(rest*rest*flight)[:, None]*control1
                     + 3*(rest*flight*flight)[:, None]*control2
                     + flight[:, None]**3*self.targets)
        shimmer = 0.8 + 0.2*np.sin(time*(0.65+self.variation) + self.variation*28)
        opacity = formed * np.where(self.stays, 0.7+0.25*self.variation, 0.6+0.35*self.variation)
        opacity *= np.where(self.stays, rest+flight*shimmer, rest) * closing
        radii = (0.92+self.variation*0.4)*rest + (0.45+self.variation*0.55)*flight
        for index, (x, y) in enumerate(positions):
            alpha = float(opacity[index])
            if alpha < 0.008:
                continue
            radius = float(radii[index])
            color = tuple(int(c*alpha) for c in (170, 230, 255))
            if self.variation[index] > 0.96 and flight[index] > 0.5:
                color = tuple(int(c*alpha) for c in (255, 232, 198))
            draw.ellipse((x-radius, y-radius, x+radius, y+radius), fill=color)
            if self.stays[index] and self.spark[index] and flight[index] > 0.85:
                draw.line((x-3, y, x+3, y), fill=tuple(int(c*.5) for c in color))
                draw.line((x, y-3, x, y+3), fill=tuple(int(c*.5) for c in color))
        # Bloom belongs to the particles; the underlying footage keeps its exposure.
        glow = layer.filter(ImageFilter.GaussianBlur(3.5))
        pixels = np.minimum(255, np.asarray(layer, dtype=np.uint16)
                            + np.asarray(glow, dtype=np.uint16)*2).astype(np.uint8)
        layer = Image.composite(Image.fromarray(pixels), Image.new("RGB", layer.size), self.sky_mask)
        beam = Image.new("RGB", layer.size)
        beam_draw = ImageDraw.Draw(beam)
        strength = float(np.mean(formed * rest)) * closing
        px, py = SPEC.projector
        beam_draw.polygon([(px-23, py), (px+23, py), (px+186, py-210), (px-186, py-210)],
                          fill=(int(3*strength), int(9*strength), int(15*strength)))
        beam = beam.filter(ImageFilter.GaussianBlur(15))
        return Image.fromarray(np.minimum(255, np.asarray(layer, dtype=np.uint16)
                                         + np.asarray(beam, dtype=np.uint16)).astype(np.uint8))


def render_video() -> None:
    source = ROOT / "assets/cockpit-ambient-source.mp4"
    destination = ROOT / "assets/cockpit-ambient.mp4"
    temporary = destination.with_name("cockpit-ambient-rendering.mp4")
    log_path = ROOT / ".preview-home/whale-render.log"
    log_path.parent.mkdir(parents=True, exist_ok=True)
    animation = WhaleAnimation()
    probe = json.loads(subprocess.run([
        "ffprobe", "-v", "error", "-select_streams", "v:0", "-show_entries",
        "stream=width,height,r_frame_rate:format=duration", "-of", "json", str(source),
    ], check=True, capture_output=True, text=True).stdout)
    stream = probe["streams"][0]
    if (stream["width"], stream["height"], stream["r_frame_rate"]) != (SPEC.width, SPEC.height, "24/1"):
        raise ValueError("Expected the original 1344x768, 24fps source; do not stretch replacement footage")
    if float(probe["format"]["duration"]) < 8:
        raise ValueError("Source must contain at least eight seconds")
    frames = SPEC.fps * SPEC.duration
    frame_bytes = SPEC.width * SPEC.height * 3
    with log_path.open("wb") as log:
        decoder = subprocess.Popen([
            "ffmpeg", "-nostdin", "-v", "error", "-i", str(source), "-an",
            "-vf", "trim=end_frame=192,loop=loop=1:size=192:start=0,setpts=N/(24*TB)",
            "-frames:v", str(frames), "-f", "rawvideo", "-pix_fmt", "rgb24", "pipe:1",
        ], stdout=subprocess.PIPE, stderr=log)
        encoder = subprocess.Popen([
            "ffmpeg", "-nostdin", "-v", "error", "-y", "-f", "rawvideo",
            "-pix_fmt", "rgb24", "-s", f"{SPEC.width}x{SPEC.height}", "-r", str(SPEC.fps),
            "-i", "pipe:0", "-an", "-c:v", "libx264", "-preset", "slow", "-crf", "20",
            "-pix_fmt", "yuv420p", "-movflags", "+faststart", "-colorspace", "bt709",
            "-color_primaries", "bt709", "-color_trc", "bt709", str(temporary),
        ], stdin=subprocess.PIPE, stderr=log)
        assert decoder.stdout is not None and encoder.stdin is not None
        try:
            for frame_index in range(frames):
                raw = decoder.stdout.read(frame_bytes)
                if len(raw) != frame_bytes:
                    raise RuntimeError(f"Source ended at frame {frame_index}; see {log_path}")
                background = np.frombuffer(raw, dtype=np.uint8).reshape(SPEC.height, SPEC.width, 3)
                light = np.asarray(animation.render(frame_index / SPEC.fps), dtype=np.uint16)
                composed = np.minimum(255, background.astype(np.uint16) + light).astype(np.uint8)
                encoder.stdin.write(composed.tobytes())
                if frame_index in (0, 72, 180, 264, 383):
                    proof = ROOT / ".preview-home/video-proof"
                    proof.mkdir(parents=True, exist_ok=True)
                    Image.fromarray(composed).save(proof / f"frame-{frame_index:03}.png")
            encoder.stdin.close()
            if decoder.wait() or encoder.wait():
                raise RuntimeError(f"FFmpeg failed; see {log_path}")
        except BaseException:
            decoder.kill()
            encoder.kill()
            decoder.wait()
            encoder.wait()
            raise
    temporary.replace(destination)
    Image.open(ROOT / ".preview-home/video-proof/frame-072.png").save(
        ROOT / "assets/cockpit-ambient-poster.webp", quality=88,
    )
    metadata = {
        "direction": "Ice-blue point-cloud whale projected from the cockpit core, dispersing into canopy stars",
        "source": "assets/cockpit-ambient-source.mp4",
        "sourceSha256": hashlib.sha256(source.read_bytes()).hexdigest(),
        "sourceProvenance": "Original project-generated HeyGen cockpit clip; first 8 seconds looped twice at 1x",
        "output": "assets/cockpit-ambient.mp4",
        "outputSha256": hashlib.sha256(destination.read_bytes()).hexdigest(),
        "dimensions": [SPEC.width, SPEC.height], "fps": SPEC.fps, "durationSeconds": SPEC.duration,
        "audio": "none", "particleCount": len(animation.points),
        "coordinates": {"projector": SPEC.projector, "whaleCenter": SPEC.whale_center, "whaleScale": SPEC.whale_scale},
        "cuesSeconds": {"form": [0.65, 2.45], "hold": [2.45, 5.2], "disperse": [5.2, 9.6], "stars": [9.6, 14.5], "fadeToLoop": [14.5, 16]},
        "render": "python3 scripts/render_whale_video.py",
    }
    (ROOT / "docs/video-composition.json").write_text(json.dumps(metadata, indent=2) + "\n")
    print(f"Rendered {SPEC.duration}s, {SPEC.width}x{SPEC.height}, {SPEC.fps}fps, {len(animation.points)} particles")


if __name__ == "__main__":
    render_video()
