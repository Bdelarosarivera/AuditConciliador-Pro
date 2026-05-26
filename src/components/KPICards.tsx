import { motion } from "motion/react";
import { 
  ClipboardCheck, 
  TrendingUp, 
  TrendingDown, 
  DollarSign, 
  AlertTriangle, 
  Coins, 
  CheckCircle2, 
  ShieldCheck 
} from "lucide-react";
import { AuditSummary } from "../types";

interface KPICardsProps {
  summary: AuditSummary;
}

export default function KPICards({ summary }: KPICardsProps) {
  const formatRD = (value: number) => {
    return new Intl.NumberFormat("es-DO", {
      style: "currency",
      currency: "DOP",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value).replace("DOP", "RD$");
  };

  const cards = [
    {
      id: "kpi-total-articles",
      title: "Artículos Auditados",
      value: summary.totalArticulos,
      formatted: `${summary.totalArticulos} SKUs`,
      desc: `${summary.sinDiferencia} correctos • ${summary.conDiferencia} con cambios`,
      icon: ClipboardCheck,
      color: "border-slate-100 text-slate-700 bg-slate-50/50",
      accent: "text-slate-600",
    },
    {
      id: "kpi-reliability",
      title: "Confiabilidad de Stock",
      value: summary.confiabilidad,
      formatted: `${summary.confiabilidad}%`,
      desc: `Nivel: ${summary.confiabilidadNivel}`,
      icon: ShieldCheck,
      color: 
        summary.confiabilidadNivel === "EXCELLENT" 
          ? "border-emerald-100 text-emerald-700 bg-emerald-50/25" 
          : summary.confiabilidadNivel === "GOOD"
          ? "border-amber-100 text-amber-700 bg-amber-50/25"
          : "border-rose-100 text-rose-700 bg-rose-50/25",
      accent: 
        summary.confiabilidadNivel === "EXCELLENT" 
          ? "text-emerald-500" 
          : summary.confiabilidadNivel === "GOOD"
          ? "text-amber-500"
          : "text-rose-500",
    },
    {
      id: "kpi-exactitud",
      title: "Exactitud del Monto",
      value: summary.exactitudMonto,
      formatted: `${summary.exactitudMonto}%`,
      desc: "Desviación vs Valor Teórico",
      icon: CheckCircle2,
      color: summary.exactitudMonto >= 95 ? "border-teal-100 text-teal-700 bg-teal-50/25" : "border-amber-100 text-amber-700 bg-amber-50/25",
      accent: "text-teal-500",
    },
    {
      id: "kpi-positives",
      title: "Diferencias Positivas (Sobrantes)",
      value: summary.diferenciasPositivas,
      formatted: formatRD(summary.diferenciasPositivas),
      desc: "Excedentes físicos detectados",
      icon: TrendingUp,
      color: "border-emerald-100 text-emerald-800 bg-emerald-50/25",
      accent: "text-emerald-500",
    },
    {
      id: "kpi-negatives",
      title: "Diferencias Negativas (Faltantes)",
      value: summary.diferenciasNegativas,
      formatted: `-${formatRD(summary.diferenciasNegativas)}`,
      desc: "Pérdida/Faltante valorado",
      icon: TrendingDown,
      color: "border-rose-100 text-rose-800 bg-rose-50/25",
      accent: "text-rose-500",
    },
    {
      id: "kpi-net",
      title: "Impacto Neto en Inventario",
      value: summary.diferenciaNeta,
      formatted: (summary.diferenciaNeta >= 0 ? "+" : "") + formatRD(summary.diferenciaNeta),
      desc: "Valor neto para ajuste contable",
      icon: DollarSign,
      color: summary.diferenciaNeta >= 0 ? "border-blue-100 text-blue-800 bg-blue-50/25" : "border-rose-100 text-rose-800 bg-rose-50/25",
      accent: summary.diferenciaNeta >= 0 ? "text-blue-500" : "text-rose-500",
    },
    {
      id: "kpi-errors",
      title: "Discrepancias (Errores)",
      value: summary.totalErrores,
      formatted: `${summary.totalErrores} SKUs`,
      desc: "Items con diferencia física != 0",
      icon: AlertTriangle,
      color: "border-amber-100 text-amber-800 bg-amber-50/25",
      accent: "text-amber-500",
    },
    {
      id: "kpi-total-val-teo",
      title: "Valor Teórico Total (SAP)",
      value: summary.valorTotalTeorico,
      formatted: formatRD(summary.valorTotalTeorico),
      desc: "Activo total registrado",
      icon: Coins,
      color: "border-slate-100 text-slate-800 bg-slate-50/50",
      accent: "text-slate-500",
    },
  ];

  const containerVariants = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: {
        staggerChildren: 0.05,
      },
    },
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 10 },
    show: { opacity: 1, y: 0 },
  };

  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="show"
      className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4"
    >
      {cards.map((card) => (
        <motion.div
          key={card.id}
          id={card.id}
          variants={itemVariants}
          whileHover={{ y: -2, transition: { duration: 0.1 } }}
          className={`relative p-5 bg-white rounded-xl border ${card.color} shadow-3xs flex flex-col justify-between transition-shadow hover:shadow-2xs`}
        >
          <div className="flex items-start justify-between">
            <div className="space-y-1">
              <span className="text-xs font-semibold text-gray-500 tracking-wide uppercase">
                {card.title}
              </span>
              <div className="text-2xl font-extrabold text-gray-900 tracking-tight">
                {card.formatted}
              </div>
            </div>
            <div className={`p-2 rounded-lg bg-white shadow-3xs ${card.accent}`}>
              <card.icon className="w-5 h-5 stroke-[2]" />
            </div>
          </div>
          <div className="mt-4 pt-3 border-t border-gray-100/60 flex items-center justify-between text-xs text-gray-500">
            <span>{card.desc}</span>
          </div>
        </motion.div>
      ))}
    </motion.div>
  );
}
