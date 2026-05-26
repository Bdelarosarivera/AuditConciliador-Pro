import { useState, useMemo } from "react";
import { 
  Search, 
  ArrowUpDown, 
  ArrowUp, 
  ArrowDown, 
  ChevronLeft, 
  ChevronRight, 
  RotateCcw, 
  CheckCircle, 
  AlertCircle, 
  Edit3,
  Sparkles,
  SlidersHorizontal,
  FolderOpen
} from "lucide-react";
import { InventoryItem } from "../types";

interface InteractiveTableProps {
  items: InventoryItem[];
  onUpdateItem: (updatedItem: InventoryItem) => void;
  onResetItems: () => void;
}

type SortField = 'codigo' | 'descripcion' | 'fisico' | 'teorico' | 'diferencia' | 'costo' | 'diferenciaRD' | 'familia' | 'clasificacion';
type SortOrder = 'asc' | 'desc' | null;

export default function InteractiveTable({ items, onUpdateItem, onResetItems }: InteractiveTableProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [discrepancyFilter, setDiscrepancyFilter] = useState<"ALL" | "FALTANTES" | "SOBRANTES" | "NOCENT">("ALL");
  const [abcFilter, setAbcFilter] = useState<"ALL" | "A" | "B" | "C">("ALL");
  const [familyFilter, setFamilyFilter] = useState("ALL");
  
  // Sorting state
  const [sortField, setSortField] = useState<SortField>('clasificacion');
  const [sortOrder, setSortOrder] = useState<SortOrder>('asc');

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);

  // Edit State
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editFisico, setEditFisico] = useState<number>(0);
  const [editCosto, setEditCosto] = useState<number>(0);

  // Get dynamic unique families listing from active items
  const uniqueFamilies = useMemo(() => {
    const families = items.map(item => item.familia);
    return ["ALL", ...Array.from(new Set(families))];
  }, [items]);

  // Handle cell inline double-click/pencil click edits
  const startEditing = (item: InventoryItem) => {
    setEditingId(item.id);
    setEditFisico(item.fisico);
    setEditCosto(item.costo);
  };

  const saveCellEdit = (item: InventoryItem) => {
    const fisicoNum = Number(editFisico) || 0;
    const costoNum = Number(editCosto) || 0;
    const diferencia = fisicoNum - item.teorico;
    const diferenciaRD = diferencia * costoNum;

    onUpdateItem({
      ...item,
      fisico: fisicoNum,
      costo: costoNum,
      diferencia,
      diferenciaRD,
    });
    setEditingId(null);
  };

  // Handle Sort triggers
  const triggerSort = (field: SortField) => {
    if (sortField === field) {
      if (sortOrder === 'asc') setSortOrder('desc');
      else if (sortOrder === 'desc') {
        setSortField('clasificacion');
        setSortOrder('asc'); // Back to default
      }
    } else {
      setSortField(field);
      setSortOrder('asc');
    }
  };

  // Reset all filters in one click
  const clearFilters = () => {
    setSearchTerm("");
    setDiscrepancyFilter("ALL");
    setAbcFilter("ALL");
    setFamilyFilter("ALL");
    setCurrentPage(1);
  };

  const formatRD = (value: number) => {
    return new Intl.NumberFormat("es-DO", {
      style: "currency",
      currency: "DOP",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value).replace("DOP", "RD$");
  };

  // Filter & Sort Logic
  const processedItems = useMemo(() => {
    return items
      .filter((item) => {
        // Search term
        const searchLow = searchTerm.toLowerCase();
        const matchesSearch = 
          item.codigo.toLowerCase().includes(searchLow) ||
          item.descripcion.toLowerCase().includes(searchLow) ||
          item.familia.toLowerCase().includes(searchLow);

        // Discrepancy
        let matchesDiscrepancy = true;
        if (discrepancyFilter === "FALTANTES") matchesDiscrepancy = item.diferencia < 0;
        else if (discrepancyFilter === "SOBRANTES") matchesDiscrepancy = item.diferencia > 0;
        else if (discrepancyFilter === "NOCENT") matchesDiscrepancy = item.diferencia === 0;

        // ABC
        const matchesABC = abcFilter === "ALL" || item.clasificacion === abcFilter;

        // Family
        const matchesFamily = familyFilter === "ALL" || item.familia === familyFilter;

        return matchesSearch && matchesDiscrepancy && matchesABC && matchesFamily;
      })
      .sort((a, b) => {
        if (!sortField || !sortOrder) return 0;
        
        let valA = a[sortField];
        let valB = b[sortField];

        if (typeof valA === "string" && typeof valB === "string") {
          return sortOrder === 'asc' 
            ? valA.localeCompare(valB) 
            : valB.localeCompare(valA);
        }

        // Numbers
        const numA = Number(valA) || 0;
        const numB = Number(valB) || 0;
        return sortOrder === 'asc' ? numA - numB : numB - numA;
      });
  }, [items, searchTerm, discrepancyFilter, abcFilter, familyFilter, sortField, sortOrder]);

  // Pagination bounds calculated against processed list
  const paginatedItems = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    return processedItems.slice(startIndex, startIndex + itemsPerPage);
  }, [processedItems, currentPage, itemsPerPage]);

  const totalPages = Math.max(1, Math.ceil(processedItems.length / itemsPerPage));

  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-xs overflow-hidden">
      {/* Search and Filters top bar */}
      <div className="p-5 border-b border-gray-100 space-y-4 bg-slate-50/50">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="relative flex-1 max-w-md">
            <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-gray-400">
              <Search className="w-4 h-4" />
            </span>
            <input
              type="text"
              placeholder="Buscar por código, descripción o categoría..."
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full pl-10 pr-4 py-2 bg-white border border-gray-200 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-100 rounded-lg text-xs transition-all shadow-3xs"
            />
          </div>

          <div className="flex flex-wrap items-center gap-2 text-xs">
            <button
              onClick={clearFilters}
              className="px-3 py-2 bg-white hover:bg-gray-50 border border-gray-200 text-gray-600 rounded-lg flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Restablecer Filtros</span>
            </button>
            <button
              onClick={onResetItems}
              className="px-3 py-2 bg-white hover:bg-rose-50 border border-rose-100 text-rose-600 rounded-lg flex items-center gap-1.5 transition-colors cursor-pointer"
              title="Restaurar el conteo original"
            >
              <span>Revertir Cambios</span>
            </button>
          </div>
        </div>

        {/* Filters Select Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {/* Discrepancy Filter */}
          <div className="space-y-1">
            <label className="text-[10px] uppercase font-bold text-gray-400 tracking-wider">Estado de Diferencia</label>
            <select
              value={discrepancyFilter}
              onChange={(e) => {
                setDiscrepancyFilter(e.target.value as any);
                setCurrentPage(1);
              }}
              className="w-full p-2 bg-white border border-gray-200 focus:border-indigo-500 rounded-lg text-xs"
            >
              <option value="ALL">🔍 Mostrar Todos los Registros</option>
              <option value="FALTANTES">🔴 Faltantes (Negativas / Pérdida)</option>
              <option value="SOBRANTES">🟢 Sobrantes (Positivas / Excesos)</option>
              <option value="NOCENT">⚪ Sin Discrepancia (Cuadrados)</option>
            </select>
          </div>

          {/* ABC Classification Filter */}
          <div className="space-y-1">
            <label className="text-[10px] uppercase font-bold text-gray-400 tracking-wider">Clasificación ABC</label>
            <select
              value={abcFilter}
              onChange={(e) => {
                setAbcFilter(e.target.value as any);
                setCurrentPage(1);
              }}
              className="w-full p-2 bg-white border border-gray-200 focus:border-indigo-500 rounded-lg text-xs"
            >
              <option value="ALL">⭐ Todas las Clasificaciones</option>
              <option value="A">Clase A (Alto Costo / Críticos)</option>
              <option value="B">Clase B (Rotación Media)</option>
              <option value="C">Clase C (Bajo Valor)</option>
            </select>
          </div>

          {/* Dynamic Family Filter */}
          <div className="space-y-1">
            <label className="text-[10px] uppercase font-bold text-gray-400 tracking-wider">Familia o Categoría</label>
            <select
              value={familyFilter}
              onChange={(e) => {
                setFamilyFilter(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full p-2 bg-white border border-gray-200 focus:border-indigo-500 rounded-lg text-xs uppercase"
            >
              <option value="ALL">📦 Todas las Categorías</option>
              {uniqueFamilies.filter(f => f !== "ALL").map(f => (
                <option key={f} value={f}>{f}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Main Table Layout */}
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse min-w-[1000px]">
          <thead>
            <tr className="bg-slate-100 text-[10px] font-bold text-slate-600 uppercase tracking-wider border-b border-gray-200">
              <th className="py-3 px-4 text-center cursor-pointer select-none hover:bg-slate-200" onClick={() => triggerSort('codigo')}>
                <div className="flex items-center justify-center gap-1.5">
                  Código
                  <ArrowUpDown className="w-3 h-3 text-slate-400" />
                </div>
              </th>
              <th className="py-3 px-4 cursor-pointer select-none hover:bg-slate-200" onClick={() => triggerSort('descripcion')}>
                <div className="flex items-center gap-1.5">
                  Artículo / Descripción
                  <ArrowUpDown className="w-3 h-3 text-slate-400" />
                </div>
              </th>
              <th className="py-3 px-3 text-center">Unidad</th>
              <th className="py-3 px-4 text-right cursor-pointer select-none hover:bg-slate-200" onClick={() => triggerSort('fisico')}>
                <div className="flex items-center justify-end gap-1.5">
                  Físico (Conteo)
                  <ArrowUpDown className="w-3 h-3 text-slate-400" />
                </div>
              </th>
              <th className="py-3 px-4 text-right cursor-pointer select-none hover:bg-slate-200" onClick={() => triggerSort('teorico')}>
                <div className="flex items-center justify-end gap-1.5">
                  Teórico (SAP)
                  <ArrowUpDown className="w-3 h-3 text-slate-400" />
                </div>
              </th>
              <th className="py-3 px-4 text-right cursor-pointer select-none hover:bg-slate-200" onClick={() => triggerSort('diferencia')}>
                <div className="flex items-center justify-end gap-1.5">
                  Diferencia
                  <ArrowUpDown className="w-3 h-3 text-slate-400" />
                </div>
              </th>
              <th className="py-3 px-4 text-right cursor-pointer select-none hover:bg-slate-200" onClick={() => triggerSort('costo')}>
                <div className="flex items-center justify-end gap-1.5">
                  Costo Unitario
                  <ArrowUpDown className="w-3 h-3 text-slate-400" />
                </div>
              </th>
              <th className="py-3 px-4 text-right cursor-pointer select-none hover:bg-slate-200" onClick={() => triggerSort('diferenciaRD')}>
                <div className="flex items-center justify-end gap-1.5">
                  Dif. Peso (RD$)
                  <ArrowUpDown className="w-3 h-3 text-slate-400" />
                </div>
              </th>
              <th className="py-3 px-4 cursor-pointer select-none hover:bg-slate-200" onClick={() => triggerSort('familia')}>
                <div className="flex items-center gap-1.5">
                  Familia
                  <ArrowUpDown className="w-3 h-3 text-slate-400" />
                </div>
              </th>
              <th className="py-3 px-4 text-center cursor-pointer select-none hover:bg-slate-200" onClick={() => triggerSort('clasificacion')}>
                <div className="flex items-center justify-center gap-1.5">
                  ABC
                  <ArrowUpDown className="w-3 h-3 text-slate-400" />
                </div>
              </th>
              <th className="py-3 px-3 text-center text-[9px]">Acciones</th>
            </tr>
          </thead>

          <tbody className="divide-y divide-gray-100 text-xs">
            {paginatedItems.length === 0 ? (
              <tr>
                <td colSpan={11} className="py-12 text-center text-gray-500 italic bg-gray-50/20">
                  <div className="flex flex-col items-center justify-center gap-2">
                    <FolderOpen className="w-10 h-10 text-gray-300 stroke-[1.5]" />
                    <span>No se encontraron artículos con los filtros aplicados.</span>
                  </div>
                </td>
              </tr>
            ) : (
              paginatedItems.map((item) => {
                const isEditing = editingId === item.id;
                const statusColor = item.diferencia < 0 
                  ? "bg-rose-50 text-rose-800" 
                  : item.diferencia > 0 
                  ? "bg-emerald-50 text-emerald-800" 
                  : "bg-gray-50 text-gray-500";

                return (
                  <tr 
                    key={item.id} 
                    className={`hover:bg-slate-50/60 transition-colors ${
                      item.diferencia < 0 ? "bg-red-50/15" : item.diferencia > 0 ? "bg-emerald-50/10" : ""
                    }`}
                  >
                    {/* Código */}
                    <td className="py-3 px-4 font-mono font-semibold text-gray-600 text-center">
                      {item.codigo}
                    </td>

                    {/* Descripción */}
                    <td className="py-3 px-4 font-medium text-gray-800">
                      <div>{item.descripcion}</div>
                    </td>

                    {/* Unidad */}
                    <td className="py-3 px-3 text-center text-gray-500 font-medium">
                      {item.unidad}
                    </td>

                    {/* Físico (Editable) */}
                    <td className="py-3 px-4 text-right font-mono font-bold">
                      {isEditing ? (
                        <input
                          type="number"
                          value={editFisico}
                          onChange={(e) => setEditFisico(Math.max(0, parseInt(e.target.value) || 0))}
                          className="w-20 px-2 py-1 border border-indigo-400 rounded-md text-right text-xs bg-white text-gray-900 focus:outline-hidden"
                          autoFocus
                          onKeyDown={(e) => e.key === 'Enter' && saveCellEdit(item)}
                        />
                      ) : (
                        <span 
                          onClick={() => startEditing(item)} 
                          className="cursor-pointer hover:underline decoration-dashed decoration-indigo-400 text-indigo-700 font-bold"
                          title="Haz clic para editar conteo"
                        >
                          {item.fisico.toLocaleString()}
                        </span>
                      )}
                    </td>

                    {/* Teórico */}
                    <td className="py-3 px-4 text-right font-mono text-gray-500">
                      {item.teorico.toLocaleString()}
                    </td>

                    {/* Diferencia */}
                    <td className={`py-3 px-4 text-right font-mono font-bold`}>
                      <span className={`px-2 py-0.5 rounded-sm ${statusColor}`}>
                        {item.diferencia > 0 ? "+" : ""}{item.diferencia.toLocaleString()}
                      </span>
                    </td>

                    {/* Costo Unitario (Editable) */}
                    <td className="py-3 px-4 text-right font-mono">
                      {isEditing ? (
                        <input
                          type="number"
                          value={editCosto}
                          onChange={(e) => setEditCosto(Math.max(0, parseFloat(e.target.value) || 0))}
                          className="w-24 px-2 py-1 border border-indigo-400 rounded-md text-right text-xs bg-white text-gray-900 focus:outline-hidden"
                          onKeyDown={(e) => e.key === 'Enter' && saveCellEdit(item)}
                        />
                      ) : (
                        <span 
                          onClick={() => startEditing(item)}
                          className="cursor-pointer hover:underline text-gray-700"
                          title="Haz clic para editar costo unitario"
                        >
                          {formatRD(item.costo)}
                        </span>
                      )}
                    </td>

                    {/* Diferencia RD$ */}
                    <td className={`py-3 px-4 text-right font-mono font-bold ${
                      item.diferenciaRD < 0 ? "text-rose-600" : item.diferenciaRD > 0 ? "text-emerald-600" : "text-gray-400"
                    }`}>
                      {item.diferenciaRD > 0 ? "+" : ""}{formatRD(item.diferenciaRD)}
                    </td>

                    {/* Familia */}
                    <td className="py-3 px-4 text-gray-500 uppercase text-[11px] font-sans">
                      {item.familia}
                    </td>

                    {/* Clasificación ABC */}
                    <td className="py-3 px-4 text-center">
                      <span className={`inline-flex items-center justify-center w-6 h-6 rounded-full text-[10px] font-extrabold ${
                        item.clasificacion === 'A' 
                          ? 'bg-rose-100 text-rose-800 border border-rose-200' 
                          : item.clasificacion === 'B' 
                          ? 'bg-amber-100 text-amber-800 border border-amber-200' 
                          : 'bg-slate-100 text-slate-700 border border-slate-200'
                      }`}>
                        {item.clasificacion}
                      </span>
                    </td>

                    {/* Acciones */}
                    <td className="py-3 px-3 text-center">
                      {isEditing ? (
                        <button
                          onClick={() => saveCellEdit(item)}
                          className="p-1 text-emerald-600 hover:text-emerald-700 font-bold hover:bg-emerald-50 rounded cursor-pointer"
                          title="Guardar"
                        >
                          <CheckCircle className="w-4 h-4" />
                        </button>
                      ) : (
                        <button
                          onClick={() => startEditing(item)}
                          className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-slate-50 rounded cursor-pointer transition-colors"
                          title="Modificar valores"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination Controls bar */}
      <div className="p-4 border-t border-gray-100 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-slate-50/30 text-xs text-gray-500">
        <div className="flex items-center gap-1.5">
          <span>{processedItems.length} SKUs encontrados. Mostrar</span>
          <select
            value={itemsPerPage}
            onChange={(e) => {
              setItemsPerPage(parseInt(e.target.value));
              setCurrentPage(1);
            }}
            className="p-1 bg-white border border-gray-200 rounded-md text-xs py-0.5"
          >
            <option value={5}>5 por pág.</option>
            <option value={10}>10 por pág.</option>
            <option value={20}>20 por pág.</option>
            <option value={50}>50 por pág.</option>
          </select>
        </div>

        <div className="flex items-center gap-2 self-end">
          <button
            onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
            disabled={currentPage === 1}
            className="p-1 px-1.5 bg-white border border-gray-200 hover:bg-gray-50 rounded-md disabled:opacity-40 select-none cursor-pointer"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <span>Página <strong className="text-gray-900 font-bold">{currentPage}</strong> de {totalPages}</span>
          <button
            onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
            disabled={currentPage === totalPages}
            className="p-1 px-1.5 bg-white border border-gray-200 hover:bg-gray-50 rounded-md disabled:opacity-40 select-none cursor-pointer"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
