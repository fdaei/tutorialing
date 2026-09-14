'use client';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useCallback, useMemo } from 'react';

/**
 * Filter state that lives in the URL, so filtered views survive reloads, can be
 * shared, and the back button undoes a filter change.
 *
 * Values equal to their default are omitted from the query string. Any change to a
 * key other than `page` resets `page`, which prevents landing on an empty page 5
 * after narrowing the result set.
 */
export function useUrlState<T extends Record<string, string>>(defaults: T) {
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const serializedDefaults = JSON.stringify(defaults);

  const state = useMemo(() => {
    const base = JSON.parse(serializedDefaults) as T;
    const next = { ...base };
    for (const key of Object.keys(base) as Array<keyof T>) {
      const value = params.get(String(key));
      if (value !== null) next[key] = value as T[keyof T];
    }
    return next;
  }, [params, serializedDefaults]);

  const set = useCallback(
    (patch: Partial<T>) => {
      const base = JSON.parse(serializedDefaults) as T;
      const query = new URLSearchParams(params.toString());
      for (const [key, value] of Object.entries(patch)) {
        if (value === undefined || value === base[key]) query.delete(key);
        else query.set(key, String(value));
      }
      if (!('page' in patch) && 'page' in base) query.delete('page');
      const search = query.toString();
      router.replace(search ? `${pathname}?${search}` : pathname, { scroll: false });
    },
    [params, pathname, router, serializedDefaults],
  );

  const reset = useCallback(() => {
    const base = JSON.parse(serializedDefaults) as T;
    const query = new URLSearchParams(params.toString());
    for (const key of Object.keys(base)) query.delete(key);
    const search = query.toString();
    router.replace(search ? `${pathname}?${search}` : pathname, { scroll: false });
  }, [params, pathname, router, serializedDefaults]);

  const activeCount = useMemo(() => {
    const base = JSON.parse(serializedDefaults) as T;
    return (Object.keys(base) as Array<keyof T>).filter((key) => key !== 'page' && state[key] !== base[key]).length;
  }, [serializedDefaults, state]);

  return [state, set, { reset, activeCount }] as const;
}
