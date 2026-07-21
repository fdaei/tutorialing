import { NextRequest, NextResponse } from 'next/server';

export function middleware(request:NextRequest){
  const english=request.nextUrl.pathname==='/en'||request.nextUrl.pathname.startsWith('/en/');
  const locale=english?'en':'fa';
  const headers=new Headers(request.headers);headers.set('x-lingospeak-locale',locale);
  const url=request.nextUrl.clone();
  if(english){url.pathname=request.nextUrl.pathname.replace(/^\/en(?=\/|$)/,'')||'/';}
  const response=english?NextResponse.rewrite(url,{request:{headers}}):NextResponse.next({request:{headers}});
  response.cookies.set('lingospeak_locale',locale,{path:'/',maxAge:31536000,sameSite:'lax'});
  response.headers.set('Content-Language',locale);
  return response;
}
export const config={matcher:['/((?!api|_next/static|_next/image|favicon.ico|.*\\..*).*)']};
