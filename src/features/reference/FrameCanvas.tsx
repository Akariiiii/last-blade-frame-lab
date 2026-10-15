import { dataUrl } from '../../lib/data.ts';
import { useEffect, useRef, useState } from "react";
import type { Box, Frame, StaticCommand } from "../../types/reference.ts";
import { screenBox } from "../../lib/playback";

export interface Layers {
  attack: boolean;
  hurt: boolean;
  push: boolean;
  unknown: boolean;
  origins: boolean;
  grid: boolean;
  opponent: boolean;
}
const colors = {
  attack: "#ff635c",
  hurt: "#65d69c",
  push: "#73b9ff",
  unknown: "#eac46e",
};
const imageCache = new Map<string, HTMLImageElement>();
function useImage(source?: string) {
  const [loaded, setLoaded] = useState<{
    source: string;
    image: HTMLImageElement;
  } | null>(null);
  useEffect(() => {
    if (!source) return;
    const cached = imageCache.get(source);
    if (cached) {
      setLoaded({ source, image: cached });
      return;
    }
    let alive = true;
    const image = new Image();
    image.onload = () => {
      imageCache.set(source, image);
      if (imageCache.size > 256)
        imageCache.delete(imageCache.keys().next().value!);
      if (alive) setLoaded({ source, image });
    };
    image.onerror = () => {
      if (alive) setLoaded(null);
    };
    image.src = dataUrl(source);
    return () => {
      alive = false;
    };
  }, [source]);
  if (!source) return null;
  return (
    imageCache.get(source) || (loaded?.source === source ? loaded.image : null)
  );
}

