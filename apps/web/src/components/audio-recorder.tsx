'use client';

import {useEffect,useRef,useState} from 'react';
import {Mic,RotateCcw,Square,UploadCloud} from 'lucide-react';
import {api} from '@/lib/api';
import {useTranslations} from './locale-provider';

type Props={value?:string;onUploaded:(fileId:string)=>Promise<void>|void};
type Upload={fileId:string;uploadUrl:string};
type Download={url:string;expiresIn:number};

const extensions:Record<string,string>={'audio/webm':'webm','audio/mp4':'m4a','audio/mpeg':'mp3','audio/ogg':'ogg','audio/wav':'wav','audio/x-m4a':'m4a'};

export function AudioRecorder({value,onUploaded}:Props){
  const {locale}=useTranslations(),fa=locale==='fa';
  const recorder=useRef<MediaRecorder|null>(null),chunks=useRef<Blob[]>([]),lastBlob=useRef<Blob|null>(null),pendingFileId=useRef<string|null>(null),objectUrl=useRef<string|null>(null);
  const [status,setStatus]=useState<'idle'|'recording'|'uploading'|'ready'|'error'>(value?'uploading':'idle');
  const [url,setUrl]=useState<string>(),[error,setError]=useState('');

  function replaceUrl(next:string,isObject=false){
    if(objectUrl.current)URL.revokeObjectURL(objectUrl.current);
    objectUrl.current=isObject?next:null;
    setUrl(next);
  }

  useEffect(()=>()=>{if(objectUrl.current)URL.revokeObjectURL(objectUrl.current)},[]);
  useEffect(()=>{
    if(!value){if(status==='ready')setStatus('idle');return}
    let cancelled=false;
    setStatus('uploading');setError('');
    api<Download>(`/files/${value}/download`).then(result=>{if(!cancelled){replaceUrl(result.url);setStatus('ready')}}).catch(()=>{if(!cancelled){setError(fa?'فایل ذخیره شده است، اما پخش آن فعلاً در دسترس نیست. دوباره تلاش کنید.':'The recording is saved, but playback is temporarily unavailable. Try again.');setStatus('error')}});
    return()=>{cancelled=true};
  },[value]);

  async function start(){
    try{
      const stream=await navigator.mediaDevices.getUserMedia({audio:{echoCancellation:true,noiseSuppression:true}});
      const supported=['audio/webm;codecs=opus','audio/webm','audio/mp4','audio/ogg;codecs=opus'].find(type=>MediaRecorder.isTypeSupported(type));
      const media=new MediaRecorder(stream,supported?{mimeType:supported}:undefined);
      chunks.current=[];pendingFileId.current=null;
      media.ondataavailable=event=>{if(event.data.size)chunks.current.push(event.data)};
      media.onstop=()=>{stream.getTracks().forEach(track=>track.stop());const blob=new Blob(chunks.current,{type:(media.mimeType||supported||'audio/webm').split(';')[0]});lastBlob.current=blob;void upload(blob)};
      recorder.current=media;media.start(500);setError('');setStatus('recording');
    }catch{
      setError(fa?'دسترسی میکروفون ممکن نیست. مجوز مرورگر را فعال کنید.':'Microphone access is unavailable. Allow it in your browser settings.');setStatus('error');
    }
  }

  function stop(){recorder.current?.stop();setStatus('uploading')}

  async function attach(fileId:string){
    await onUploaded(fileId);
    pendingFileId.current=null;
    setStatus('ready');
  }

  async function upload(blob:Blob){
    setStatus('uploading');setError('');
    try{
      const bytes=await blob.arrayBuffer();
      const checksum=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))).map(x=>x.toString(16).padStart(2,'0')).join('');
      const mimeType=blob.type.split(';')[0]||'audio/webm',extension=extensions[mimeType]??'webm';
      const signed=await api<Upload>('/files/uploads',{method:'POST',body:JSON.stringify({originalName:`speaking-answer.${extension}`,mimeType,size:blob.size,checksum,purpose:'speaking-answer'})});
      let uploaded=false;
      try{const response=await fetch(signed.uploadUrl,{method:'PUT',headers:{'content-type':mimeType,'x-amz-meta-checksum':checksum},body:blob});uploaded=response.ok}catch{uploaded=false}
      if(!uploaded)await api(`/files/uploads/${signed.fileId}/content`,{method:'POST',headers:{'content-type':mimeType,'x-content-checksum':checksum},body:blob});
      await api(`/files/${signed.fileId}/complete`,{method:'POST'});
      pendingFileId.current=signed.fileId;
      replaceUrl(URL.createObjectURL(blob),true);
      await attach(signed.fileId);
    }catch{
      setError(fa?'ذخیره صدا کامل نشد. فایل ضبط‌شده حفظ شده است؛ «تلاش دوباره» را بزنید.':'The recording was not fully saved. Your local audio is preserved; select “Try again”.');setStatus('error');
    }
  }

  async function retry(){
    setStatus('uploading');setError('');
    try{
      if(pendingFileId.current)await attach(pendingFileId.current);
      else if(lastBlob.current)await upload(lastBlob.current);
      else if(value){const result=await api<Download>(`/files/${value}/download`);replaceUrl(result.url);setStatus('ready')}
      else setStatus('idle');
    }catch{
      setError(fa?'ذخیره صدا دوباره ناموفق بود. اتصال اینترنت و سرویس فایل را بررسی کنید.':'Saving failed again. Check your connection and file service.');setStatus('error');
    }
  }

  return <div className="mt-5 rounded-2xl border hairline bg-lavender/30 p-5" aria-live="polite">
    <div className="flex flex-wrap items-center gap-3">
      {status!=='recording'?<button type="button" disabled={status==='uploading'} onClick={start} className="brand-gradient inline-flex items-center gap-2 rounded-full px-5 py-3 font-bold text-white disabled:opacity-50"><Mic size={18}/>{value||url?(fa?'ضبط دوباره':'Record again'):(fa?'شروع ضبط':'Start recording')}</button>:<button type="button" onClick={stop} className="inline-flex items-center gap-2 rounded-full bg-red-700 px-5 py-3 font-bold text-white"><Square size={17}/>{fa?'پایان ضبط':'Stop recording'}</button>}
      {status==='uploading'&&<span className="inline-flex items-center gap-2 text-sm"><UploadCloud className="animate-pulse"/>{fa?'در حال بارگذاری و ثبت پاسخ…':'Uploading and saving the answer…'}</span>}
      {status==='ready'&&<span className="text-sm font-bold text-emerald-700">{fa?'فایل صوتی و پاسخ آزمون ذخیره شدند.':'The audio file and test answer are saved.'}</span>}
      {status==='error'&&<button type="button" onClick={retry} className="inline-flex items-center gap-2 rounded-full border border-purple/25 bg-white px-4 py-2 text-sm font-bold text-purple"><RotateCcw size={16}/>{fa?'تلاش دوباره':'Try again'}</button>}
    </div>
    {url&&<audio className="mt-4 w-full" controls preload="metadata" src={url}/>} 
    {error&&<p role="alert" className="mt-3 text-sm text-red-700">{error}</p>}
    <p className="mt-3 text-xs text-muted">{fa?'پیش از قفل‌کردن بخش، صدای ذخیره‌شده را پخش و بررسی کنید.':'Play and review the saved recording before locking the section.'}</p>
  </div>;
}
