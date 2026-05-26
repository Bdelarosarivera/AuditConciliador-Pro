import { motion } from "motion/react";

interface GaugeChartProps {
  percentage: number; // e.g. 91.5
  level: 'EXCELLENT' | 'GOOD' | 'CRITICAL';
}

export default function GaugeChart({ percentage, level }: GaugeChartProps) {
  // Convert percentage (0-100) to rotation angle in degrees for the needle.
  // The gauge arc starts at -90deg and ends at +90deg (180 deg total sweep).
  const clamped = Math.max(0, Math.min(100, percentage));
  const rotation = -90 + (clamped / 100) * 180;

  let colorClass = "text-emerald-500";
  let bgClass = "bg-emerald-50 text-emerald-700 border-emerald-200";
  let labelText = "Excelente (Consistente)";

  if (level === "CRITICAL") {
    colorClass = "text-rose-500";
    bgClass = "bg-rose-50 text-rose-700 border-rose-200";
    labelText = "Crítico (Se Requiere Acción)";
  } else if (level === "GOOD") {
    colorClass = "text-amber-500";
    bgClass = "bg-amber-50 text-amber-700 border-amber-200";
    labelText = "Bueno (Tolerable)";
  }

  return (
    <div id="gauge-container" className="flex flex-col items-center justify-center p-6 bg-white rounded-xl border border-gray-100 shadow-xs h-full min-h-[300px]">
      <div className="text-sm font-semibold text-gray-400 uppercase tracking-widest mb-4">
        Confiabilidad de Stock
      </div>

      <div className="relative w-56 h-32 flex items-end justify-center overflow-hidden mb-4">
        {/* SVG background arc */}
        <svg className="absolute top-0 left-0 w-full h-full" viewBox="0 0 100 50">
          {/* Base Gray Arc */}
          <path
            d="M 10 50 A 40 40 0 0 1 90 50"
            fill="none"
            stroke="#E5E7EB"
            strokeWidth="8"
            strokeLinecap="round"
          />
          {/* Dynamic filled arc path */}
          <path
            d="M 10 50 A 40 40 0 0 1 90 50"
            fill="none"
            stroke="currentColor"
            strokeWidth="8"
            strokeLinecap="round"
            strokeDasharray="125.6"
            strokeDashoffset={125.6 - (clamped / 100) * 125.6}
            className={`${colorClass} transition-all duration-1000 ease-out`}
          />
        </svg>

        {/* Needle */}
        <div
          className="absolute bottom-0 w-1 h-20 bg-gray-800 origin-bottom transition-all duration-1000 cubic-bezier(0.17, 0.67, 0.2, 1)"
          style={{ transform: `rotate(${rotation}deg)`, bottom: "0px" }}
        >
          {/* Needle cap */}
          <div className="absolute top-0 -left-1 w-3 h-3 bg-indigo-600 rounded-full border border-white shadow-xs"></div>
        </div>

        {/* Center cap cover */}
        <div className="absolute bottom-0 w-6 h-3 bg-gray-900 rounded-t-full shadow-xs"></div>

        {/* Float Value */}
        <div className="absolute bottom-1 text-center">
          <span className="text-3xl font-extrabold text-gray-800 tracking-tight leading-none">
            {percentage}%
          </span>
        </div>
      </div>

      {/* Threshold indicator bounds */}
      <div className="flex justify-between w-full text-[10px] font-mono text-gray-400 px-6 border-b border-gray-50 pb-3 mb-3">
        <span className="text-rose-500">Crítico (&lt;85%)</span>
        <span className="text-amber-500">Bueno (85%-95%)</span>
        <span className="text-emerald-500">Excelente (95%+)</span>
      </div>

      <div className={`px-4 py-1.5 rounded-full text-xs font-bold border ${bgClass} shadow-3xs`}>
        {labelText}
      </div>

      <p className="text-[11px] text-gray-500 text-center mt-3 max-w-[200px] leading-relaxed">
        Calculado como ratio unitario de SKUs completamente libres de discrepancias.
      </p>
    </div>
  );
}
