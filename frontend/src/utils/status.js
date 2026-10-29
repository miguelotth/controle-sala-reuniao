import {
  CalendarCheck,
  Clock3,
  AlertTriangle,
  Ban,
} from "lucide-react";

export const STATUS = {
  AGENDADA: "AGENDADA",
  STAND_BY: "STAND_BY",
  CONFLITO: "CONFLITO",
  CANCELADA: "CANCELADA",
};

export const STATUS_CONFIG = {
  AGENDADA: {
    label: "Agendada",
    color: "var(--gp-status-agendada)",
    bg: "var(--gp-status-agendada-bg)",
    icon: CalendarCheck,
  },
  STAND_BY: {
    label: "Stand by",
    color: "var(--gp-status-standby)",
    bg: "var(--gp-status-standby-bg)",
    icon: Clock3,
  },
  CONFLITO: {
    label: "Conflito",
    color: "var(--gp-status-conflito)",
    bg: "var(--gp-status-conflito-bg)",
    icon: AlertTriangle,
  },
  CANCELADA: {
    label: "Cancelada",
    color: "var(--gp-status-cancelada)",
    bg: "var(--gp-status-cancelada-bg)",
    icon: Ban,
  },
};

export const EMPRESA = {
  GREEN: "GREEN",
  MV: "MV",
  EXTERNO: "EXTERNO",
};

export const EMPRESA_CONFIG = {
  GREEN: {
    label: "Green",
    color: "var(--gp-empresa-green)",
    bg: "var(--gp-empresa-green-bg)",
  },
  MV: {
    label: "MV",
    color: "var(--gp-empresa-mv)",
    bg: "var(--gp-empresa-mv-bg)",
  },
  EXTERNO: {
    label: "Externo",
    color: "var(--gp-empresa-externo)",
    bg: "var(--gp-empresa-externo-bg)",
  },
};

export function statusConfig(status) {
  return STATUS_CONFIG[status] || STATUS_CONFIG.AGENDADA;
}

export function empresaConfig(empresa) {
  return EMPRESA_CONFIG[empresa] || EMPRESA_CONFIG.EXTERNO;
}
