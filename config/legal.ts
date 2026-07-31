export const TERMS_VERSION = process.env.LEGAL_TERMS_VERSION || "2026-01";
export const CANCELLATION_POLICY_VERSION = process.env.LEGAL_CANCELLATION_POLICY_VERSION || "2026-01";
export const LEGAL_APPROVED = process.env.LEGAL_APPROVED === "true";

export const LEGAL_PROVIDER = {
  legalName: "PILULA",
  rfc: "PIL2603204H1",
  capitalRegime: "Sociedad por Acciones Simplificada",
  taxRegime: "Régimen Simplificado de Confianza",
  legalAddress:
    "Calle Atenas 40, Interior 602, Colonia Juárez, Cuauhtémoc, Ciudad de México, C.P. 06600, México.",
  tradeName: "PÍLULA MedPlanner"
} as const;

export const REFUND_POLICY_SUMMARY =
  "Después del periodo legal aplicable, la cancelación voluntaria no genera devolución. Las transferencias, cambios de edición y excepciones se sujetan a la política vigente.";

export const CANCELLATION_RULES = [
  "Se respetan los derechos legales obligatorios aplicables.",
  "Después del periodo legal aplicable, no hay devolución por cancelación voluntaria.",
  "Médico con 30 días o más: puede solicitar una transferencia o un cambio de edición.",
  "Médico entre 29 y 7 días: solo puede solicitar transferencia.",
  "Médico con menos de 7 días o no-show: sin transferencia, cambio o devolución.",
  "El saldo es válido una sola vez, por máximo 24 meses, sujeto a disponibilidad y diferencias de precio.",
  "El pago de paciente no es transferible.",
  "Paciente con 30 días o más puede pedir un cambio sujeto a nueva valoración y aprobación.",
  "Si el equipo médico retira la aprobación y no existe alternativa segura o viable, se procesará devolución.",
  "Casos extraordinarios documentados pueden autorizar cambio.",
  "Si PÍLULA cancela definitivamente por causa imputable, devolverá el importe y respetará derechos legales."
] as const;

export function termsHash() {
  return `${TERMS_VERSION}:${CANCELLATION_POLICY_VERSION}:pilula-htw-2026`;
}

export function assertLiveLegalReady() {
  const missing: string[] = [];

  return {
    approved: LEGAL_APPROVED && missing.length === 0,
    missing
  };
}
