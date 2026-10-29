// Aviso imediato no formulário de reserva: horário passado ou ocupado.
// Espelha as regras do backend (reservasController), que continua sendo
// quem decide de verdade ao salvar.

import { toISODate, timeToMinutes, formatTime } from "./date";

const NOME_EMPRESA = { GREEN: "Green", MV: "MV", EXTERNO: "Externo" };

function hhmmAgora(agora) {
  return `${String(agora.getHours()).padStart(2, "0")}:${String(agora.getMinutes()).padStart(2, "0")}`;
}

/** Igual ao backend: a prioridade só vale com MAIS de 24h até o início */
function prioridadeNoPrazo(data, horaInicio, agora) {
  const [a, m, d] = data.split("-").map(Number);
  const [h, min] = horaInicio.split(":").map(Number);
  const inicio = new Date(a, m - 1, d, h, min);
  return inicio.getTime() - agora.getTime() > 24 * 60 * 60 * 1000;
}

/**
 * @param form            { data, hora_inicio, hora_fim, empresa }
 * @param reservasDoDia   reservas da mesma data vindas da API
 * @param opcoes.ignorarId    id da reserva em edição (não conflita consigo)
 * @param opcoes.checarPassado false na edição quando data/início não mudaram
 * @returns null (ainda incompleto) ou { tipo: "ok" | "aviso" | "erro", titulo, detalhe, conflitos }
 */
export function avaliarHorario(form, reservasDoDia, { ignorarId = null, checarPassado = true, agora = new Date() } = {}) {
  const { data, hora_inicio, hora_fim, empresa } = form;
  if (!data || !hora_inicio) return null;

  if (checarPassado) {
    const hoje = toISODate(agora);
    if (data < hoje) {
      return { tipo: "erro", titulo: "Essa data já passou", detalhe: "Escolha hoje ou uma data futura.", conflitos: [] };
    }
    const agoraHHMM = hhmmAgora(agora);
    if (data === hoje && hora_inicio < agoraHHMM) {
      return {
        tipo: "erro",
        titulo: "Esse horário já passou",
        detalhe: `Agora são ${agoraHHMM}. Escolha um início a partir desse horário.`,
        conflitos: [],
      };
    }
  }

  if (!hora_fim || hora_fim <= hora_inicio) return null;

  const ini = timeToMinutes(hora_inicio);
  const fim = timeToMinutes(hora_fim);
  const conflitos = reservasDoDia
    .filter(
      (r) =>
        r.status === "AGENDADA" &&
        r.id !== ignorarId &&
        timeToMinutes(r.hora_inicio) < fim &&
        timeToMinutes(r.hora_fim) > ini
    )
    .sort((a, b) => timeToMinutes(a.hora_inicio) - timeToMinutes(b.hora_inicio));

  if (conflitos.length === 0) {
    return { tipo: "ok", titulo: "Horário disponível", detalhe: "", conflitos };
  }

  const temGreen = conflitos.some((r) => r.empresa === "GREEN");

  if (empresa === "GREEN" && !temGreen) {
    const quem = [...new Set(conflitos.map((r) => NOME_EMPRESA[r.empresa]))].join(" e ");
    if (prioridadeNoPrazo(data, hora_inicio, agora)) {
      return {
        tipo: "aviso",
        titulo: `Horário ocupado por ${quem}`,
        detalhe: "A Green tem prioridade: ao salvar, o sistema vai oferecer aplicar a prioridade.",
        conflitos,
      };
    }
    return {
      tipo: "erro",
      titulo: `Horário ocupado por ${quem}`,
      detalhe: "A prioridade da Green só pode ser usada com mais de 24h de antecedência do início da reunião.",
      conflitos,
    };
  }

  return { tipo: "erro", titulo: "Horário ocupado", detalhe: "Escolha outro horário.", conflitos };
}

export function descreverConflito(r) {
  return `${formatTime(r.hora_inicio)}–${formatTime(r.hora_fim)} · ${r.responsavel} (${r.setor}) · ${NOME_EMPRESA[r.empresa] || r.empresa}`;
}
