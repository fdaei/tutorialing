'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';

export function useAction(endpoint: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (task: () => Promise<unknown>) => task(),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: [endpoint] }),
        queryClient.invalidateQueries({ queryKey: ['panel-me'] }),
      ]);
    },
  });
}
