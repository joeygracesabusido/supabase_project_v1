import { useCallback, useEffect, useState } from 'react';
import { supabase } from './supabase';
import type { Property, Unit, Tenant, Payment } from './types';

function useTable<T>(table: string) {
  const [data, setData] = useState<T[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const { data: rows, error: err } = await supabase.from(table).select('*').limit(200);
    if (err) setError(err.message);
    else setData((rows ?? []) as T[]);
    setLoading(false);
  }, [table]);
  useEffect(() => {
    load();
  }, [load]);
  return { data, loading, error, reload: load };
}

export const useProperties = () => useTable<Property>('properties');
export const useUnits = () => useTable<Unit>('units');
export const useTenants = () => useTable<Tenant>('tenants');
export const usePayments = () => useTable<Payment>('payments');
