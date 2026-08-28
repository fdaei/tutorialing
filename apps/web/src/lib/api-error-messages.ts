export type ApiLocale = 'fa' | 'en';

export const API_ERROR_MESSAGES: Record<string, Record<ApiLocale, string>> = {
  GOOGLE_AUTH_NOT_CONFIGURED: { fa: 'ورود با گوگل هنوز تنظیم نشده است.', en: 'Google sign-in is not configured yet.' },
  GOOGLE_TOKEN_INVALID: { fa: 'ورود با گوگل معتبر نبود؛ دوباره تلاش کنید.', en: 'Google sign-in was invalid. Try again.' },
  INVALID_CREDENTIALS: {
    fa: 'ایمیل، شماره موبایل یا رمز عبور اشتباه است.',
    en: 'The email, mobile number, or password is incorrect.',
  },
  IDENTITY_INVALID: {
    fa: 'ایمیل یا شماره موبایل واردشده معتبر نیست.',
    en: 'Enter a valid email address or mobile number.',
  },
  IDENTITY_ALREADY_REGISTERED: {
    fa: 'قبلاً حسابی با این ایمیل یا شماره موبایل ساخته شده است.',
    en: 'An account already exists with this email address or mobile number.',
  },
  RATE_LIMITED: {
    fa: 'درخواست‌های شما بیش از حد مجاز است. {0} ثانیه دیگر دوباره تلاش کنید.',
    en: 'Too many requests. Try again in {0} seconds.',
  },
  SELF_PRIVILEGE_CHANGE: {
    fa: 'نمی‌توانید نقش یا دسترسی خودتان را تغییر دهید؛ این کار باید توسط مدیر دیگری انجام شود.',
    en: 'You cannot change your own roles or permissions; another administrator must do it.',
  },
  ADMIN_GRANT_REQUIRES_ADMIN: {
    fa: 'فقط یک مدیر کل می‌تواند نقش مدیر کل را اعطا کند.',
    en: 'Only an existing ADMIN can grant the ADMIN role.',
  },
  PRIVILEGED_ROLE_GRANT_REQUIRES_ADMIN: {
    fa: 'فقط یک مدیر کل می‌تواند این نقش را اعطا کند.',
    en: 'Only an existing ADMIN can grant this role.',
  },
  ELEVATED_PERMISSION_GRANT_REQUIRES_ADMIN: {
    fa: 'فقط یک مدیر کل می‌تواند این دسترسی را اعطا کند.',
    en: 'Only an existing ADMIN can grant this permission.',
  },
  SEARCH_PERMISSION_REQUIRED: {
    fa: 'شما دسترسی لازم برای جست‌وجوی این بخش را ندارید.',
    en: 'You do not have the required permission to search this entity.',
  },
  OTP_RESEND_TOO_SOON: {
    fa: '{0} ثانیه دیگر می‌توانید کد جدید بخواهید.',
    en: 'You can request a new code in {0} seconds.',
  },
  OTP_HOURLY_LIMIT: {
    fa: 'تعداد درخواست کد در یک ساعت گذشته بیش از حد مجاز است. بعداً دوباره تلاش کنید.',
    en: 'You have requested too many codes in the past hour. Try again later.',
  },
  OTP_ATTEMPTS_EXCEEDED: {
    fa: 'تعداد تلاش‌های نادرست بیش از حد مجاز است. کد جدید بخواهید.',
    en: 'Too many incorrect attempts. Request a new code.',
  },
  TEACHER_PROFILE_NOT_FOUND: {
    fa: 'پروفایل مدرس پیدا نشد.',
    en: 'Teacher profile was not found.',
  },
  AVAILABILITY_RULE_OVERLAP: {
    fa: 'دو بازه برنامه هفتگی با هم هم‌پوشانی دارند. زمان شروع یا پایان یکی از بازه‌ها را تغییر دهید.',
    en: 'Two weekly availability ranges overlap. Change the start or end time of one range.',
  },
  AVAILABILITY_WEEKDAY_INVALID: {
    fa: 'روز هفته معتبر نیست.',
    en: 'The weekday is invalid.',
  },
  AVAILABILITY_TIME_INVALID: {
    fa: 'ساعت شروع یا پایان معتبر نیست.',
    en: 'The start or end time is invalid.',
  },
  AVAILABILITY_END_BEFORE_START: {
    fa: 'ساعت پایان باید بعد از ساعت شروع باشد.',
    en: 'The end time must be after the start time.',
  },
  LESSON_DURATION_INVALID: {
    fa: 'مدت کلاس باید بین ۱۵ تا ۲۴۰ دقیقه باشد.',
    en: 'Lesson duration must be between 15 and 240 minutes.',
  },
  BREAK_DURATION_INVALID: {
    fa: 'فاصله بین کلاس‌ها باید بین صفر تا ۱۲۰ دقیقه باشد.',
    en: 'The break between lessons must be between 0 and 120 minutes.',
  },
  AVAILABILITY_RANGE_TOO_SHORT: {
    fa: 'این بازه برای مدت کلاس انتخاب‌شده کوتاه است.',
    en: 'This range is shorter than the selected lesson duration.',
  },
  TIMEZONE_INVALID: {
    fa: 'منطقه زمانی معتبر نیست.',
    en: 'The timezone is invalid.',
  },
  AVAILABILITY_DATE_PAST: {
    fa: 'برای استثنا باید امروز یا یک تاریخ آینده را انتخاب کنید.',
    en: 'Choose today or a future date for an exception.',
  },
  OVERRIDE_TIME_INVALID: {
    fa: 'برای روز آزاد، یک بازه زمانی معتبر تعیین کنید.',
    en: 'Set a valid time range for an available exception.',
  },
  AVAILABILITY_OVERRIDE_NOT_FOUND: {
    fa: 'استثنای زمانی پیدا نشد.',
    en: 'Availability exception was not found.',
  },
  TEACHER_REQUIRED: {
    fa: 'مدرس را انتخاب کنید.',
    en: 'Select a teacher.',
  },
  TEACHER_NOT_FOUND: {
    fa: 'مدرس انتخاب‌شده پیدا نشد.',
    en: 'The selected teacher was not found.',
  },
  BLOCKED_PERIOD_DATE_INVALID: {
    fa: 'تاریخ یا ساعت مسدودی معتبر نیست.',
    en: 'The blocked period date or time is invalid.',
  },
  BLOCKED_PERIOD_PAST: {
    fa: 'بازه گذشته را نمی‌توان مسدود کرد.',
    en: 'A past period cannot be blocked.',
  },
  BLOCKED_PERIOD_OVERLAP: {
    fa: 'این بازه با یک مسدودی دیگر تداخل دارد.',
    en: 'This period overlaps another blocked period.',
  },
  BLOCKED_PERIOD_NOT_FOUND: {
    fa: 'بازه مسدودشده پیدا نشد یا اجازه حذف آن را ندارید.',
    en: 'The blocked period was not found or you cannot delete it.',
  },
  TEACHER_NOT_BOOKABLE: {
    fa: 'این مدرس در حال حاضر برای رزرو فعال نیست.',
    en: 'This teacher is not currently available for booking.',
  },
  SLOT_OUTSIDE_AVAILABILITY: {
    fa: 'این ساعت در برنامه آزاد مدرس نیست. یک ساعت دیگر انتخاب کنید.',
    en: 'This time is outside the teacher’s availability. Choose another slot.',
  },
  SLOT_BLOCKED_BY_TEACHER: {
    fa: 'این بازه توسط مدرس مسدود شده است. یک ساعت دیگر انتخاب کنید.',
    en: 'This period is blocked by the teacher. Choose another slot.',
  },
  SLOT_ALREADY_BOOKED: {
    fa: 'این زمان لحظاتی قبل رزرو شده است. یک ساعت دیگر انتخاب کنید.',
    en: 'This slot was just booked. Choose another time.',
  },
  AVAILABILITY_RANGE_INVALID: {
    fa: 'بازه دریافت نوبت معتبر نیست و حداکثر می‌تواند ۳۱ روز باشد.',
    en: 'The slot range is invalid and cannot exceed 31 days.',
  },
  CANCELLATION_POLICY_NOT_ACCEPTED: {
    fa: 'برای ادامه باید سیاست لغو جلسه را مطالعه و تأیید کنید.',
    en: 'Read and accept the cancellation policy before continuing.',
  },
  BOOKING_START_INVALID: {
    fa: 'زمان شروع باید یک تاریخ و ساعت معتبر در آینده باشد.',
    en: 'The start time must be a valid future date and time.',
  },
  SLOT_LOCKED: {
    fa: 'کاربر دیگری در حال رزرو این ساعت است. چند لحظه بعد دوباره تلاش کنید یا ساعت دیگری انتخاب کنید.',
    en: 'Another user is reserving this slot. Try again shortly or choose another time.',
  },
  STUDENT_BOOKING_OVERLAP: {
    fa: 'در این ساعت یک رزرو دیگر دارید. ساعت دیگری انتخاب کنید.',
    en: 'You already have another booking at this time. Choose another slot.',
  },
  ENROLLMENT_INVALID: {
    fa: 'بسته آموزشی انتخاب‌شده معتبر یا فعال نیست.',
    en: 'The selected enrollment is invalid or inactive.',
  },
  LESSON_CREDIT_INSUFFICIENT: {
    fa: 'اعتبار جلسه این بسته کافی نیست.',
    en: 'This enrollment does not have enough lesson credit.',
  },
  BOOKING_LEAD_TIME_TOO_SHORT: {
    fa: 'رزرو باید حداقل {0} دقیقه پیش از شروع کلاس انجام شود.',
    en: 'A lesson must be booked at least {0} minutes before it starts.',
  },
  BOOKING_TOO_FAR_AHEAD: {
    fa: 'تا حداکثر {0} روز آینده می‌توانید رزرو کنید.',
    en: 'You can book up to {0} days ahead.',
  },
  TRIAL_SESSION_REQUIRED: {
    fa: '',
    en: '',
  },
  TRIAL_ALREADY_USED: {
    fa: 'شما قبلاً با این مدرس جلسه آزمایشی داشته‌اید. برای ادامه، کلاس عادی رزرو کنید.',
    en: 'You have already had a trial session with this teacher. Book a regular lesson to continue.',
  },
  CANCELLATION_REASON_REQUIRED: {
    fa: 'دلیل لغو را وارد کنید.',
    en: 'Enter a cancellation reason.',
  },
  BOOKING_NOT_FOUND: {
    fa: 'رزرو پیدا نشد.',
    en: 'Booking was not found.',
  },
  BOOKING_NOT_CANCELLABLE: {
    fa: 'این رزرو در وضعیت فعلی قابل لغو نیست.',
    en: 'This booking cannot be cancelled in its current status.',
  },
  BOOKING_NOT_RESCHEDULABLE: {
    fa: 'فقط رزرو تأییدشده قابل جابه‌جایی است.',
    en: 'Only a confirmed booking can be rescheduled.',
  },
  NO_RESCHEDULE_REQUEST: {
    fa: 'درخواست جابه‌جایی فعالی برای این کلاس وجود ندارد.',
    en: 'There is no active reschedule request for this lesson.',
  },
  RESCHEDULE_SELF_ACCEPT: {
    fa: 'تأیید جابه‌جایی باید توسط طرف دیگر انجام شود.',
    en: 'The other party has to accept the reschedule.',
  },
  RESCHEDULE_REQUEST_STALE: {
    fa: 'زمان پیشنهادی گذشته است. از طرف مقابل بخواهید زمان جدیدی پیشنهاد کند.',
    en: 'The proposed time has passed. Ask the other party to propose a new one.',
  },
  RESCHEDULE_SELF_DECLINE: {
    fa: 'رد درخواست باید توسط طرف دیگر انجام شود.',
    en: 'The other party has to respond to the request.',
  },
  BOOKING_OWNERSHIP_REQUIRED: {
    fa: 'فقط مدرس همین کلاس می‌تواند حضور را ثبت کند.',
    en: 'Only this booking’s teacher can record attendance.',
  },
  ATTENDANCE_STATUS_INVALID: {
    fa: 'ثبت حضور فقط برای رزرو تأییدشده ممکن است.',
    en: 'Attendance can only be recorded for a confirmed booking.',
  },
  BOOKING_NOT_COMPLETABLE: {
    fa: 'فقط کلاس تأییدشده قابل تکمیل است.',
    en: 'Only a confirmed booking can be completed.',
  },
  BOOKING_NOT_ENDED: {
    fa: 'کلاس هنوز به پایان نرسیده است و نمی‌توان آن را تکمیل کرد.',
    en: 'The lesson has not ended yet and cannot be completed.',
  },
  TEACHER_ATTENDANCE_REQUIRED: {
    fa: 'قبل از تکمیل کلاس، حضور مدرس را ثبت کنید.',
    en: 'Record teacher attendance before completing the class.',
  },
  PACKAGE_TIER_INVALID: {
    fa: 'تعداد جلسات بسته باید یکی از مقادیر {0} باشد.',
    en: 'Package session count must be one of {0}.',
  },
  PAYMENT_KEY_CONFLICT: {
    fa: 'این کلید پرداخت قبلاً استفاده شده است.',
    en: 'This payment key has already been used.',
  },
  DISCOUNT_INVALID: {
    fa: 'کد تخفیف معتبر نیست یا منقضی شده است.',
    en: 'The discount code is invalid or has expired.',
  },
  DISCOUNT_LIMIT_REACHED: {
    fa: 'ظرفیت استفاده از این کد تخفیف تکمیل شده است.',
    en: 'This discount code has reached its usage limit.',
  },
  WALLET_AMOUNT_INVALID: {
    fa: 'مبلغ انتخاب‌شده از کیف پول بیشتر از موجودی یا مبلغ قابل پرداخت است.',
    en: 'The selected wallet amount exceeds your balance or the payable amount.',
  },
  WALLET_BALANCE_CONFLICT: {
    fa: 'موجودی کیف پول شما هم‌زمان در پرداخت دیگری استفاده شد. صفحه را دوباره بارگذاری کنید.',
    en: 'Your wallet balance was spent by another payment at the same time. Reload and try again.',
  },
  BOOKING_PAYMENT_EXISTS: {
    fa: 'برای این جلسه پرداخت دیگری در جریان است یا تکمیل شده است.',
    en: 'Another payment for this booking is already in progress or completed.',
  },
  PAYMENT_GATEWAY_BUSY: {
    fa: 'درخواست پرداخت قبلی هنوز در حال پردازش است. لطفاً چند لحظه صبر کنید.',
    en: 'A previous payment request is still being processed. Please wait a moment and try again.',
  },
  PAYOUT_PERIOD_INVALID: {
    fa: 'بازه تسویه معتبر نیست.',
    en: 'The payout period is invalid.',
  },
  NO_ELIGIBLE_TEACHER_EARNINGS: {
    fa: 'در این بازه درآمد قابل تسویه‌ای پیدا نشد. فقط کلاس‌هایی که برگزار و تکمیل شده‌اند، حضور مدرس برای آن‌ها ثبت شده و قبلاً تسویه نشده‌اند وارد تسویه می‌شوند.',
    en: 'No payable teacher earnings were found in this period. Only completed lessons with recorded teacher attendance that have not already been paid are eligible.',
  },
  PAYOUT_BATCH_NOT_APPROVABLE: {
    fa: 'این دسته تسویه در وضعیت فعلی قابل تأیید نیست.',
    en: 'This payout batch cannot be approved in its current status.',
  },
  WITHDRAWAL_KEY_CONFLICT: {
    fa: 'این کلید قبلاً استفاده شده است.',
    en: 'This idempotency key has already been used.',
  },
  WITHDRAWAL_INSUFFICIENT_BALANCE: {
    fa: 'مبلغ برداشت بیشتر از موجودی قابل برداشت است.',
    en: 'The withdrawal amount exceeds the available balance.',
  },
  WITHDRAWAL_NOT_TRANSFERABLE: {
    fa: 'این درخواست قبلاً تعیین تکلیف شده است.',
    en: 'This request has already been processed.',
  },
  WITHDRAWAL_REFERENCE_REQUIRED: {
    fa: 'شماره پیگیری بانکی الزامی است.',
    en: 'A bank transfer reference is required.',
  },
  PAYMENT_NOT_REFUNDABLE: {
    fa: 'این پرداخت هنوز تسویه نشده و قابل بازگشت وجه نیست.',
    en: 'This payment has not been captured yet and cannot be refunded.',
  },
  FILE_TYPE_NOT_ALLOWED: {
    fa: 'فرمت فایل مجاز نیست. برای مدارک PDF، JPG یا PNG و برای ویدئو MP4، WebM یا MOV انتخاب کنید.',
    en: 'The file type is not allowed. Use PDF, JPG, or PNG for documents and MP4, WebM, or MOV for videos.',
  },
  FILE_SIZE_INVALID: {
    fa: 'حجم فایل باید بیشتر از صفر و حداکثر ۵۰ مگابایت باشد.',
    en: 'The file must be larger than zero and no more than 50 MB.',
  },
  SUPPORT_ATTACHMENT_INVALID: {
    fa: 'ضمیمه معتبر نیست. فایل PDF، JPG یا PNG تا ۱۰ مگابایت انتخاب کنید.',
    en: 'The attachment is invalid. Select a PDF, JPG, or PNG file up to 10 MB.',
  },
  FILE_CHECKSUM_INVALID: {
    fa: 'اعتبارسنجی فایل ناموفق بود. فایل را دوباره انتخاب کنید.',
    en: 'File validation failed. Select the file again.',
  },
  UPLOAD_NOT_FOUND: {
    fa: 'آپلود پیدا نشد یا قبلاً تکمیل شده است.',
    en: 'The upload was not found or has already been completed.',
  },
  UPLOAD_CHECKSUM_MISMATCH: {
    fa: 'محتوای فایل با فایل انتخاب‌شده مطابقت ندارد.',
    en: 'The uploaded content does not match the selected file.',
  },
  UPLOAD_CONTENT_MISSING: {
    fa: 'ارسال فایل به فضای ذخیره‌سازی کامل نشد. اتصال را بررسی و دوباره تلاش کنید.',
    en: 'The file was not fully uploaded to storage. Check the connection and try again.',
  },
  UPLOAD_VALIDATION_FAILED: {
    fa: 'فایل دریافت شد اما اندازه، نوع یا محتوای آن معتبر نیست. فایل را دوباره بارگذاری کنید.',
    en: 'The file was received, but its size, type, or content is invalid. Upload it again.',
  },
  FILE_NOT_FOUND: {
    fa: 'فایل پیدا نشد یا اجازه مشاهده آن را ندارید.',
    en: 'The file was not found or you cannot access it.',
  },
  LANGUAGE_CODE_INVALID: {
    fa: 'کد زبان باید کوتاه و استاندارد باشد؛ مانند en، de یا pt-BR.',
    en: 'The language code must be a short standard code such as en, de, or pt-BR.',
  },
  LANGUAGE_NAME_REQUIRED: {
    fa: 'نام فارسی، نام انگلیسی و نام بومی زبان باید تکمیل شوند.',
    en: 'Persian, English, and native language names are required.',
  },
  LANGUAGE_CODE_EXISTS: {
    fa: 'این کد زبان قبلاً ثبت شده است.',
    en: 'This language code already exists.',
  },
  LANGUAGE_NOT_FOUND: {
    fa: 'زبان پیدا نشد.',
    en: 'Language not found.',
  },
  LANGUAGE_IN_USE: {
    fa: 'این زبان در مدرس‌ها، آزمون‌ها یا تطبیق‌های قبلی استفاده شده و قابل حذف نیست. آن را غیرفعال کنید.',
    en: 'This language is used by teachers, tests, or matching history and cannot be deleted. Deactivate it instead.',
  },
  MATCH_LANGUAGE_INVALID: {
    fa: 'زبان آموزشی انتخاب‌شده فعال یا معتبر نیست.',
    en: 'The selected educational language is invalid or inactive.',
  },
  SEARCH_ENTITY_INVALID: {
    fa: 'نوع جستجو معتبر نیست.',
    en: 'Search entity is invalid.',
  },
  TICKET_NOT_FOUND: {
    fa: 'تیکت پیدا نشد یا دسترسی مشاهده آن را ندارید.',
    en: 'Ticket was not found or you cannot view it.',
  },
  TICKET_OWNERSHIP_REQUIRED: {
    fa: 'اجازه پاسخ به این تیکت را ندارید.',
    en: 'You cannot reply to this ticket.',
  },
  INTERNAL_NOTE_STAFF_ONLY: {
    fa: 'یادداشت داخلی فقط برای تیم پشتیبانی است.',
    en: 'Internal notes are staff-only.',
  },
  TICKET_CLOSED: {
    fa: 'این تیکت بسته است. برای موضوع جدید تیکت تازه ایجاد کنید.',
    en: 'This ticket is closed. Create a new ticket for a new issue.',
  },
  TICKET_STATUS_STAFF_ONLY: {
    fa: 'فقط تیم پشتیبانی می‌تواند وضعیت تیکت را تغییر دهد.',
    en: 'Only support staff can change ticket status.',
  },
  TICKET_ASSIGNMENT_STAFF_ONLY: {
    fa: 'فقط تیم پشتیبانی می‌تواند مسئول تیکت را تعیین کند.',
    en: 'Only support staff can assign tickets.',
  },
  TICKET_ASSIGNEE_INVALID: {
    fa: 'مسئول انتخاب‌شده کاربر فعال پشتیبانی نیست.',
    en: 'The selected assignee is not an active support user.',
  },
  PAGE_NOT_FOUND: {
    fa: 'صفحه پیدا نشد.',
    en: 'Page was not found.',
  },
  TRIAL_PRICE_INVALID: {
    fa: 'قیمت پیشنهادی جلسه آزمایشی باید یک عدد صحیح و حداقل ۱۰٬۰۰۰ تومان باشد.',
    en: 'The proposed trial price must be a whole number of at least 10,000.',
  },
  REGULAR_PRICE_INVALID: {
    fa: 'قیمت پیشنهادی جلسه عادی باید یک عدد صحیح و حداقل ۱۰٬۰۰۰ تومان باشد.',
    en: 'The proposed regular price must be a whole number of at least 10,000.',
  },
  REGULAR_PRICE_BELOW_TRIAL: {
    fa: 'قیمت جلسه عادی نباید کمتر از جلسه آزمایشی باشد.',
    en: 'The regular lesson price cannot be lower than the trial price.',
  },
  TRIAL_PRICE_NOT_HALF_REGULAR: {
    fa: 'قیمت جلسه آزمایشی باید نصف قیمت جلسه عادی باشد؛ برای این قیمت عادی، مقدار درست {0} تومان است.',
    en: 'The trial price must be half the regular price; for this regular price it must be {0}.',
  },
  PRICE_ALREADY_UNDER_REVIEW: {
    fa: 'قیمت فعلی هنوز در حال بررسی است.',
    en: 'The current price proposal is still under review.',
  },
  COUNTER_OFFER_NOT_AVAILABLE: {
    fa: 'پیشنهاد متقابل فعالی برای پذیرش وجود ندارد.',
    en: 'There is no active counter-offer to accept.',
  },
  PRICE_PROPOSAL_MISSING: {
    fa: 'مدرس هنوز قیمت پیشنهادی ثبت نکرده است.',
    en: 'The teacher has not submitted a price proposal yet.',
  },
  COUNTER_PRICE_REQUIRED: {
    fa: 'برای پیشنهاد متقابل، هر دو قیمت آزمایشی و عادی را وارد کنید.',
    en: 'Both trial and regular counter prices are required.',
  },
  PRICE_REJECTION_NOTE_REQUIRED: {
    fa: 'دلیل رد قیمت را دقیق بنویسید.',
    en: 'Provide a clear reason for rejecting the price.',
  },
  FINAL_PRICE_ADMIN_ONLY: {
    fa: 'تأیید نهایی قیمت فقط توسط مدیر انجام می‌شود.',
    en: 'Only an administrator can grant final price approval.',
  },
  REVIEW_RATING_INVALID: {
    fa: 'امتیاز باید عددی بین ۱ تا ۵ باشد.',
    en: 'Rating must be a whole number from 1 to 5.',
  },
  REVIEW_ALREADY_EXISTS: {
    fa: 'برای این کلاس قبلاً نظر ثبت شده است.',
    en: 'A review has already been submitted for this booking.',
  },
  REVIEW_REQUIRES_COMPLETED_CLASS: {
    fa: 'فقط پس از برگزاری و تکمیل موفق کلاس می‌توانید نظر ثبت کنید.',
    en: 'You can review a teacher only after a successfully completed class.',
  },
  REVIEW_MODERATION_NOTE_REQUIRED: {
    fa: 'برای رد یا نیاز به اصلاح، دلیل را بنویسید.',
    en: 'Provide a reason when rejecting or requesting revision.',
  },
  REVIEW_NOT_FOUND: {
    fa: 'نظر پیدا نشد.',
    en: 'Review not found.',
  },
  REVIEW_REPLY_FORBIDDEN: {
    fa: 'فقط مدرس همین کلاس می‌تواند به نظر پاسخ دهد.',
    en: 'Only the reviewed teacher can reply.',
  },
  REVIEW_NOT_PUBLISHED: {
    fa: 'فقط به نظر تأییدشده و منتشرشده می‌توان پاسخ داد.',
    en: 'Only approved and published reviews can be answered.',
  },
  TEACHER_LANGUAGE_REQUIRED: {
    fa: 'حداقل یک زبان آموزشی انتخاب کنید.',
    en: 'Select at least one teaching language.',
  },
  TEACHER_LANGUAGE_INVALID: {
    fa: 'یک یا چند زبان انتخاب‌شده معتبر یا فعال نیست.',
    en: 'One or more selected languages are invalid or inactive.',
  },
  TEACHER_APPLICATION_NOT_FOUND: {
    fa: 'درخواست مدرس پیدا نشد.',
    en: 'Teacher application not found.',
  },
  TEACHER_APPLICATION_NOT_SUBMITTABLE: {
    fa: 'این درخواست در وضعیت فعلی قابل ارسال نیست.',
    en: 'The application cannot be submitted in its current state.',
  },
  TEACHER_DOCUMENTS_REQUIRED: {
    fa: 'مدرک هویتی و مدرک آموزشی را بارگذاری و ارسال کنید.',
    en: 'Upload and submit both identity and teaching certificate documents.',
  },
  TEACHER_STATUS_TRANSITION_INVALID: {
    fa: 'تغییر وضعیت از {0} به {1} مجاز نیست.',
    en: 'Changing teacher status from {0} to {1} is not allowed.',
  },
  TEACHER_DOCUMENT_KIND_REQUIRED: {
    fa: 'نوع مدرک را انتخاب کنید.',
    en: 'Select the document type.',
  },
  TEACHER_DOCUMENT_FILE_INVALID: {
    fa: 'فایل مدرک کامل یا ایمن نیست. فایل را دوباره بارگذاری کنید.',
    en: 'The document upload is incomplete or unsafe. Upload the file again.',
  },
  DOCUMENT_REVIEW_STATUS_INVALID: {
    fa: 'وضعیت بررسی مدرک معتبر نیست.',
    en: 'The document review status is invalid.',
  },
  DOCUMENT_REVIEW_REASON_REQUIRED: {
    fa: 'برای رد مدرک یا درخواست اصلاح، دلیل دقیق را بنویسید.',
    en: 'Provide a clear reason when rejecting a document or requesting revision.',
  },
  VERIFICATION_ITEM_NOT_FOUND: {
    fa: 'مدرک پیدا نشد.',
    en: 'Verification document not found.',
  },
  DOCUMENT_RESUBMIT_FORBIDDEN: {
    fa: 'این مدرک متعلق به حساب شما نیست.',
    en: 'This document does not belong to your account.',
  },
  DOCUMENT_NOT_RESUBMITTABLE: {
    fa: 'این مدرک در وضعیت فعلی نیاز به ارسال مجدد ندارد.',
    en: 'This document does not require resubmission in its current state.',
  },
  INTRO_VIDEO_INVALID: {
    fa: 'ویدیوی معرفی باید MP4، WebM یا MOV و با موفقیت بارگذاری شده باشد.',
    en: 'The intro video must be a successfully uploaded MP4, WebM, or MOV file.',
  },
  PUBLISHED_TEST_NOT_FOUND: {
    fa: 'آزمون منتشرشده پیدا نشد.',
    en: 'Published test was not found.',
  },
  TEST_HAS_NO_SECTIONS: {
    fa: 'این آزمون بخش معتبری ندارد و قابل شروع نیست.',
    en: 'This test has no valid sections and cannot be started.',
  },
  TEST_ATTEMPT_CLOSED: {
    fa: 'این آزمون بسته یا منقضی شده و پاسخ جدید ذخیره نمی‌شود.',
    en: 'This test attempt is closed or expired and cannot accept new answers.',
  },
  TEST_ANSWERS_EMPTY: {
    fa: 'حداقل یک پاسخ برای ذخیره ارسال کنید.',
    en: 'Send at least one answer to save.',
  },
  TEST_QUESTION_UNKNOWN: {
    fa: 'حداقل یکی از سؤال‌ها متعلق به این آزمون نیست.',
    en: 'At least one question does not belong to this test.',
  },
  TEST_REVISION_NOT_ALLOWED: {
    fa: 'فقط پاسخ‌های تشریحی که ارزیاب برای آن‌ها درخواست اصلاح ثبت کرده است قابل ویرایش هستند.',
    en: 'Only subjective answers explicitly marked as needing revision can be edited.',
  },
  SPEAKING_AUDIO_INVALID: {
    fa: 'فایل صوتی پاسخ معتبر نیست.',
    en: 'The speaking response audio file is invalid.',
  },
  TEST_SECTION_NOT_ACTIVE: {
    fa: 'این بخش در حال حاضر فعال نیست.',
    en: 'This test section is not currently active.',
  },
  TEST_SECTION_NOT_FOUND: {
    fa: 'بخش آزمون پیدا نشد.',
    en: 'Test section was not found.',
  },
  TEST_ANSWERS_INCOMPLETE: {
    fa: 'قبل از قفل‌کردن بخش به همه سؤال‌ها پاسخ دهید.',
    en: 'Answer every question before locking the section.',
  },
  TEST_ATTEMPT_NOT_SUBMITTABLE: {
    fa: 'این آزمون در وضعیت قابل ارسال نیست.',
    en: 'This attempt cannot be submitted in its current status.',
  },
  TEST_SECTIONS_NOT_SUBMITTED: {
    fa: 'ابتدا همه بخش‌ها را ارسال و قفل کنید.',
    en: 'Submit and lock every section first.',
  },
  REVIEW_ANSWER_NOT_FOUND: {
    fa: 'پاسخ در صف بررسی پیدا نشد.',
    en: 'The answer was not found in the review queue.',
  },
  ANSWER_ALREADY_CLAIMED: {
    fa: 'این پاسخ توسط ارزیاب دیگری در حال بررسی است.',
    en: 'Another examiner is already reviewing this answer.',
  },
  REVIEW_FEEDBACK_REQUIRED: {
    fa: 'بازخورد فارسی و انگلیسی هر دو الزامی هستند.',
    en: 'Both Persian and English feedback are required.',
  },
  REQUEST_BODY_INVALID: {
    fa: 'بدنه درخواست باید یک شیء معتبر باشد.',
    en: 'Request body must be an object.',
  },
  FIELD_REQUIRED: {
    fa: 'فیلد {0} الزامی است.',
    en: '{0} is required.',
  },
  FIELD_TOO_LONG: {
    fa: 'فیلد {0} بیش از حد طولانی است.',
    en: '{0} is too long.',
  },
  POSITIVE_INTEGER_REQUIRED: {
    fa: '{0} باید عدد صحیح مثبت باشد.',
    en: '{0} must be a positive integer.',
  },
  TEST_FIELD_REQUIRED: {
    fa: 'فیلد {0} الزامی است.',
    en: '{0} is required.',
  },
  TEST_LANGUAGE_REQUIRED: {
    fa: 'قبل از ساخت آزمون، زبان آموزشی را انتخاب کنید.',
    en: 'Select the educational language before creating the test.',
  },
  TEST_DURATION_REQUIRED: {
    fa: 'مدت آزمون الزامی است.',
    en: 'Test duration is required.',
  },
  TEST_SKILL_REQUIRED: {
    fa: 'مهارت یا نوع بخش را وارد کنید.',
    en: 'Enter the section skill or type.',
  },
  TEST_SECTION_TITLE_REQUIRED: {
    fa: 'عنوان بخش الزامی است.',
    en: 'Section title is required.',
  },
  TEST_INSTRUCTIONS_REQUIRED: {
    fa: 'راهنمای فارسی و انگلیسی بخش الزامی است.',
    en: 'Persian and English section instructions are required.',
  },
  TEST_SECTION_DURATION_REQUIRED: {
    fa: 'مدت بخش الزامی است.',
    en: 'Section duration is required.',
  },
  TEST_SECTION_ORDER_REQUIRED: {
    fa: 'ترتیب بخش الزامی است.',
    en: 'Section order is required.',
  },
  QUESTION_PROMPT_REQUIRED: {
    fa: 'متن فارسی و انگلیسی سؤال الزامی است.',
    en: 'Persian and English question prompts are required.',
  },
  QUESTION_TYPE_INVALID: {
    fa: 'نوع سؤال معتبر نیست.',
    en: 'Question type is invalid.',
  },
  QUESTION_TYPE_REQUIRED: {
    fa: 'نوع سؤال را انتخاب کنید.',
    en: 'Select a question type.',
  },
  QUESTION_CHOICES_REQUIRED: {
    fa: 'برای سؤال گزینه‌ای، گزینه‌های فارسی و انگلیسی را به‌صورت بصری اضافه کنید.',
    en: 'Add Persian and English options for an objective question.',
  },
  QUESTION_ANSWER_KEY_REQUIRED: {
    fa: 'پاسخ صحیح را از میان گزینه‌ها انتخاب کنید.',
    en: 'Select the correct answer from the options.',
  },
  QUESTION_ANSWER_KEY_INVALID: {
    fa: 'پاسخ صحیح باید یکی از گزینه‌های ساخته‌شده باشد.',
    en: 'The correct answer must be one of the created options.',
  },
  QUESTION_POINTS_INVALID: {
    fa: 'امتیاز سؤال باید عددی بیشتر از صفر باشد.',
    en: 'Question points must be greater than zero.',
  },
  QUESTION_ORDER_REQUIRED: {
    fa: 'ترتیب سؤال الزامی است.',
    en: 'Question order is required.',
  },
  QUESTION_CHOICES_INVALID: {
    fa: 'تعداد گزینه‌های فارسی و انگلیسی باید برابر و بیشتر از صفر باشد.',
    en: 'Persian and English choices must have the same non-zero length.',
  },
  TEST_NOT_FOUND: {
    fa: 'آزمون پیدا نشد.',
    en: 'Test was not found.',
  },
  TEST_PUBLISH_QUESTIONS_REQUIRED: {
    fa: 'آزمون قبل از انتشار باید حداقل یک سؤال معتبر در هر بخش داشته باشد.',
    en: 'Before publishing, every section must contain at least one valid question.',
  },
  TEST_PUBLISH_INVALID_QUESTION: {
    fa: 'حداقل یک سؤال متن یا پاسخ صحیح معتبر ندارد.',
    en: 'At least one question is missing a valid prompt or correct answer.',
  },
  TEST_HAS_ATTEMPTS: {
    fa: 'آزمونی که پاسخ ثبت‌شده دارد قابل حذف نیست؛ آن را از انتشار خارج کنید.',
    en: 'A test with attempts cannot be deleted; unpublish it instead.',
  },
  TEST_SECTION_HAS_ANSWERS: {
    fa: 'بخشی که پاسخ ثبت‌شده دارد قابل حذف نیست.',
    en: 'A section with submitted answers cannot be deleted.',
  },
  QUESTION_NOT_FOUND: {
    fa: 'سؤال پیدا نشد.',
    en: 'Question was not found.',
  },
  QUESTION_HAS_ANSWERS: {
    fa: 'سؤالی که پاسخ ثبت‌شده دارد قابل حذف نیست.',
    en: 'A question with submitted answers cannot be deleted.',
  },
  QUESTION_REORDER_INVALID: {
    fa: 'فهرست ترتیب سؤال‌ها کامل یا معتبر نیست.',
    en: 'The question reorder list is incomplete or invalid.',
  },
  PASSAGE_HAS_QUESTIONS: {
    fa: 'ابتدا اتصال سؤال‌ها به این متن را حذف کنید.',
    en: 'Disconnect questions from this passage before deleting it.',
  },
  QUESTION_IMPORT_EMPTY: {
    fa: 'فایل ورود سؤال خالی است.',
    en: 'Question import is empty.',
  },
  QUESTION_IMPORT_DUPLICATE_ORDER: {
    fa: 'ترتیب سؤال‌ها در فایل تکراری است.',
    en: 'Question order values are duplicated in the import.',
  },
  QUESTION_IMPORT_ORDER_EXISTS: {
    fa: 'یک یا چند شماره ترتیب از قبل در این بخش وجود دارد.',
    en: 'One or more order values already exist in this section.',
  },
  TEST_LANGUAGE_INVALID: {
    fa: 'زبان آموزشی انتخاب‌شده فعال یا معتبر نیست.',
    en: 'The selected educational language is invalid or inactive.',
  },
  TEST_AUDIO_INVALID: {
    fa: 'فایل صوتی باید MP3، WAV، M4A، OGG یا WebM و کمتر از حجم مجاز باشد.',
    en: 'Audio must be MP3, WAV, M4A, OGG, or WebM and below the size limit.',
  },
  QUESTION_PASSAGE_INVALID: {
    fa: 'متن Reading انتخاب‌شده متعلق به این بخش نیست.',
    en: 'The selected reading passage does not belong to this section.',
  },
};
