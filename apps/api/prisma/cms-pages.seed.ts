import type { PrismaClient } from '@prisma/client';

// The canonical set of public content pages. The site footer links to
// /about, /faq, /contact, /terms, /privacy and /cancellation-policy on every
// page, so a missing row here is a 404 on a link that is always visible.
//
// This list deliberately lives outside seed.ts: that seed also creates demo
// users and sample transactions and is never run against production, which
// left production with an empty CmsPage table and every one of those footer
// links broken. seed-cms-pages.ts installs this baseline on its own, the same
// way country reference data is installed. The legal pages are also an
// Enamad prerequisite.
//
// TODO(legal): a working baseline, not vetted legal text. Have it reviewed
// before launch, and replace every «...» placeholder — the company
// registration details are not derivable from the codebase.
export const PUBLIC_CMS_PAGES = [
  {
    slug: 'about',
    titleFa: 'درباره ما',
    titleEn: 'About us',
    contentFa: {
      paragraphs: [
        'لینگواسپیک برای ساده‌کردن مسیر پیدا کردن مدرس زبان ساخته شده است. ما مدرس‌ها را بررسی می‌کنیم، امکان تعیین سطح و مقایسه شفاف را فراهم می‌کنیم و به زبان‌آموز کمک می‌کنیم کلاس مناسب هدف، بودجه و زمان خود را پیدا کند.',
      ],
    },
    contentEn: {
      paragraphs: [
        'LingoSpeak makes finding the right language teacher simpler. We verify teachers, provide language-specific assessments and transparent comparisons, and help learners book classes that fit their goals, budget and schedule.',
      ],
    },
  },
  {
    slug: 'how-it-works',
    titleFa: 'نحوه کار',
    titleEn: 'How it works',
    contentFa: { paragraphs: ['زبان را انتخاب کنید، سطح خود را بسنجید و مدرس مناسب را رزرو کنید.'] },
    contentEn: { paragraphs: ['Choose a language, assess your level, and book the right teacher.'] },
  },
  {
    slug: 'faq',
    titleFa: 'سؤالات متداول',
    titleEn: 'FAQ',
    contentFa: { paragraphs: ['پاسخ سؤالات متداول از پنل مدیریت قابل ویرایش است.'] },
    contentEn: { paragraphs: ['Frequently asked questions are editable from the admin panel.'] },
  },
  {
    slug: 'contact',
    titleFa: 'تماس با ما',
    titleEn: 'Contact us',
    contentFa: {
      paragraphs: [
        'پشتیبانی لینگواسپیک شنبه تا پنج‌شنبه از ساعت ۹ تا ۲۰ پاسخگوی شماست.',
        'تلفن پشتیبانی: ۰۲۱۹۱۰۹۴۲۰۰',
        'رایانامه: support@lingospeak.ir',
        'نشانی: «نشانی کامل شرکت را وارد کنید»',
        'شناسه ملی / شماره ثبت: «شماره ثبت را وارد کنید»',
        'برای پیگیری سفارش، رزرو یا پرداخت، از بخش «تیکت پشتیبانی» در پنل کاربری خود استفاده کنید تا درخواست شما ثبت و قابل پیگیری باشد.',
      ],
    },
    contentEn: {
      paragraphs: [
        'LingoSpeak support is available Saturday to Thursday, 9:00 to 20:00.',
        'Phone: +98 21 9109 4200',
        'Email: support@lingospeak.ir',
        'Address: «enter the full company address»',
        'Company registration number: «enter the registration number»',
        'To follow up on a booking or payment, open a support ticket from your dashboard so your request is recorded and traceable.',
      ],
    },
  },
  {
    slug: 'terms',
    titleFa: 'قوانین و مقررات',
    titleEn: 'Terms of use',
    contentFa: {
      paragraphs: [
        'با ثبت‌نام و استفاده از لینگواسپیک، شما این قوانین را می‌پذیرید. لینگواسپیک بستری برای اتصال زبان‌آموز و مدرس زبان است و کلاس‌ها به‌صورت آنلاین و از طریق همین سامانه برگزار می‌شود.',
        'ثبت‌نام و ورود با شماره تلفن همراه و کد یک‌بارمصرف انجام می‌شود. مسئولیت حفظ دسترسی به شماره تلفن و حساب کاربری بر عهده کاربر است.',
        'مدرسان پیش از انتشار پروفایل عمومی، از نظر مدارک، سابقه و ویدیوی معرفی بررسی و تأیید می‌شوند. قیمت هر مدرس نیز پیش از انتشار توسط تیم لینگواسپیک بررسی و تأیید می‌شود.',
        'برای رزرو کلاس عادی با هر مدرس، ابتدا برگزاری یک جلسه آزمایشی با همان مدرس الزامی است. قیمت جلسه آزمایشی نصف قیمت جلسه عادی است و هر زبان‌آموز با هر مدرس یک‌بار می‌تواند از آن استفاده کند.',
        'مبلغ پرداختی زبان‌آموز تا زمان برگزاری و تکمیل کلاس توسط لینگواسپیک نگهداری می‌شود و پس از آن سهم مدرس، پس از کسر کمیسیون سامانه، به کیف پول او واریز می‌گردد.',
        'جابه‌جایی زمان کلاس تنها با توافق هر دو طرف و از طریق همین سامانه امکان‌پذیر است. لغو کلاس تابع سیاست لغو و بازپرداخت است که در زمان رزرو به تأیید شما می‌رسد.',
        'رد و بدل کردن شماره تلفن، نشانی یا اطلاعات تماس شخصی برای برگزاری کلاس خارج از سامانه مجاز نیست و می‌تواند به تعلیق حساب کاربری منجر شود.',
        'نظرات زبان‌آموزان پیش از انتشار توسط تیم پشتیبانی بررسی می‌شود. انتشار محتوای توهین‌آمیز، تبلیغاتی یا نامرتبط مجاز نیست.',
        'لینگواسپیک می‌تواند در صورت تکرار نظرات بسیار منفی یا نقض مکرر قوانین، حساب یک مدرس را غیرفعال کند.',
        'این قوانین ممکن است به‌روزرسانی شود و نسخه جاری همیشه در همین صفحه در دسترس است.',
      ],
    },
    contentEn: {
      paragraphs: [
        'By registering and using LingoSpeak you accept these terms. LingoSpeak is a platform that connects language learners with teachers; lessons are delivered online through this platform.',
        'Registration and sign-in use your mobile number and a one-time code. You are responsible for keeping access to that number and your account secure.',
        "Teachers are reviewed for documents, experience and an introduction video before their public profile goes live. Each teacher's price is also reviewed and approved by the LingoSpeak team before publication.",
        'Before booking a regular lesson with a teacher, you must first take a trial session with that teacher. The trial is half the price of a regular lesson and is available once per learner-teacher pair.',
        "Payments are held by LingoSpeak until the lesson has taken place and been completed. The teacher's share, net of the platform commission, is then credited to their wallet.",
        'Rescheduling requires both parties to agree and must be arranged through this platform. Cancellations are governed by the cancellation and refund policy you accept when booking.',
        'Exchanging phone numbers, addresses or other personal contact details in order to hold lessons outside the platform is not permitted and may lead to account suspension.',
        'Learner reviews are checked by the support team before publication. Abusive, promotional or irrelevant content will not be published.',
        "LingoSpeak may deactivate a teacher's account after repeated very negative reviews or repeated breaches of these terms.",
        'These terms may be updated; the current version is always available on this page.',
      ],
    },
  },
  {
    slug: 'privacy',
    titleFa: 'سیاست حفظ حریم خصوصی',
    titleEn: 'Privacy policy',
    contentFa: {
      paragraphs: [
        'لینگواسپیک تنها اطلاعاتی را جمع‌آوری می‌کند که برای ارائه خدمات لازم است: شماره تلفن همراه، نام، نشانی رایانامه (اختیاری)، تاریخ تولد (اختیاری، برای تخفیف تولد)، منطقه زمانی و زبان مورد نظر شما.',
        'شماره تلفن شما برای ورود به حساب، ارسال کد یک‌بارمصرف و اطلاع‌رسانی درباره کلاس‌ها استفاده می‌شود.',
        'تاریخ تولد تنها برای اعمال خودکار تخفیف تولد استفاده می‌شود و در پروفایل عمومی نمایش داده نمی‌شود.',
        'اطلاعات پرداخت شما نزد درگاه پرداخت پردازش می‌شود؛ لینگواسپیک اطلاعات کارت بانکی شما را دریافت یا ذخیره نمی‌کند.',
        'مدارک بارگذاری‌شده توسط مدرسان تنها برای فرایند تأیید صلاحیت و توسط تیم بررسی لینگواسپیک مشاهده می‌شود.',
        'اطلاعات شما بدون رضایت شما در اختیار اشخاص ثالث قرار نمی‌گیرد، مگر در مواردی که قانون یا مراجع قضایی الزام کند.',
        'برای حذف حساب کاربری یا درخواست اطلاعات ذخیره‌شده خود، از طریق صفحه تماس با ما یا تیکت پشتیبانی درخواست دهید.',
      ],
    },
    contentEn: {
      paragraphs: [
        'LingoSpeak collects only the information needed to provide the service: your mobile number, name, email address (optional), date of birth (optional, for the birthday discount), timezone and the language you want to learn.',
        'Your phone number is used to sign in, to send one-time codes, and to notify you about your lessons.',
        'Your date of birth is used only to apply the automatic birthday discount and is never shown on your public profile.',
        'Payment details are processed by the payment gateway. LingoSpeak does not receive or store your bank card details.',
        'Documents uploaded by teachers are visible only to the LingoSpeak verification team, and only for the purpose of that verification.',
        'We do not share your information with third parties without your consent, except where required by law.',
        'To delete your account or request a copy of your stored data, contact us through the contact page or a support ticket.',
      ],
    },
  },
  {
    slug: 'cancellation-policy',
    titleFa: 'سیاست لغو و بازپرداخت',
    titleEn: 'Cancellation and refund policy',
    contentFa: {
      paragraphs: [
        'مبلغ پرداختی شما تا زمان برگزاری کلاس نزد لینگواسپیک نگهداری می‌شود، بنابراین بازپرداخت به‌صورت خودکار و بدون نیاز به پیگیری دستی انجام می‌شود.',
        'لغو کلاس تا پیش از بازه تعیین‌شده در سیاست لغو همان مدرس، مشمول بازپرداخت است. درصد بازپرداخت در زمان رزرو به شما نمایش داده می‌شود و همان مقدار برای رزرو شما ثبت و اعمال می‌گردد.',
        'مبلغ بازپرداخت به کیف پول شما در لینگواسپیک واریز می‌شود و می‌توانید از آن برای رزرو کلاس بعدی استفاده کنید.',
        'لغو دیرهنگام یا عدم حضور در کلاس، مشمول جریمه است و ممکن است بازپرداختی صورت نگیرد.',
        'اگر پرداخت شما پس از پایان مهلت پرداخت به سامانه برسد و نوبت آزاد شده باشد، کل مبلغ به‌طور خودکار به کیف پول شما بازگردانده می‌شود.',
        'در صورت لغو کلاس توسط مدرس یا بروز اختلاف، از طریق تیکت پشتیبانی درخواست خود را ثبت کنید؛ تیم پشتیبانی موضوع را بررسی و درباره بازپرداخت تصمیم‌گیری می‌کند.',
        'اگر کلاس با استفاده از اعتبار یک بسته آموزشی رزرو شده باشد، در صورت لغو مجاز، اعتبار جلسه به بسته شما بازگردانده می‌شود.',
      ],
    },
    contentEn: {
      paragraphs: [
        'Your payment is held by LingoSpeak until the lesson takes place, so refunds are issued automatically without manual follow-up.',
        "Cancelling before the window defined in your teacher's cancellation policy qualifies for a refund. The refund percentage is shown to you at booking time and that same figure is recorded against your booking and applied.",
        'Refunds are credited to your LingoSpeak wallet and can be used for your next booking.',
        'Late cancellation or not attending a lesson incurs a penalty and may not be refunded.',
        'If your payment reaches us after the payment window has closed and the slot has been released, the full amount is returned to your wallet automatically.',
        'If a teacher cancels, or a dispute arises, open a support ticket. The support team will review it and decide on a refund.',
        'When a lesson was booked using package credit, an eligible cancellation returns the lesson credit to your package.',
      ],
    },
  },
  {
    slug: 'become-a-teacher',
    titleFa: 'مدرس شوید',
    titleEn: 'Become a teacher',
    contentFa: {
      paragraphs: [
        'برای تدریس در لینگواسپیک، فرم درخواست را تکمیل کنید و زبان‌ها و سطوح تدریس، سابقه، مدارک و یک ویدیوی معرفی کوتاه را بارگذاری کنید.',
        'تیم لینگواسپیک مدارک شما را بررسی می‌کند. مدارک به‌صورت جداگانه راستی‌آزمایی می‌شوند و تنها پس از تأیید نهایی، پروفایل شما عمومی و قابل جستجو می‌شود.',
        'قیمت جلسه آزمایشی و عادی خود را پیشنهاد می‌دهید؛ تیم لینگواسپیک می‌تواند آن را تأیید کند یا قیمت متقابل پیشنهاد دهد. قیمت جلسه آزمایشی نصف قیمت جلسه عادی است.',
        'درآمد هر کلاس پس از برگزاری و تکمیل آن، با کسر کمیسیون سامانه، به کیف پول شما واریز می‌شود و در دوره‌های تسویه به حساب بانکی شما پرداخت می‌گردد.',
        'در صورت رد درخواست، دلیل آن به شما اعلام می‌شود و می‌توانید پس از رفع موارد اعلام‌شده دوباره درخواست دهید.',
      ],
    },
    contentEn: {
      paragraphs: [
        'To teach on LingoSpeak, complete the application form with the languages and levels you teach, your experience, your documents, and a short introduction video.',
        'The LingoSpeak team reviews your application. Documents are verified separately, and your profile becomes public and searchable only after final approval.',
        'You propose your trial and regular lesson prices; the team can approve them or make a counter-offer. The trial price is half the regular price.',
        'Earnings from each lesson are credited to your wallet after the lesson is completed, net of the platform commission, and paid out to your bank account in the settlement cycle.',
        'If your application is rejected you will be told why, and you can reapply once you have addressed the reasons given.',
      ],
    },
  },
];

export async function seedCmsPages(db: PrismaClient) {
  for (const page of PUBLIC_CMS_PAGES)
    await db.cmsPage.upsert({
      where: { slug: page.slug },
      create: { ...page, seo: { description: page.titleFa }, published: true },
      // Content is deliberately not overwritten. `db:prepare` runs the seed, and
      // `start:api` runs `db:prepare`, so re-writing the body here reverted every
      // admin edit to the legal and CMS pages on each deploy. The seed's job is to
      // guarantee the page exists and is reachable; the admin panel owns the text
      // from then on.
      update: { published: true },
    });
  return PUBLIC_CMS_PAGES.length;
}
