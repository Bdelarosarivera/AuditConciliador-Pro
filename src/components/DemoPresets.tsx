import { 
  Building2, 
  Tv2, 
  Activity, 
  ShoppingBag,
  Sparkles,
  CheckCircle2
} from "lucide-react";

interface DemoPresetsProps {
  onLoadPreset: (presetType: "farmacia" | "electronica" | "general", name: string) => void;
  isLoading: boolean;
}

export default function DemoPresets({ onLoadPreset, isLoading }: DemoPresetsProps) {
  const presets = [
    {
      id: "farmacia",
      name: "Farmacia & Medicamentos Médicos",
      desc: "Lote de alta regulación con medicamentos controlados, suplementos, termómetros y diferencias de alto costo unitario.",
      icon: Activity,
      themeColor: "text-rose-600 bg-rose-50 border-rose-100",
      pillText: "Alta Regulación RD$",
    },
    {
      id: "electronica",
      name: "Distribuidora de Tecnología Pro",
      desc: "Productos de alto valor con incidencias críticas en Laptops, iPhones y SSDs selectos. Ideal para análisis ABC.",
      icon: Tv2,
      themeColor: "text-indigo-600 bg-indigo-50 border-indigo-100",
      pillText: "Alto Valor Unitario",
    },
    {
      id: "general",
      name: "Almacén Mayorista FMCG",
      desc: "Auditoría de volumen de alimentos, bebidas alcohólicas finas y artículos del hogar con márgenes logísticos típicos.",
      icon: ShoppingBag,
      themeColor: "text-emerald-600 bg-emerald-50 border-emerald-100",
      pillText: "Consumo Masivo",
    },
  ];

  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-xs p-6 space-y-4">
      <div className="flex items-center gap-2">
        <Sparkles className="w-5 h-5 text-indigo-600" />
        <h3 className="text-sm font-bold text-gray-800 uppercase tracking-wider">
          Probar con Modelos de Datos Reales (Presets)
        </h3>
      </div>
      <p className="text-xs text-gray-500 leading-relaxed font-sans max-w-2xl">
        ¿No tienes un PDF de inventario a mano? Elige uno de nuestros presets industriales optimizados para simular instantáneamente un flujo real de OCR, reconstrucción de tablas y análisis financiero:
      </p>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
        {presets.map((preset) => (
          <div
            key={preset.id}
            onClick={() => !isLoading && onLoadPreset(preset.id as any, preset.name)}
            className={`p-4 rounded-xl border border-gray-100 hover:border-indigo-400 hover:shadow-2xs transition-all flex flex-col justify-between text-left group cursor-pointer ${
              isLoading ? "opacity-50 pointer-events-none" : ""
            }`}
          >
            <div className="space-y-3">
              <div className="flex items-center justify-between gap-2">
                <span className={`p-2 rounded-lg border ${preset.themeColor} shrink-0`}>
                  <preset.icon className="w-4 h-4 stroke-[2]" />
                </span>
                <span className="text-[9px] font-bold uppercase tracking-wider bg-gray-100 text-gray-600 px-2 py-0.5 rounded-sm">
                  {preset.pillText}
                </span>
              </div>
              <div className="space-y-1">
                <h4 className="text-xs font-bold text-gray-800 group-hover:text-indigo-600 transition-colors">
                  {preset.name}
                </h4>
                <p className="text-[11px] text-gray-500 leading-relaxed font-sans line-clamp-3">
                  {preset.desc}
                </p>
              </div>
            </div>

            <div className="mt-4 pt-3 border-t border-gray-50 flex items-center justify-between text-[11px] font-semibold text-indigo-600 group-hover:underline">
              <span>Cargar Plantilla Demo</span>
              <CheckCircle2 className="w-4 h-4 text-gray-300 group-hover:text-indigo-500 transition-colors" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
