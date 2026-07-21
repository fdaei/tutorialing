'use client';
import { QueryClient,QueryClientProvider } from '@tanstack/react-query';import { useState } from 'react';
import {LocaleProvider} from '@/components/locale-provider';import type{Locale}from'@/lib/i18n';
export function Providers({children,locale}:{children:React.ReactNode;locale:Locale}){const [client]=useState(()=>new QueryClient({defaultOptions:{queries:{staleTime:30000,retry:1}}}));return <LocaleProvider locale={locale}><QueryClientProvider client={client}>{children}</QueryClientProvider></LocaleProvider>}
