const API=process.env.NEXT_PUBLIC_API_URL??'http://localhost:4001/api';
function locale(){if(typeof document==='undefined')return undefined;return document.documentElement.lang.startsWith('en')?'en':'fa'}
export type ApiErrorBody={code?:string;message?:string;fieldErrors?:Record<string,string>;requestId?:string;timestamp?:string};
export class ApiError extends Error{details:ApiErrorBody;constructor(public status:number,details:unknown){const body=(details&&typeof details==='object'?details:{}) as ApiErrorBody;super(body.message||`Request failed (${status})`);this.name='ApiError';this.details=body}}
async function parse(r:Response){const body=await r.json().catch(()=>null);if(!r.ok)throw new ApiError(r.status,body);return body}
function headers(init?:RequestInit,token?:string|null){return{'content-type':'application/json',...(locale()&&{'accept-language':locale()}),...(token&&{authorization:`Bearer ${token}`}),...init?.headers}}
export async function publicApi<T>(path:string,init?:RequestInit):Promise<T>{return parse(await fetch(`${API}${path}`,{...init,headers:headers(init),cache:init?.cache??'no-store'}))}

// Refresh tokens rotate and the API revokes the whole token family when it sees
// a token it has already replaced. A page that fires several requests at once
// gets several 401s at once, so refreshing per-request would send the same
// refresh token N times: the first rotates it and the rest look like replay,
// which signs the user out entirely. All of them share one in-flight refresh
// instead, then retry with whatever it produced.
let pendingRefresh:Promise<string|null>|null=null;
function refreshAccessToken():Promise<string|null>{
 pendingRefresh??=(async()=>{
  try{
   const refreshed=await fetch(`${API}/auth/refresh`,{method:'POST',credentials:'include',headers:{...(locale()&&{'accept-language':locale()})}});
   if(!refreshed.ok){sessionStorage.removeItem('access_token');return null}
   const data=await refreshed.json();
   sessionStorage.setItem('access_token',data.accessToken);
   return data.accessToken as string;
  }catch{
   // A network failure is not proof the session is gone, but the cached token is
   // already known to be rejected, so drop it and let the caller surface the 401.
   sessionStorage.removeItem('access_token');
   return null;
  }
 })().finally(()=>{pendingRefresh=null});
 return pendingRefresh;
}

export async function api<T>(path:string,init?:RequestInit):Promise<T>{
 const token=typeof window!=='undefined'?sessionStorage.getItem('access_token'):null;
 let r=await fetch(`${API}${path}`,{...init,credentials:'include',headers:headers(init,token)});
 if(r.status===401&&typeof window!=='undefined'){
  const refreshedToken=await refreshAccessToken();
  if(refreshedToken)r=await fetch(`${API}${path}`,{...init,credentials:'include',headers:headers(init,refreshedToken)});
 }
 return parse(r);
}
export function apiMessage(error:unknown,fallback:string){return error instanceof ApiError?error.message:error instanceof Error?error.message:fallback}
export function apiField(error:unknown,field:string){return error instanceof ApiError?error.details.fieldErrors?.[field]:undefined}
export type EducationalLanguage={id:string;code:string;nameFa:string;nameEn:string;nativeName:string;flag?:string;direction:'LTR'|'RTL';active:boolean;order:number;proficiencySystem:'CEFR'|'CUSTOM'};
export type TeacherLanguage={language:EducationalLanguage;levels:string[];specialties:string[]};
export type PublicTeacher={id:string;slug:string;nameFa:string;nameEn:string;bioFa:string;bioEn?:string;rating:number;reviewsCount:number;trialPrice:number;regularPrice?:number;approvedTrialPrice?:number;approvedRegularPrice?:number;trialDuration?:number;lessonDuration:number;specialties:string[];languages:string[];languageLinks?:TeacherLanguage[];targetBands:number[];introVideoKey?:string;approvedAt:string;successfulClasses?:number;studentsCount?:number;packages?:unknown[];reviews?:unknown[];policy?:{titleFa:string;titleEn:string;rules:unknown}};
export type Paginated<T>={data:T[];total:number;page:number;totalPages:number};
export type ItemsPage<T>={items:T[];pagination:{page:number;pageSize:number;total:number;pages:number;hasMore?:boolean}};
