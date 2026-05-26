import { motion } from "motion/react";
import { 
  FileText, 
  HelpCircle, 
  Sparkles, 
  TrendingDown, 
  FolderLock, 
  CheckSquare, 
  Printer,
  ChevronRight
} from "lucide-react";
import { ExecutiveReport } from "../types";

interface ExecutiveReportPanelProps {
  report: ExecutiveReport | null;
  onPrint?: () => void;
}

export default function ExecutiveReportPanel({ report, onPrint }: ExecutiveReportPanelProps) {
  if (!report) {
    return (
      <div className="flex flex-col items-center justify-center p-12 bg-gray-50/50 rounded-2xl border border-dashed border-gray-200 text-center min-h-[350px]">
        <FileText className="w-12 h-12 text-gray-300 mb-4 stroke-[1.5]" />
        <h3 className="text-sm font-semibold text-gray-700">No hay reporte generado</h3>
        <p className="text-xs text-gray-500 max-w-xs mt-1 leading-relaxed">
          Carga un documento de inventario o selecciona uno de nuestros presets para compilar el reporte ejecutivo de gerencia inmediatamente.
        </p>
      </div>
    );
  }

  const formatRD = (value: number) => {
    return new Intl.NumberFormat("es-DO", {
      style: "currency",
      currency: "DOP",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value).replace("DOP", "RD$");
  };

  return (
    <div id="executive-report-card" className="bg-white rounded-xl border border-gray-100 shadow-xs overflow-hidden">
      {/* Editorial Header */}
      <div className="p-6 bg-slate-900 text-white flex flex-col md:flex-row md:items-center md:justify-between border-b gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="bg-indigo-600 text-white text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-sm tracking-wide">
              Gerencial
            </span>
            <span className="text-[11px] font-mono text-slate-400">
              ID: {new Date().getFullYear()}-AUDIT-REG
            </span>
          </div>
          <h2 className="text-lg font-bold tracking-tight">
            {report.titulo}
          </h2>
          <p className="text-xs text-slate-300 flex items-center gap-1.5 font-sans">
            <span>Fecha del informe:</span>
            <span className="font-semibold text-slate-100">{report.fecha}</span>
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => window.print()}
            className="px-3.5 py-1.5 bg-slate-800 hover:bg-slate-700 active:bg-slate-950 text-slate-100 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors border border-slate-700 cursor-pointer"
          >
            <Printer className="w-3.5 h-3.5" />
            <span>Imprimir Informe</span>
          </button>
        </div>
      </div>

      <div className="p-6 md:p-8 space-y-8">
        {/* Abstract Box */}
        <div className="space-y-3">
          <div className="flex items-center gap-2 text-slate-800 font-bold text-sm tracking-wide border-b border-gray-100 pb-1.5">
            <Sparkles className="w-4 h-4 text-indigo-600" />
            <span>1. SINOPSIS EJECUTIVA DETALLADA</span>
          </div>
          <p className="text-xs text-gray-600 leading-relaxed font-sans text-justify">
            {report.resumenEjecutivo}
          </p>
        </div>

        {/* Economic Impact Card */}
        <div className="p-5 bg-amber-50/40 rounded-xl border border-amber-100 flex flex-col sm:flex-row gap-4">
          <div className="p-2.5 bg-amber-50 rounded-lg h-fit text-amber-600 self-start">
            <TrendingDown className="w-5 h-5 stroke-[2]" />
          </div>
          <div className="space-y-1.5">
            <h4 className="text-xs font-bold text-amber-900 uppercase tracking-widest">
              2. EVALUACIÓN DE IMPACTO FINANCIERO Y EXPOSICIÓN
            </h4>
            <p className="text-xs text-amber-800 leading-relaxed font-sans text-justify">
              {report.impactoEconomico}
            </p>
          </div>
        </div>

        {/* Family Breakdown & Discrepancies Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Families Table */}
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-slate-800 font-bold text-sm tracking-wide border-b border-gray-100 pb-1.5">
              <FolderLock className="w-4 h-4 text-indigo-600" />
              <span>3. VARIACIÓN SECTORIZADA POR FAMILIAS</span>
            </div>
            <div className="border border-gray-100 rounded-lg overflow-hidden">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-gray-50 text-[10px] font-bold text-gray-500 uppercase tracking-wider border-b border-gray-100">
                    <th className="py-2.5 px-3">Categoría</th>
                    <th className="py-2.5 px-3 text-center">SKUs</th>
                    <th className="py-2.5 px-3 text-right">Impacto Neto (RD$)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {report.analisisFamilias.map((fam, index) => (
                    <tr key={index} className="hover:bg-gray-50/50 transition-colors">
                      <td className="py-2.5 px-3 text-xs font-medium text-gray-700">
                        {fam.familia}
                      </td>
                      <td className="py-2.5 px-3 text-xs text-gray-500 text-center font-mono">
                        {fam.cantidad}
                      </td>
                      <td className={`py-2.5 px-3 text-xs text-right font-mono font-bold ${
                        fam.impacto < 0 ? "text-rose-600" : fam.impacto > 0 ? "text-emerald-600" : "text-gray-500"
                      }`}>
                        {fam.impacto > 0 ? "+" : ""}{formatRD(fam.impacto)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Critical Items */}
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-slate-800 font-bold text-sm tracking-wide border-b border-gray-100 pb-1.5">
              <TrendingDown className="w-4 h-4 text-rose-500" />
              <span>4. ÍTEMS CRÍTICOS PRÓXIMOS A CONCILIAR</span>
            </div>
            <div className="space-y-2">
              {report.diferenciasCriticas.length === 0 ? (
                <div className="text-xs text-gray-500 italic p-4 text-center border border-dashed rounded-lg">
                  Ninguna discrepancia crítica registrada.
                </div>
              ) : (
                report.diferenciasCriticas.map((item, index) => (
                  <div
                    key={index}
                    className="p-3 rounded-lg border border-rose-100/60 bg-rose-50/10 hover:bg-rose-50/20 transition-colors flex items-center justify-between gap-4"
                  >
                    <div className="space-y-0.5">
                      <span className="text-[10px] font-mono font-bold text-rose-600 bg-rose-50 px-1.5 py-0.5 rounded">
                        {item.codigo}
                      </span>
                      <h5 className="text-xs font-medium text-gray-700 line-clamp-1">
                        {item.descripcion}
                      </h5>
                    </div>
                    <div className="text-right shrink-0">
                      <span className={`text-xs font-bold font-mono ${item.diferenciaRD < 0 ? "text-rose-600" : "text-emerald-600"}`}>
                        {item.diferenciaRD < 0 ? "" : "+"}{formatRD(item.diferenciaRD)}
                      </span>
                      <p className="text-[9px] text-gray-400 font-mono">
                        Dif: {item.diferencia > 0 ? "+" : ""}{item.diferencia}
                      </p>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Actionable Recommendations */}
        <div className="space-y-4 pt-4 border-t border-gray-100">
          <div className="flex items-center gap-2 text-slate-800 font-bold text-sm tracking-wide">
            <CheckSquare className="w-4 h-4 text-indigo-600" />
            <span>5. PLAN DE ACCIÓN Y RECOMENDACIONES PREDICTIVAS</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
            {report.recomendaciones.map((rec, index) => (
              <div 
                key={index}
                className="p-3.5 bg-slate-50 border border-slate-100/60 rounded-lg flex items-start gap-2.5 hover:border-indigo-100/80 transition-shadow hover:shadow-3xs"
              >
                <div className="flex items-center justify-center p-1 font-mono text-[10px] font-extrabold text-indigo-600 bg-indigo-50 border border-indigo-100 rounded-sm shrink-0 w-5 h-5 mt-0.5">
                  {index + 1}
                </div>
                <p className="text-xs text-gray-600 leading-relaxed font-sans">
                  {rec}
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
