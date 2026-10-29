import { useCallback, useEffect, useState } from "react";
import { reservasApi } from "../services/api";

export function useReservas(filters = {}) {
  const [reservas, setReservas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const filtersKey = JSON.stringify(filters);

  const refetch = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await reservasApi.listar(JSON.parse(filtersKey));
      setReservas(Array.isArray(data) ? data : data.reservas || []);
    } catch (err) {
      setError(err);
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filtersKey]);

  useEffect(() => {
    refetch();
  }, [refetch]);

  return { reservas, loading, error, refetch };
}

export default useReservas;
