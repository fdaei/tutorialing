import { Footer, Header } from '@/components/layout/site';
import { LanguageCard } from '@/components/marketplace/cards';
import { marketplaceService } from '@/lib/marketplace-data';
export default async function LanguagesPage(){const items=await marketplaceService.getLanguages();return <><Header/><main className="page-shell section-space"><p className="text-sm font-black text-purple">چه زبانی می‌خواهید یاد بگیرید؟</p><h1 className="mt-3 text-4xl font-black md:text-5xl">زبان‌ها</h1><p className="mt-4 max-w-2xl leading-8 text-muted">از سطح مقدماتی تا پیشرفته، مسیر مناسب خودتان را میان دوره‌ها و مدرس‌های متخصص پیدا کنید.</p><div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">{items.map(x=><LanguageCard key={x.slug} language={x}/>)}</div></main><Footer/></>}
