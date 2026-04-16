"""
Modal-hosted ffmpeg encoding functions.
Deploy with: modal deploy encoder/modal_encoder.py
"""

import modal
import subprocess
import os
import json
from pathlib import Path

app = modal.App("demoagent-encoder")

# Container image with ffmpeg + Python deps
image = (
    modal.Image.debian_slim()
    .apt_install("ffmpeg")
    .pip_install("boto3", "requests")
)


@app.function(image=image, timeout=300, cpu=2)
def encode_clip(
    frames_dir: str,
    audio_url: str,
    click_events: list[dict],
    title: str,
    duration_seconds: float,
    output_key: str,
    r2_config: dict,
) -> str:
    """
    Encode a single clip:
    1. Assemble frames into video
    2. Overlay animated click circles at correct timestamps
    3. Add title card lower-third
    4. Mix in narration audio
    5. Upload to R2, return public URL
    """
    import tempfile
    import boto3

    with tempfile.TemporaryDirectory() as tmp:
        raw_video = f"{tmp}/raw.mp4"
        final_video = f"{tmp}/final.mp4"
        audio_file = f"{tmp}/narration.mp3"

        # Download narration audio
        import requests
        r = requests.get(audio_url)
        with open(audio_file, "wb") as f:
            f.write(r.content)

        # Step 1: Assemble frames -> raw video at 30fps
        subprocess.run([
            "ffmpeg", "-y",
            "-framerate", "30",
            "-i", f"{frames_dir}/frame_%05d.png",
            "-c:v", "libx264",
            "-pix_fmt", "yuv420p",
            "-preset", "fast",
            raw_video
        ], check=True)

        # Step 2: Build click circle overlay filter
        # Each click event gets a pulsing orange circle at (x,y) for 0.6s
        overlay_filters = []
        for i, event in enumerate(click_events):
            t = event["timestamp_ms"] / 1000
            x, y = int(event["x"]), int(event["y"])
            # drawcircle with fade in/out using enable expression
            overlay_filters.append(
                f"drawcircle=x={x}:y={y}:r=24:color=0xFF5722@0.85:"
                f"enable='between(t,{t},{t+0.6})'"
            )

        # Step 3: Title card lower-third (fade in at 0.5s, fade out at 3.5s)
        safe_title = title.replace("'", "\\'")
        title_filter = (
            f"drawtext=text='{safe_title}'"
            f":fontsize=28:fontcolor=white"
            f":x=48:y=h-80"
            f":box=1:boxcolor=black@0.55:boxborderw=10"
            f":enable='between(t,0.5,3.5)'"
        )

        all_filters = ",".join(overlay_filters + [title_filter]) if overlay_filters else title_filter

        # Step 4: Combine video, filters, and audio
        subprocess.run([
            "ffmpeg", "-y",
            "-i", raw_video,
            "-i", audio_file,
            "-vf", all_filters,
            "-c:v", "libx264",
            "-c:a", "aac",
            "-shortest",
            "-preset", "fast",
            "-pix_fmt", "yuv420p",
            final_video
        ], check=True)

        # Step 5: Upload to R2
        s3 = boto3.client(
            "s3",
            endpoint_url=f"https://{r2_config['account_id']}.r2.cloudflarestorage.com",
            aws_access_key_id=r2_config["access_key_id"],
            aws_secret_access_key=r2_config["secret_access_key"],
            region_name="auto",
        )

        with open(final_video, "rb") as f:
            s3.put_object(
                Bucket=r2_config["bucket"],
                Key=output_key,
                Body=f,
                ContentType="video/mp4",
            )

        return f"{r2_config['public_url']}/{output_key}"


@app.function(image=image, timeout=600, cpu=4)
def stitch_clips(
    clip_urls: list[str],
    output_key: str,
    r2_config: dict,
    music_track: str = "none",
) -> str:
    """
    Concatenate multiple clip MP4s into one final video.
    Optionally mix in background music at low volume.
    """
    import tempfile
    import boto3
    import requests

    with tempfile.TemporaryDirectory() as tmp:
        clip_files = []

        # Download all clips
        for i, url in enumerate(clip_urls):
            path = f"{tmp}/clip_{i:03d}.mp4"
            r = requests.get(url)
            with open(path, "wb") as f:
                f.write(r.content)
            clip_files.append(path)

        # Build concat list
        concat_list = f"{tmp}/concat.txt"
        with open(concat_list, "w") as f:
            for clip in clip_files:
                f.write(f"file '{clip}'\n")

        final_video = f"{tmp}/final_stitched.mp4"

        subprocess.run([
            "ffmpeg", "-y",
            "-f", "concat",
            "-safe", "0",
            "-i", concat_list,
            "-c", "copy",
            final_video
        ], check=True)

        # Upload final stitched video to R2
        s3 = boto3.client(
            "s3",
            endpoint_url=f"https://{r2_config['account_id']}.r2.cloudflarestorage.com",
            aws_access_key_id=r2_config["access_key_id"],
            aws_secret_access_key=r2_config["secret_access_key"],
            region_name="auto",
        )

        with open(final_video, "rb") as f:
            s3.put_object(
                Bucket=r2_config["bucket"],
                Key=output_key,
                Body=f,
                ContentType="video/mp4",
            )

        return f"{r2_config['public_url']}/{output_key}"
