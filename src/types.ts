export interface InventoryItem {
  id: string; // unique item identifier
  codigo: string;
  descripcion: string;
  unidad: string;
  fisico: number;
  teorico: number;
  diferencia: number; // fisico - teorico
  costo: number; // cost per unit in RD$
  diferenciaRD: number; // diferencia * costo
  familia: string;
  clasificacion: 'A' | 'B' | 'C' | string;
  usuario: string;
  fecha: string;
}

export type ReliabilityLevel = 'EXCELLENT' | 'GOOD' | 'CRITICAL';

export interface AuditSummary {
  totalArticulos: number;
  conDiferencia: number;
  sinDiferencia: number;
  diferenciasPositivas: number; // Total value of positive differences in RD$
  diferenciasNegativas: number; // Total value of negative differences in RD$ (magnitude)
  diferenciaNeta: number; // Net financial adjustment (RD$)
  valorTotalFisico: number; // Total physical count asset value
  valorTotalTeorico: number; // Total theoretical count asset value
  confiabilidad: number; // Percentage: ((Total correctos / Total auditados) * 100)
  confiabilidadNivel: ReliabilityLevel;
  totalErrores: number; // Number of items with differences
  exactitudMonto: number; // 100 - (abs(DiferenciaNeta) / valorTotalTeorico * 100)
}

export interface ExecutiveReport {
  titulo: string;
  fecha: string;
  resumenEjecutivo: string;
  impactoEconomico: string;
  analisisFamilias: { familia: string; impacto: number; cantidad: number }[];
  diferenciasCriticas: { codigo: string; descripcion: string; diferenciaRD: number; diferencia: number }[];
  recomendaciones: string[];
}

export type ProcessingState =
  | 'idle'
  | 'uploading'
  | 'detecting'
  | 'ocr_reading'
  | 'data_extracting'
  | 'excel_generating'
  | 'finalized'
  | 'error';

export interface ProcessResponse {
  success: boolean;
  isScanned: boolean;
  status: string;
  data: InventoryItem[];
  summary: AuditSummary;
  report: ExecutiveReport;
  fileName: string;
  fileSizeText: string;
  pagesCount: number;
  error?: string;
}
