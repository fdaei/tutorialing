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
      intro: 'یادگیری زبان، وقتی نتیجه می‌دهد که اصولی باشد.',
      paragraphs: [
        'لینگو اسپیک از سال ۲۰۱۴ با یک هدف مشخص فعالیت خود را آغاز کرد: ارائه آموزش زبان به شیوه‌ای اصولی، حرفه‌ای و نتیجه‌محور.',
        'ایده شکل‌گیری لینگو اسپیک زمانی به وجود آمد که دیدیم در فضای آموزش زبان، روش‌های غیراصولی و وعده‌های غیرواقعی روزبه‌روز بیشتر می‌شوند؛ روش‌هایی که گاهی به جای ساختن یک پایه زبانی قوی، تنها به دنبال ایجاد مسیرهای ظاهراً سریع و ساده برای یادگیری هستند.',
        'ما معتقدیم یادگیری واقعی یک زبان، میان‌بُر جادویی ندارد؛ اما با مدرس متخصص، مسیر آموزشی درست، تمرین مستمر و پشتیبانی مناسب می‌توان این مسیر را بسیار مؤثرتر و هدفمندتر طی کرد.',
        'چه زبان‌هایی در لینگو اسپیک آموزش داده می‌شود؟ در لینگو اسپیک دوره‌های زبان انگلیسی، آلمانی و فرانسوی به صورت آنلاین و خصوصی برگزار می‌شوند.',
        'خصوصی بودن کلاس‌ها این امکان را ایجاد می‌کند که روند آموزش بر اساس سطح، هدف، نقاط قوت و ضعف و سرعت یادگیری هر زبان‌آموز تنظیم شود. به همین دلیل، برنامه آموزشی یک فرد که برای مهاجرت زبان می‌آموزد لزوماً با فردی که برای اهداف کاری یا علاقه شخصی زبان می‌خواند یکسان نخواهد بود.',
        'چیزی فراتر از حضور در کلاس: از نگاه ما، یادگیری زبان فقط به زمان برگزاری کلاس محدود نمی‌شود. به همین دلیل در لینگو اسپیک، زبان‌آموزان در طول مسیر آموزشی از پشتیبانی و پیگیری درسی برخوردار هستند. تمرین‌ها و Homeworkها بررسی و تصحیح می‌شوند و روند پیشرفت زبان‌آموز به صورت مستمر مورد توجه قرار می‌گیرد.',
        'هدف این است که زبان‌آموز بین جلسات کلاس نیز ارتباط خود را با فرآیند یادگیری حفظ کند و بداند برای پیشرفت، در هر مرحله باید روی چه موضوعاتی بیشتر تمرکز کند.',
        'مهم‌ترین تفاوت لینگو اسپیک: یکی از مهم‌ترین معیارهای ما، تخصص مدرس در زمینه آموزش زبان است. دانستن یک زبان، الزاماً به معنی توانایی تدریس آن نیست. آموزش حرفه‌ای نیازمند شناخت روش‌های تدریس، درک فرآیند یادگیری زبان، توانایی تشخیص نیازهای زبان‌آموز و انتخاب مسیر آموزشی مناسب است.',
        'به همین دلیل تلاش کرده‌ایم همکاری با مدرسینی را در اولویت قرار دهیم که علاوه بر تسلط زبانی، در زمینه آموزش و تدریس زبان تخصص و تجربه داشته باشند.',
        'لینگو اسپیک برای چه کسانی است؟ فرقی نمی‌کند هدفتان از یادگیری زبان چیست؛ مهاجرت، تحصیل، پیشرفت شغلی، ارتباطات بین‌المللی، سفر یا حتی علاقه شخصی.',
        'در لینگو اسپیک تلاش می‌کنیم متناسب با هدف شما، یک مسیر آموزشی مشخص و اصولی طراحی کنیم تا به جای سردرگمی میان منابع و روش‌های مختلف، بدانید از کجا شروع کنید، چه مسیری را طی کنید و برای رسیدن به هدف خود روی چه مهارت‌هایی تمرکز داشته باشید.',
        'فلسفه ما ساده است: ما به وعده‌های یک‌شبه اعتقادی نداریم. به آموزش درست، تمرین هدفمند، مدرس متخصص و استمرار اعتقاد داریم.',
        'لینگو اسپیک از سال ۲۰۱۴ با همین نگاه شکل گرفته و هدف ما این است که زبان‌آموزان، زبان را نه صرفاً برای تمام کردن یک کتاب یا دوره، بلکه برای استفاده واقعی در زندگی، تحصیل، کار و ارتباطات خود یاد بگیرند.',
      ],
    },
    contentEn: {
      intro: 'Language learning pays off when it is done properly.',
      paragraphs: [
        'LingoSpeak started in 2014 with one clear goal: to teach languages in a principled, professional and results-driven way.',
        'The idea came when we saw unprincipled methods and unrealistic promises multiplying in language education — approaches that chase routes that only look quick and easy instead of building a strong foundation.',
        'We believe real language learning has no magic shortcut. With a specialist teacher, the right learning route, consistent practice and proper support, though, the journey becomes far more effective and purposeful.',
        'Which languages do we teach? LingoSpeak runs private online courses in English, German and French.',
        "Private classes let us shape the lessons around each learner's level, goal, strengths, weaknesses and pace. Someone learning a language to emigrate will not follow the same plan as someone learning it for work or personal interest.",
        'More than attending a class: learning does not stop when the lesson ends. LingoSpeak learners get study support and follow-up throughout their course. Exercises and homework are reviewed and corrected, and progress is tracked continuously.',
        'The aim is for learners to stay connected to their learning between lessons and to know what to focus on at every stage.',
        "What sets LingoSpeak apart: one of our most important criteria is the teacher's expertise in language teaching. Knowing a language does not mean being able to teach it. Professional teaching takes an understanding of teaching methods and of how languages are learned, the ability to identify a learner's needs, and the judgement to choose the right route.",
        'That is why we prioritise teachers who, beyond their command of the language, have specialist training and experience in teaching it.',
        'Who is LingoSpeak for? Whatever your reason for learning — emigration, study, career growth, international communication, travel or simply interest.',
        'We design a clear, principled route around your goal, so instead of getting lost among resources and methods you know where to start, which path to take and which skills to focus on.',
        'Our philosophy is simple: we do not believe in overnight promises. We believe in proper teaching, purposeful practice, specialist teachers and consistency.',
        'LingoSpeak has worked this way since 2014. Our goal is for learners to learn a language not just to finish a book or a course, but to use it for real in their lives, studies, work and relationships.',
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
        'ساعت کاری مجموعه ۱۰ صبح تا ۵ عصر است. لطفاً برای هماهنگی، کنسلی و جابه‌جایی کلاس‌ها در همین ساعت‌ها اقدام کنید.',
        'تلفن: ۰۹۹۱۴۶۷۳۶۸۳',
        'رایانامه: Arezoo.ahmadi.39@gmail.com',
        'نشانی: «نشانی کامل شرکت را وارد کنید»',
        'شناسه ملی / شماره ثبت: «شماره ثبت را وارد کنید»',
        'برای پیگیری سفارش، رزرو یا پرداخت، از بخش «تیکت پشتیبانی» در پنل کاربری خود استفاده کنید تا درخواست شما ثبت و قابل پیگیری باشد.',
      ],
    },
    contentEn: {
      paragraphs: [
        'Office hours are 10:00 to 17:00. Please arrange, cancel or reschedule classes within these hours.',
        'Phone: +98 991 467 3683',
        'Email: Arezoo.ahmadi.39@gmail.com',
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
      intro: 'قوانین به‌روزشده مجموعه لینگو اسپیک برای زبان‌آموزان و مدرسین.',
      paragraphs: [
        '۱. ترم‌های مجموعه به صورت ۱۵ جلسه‌ای هستند و هر زبان‌آموز در طول ترم می‌تواند ۲ جلسه کنسلی، با هماهنگی حداقل یک روز کاری قبل با خانم آرزو احمدی، داشته باشد.',
        '۲. بیشتر از ۲ جلسه کنسلی غیبت محسوب می‌شود و آن جلسه جزو جلسات شما حساب می‌شود.',
        '۳. برای جلسات کنسل‌شده باید جلسه جبرانی برگزار شود تا ترم زبان‌آموز طبق برنامه‌ریزی به پایان برسد.',
        '۴. در صورت عدم توانایی شرکت در کلاس برای مدت طولانی، لطفاً کلاس خود را به حالت فریز دربیاورید تا جلسات برای شما محاسبه نشوند.',
        '۵. فریز کلاس‌ها فقط یک ماه اعتبار دارد.',
        '۶. زبان‌آموز باید رأس ساعت وارد لینک اختصاصی خود شود و در کلاس شرکت کند.',
        '۷. اگر زبان‌آموز به‌موقع سر کلاس حاضر نشود، مدرس می‌تواند بعد از ۲۰ دقیقه از کلاس خارج شود و آن جلسه غیبت محسوب می‌شود.',
        '۸. زبان‌آموز گرامی، اگر تمایل به ادامه کلاس با مدرس خود و در ساعت خود دارید، لطفاً ثبت‌نام ترم جدید را تا قبل از جلسه ۱۳ ترم کنونی تکمیل کنید.',
        '۹. مدرسین پس از هر جلسه فایل کلاس را در اختیار شما قرار خواهند داد.',
        '۱۰. زبان‌آموزان چرخشی باید طبق برنامه‌ای که برای کلاس آن‌ها چیده شده در کلاس خود شرکت کنند.',
        '۱۱. با توجه به شرایط کنونی کشور و قطعی برق، لطفاً با نصب برنامه «برق من» از ساعات احتمالی قطع برق منطقه خود اطلاع پیدا کنید و شرایط حضور در کلاس را برای خود فراهم کنید.',
        '۱۲. با توجه به برگزاری جلسه تست برای اطمینان زبان‌آموز از ثبت‌نام ترم پیش رو، به هیچ وجه عودت وجه نداریم.',
        '۱۳. اگر مدرس در روز کلاس سر کلاس حاضر نشود، علاوه بر جلسه جبرانی آن روز، باید یک جلسه رایگان برای زبان‌آموز در نظر بگیرد.',
        '۱۴. لطفاً در ساعات کاری برای هماهنگی‌های کلاس خود اقدام کنید. ساعت کاری مجموعه ۱۰ صبح تا ۵ عصر است؛ پس در همان ساعت‌ها برای کنسلی و جابه‌جایی کلاس خود اقدام نمایید.',
        '۱۵. مدرس در صورت شروع کلاس با تأخیر، باید زمان از دست رفته را برای زبان‌آموز جبران کند.',
      ],
    },
    contentEn: {
      intro: 'The updated LingoSpeak rules for learners and teachers.',
      paragraphs: [
        '1. Terms run for 15 sessions. During a term each learner may cancel up to 2 sessions, arranged with Ms Arezoo Ahmadi at least one working day in advance.',
        '2. Any cancellation beyond those 2 counts as an absence, and the session is counted as used.',
        "3. Cancelled sessions must be made up so the learner's term finishes on schedule.",
        '4. If you cannot attend for an extended period, please freeze your class so the sessions are not counted.',
        '5. A class freeze is valid for one month only.',
        '6. Learners must join their personal class link on time and attend the class.',
        '7. If a learner has not arrived, the teacher may leave after 20 minutes and the session counts as an absence.',
        '8. To keep your teacher and time slot, please complete registration for the next term before session 13 of your current term.',
        '9. Teachers share the class file with you after every session.',
        '10. Learners on a rotating schedule must attend according to the schedule arranged for their class.',
        '11. Given the country\'s current conditions and power cuts, please install the "Bargh-e Man" app to see your area\'s likely outage times and make sure you can attend.',
        '12. Because a test session is held so learners can be confident before registering for a term, fees are non-refundable.',
        '13. If a teacher does not show up on the day of a class, they must hold a make-up session and give the learner one additional free session.',
        '14. Please arrange class matters during office hours, 10:00 to 17:00, including cancellations and rescheduling.',
        '15. If a teacher starts a class late, they must make up the lost time for the learner.',
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
        'پیش از ثبت‌نام هر ترم، جلسه تست برگزار می‌شود تا زبان‌آموز با کلاس و شیوه تدریس مدرس آشنا شود و با اطمینان ثبت‌نام کند. به همین دلیل، هزینه ثبت‌نام و جلسات پس از پرداخت به هیچ وجه عودت داده نمی‌شود.',
        'هر زبان‌آموز در طول یک ترم ۱۵ جلسه‌ای می‌تواند ۲ جلسه را، با هماهنگی حداقل یک روز کاری قبل با خانم آرزو احمدی، کنسل کند. برای این جلسات، جلسه جبرانی برگزار می‌شود تا ترم طبق برنامه به پایان برسد.',
        'کنسلی بیش از ۲ جلسه، یا کنسلی بدون هماهنگی در مهلت تعیین‌شده، غیبت محسوب می‌شود و آن جلسه جزو جلسات ترم شما حساب می‌گردد.',
        'اگر زبان‌آموز به‌موقع سر کلاس حاضر نشود، مدرس می‌تواند پس از ۲۰ دقیقه از کلاس خارج شود و آن جلسه غیبت محسوب می‌شود.',
        'اگر برای مدت طولانی امکان شرکت در کلاس را ندارید، به جای کنسلی کلاس خود را فریز کنید تا جلسات برای شما محاسبه نشوند. فریز کلاس فقط یک ماه اعتبار دارد.',
        'اگر مدرس در روز کلاس حاضر نشود، علاوه بر جلسه جبرانی آن روز، یک جلسه رایگان برای زبان‌آموز در نظر گرفته می‌شود. اگر کلاس با تأخیر مدرس شروع شود، زمان از دست رفته برای زبان‌آموز جبران می‌شود.',
        'درخواست کنسلی، جابه‌جایی و فریز کلاس فقط در ساعات کاری مجموعه، ۱۰ صبح تا ۵ عصر، پذیرفته می‌شود.',
        'اگر پرداخت شما پس از پایان مهلت پرداخت به سامانه برسد و نوبت مورد نظر آزاد شده باشد، ثبت‌نامی انجام نشده و مبلغ به‌طور خودکار به کیف پول شما بازگردانده می‌شود.',
      ],
    },
    contentEn: {
      paragraphs: [
        "A test session is held before every term so learners can get to know the class and the teacher's approach and register with confidence. For that reason, registration and session fees are non-refundable once paid.",
        'During a 15-session term each learner may cancel up to 2 sessions, arranged with Ms Arezoo Ahmadi at least one working day in advance. Those sessions are made up so the term finishes on schedule.',
        'Any cancellation beyond those 2, or without notice within that deadline, counts as an absence and the session is counted as used.',
        'If a learner has not arrived, the teacher may leave after 20 minutes and the session counts as an absence.',
        'If you cannot attend for an extended period, freeze your class instead of cancelling so the sessions are not counted. A freeze is valid for one month only.',
        'If a teacher does not show up on the day of a class, the learner receives the make-up session plus one additional free session. If a teacher starts late, the lost time is made up.',
        'Cancellation, rescheduling and freeze requests are accepted only during office hours, 10:00 to 17:00.',
        'If your payment reaches us after the payment window has closed and the slot has been released, no registration is made and the amount is returned to your wallet automatically.',
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

// The previous seeded defaults for pages whose baseline text has since been
// replaced. A page whose stored content still equals one of these was never
// edited from the admin panel, so the seed may safely move it to the new text;
// any other content is the admin's and is left alone.
const SUPERSEDED_DEFAULTS: Record<string, { contentFa: unknown; contentEn: unknown }> = {
  'cancellation-policy': {
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
  about: {
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
  contact: {
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
  terms: {
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
};

const canonicalJson = (value: unknown): string =>
  Array.isArray(value)
    ? `[${value.map(canonicalJson).join(',')}]`
    : value && typeof value === 'object'
      ? `{${Object.keys(value)
          .sort()
          .map((key) => `${JSON.stringify(key)}:${canonicalJson((value as Record<string, unknown>)[key])}`)
          .join(',')}}`
      : JSON.stringify(value);

const sameJson = (a: unknown, b: unknown) => canonicalJson(a) === canonicalJson(b);

export async function seedCmsPages(db: PrismaClient) {
  for (const page of PUBLIC_CMS_PAGES) {
    const superseded = SUPERSEDED_DEFAULTS[page.slug];
    const stored = superseded
      ? await db.cmsPage.findUnique({ where: { slug: page.slug }, select: { contentFa: true, contentEn: true } })
      : null;
    await db.cmsPage.upsert({
      where: { slug: page.slug },
      create: { ...page, seo: { description: page.titleFa }, published: true },
      // Content is deliberately not overwritten. `db:prepare` runs the seed, and
      // `start:api` runs `db:prepare`, so re-writing the body here reverted every
      // admin edit to the legal and CMS pages on each deploy. The seed's job is to
      // guarantee the page exists and is reachable; the admin panel owns the text
      // from then on. The one exception is a locale still holding a superseded
      // seed default, which no admin has touched.
      update: {
        published: true,
        ...(stored && superseded && sameJson(stored.contentFa, superseded.contentFa) && { contentFa: page.contentFa }),
        ...(stored && superseded && sameJson(stored.contentEn, superseded.contentEn) && { contentEn: page.contentEn }),
      },
    });
  }
  return PUBLIC_CMS_PAGES.length;
}