export default function FrameCanvas({
  frame,
  command,
  layers,
  zoom,
  mirror,
  startX,
  character,
}: {
  frame?: Frame;
  command?: StaticCommand;
  layers: Layers;
  zoom: number;
  mirror: boolean;
  startX: number;
  character: string;
}) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const [size, setSize] = useState({ width: 900, height: 390 });
  const gameImage = useImage(frame?.camera ? frame.image : undefined);
  const sprite = useImage(frame?.sprite?.image);
  useEffect(() => {
    const el = canvas.current;
    if (!el) return;
    const observer = new ResizeObserver(([entry]) =>
      setSize({
        width: entry.contentRect.width,
        height: entry.contentRect.height,
      }),
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);
  useEffect(() => {
    const el = canvas.current;
    if (!el) return;
    const dpr = window.devicePixelRatio || 1;
    el.width = Math.round(size.width * dpr);
    el.height = Math.round(size.height * dpr);
    const ctx = el.getContext("2d");
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.imageSmoothingEnabled = false;
    const width = size.width,
      height = size.height;
    ctx.fillStyle = "#111a17";
    ctx.fillRect(0, 0, width, height);
    let scale = zoom * Math.min(width / 900, height / 390) * 2;
    let ox = width * 0.48,
      ground = height * 0.8;
    const camera = frame?.camera;
    const aligned = Boolean(camera && gameImage);
    let scaleX = scale,
      scaleY = scale;
    if (camera && gameImage) {
      scale = Math.min(width / camera.width, height / camera.height);
      const left = (width - camera.width * scale) / 2;
      const top = (height - camera.height * scale) / 2;
      ctx.drawImage(
        gameImage,
        left,
        top,
        camera.width * scale,
        camera.height * scale,
      );
      scaleX = scale * (camera.scaleX ?? 1);
      scaleY = scale * (camera.scaleY ?? 1);
      ox = left + ((frame?.x || 0) - camera.x) * scaleX;
      ground = top + camera.groundY * scale;
    } else if (frame)
      ox += Math.max(
        -width * 0.23,
        Math.min(width * 0.23, (frame.x - startX) * scale),
      );
    if (layers.grid && !aligned) {
      ctx.lineWidth = 1;
      ctx.strokeStyle = "#21332b";
      const gap = 16 * scale;
      for (let x = ox % gap; x < width; x += gap) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, height);
        ctx.stroke();
      }
      for (let y = ground % gap; y < height; y += gap) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(width, y);
        ctx.stroke();
      }
      ctx.strokeStyle = "#496253";
      ctx.beginPath();
      ctx.moveTo(0, ground);
      ctx.lineTo(width, ground);
      ctx.stroke();
      ctx.fillStyle = "#668273";
      ctx.font = "10px monospace";
      for (let x = ox % (64 * scale); x < width; x += 64 * scale)
        ctx.fillText(`${Math.round((x - ox) / scale)}`, x + 4, ground + 15);
    }
    const facing = frame ? frame.facing : mirror ? 1 : 0;
    const py = ground - (frame?.y || 0) * scaleY;
    if (sprite && frame?.sprite) {
      const pose = frame.sprite;
      ctx.save();
      ctx.translate(ox, py);
      ctx.scale(facing ? -scaleX : scaleX, scaleY);
      ctx.drawImage(
        sprite,
        -pose.originX,
        -pose.originY,
        pose.width,
        pose.height,
      );
      ctx.restore();
    }
    const drawBox = (
      box: Box,
      x: number,
      y: number,
      face: number,
      opponent = false,
    ) => {
      if (!layers[box.role] || box.special || box.profile === 0) return;
      const rect = screenBox(box, x, y, face, scaleX, scaleY);
      ctx.fillStyle = colors[box.role] + (opponent ? "16" : "30");
      ctx.strokeStyle = colors[box.role];
      ctx.lineWidth = 1.5;
      ctx.setLineDash(opponent || box.role === "push" ? [5, 3] : []);
      ctx.fillRect(rect.x, rect.y, rect.width, rect.height);
      ctx.strokeRect(rect.x + 0.5, rect.y + 0.5, rect.width, rect.height);
      ctx.setLineDash([]);
      if (rect.width > 24 && rect.height > 12) {
        ctx.font = "bold 10px monospace";
        ctx.fillStyle = colors[box.role];
        const text = `${opponent ? "P2 " : ""}${box.role === "attack" ? `ATK ${box.damage}` : box.role.toUpperCase()}`;
        ctx.fillText(text, rect.x + 4, rect.y + 12);
      }
    };
    const boxes = frame?.boxes || (command ? [command.box] : []);
    boxes
      .filter((b) => b.role !== "attack")
      .forEach((b) => drawBox(b, ox, py, facing));
    boxes
      .filter((b) => b.role === "attack")
      .forEach((b) => drawBox(b, ox, py, facing));
    if (frame && layers.opponent && frame.opponent.x !== undefined) {
      const qx = ox + (frame.opponent.x - frame.x) * scaleX,
        qy = ground - (frame.opponent.y || 0) * scaleY;
      (frame.opponent.boxes || []).forEach((box) =>
        drawBox(box, qx, qy, frame.opponent.facing ?? (facing ? 0 : 1), true),
      );
    }
    if (layers.origins) {
      ctx.strokeStyle = "#eadfc4";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(ox - 7, py);
      ctx.lineTo(ox + 7, py);
      ctx.moveTo(ox, py - 7);
      ctx.lineTo(ox, py + 7);
      ctx.stroke();
      ctx.font = "10px monospace";
      ctx.fillStyle = "#eadfc4";
      ctx.fillText("P1 ORIGIN", ox + 10, py - 4);
    }
    if (!aligned && !sprite) {
      ctx.font = "11px monospace";
      ctx.fillStyle = "#8ca697";
      ctx.fillText("COLLISION SCHEMATIC · GAME UNITS", 16, 24);
      ctx.fillStyle = "#637e6e";
      ctx.fillText("Sprite alignment not available for this frame", 16, 42);
    }
    if (!frame && !command) {
      ctx.font = "14px system-ui";
      ctx.fillStyle = "#9ead9f";
      ctx.textAlign = "center";
      ctx.fillText(
        "Select a move or ROM collision record to inspect",
        width / 2,
        height / 2,
      );
      ctx.textAlign = "left";
    }
  }, [
    frame,
    command,
    layers,
    zoom,
    mirror,
    startX,
    character,
    size,
    gameImage,
    sprite,
  ]);
  return (
    <canvas
      ref={canvas}
      className="frame-canvas"
      role="img"
      aria-label={`${character} ${frame ? `recorded frame ${frame.frame}` : "ROM collision record"} with attack and hurt box overlays`}
    />
  );
}
