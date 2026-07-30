import Link from'next/link';import{requestLocale}from'@/lib/server-locale';import{localePath}from'@/lib/i18n';
// The copy used to send people to "the payments dashboard" while the only link
// went to the wallet, and offered no route back to what they were paying for.
// A failed booking payment is now retryable — the failed attempt releases the
// booking's payment slot — so the primary action points at the classes panel
// where the still-unpaid booking is listed.
export default async function Failure(){
 const locale=await requestLocale(),fa=locale==='fa';
 return <main className="grid min-h-screen place-items-center p-6"><div className="w-full max-w-md text-center"><span className="text-6xl text-red-500">×</span><h1 className="mt-5 text-3xl font-black sm:text-4xl">{fa?'پرداخت ناموفق بود':'Payment failed'}</h1><p className="mt-4 leading-7 text-muted">{fa?'مبلغی از شما کسر نشده است. اگر برای یک جلسه پرداخت می‌کردید، رزرو شما تا پایان مهلت پرداخت نگه داشته می‌شود و می‌توانید دوباره تلاش کنید.':'You were not charged. If this was for a lesson, your booking is held until the payment window closes, so you can try again.'}</p><div className="mt-7 flex flex-col gap-3 sm:flex-row sm:justify-center"><Link href={localePath('/dashboard/classes',locale)} className="rounded-xl bg-navy px-7 py-4 font-black text-white">{fa?'رفتن به کلاس‌ها':'Go to my classes'}</Link><Link href={localePath('/dashboard/wallet',locale)} className="rounded-xl border hairline px-7 py-4 font-black">{fa?'مشاهده پرداخت‌ها':'View payments'}</Link></div></div></main>;
}
