export const API_BASE_URL =
  import.meta.env.VITE_API_URL || "http://localhost:3000";

export class ApiError extends Error {
  constructor(codigo, mensagem, reservas = []) {
    super(mensagem || codigo);
    this.name = "ApiError";
    this.codigo = codigo;
    this.reservas = reservas;
  }
}

async function request(path, options = {}) {
  let response;

  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      headers: {
        "Content-Type": "application/json",
      },
      ...options,
    });
  } catch {
    throw new ApiError(
      "ERRO_REDE",
      "Não foi possível conectar ao servidor. Verifique se a API está em execução."
    );
  }

  const text = await response.text();
  const data = text ? JSON.parse(text) : {};

  if (!response.ok) {
    if (data && data.erro) {
      throw new ApiError(
        data.erro,
        data.mensagem || data.erro,
        data.reservas || []
      );
    }

    throw new ApiError(
      "ERRO_SERVIDOR",
      "Ocorreu um erro inesperado no servidor. Tente novamente."
    );
  }

  return data;
}

function buildQuery(filters = {}) {
  const params = new URLSearchParams();

  Object.entries(filters).forEach(([key, value]) => {
    if (
      value !== undefined &&
      value !== null &&
      value !== ""
    ) {
      params.set(key, value);
    }
  });

  const qs = params.toString();

  return qs ? `?${qs}` : "";
}

export const reservasApi = {
  listar(filters = {}) {
    return request(`/reservas${buildQuery(filters)}`);
  },

  buscar(id) {
    return request(`/reservas/${id}`);
  },

  criar(payload) {
    return request("/reservas", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },

  editar(id, payload) {
    return request(`/reservas/${id}`, {
      method: "PUT",
      body: JSON.stringify(payload),
    });
  },

  cancelar(id) {
    return request(`/reservas/${id}/cancelar`, {
      method: "PATCH",
    });
  },

  pausar(id) {
    return request(`/reservas/${id}/standby`, {
      method: "PATCH",
    });
  },

  retomar(id) {
    return request(`/reservas/${id}/retomar`, {
      method: "PATCH",
    });
  },

  encerrar(id) {
    return request(`/reservas/${id}/encerrar`, {
      method: "PATCH",
    });
  },

  estender(id, horaFim) {
    return request(`/reservas/${id}/estender`, {
      method: "PATCH",
      body: JSON.stringify({ hora_fim: horaFim }),
    });
  },

  aplicarPrioridade(payload) {
    return request("/reservas/prioridade", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },
};