// Utilitários de data/hora.
// A API sempre trabalha com "YYYY-MM-DD" e "HH:mm:ss".
// A interface sempre exibe "DD/MM/YYYY" e "HH:mm".

/** "2026-08-18" -> "18/08/2026" */
export function formatDateBR(isoDate) {
  if (!isoDate) return "";
  const [y, m, d] = isoDate.split("-");
  if (!y || !m || !d) return isoDate;
  return `${d}/${m}/${y}`;
}

/** "14:00:00" ou "14:00" -> "14:00" */
export function formatTime(time) {
  if (!time) return "";
  return time.slice(0, 5);
}

/** Date -> "YYYY-MM-DD" (nunca altera o formato enviado à API) */
export function toISODate(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/** "YYYY-MM-DD" -> Date local (evita bug de fuso horário do `new Date(iso)`) */
export function fromISODate(isoDate) {
  const [y, m, d] = isoDate.split("-").map(Number);
  return new Date(y, m - 1, d);
}

export function todayISO() {
  return toISODate(new Date());
}

const DIAS_SEMANA = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
const DIAS_SEMANA_LONGO = [
  "Domingo",
  "Segunda-feira",
  "Terça-feira",
  "Quarta-feira",
  "Quinta-feira",
  "Sexta-feira",
  "Sábado",
];
const MESES = [
  "Janeiro",
  "Fevereiro",
  "Março",
  "Abril",
  "Maio",
  "Junho",
  "Julho",
  "Agosto",
  "Setembro",
  "Outubro",
  "Novembro",
  "Dezembro",
];

export function weekdayShort(isoDate) {
  return DIAS_SEMANA[fromISODate(isoDate).getDay()];
}

export function weekdayLong(isoDate) {
  return DIAS_SEMANA_LONGO[fromISODate(isoDate).getDay()];
}

export function monthName(isoDate) {
  return MESES[fromISODate(isoDate).getMonth()];
}

/** Converte "HH:mm" em minutos desde 00:00, para posicionamento na timeline */
export function timeToMinutes(time) {
  if (!time) return 0;
  const [h, m] = time.slice(0, 5).split(":").map(Number);
  return h * 60 + m;
}

/** Retorna array de 7 datas ISO (segunda a domingo) da semana que contém `isoDate` */
export function weekDates(isoDate) {
  const date = fromISODate(isoDate);
  const day = date.getDay(); // 0 = domingo
  const diffToMonday = day === 0 ? -6 : 1 - day;
  const monday = new Date(date);
  monday.setDate(date.getDate() + diffToMonday);
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    return toISODate(d);
  });
}

/** Último dia do mês que contém `isoDate` ("2026-02-10" -> "2026-02-28") */
export function endOfMonth(isoDate) {
  const d = fromISODate(isoDate);
  return toISODate(new Date(d.getFullYear(), d.getMonth() + 1, 0));
}

export function addDays(isoDate, days) {
  const d = fromISODate(isoDate);
  d.setDate(d.getDate() + days);
  return toISODate(d);
}

export function isSameISODate(a, b) {
  return a === b;
}

export function isTodayISO(isoDate) {
  return isoDate === todayISO();
}

export function isReservationPast(data, horaFim, now = new Date()) {
  if (!data || !horaFim) return false;

  const hoje = toISODate(now);

  if (data < hoje) return true;
  if (data > hoje) return false;

  const agoraEmMinutos = now.getHours() * 60 + now.getMinutes();
  return timeToMinutes(horaFim) <= agoraEmMinutos;
}


/** 462 -> "7h 42min", 45 -> "45min", 120 -> "2h" (em vez de horas decimais como "7.7h") */
export function formatDuracao(minutos) {
  const horas = Math.floor(minutos / 60);
  const resto = minutos % 60;

  if (horas === 0) return `${resto}min`;
  if (resto === 0) return `${horas}h`;
  return `${horas}h ${resto}min`;
}

/**
 * Reunião estendida ou encerrada antes: o backend guarda o fim original
 * em hora_fim_prevista. Retorna null quando o horário não mudou.
 */
export function ajusteDeHorario(reserva) {
  if (!reserva?.hora_fim_prevista) return null;

  const previsto = timeToMinutes(reserva.hora_fim_prevista);
  const real = timeToMinutes(reserva.hora_fim);
  if (real === previsto) return null;

  return {
    tipo: real > previsto ? "estendida" : "encerrada",
    minutos: Math.abs(real - previsto),
    previsto: formatTime(reserva.hora_fim_prevista),
  };
}
