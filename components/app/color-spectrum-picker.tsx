"use client";

import { useEffect, useRef } from "react";
import { hexToHsv, hsvToHex } from "@/lib/color";

/** Continuous saturation/brightness field (drag anywhere) + a hue slider — pick any color, not just fixed swatches. */
export function ColorSpectrumPicker({ hex, onChange }: { hex: string; onChange: (hex: string) => void }) {
  const { h, s, v } = hexToHsv(hex);
  const boxRef = useRef<HTMLDivElement>(null);
  const draggingRef = useRef(false);

  function pickFromPoint(clientX: number, clientY: number, hue: number) {
    const box = boxRef.current;
    if (!box) return;
    const rect = box.getBoundingClientRect();
    const x = Math.min(Math.max(clientX - rect.left, 0), rect.width);
    const y = Math.min(Math.max(clientY - rect.top, 0), rect.height);
    onChange(hsvToHex(hue, x / rect.width, 1 - y / rect.height));
  }

  useEffect(() => {
    function handleMove(e: MouseEvent) {
      if (draggingRef.current) pickFromPoint(e.clientX, e.clientY, h);
    }
    function handleUp() {
      draggingRef.current = false;
    }
    window.addEventListener("mousemove", handleMove);
    window.addEventListener("mouseup", handleUp);
    return () => {
      window.removeEventListener("mousemove", handleMove);
      window.removeEventListener("mouseup", handleUp);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [h]);

  return (
    <div className="space-y-2 pt-0.5">
      <div
        ref={boxRef}
        onMouseDown={(e) => {
          draggingRef.current = true;
          pickFromPoint(e.clientX, e.clientY, h);
        }}
        className="relative h-24 w-full cursor-crosshair rounded-md"
        style={{
          backgroundColor: `hsl(${h}, 100%, 50%)`,
          backgroundImage: "linear-gradient(to top, #000, rgba(0,0,0,0)), linear-gradient(to right, #fff, rgba(255,255,255,0))",
        }}
      >
        <span
          className="pointer-events-none absolute h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white shadow"
          style={{ left: `${s * 100}%`, top: `${(1 - v) * 100}%` }}
        />
      </div>
      <input
        type="range"
        min={0}
        max={360}
        value={h}
        onChange={(e) => onChange(hsvToHex(Number(e.target.value), s || 0.65, v || 0.9))}
        className="h-2.5 w-full cursor-pointer appearance-none rounded-full [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-white [&::-webkit-slider-thumb]:shadow"
        style={{ backgroundImage: "linear-gradient(to right, #f00, #ff0, #0f0, #0ff, #00f, #f0f, #f00)" }}
      />
    </div>
  );
}
