'use client';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { CheckCircle2 } from 'lucide-react';
import { Footer, Header } from '@/components/layout/site';
type FormValues = {
  name: string;
  phone: string;
  email: string;
  languages: string[];
  expertise: string;
  experience: string;
  bio: string;
  price: number;
  availability: string;
  classType: string;
  terms: boolean;
};
const fields: { key: keyof FormValues; label: string; type?: string; placeholder?: string }[] = [
  { key: 'name', label: 'نام و نام خانوادگی', placeholder: 'مثلاً سارا محمدی' },
  { key: 'phone', label: 'شماره تماس', type: 'tel', placeholder: '۰۹۱۲۱۲۳۴۵۶۷' },
  { key: 'email', label: 'ایمیل', type: 'email', placeholder: 'name@example.com' },
];
export default function TeacherRegister() {
  const [step, setStep] = useState(1),
    [done, setDone] = useState(false);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    trigger,
  } = useForm<FormValues>({ defaultValues: { languages: [], classType: 'online' } });
  const next = async () => {
    const names: (keyof FormValues)[] =
      step === 1 ? ['name', 'phone', 'email'] : step === 2 ? ['languages', 'expertise', 'experience'] : [];
    if (await trigger(names)) setStep((x) => Math.min(3, x + 1));
  };
  const submit = async () => {
    await new Promise((r) => setTimeout(r, 700));
    setDone(true);
  };
  return (
    <>
      <Header />
      <main className="hero-wash min-h-[75vh] py-12">
        <div className="page-shell max-w-3xl">
          <p className="text-center text-sm font-black text-purple">همکاری با LingoSpeak</p>
          <h1 className="mt-3 text-center text-3xl font-black">ثبت‌نام مدرس</h1>
          <div className="mx-auto mt-7 flex max-w-md items-center">
            {[1, 2, 3].map((x) => (
              <div key={x} className="flex flex-1 items-center last:flex-none">
                <span
                  className={`grid size-9 place-items-center rounded-full font-black ${step >= x ? 'bg-purple text-white' : 'bg-indigo-50 text-muted'}`}
                >
                  {x.toLocaleString('fa-IR')}
                </span>
                {x < 3 && <i className={`h-1 flex-1 ${step > x ? 'bg-purple' : 'bg-indigo-100'}`} />}
              </div>
            ))}
          </div>
          {done ? (
            <div className="market-card mt-10 p-10 text-center">
              <CheckCircle2 className="mx-auto text-green-600" size={52} />
              <h2 className="mt-5 text-2xl font-black">درخواست شما ثبت شد</h2>
              <p className="mt-3 text-muted">پس از بررسی مدارک، نتیجه از طریق ایمیل و پیامک اطلاع داده می‌شود.</p>
            </div>
          ) : (
            <form onSubmit={handleSubmit(submit)} className="market-card mt-8 p-6 md:p-9">
              {step === 1 && (
                <div className="grid gap-5">
                  {fields.map((f) => (
                    <label key={f.key} className="grid gap-2 text-sm font-black">
                      {f.label}
                      <input
                        type={f.type}
                        placeholder={f.placeholder}
                        className="input font-normal"
                        {...register(f.key, {
                          required: 'این فیلد الزامی است',
                          ...(f.key === 'phone' && {
                            pattern: { value: /^09\d{9}$/, message: 'شماره موبایل معتبر وارد کنید' },
                          }),
                        })}
                      />
                      {errors[f.key] && <small className="text-red-600">{String(errors[f.key]?.message)}</small>}
                    </label>
                  ))}
                  <label className="grid gap-2 text-sm font-black">
                    تصویر پروفایل
                    <input type="file" accept="image/*" className="input font-normal" />
                  </label>
                </div>
              )}
              {step === 2 && (
                <div className="grid gap-6">
                  <fieldset>
                    <legend className="mb-3 text-sm font-black">زبان‌های قابل تدریس</legend>
                    <div className="flex flex-wrap gap-3">
                      {['انگلیسی', 'آلمانی', 'فرانسوی', 'اسپانیایی'].map((x) => (
                        <label key={x} className="chip cursor-pointer">
                          <input
                            type="checkbox"
                            value={x}
                            {...register('languages', { required: 'حداقل یک زبان انتخاب کنید' })}
                          />
                          {x}
                        </label>
                      ))}
                    </div>
                    {errors.languages && <small className="mt-2 block text-red-600">{errors.languages.message}</small>}
                  </fieldset>
                  <label className="grid gap-2 text-sm font-black">
                    سطح تخصص
                    <select className="input" {...register('expertise', { required: 'سطح تخصص را انتخاب کنید' })}>
                      <option value="">انتخاب کنید</option>
                      <option>مقدماتی تا پیشرفته</option>
                      <option>آمادگی آزمون</option>
                      <option>مکالمه تخصصی</option>
                    </select>
                  </label>
                  <label className="grid gap-2 text-sm font-black">
                    سوابق تدریس
                    <textarea
                      className="input min-h-28"
                      {...register('experience', { required: 'سوابق تدریس را بنویسید' })}
                    />
                  </label>
                  <label className="grid gap-2 text-sm font-black">
                    مدارک و گواهی‌ها
                    <input type="file" multiple className="input font-normal" />
                  </label>
                </div>
              )}
              {step === 3 && (
                <div className="grid gap-5">
                  <label className="grid gap-2 text-sm font-black">
                    معرفی کوتاه
                    <textarea className="input min-h-32" {...register('bio', { required: 'معرفی کوتاه الزامی است' })} />
                  </label>
                  <label className="grid gap-2 text-sm font-black">
                    هزینه پیشنهادی هر جلسه (تومان)
                    <input
                      type="number"
                      className="input"
                      {...register('price', {
                        required: 'هزینه پیشنهادی را وارد کنید',
                        valueAsNumber: true,
                        min: { value: 100000, message: 'حداقل هزینه ۱۰۰٬۰۰۰ تومان است' },
                      })}
                    />
                  </label>
                  <label className="grid gap-2 text-sm font-black">
                    روزها و ساعت‌های در دسترس
                    <textarea
                      className="input"
                      {...register('availability', { required: 'زمان‌های در دسترس را بنویسید' })}
                    />
                  </label>
                  <fieldset>
                    <legend className="mb-2 text-sm font-black">نوع کلاس</legend>
                    <label className="ml-5">
                      <input type="radio" value="online" {...register('classType')} /> آنلاین
                    </label>
                    <label>
                      <input type="radio" value="both" {...register('classType')} /> آنلاین و حضوری
                    </label>
                  </fieldset>
                  <label className="flex items-start gap-2 text-sm">
                    <input
                      type="checkbox"
                      className="mt-1"
                      {...register('terms', { required: 'پذیرش قوانین الزامی است' })}
                    />{' '}
                    قوانین همکاری و حفظ حریم خصوصی را می‌پذیرم.
                  </label>
                  {errors.terms && <small className="text-red-600">{errors.terms.message}</small>}
                </div>
              )}
              <div className="mt-8 flex justify-between border-t hairline pt-6">
                {step > 1 ? (
                  <button
                    type="button"
                    onClick={() => setStep((x) => x - 1)}
                    className="rounded-xl border hairline px-6 py-3 font-black"
                  >
                    مرحله قبل
                  </button>
                ) : (
                  <span />
                )}
                {step < 3 ? (
                  <button
                    type="button"
                    onClick={next}
                    className="brand-gradient rounded-xl px-7 py-3 font-black text-white"
                  >
                    ادامه
                  </button>
                ) : (
                  <button
                    disabled={isSubmitting}
                    className="brand-gradient rounded-xl px-7 py-3 font-black text-white disabled:opacity-60"
                  >
                    {isSubmitting ? 'در حال ارسال…' : 'ثبت درخواست'}
                  </button>
                )}
              </div>
            </form>
          )}
        </div>
      </main>
      <Footer />
    </>
  );
}
