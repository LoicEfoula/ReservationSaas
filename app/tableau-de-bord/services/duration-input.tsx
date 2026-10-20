"use client";

import { useState } from "react";
import { formatDuration } from "@/lib/format";

export default function DurationInput() {
  const [minutes, setMinutes] = useState("");
  const n = Number(minutes);
  const showHours = Number.isInteger(n) && n >= 60;

  return (
    <div className="w-1/2">
      <input
        name="durationMin"
        type="number"
        min={5}
        max={480}
        step={5}
        placeholder="Durée (min)"
        required
        value={minutes}
        onChange={(e) => setMinutes(e.target.value)}
        className="w-full rounded border p-3"
      />
      <p className="mt-1 h-5 text-sm text-gray-600">
        {showHours ? `= ${formatDuration(n)}` : ""}
      </p>
    </div>
  );
}