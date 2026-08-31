import { Footer, Header } from '@/components/layout/site';

export default function CoursesLoading() {
  return (
    <>
      <Header />
      <main aria-busy="true" aria-label="در حال دریافت دوره‌ها" className="page-shell section-space min-h-[60vh]">
        <div className="skeleton h-4 w-36 rounded-full" />
        <div className="skeleton mt-4 h-12 max-w-sm rounded-2xl" />
        <div className="skeleton mt-4 h-6 max-w-2xl rounded-xl" />
        <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }, (_, index) => (
            <div key={index} className="skeleton h-80 rounded-[18px]" />
          ))}
        </div>
      </main>
      <Footer />
    </>
  );
}
