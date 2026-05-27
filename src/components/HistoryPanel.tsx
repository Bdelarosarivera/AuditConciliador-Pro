import React, { useEffect, useState } from "react";
import { 
  subscribeToAudits, 
  deleteAuditFromCloud, 
  getAuditItemsFromCloud,
  DBReviewAudit 
} from "../services/firebaseService";
import { useAuth } from "../context/AuthContext";
import { 
  History, 
  Search, 
  Filter, 
  CloudDownload, 
  Trash2, 
  Calendar, 
  MapPin, 
  ArrowUpRight, 
  FolderCheck,
  Award,
  AlertTriangle,
  PlayCircle
} from "lucide-react";
import { InventoryItem, AuditSummary, ExecutiveReport } from "../types";

interface HistoryPanelProps {
  onLoadAuditToDashboard: (
    items: InventoryItem[],
    summary: AuditSummary,
    report: ExecutiveReport | null,
    fileMetadata: { name: string; sizeText: string; totalPages: number }
  ) => void;
  addToast: (text: string, type: "success" | "info" | "error" | "warning") => void;
}

export default function HistoryPanel({ onLoadAuditToDashboard, addToast }: HistoryPanelProps) {
  const { userProfile } = useAuth();
  const [audits, setAudits] = useState<DBReviewAudit[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedWarehouse, setSelectedWarehouse] = useState("all");
  const [selectedAccuracyRange, setSelectedAccuracyRange] = useState("all");
  const [loadingAuditId, setLoadingAuditId] = useState<string | null>(null);

  useEffect(() => {
    // Realtime Sync from Firestore
    const unsubscribe = subscribeToAudits(
      (data) => {
        setAudits(data);
        setLoading(false);
      },
      (err) => {
        addToast(`Fallo carga histórica: ${err.message || err}`, "error");
        setLoading(false);
      }
    );
    return () => unsubscribe();
  }, []);

  const handleDelete = async (auditId: string) => {
    if (userProfile?.role !== "Admin") {
      addToast("Solo administradores pueden eliminar registros históricos de auditoría.", "error");
      return;
    }
    if (!window.confirm("¿Está seguro de eliminar permanentemente esta auditoría y todos sus SKUs de la base de datos?")) {
      return;
    }

    try {
      await deleteAuditFromCloud(auditId);
      addToast("Auditoría eliminada de la nube de forma permanente.", "success");
    } catch (err: any) {
      addToast(`Error eliminando registro: ${err.message || err}`, "error");
    }
  };

  const handleLoadToDashboard = async (audit: DBReviewAudit) => {
    setLoadingAuditId(audit.id);
    try {
      // Fetch nested SKU items from sub-collection in real-time
      const fetchedItems = await getAuditItemsFromCloud(audit.id);
      
      const fileMetadata = {
        name: audit.auditName.endsWith(".pdf") ? audit.auditName : `${audit.auditName}.pdf`,
        sizeText: "Nube de datos S3",
        totalPages: Math.ceil(fetchedItems.length / 10) || 1,
      };

      // Compile report structure from data
      const executiveReport: ExecutiveReport = {
        titulo: audit.auditName,
        fecha: audit.uploadedAt.split("T")[0],
        resumenEjecutivo: `Reporte de auditoría de inventario cargado de la nube. Procesado el ${new Date(audit.uploadedAt).toLocaleString("es-DO")}. Almacén: ${audit.warehouse}. Registrado por el auditor: ${audit.uploadedByName || "Auditor Autorizado"}.`,
        impactoEconomico: `La confiabilidad global se auditó en ${audit.inventoryAccuracy?.toFixed(2)}%, presentando un impacto neto de discrepancias financieras por RD$ ${audit.differenceValue?.toLocaleString("es-DO")}.`,
        analisisFamilias: [],
        diferenciasCriticas: fetchedItems
          .filter(it => Math.abs(it.diferenciaRD) > 5000)
          .map(it => ({
            codigo: it.codigo,
            descripcion: it.descripcion,
            diferenciaRD: it.diferenciaRD,
            diferencia: it.diferencia
          })),
        recomendaciones: [
          "Supervisar las familias críticas que presentan desviaciones recurrentes.",
          "Establecer arqueos rotativos de control físico para mercancías clasificadas como Tipo A.",
          "Verificar las firmas oficiales adjuntas para confirmar aprobaciones de patio."
        ]
      };

      onLoadAuditToDashboard(fetchedItems, audit.summary, executiveReport, fileMetadata);
      addToast(`Auditoría "${audit.auditName}" importada al dashboard con éxito.`, "success");
    } catch (err: any) {
      addToast(`Fallo al importar SKUs: ${err.message || err}`, "error");
    } finally {
      setLoadingAuditId(null);
    }
  };

  // Extract distinct warehouses to filter
  const warehouses = Array.from(new Set(audits.map((a) => a.warehouse || "Almacén Central RD")));

  // Filter & search logic
  const filteredAudits = audits.filter((audit) => {
    const matchesSearch =
      audit.auditName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (audit.warehouse || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
      (audit.uploadedByName || "").toLowerCase().includes(searchTerm.toLowerCase());

    const matchesWarehouse = selectedWarehouse === "all" || audit.warehouse === selectedWarehouse;

    let matchesAccuracy = true;
    if (selectedAccuracyRange === "excelente") {
      matchesAccuracy = (audit.inventoryAccuracy || 0) >= 95;
    } else if (selectedAccuracyRange === "intermedio") {
      matchesAccuracy = (audit.inventoryAccuracy || 0) >= 85 && (audit.inventoryAccuracy || 0) < 95;
    } else if (selectedAccuracyRange === "critico") {
      matchesAccuracy = (audit.inventoryAccuracy || 0) < 85;
    }

    return matchesSearch && matchesWarehouse && matchesAccuracy;
  });

  return (
    <div className="space-y-6">
      {/* Search and filter bar */}
      <div className="bg-white border border-slate-100 rounded-2xl p-4 shadow-3xs flex flex-wrap gap-4 items-center justify-between">
        <div className="flex items-center gap-2">
          <History className="w-5 h-5 text-indigo-600 shrink-0" />
          <div>
            <h2 className="text-sm font-extrabold text-slate-800 uppercase tracking-wider">Historial de Auditorías Cloud</h2>
            <p className="text-[10px] text-slate-400 font-sans">Visualiza, monitorea y consulta todo el inventario procesado en tiempo real.</p>
          </div>
        </div>

        <div className="flex flex-wrap gap-3 items-center w-full lg:w-auto">
          {/* Real Search bar */}
          <div className="relative flex-1 sm:w-64">
            <Search className="absolute left-3 top-2 text-slate-400 w-4 h-4" />
            <input
              type="text"
              placeholder="Buscar auditoría, almacén o auditor..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full text-xs font-sans bg-slate-50 border border-slate-200 rounded-lg py-1.5 pl-9 pr-4 text-slate-700 placeholder-slate-400 focus:outline-none focus:border-indigo-400 focus:bg-white"
            />
          </div>

          {/* Warehouse Dropdown */}
          <div className="flex items-center gap-1.5 min-w-[130px]">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 shrink-0">Bodega:</span>
            <select
              value={selectedWarehouse}
              onChange={(e) => setSelectedWarehouse(e.target.value)}
              className="w-full text-xs bg-slate-50 border border-slate-200 rounded-lg p-1.5 text-slate-700 focus:outline-none"
            >
              <option value="all">Todas</option>
              {warehouses.map((wh) => (
                <option key={wh} value={wh}>{wh}</option>
              ))}
            </select>
          </div>

          {/* Accuracy Dropdown */}
          <div className="flex items-center gap-1.5 min-w-[130px]">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 shrink-0">Exactitud:</span>
            <select
              value={selectedAccuracyRange}
              onChange={(e) => setSelectedAccuracyRange(e.target.value)}
              className="w-full text-xs bg-slate-50 border border-slate-200 rounded-lg p-1.5 text-slate-700 focus:outline-none"
            >
              <option value="all">Cualquiera</option>
              <option value="excelente">Excelente (≥ 95%)</option>
              <option value="intermedio">Regular (85% - 94%)</option>
              <option value="critico">Crítico (&lt; 85%)</option>
            </select>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="flex flex-col items-center justify-center py-16 bg-white border border-slate-100 rounded-2xl shadow-3xs text-center space-y-4">
          <div className="w-8 h-8 border-3 border-indigo-600 border-t-transparent rounded-full animate-spin" />
          <span className="text-xs font-bold text-slate-500 uppercase tracking-widest font-mono">
            Sincronizando con Firestore en tiempo real...
          </span>
        </div>
      ) : filteredAudits.length === 0 ? (
        <div className="py-16 bg-white border border-slate-100 rounded-2xl shadow-3xs text-center space-y-3">
          <FolderCheck className="w-12 h-12 text-slate-300 mx-auto" />
          <h3 className="text-sm font-extrabold text-slate-800 uppercase tracking-wider">No se detectaron conciliaciones</h3>
          <p className="text-xs text-slate-400 max-w-md mx-auto leading-relaxed">
            No hay registros de auditoría que coincidan con su búsqueda. Registre o cargue un nuevo PDF/CSV y presione "Guardar en la Nube" para registrarlo en Firestore.
          </p>
        </div>
      ) : (
        <div className="bg-white border border-slate-100 rounded-2xl overflow-hidden shadow-3xs">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 text-[10px] font-bold uppercase tracking-wider text-slate-500 border-b border-slate-100">
                  <th className="p-4">Auditoría / Acta</th>
                  <th className="p-4">Almacén o Bodega</th>
                  <th className="p-4">Fecha & Auditor</th>
                  <th className="p-4 text-center">SKUs</th>
                  <th className="p-4 text-right">Ajuste Neto (RD$)</th>
                  <th className="p-4 text-center">Confiabilidad (Monto)</th>
                  <th className="p-4 text-right">Descargas / Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs text-slate-600">
                {filteredAudits.map((audit) => {
                  const accuracy = audit.inventoryAccuracy;
                  const accuracyLabel = accuracy >= 95 
                    ? { bg: "bg-emerald-50 text-emerald-700 border-emerald-200", text: "Excelente", icon: Award }
                    : accuracy >= 85 
                      ? { bg: "bg-amber-50 text-amber-700 border-amber-200", text: "Regular", icon: Award }
                      : { bg: "bg-red-50 text-red-700 border-red-200", text: "Crítico", icon: AlertTriangle };
                  
                  const AccIcon = accuracyLabel.icon;

                  return (
                    <tr key={audit.id} className="hover:bg-slate-50/50 transition-colors">
                      {/* Name */}
                      <td className="p-4 font-extrabold text-slate-800 uppercase tracking-wider">
                        <div className="flex flex-col">
                          <span>{audit.auditName}</span>
                          <span className="text-[9px] text-slate-400 font-mono lower-case">ID: {audit.id}</span>
                        </div>
                      </td>

                      {/* Warehouse */}
                      <td className="p-4 font-sans text-slate-700">
                        <div className="flex items-center gap-1.5">
                          <MapPin className="w-3.5 h-3.5 text-slate-400" />
                          <span>{audit.warehouse}</span>
                        </div>
                      </td>

                      {/* Time & User */}
                      <td className="p-4 font-sans">
                        <div className="flex flex-col gap-0.5">
                          <div className="flex items-center gap-1 text-[11px] text-slate-700">
                            <Calendar className="w-3 h-3 text-slate-400" />
                            <span>{new Date(audit.uploadedAt).toLocaleString("es-DO")}</span>
                          </div>
                          <span className="text-[10px] text-indigo-600 font-bold">Por: {audit.uploadedByName || "Auditor Autorizado"}</span>
                        </div>
                      </td>

                      {/* SKUs */}
                      <td className="p-4 text-center font-mono font-bold text-slate-700">
                        {audit.totalItems}
                      </td>

                      {/* Net Adjust */}
                      <td className={`p-4 text-right font-mono font-extrabold ${audit.differenceValue === 0 ? "text-slate-500" : audit.differenceValue > 0 ? "text-emerald-600" : "text-red-500"}`}>
                        RD$ {audit.differenceValue?.toLocaleString("es-DO")}
                      </td>

                      {/* Accuracy */}
                      <td className="p-4 align-middle">
                        <div className="flex flex-col items-center justify-center gap-1.5">
                          <div className="font-mono font-black text-slate-800 text-xs">
                            {accuracy?.toFixed(1)}%
                          </div>
                          <div className={`px-2 py-0.5 rounded-full border text-[9px] font-black uppercase tracking-wider flex items-center gap-1 ${accuracyLabel.bg}`}>
                            <AccIcon className="w-2.5 h-2.5 shrink-0" />
                            <span>{accuracyLabel.text}</span>
                          </div>
                        </div>
                      </td>

                      {/* Controls */}
                      <td className="p-4 text-right">
                        <div className="flex items-center justify-end gap-2.5">
                          {/* Load button */}
                          <button
                            onClick={() => handleLoadToDashboard(audit)}
                            disabled={loadingAuditId === audit.id}
                            className="px-2.5 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-lg text-[10px] font-extrabold uppercase tracking-wider cursor-pointer flex items-center gap-1 transition-colors disabled:opacity-50"
                            title="Montar esta auditoría histórica en el visualizador"
                          >
                            <PlayCircle className="w-3.5 h-3.5" />
                            <span>{loadingAuditId === audit.id ? "Montando..." : "Mapear"}</span>
                          </button>

                          {/* PDF link */}
                          {audit.pdfUrl && (
                            <a
                              href={audit.pdfUrl}
                              target="_blank"
                              rel="noreferrer referrer"
                              className="p-1 px-2 border border-slate-200 text-slate-500 hover:text-indigo-600 hover:bg-slate-100 rounded-lg transition-all"
                              title="Descargar Acta PDF original cargada"
                            >
                              <CloudDownload className="w-3.5 h-3.5" />
                            </a>
                          )}

                          {/* Excel link */}
                          {audit.excelUrl && (
                            <a
                              href={audit.excelUrl}
                              target="_blank"
                              rel="noreferrer referrer"
                              className="p-1 px-2 border border-emerald-200 text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 rounded-lg transition-all"
                              title="Descargar Libro de Excel reconciliado"
                            >
                              <ArrowUpRight className="w-3.5 h-3.5" />
                            </a>
                          )}

                          {/* Delete button (Admin-only validation is verified by the rules) */}
                          {userProfile?.role === "Admin" && (
                            <button
                              onClick={() => handleDelete(audit.id)}
                              className="p-1.5 bg-red-50 hover:bg-red-100 text-red-600 rounded-lg transition-colors cursor-pointer"
                              title="Eliminar de la nube permanentemente (Administradores)"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="bg-slate-50 p-3 text-[10px] font-mono text-slate-400 text-center border-t border-slate-100">
            Mostrando {filteredAudits.length} conciliaciones de inventario físicamente sincronizadas con Firebase.
          </div>
        </div>
      )}
    </div>
  );
}
