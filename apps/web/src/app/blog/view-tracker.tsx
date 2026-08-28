'use client';
import { useEffect } from 'react'; import { publicApi } from '@/shared/services/api';
export function ViewTracker({id}:{id:string}){useEffect(()=>{const k=`blog-view:${id}`;if(!localStorage.getItem(k)){const v=crypto.randomUUID();localStorage.setItem(k,v);publicApi(`/blog/posts/${id}/view`,{method:'POST',body:JSON.stringify({visitorKey:v})}).catch(()=>{});}},[id]);return null}
