-- The production deploy deliberately does not run prisma/seed.ts because that
-- seed also creates demo users and other sample data. Public CMS pages therefore
-- need a production-safe baseline of their own.
--
-- Do not replace existing content: it may have been edited by an administrator.
-- The route is part of the public site, though, so make an existing draft public.
INSERT INTO "CmsPage" (
    "id",
    "slug",
    "titleFa",
    "titleEn",
    "contentFa",
    "contentEn",
    "seo",
    "published",
    "updatedAt"
)
VALUES (
    'cms_page_about',
    'about',
    'درباره ما',
    'About us',
    '{"paragraphs":["لینگواسپیک برای ساده‌کردن مسیر پیدا کردن مدرس زبان ساخته شده است. ما مدرس‌ها را بررسی می‌کنیم، امکان تعیین سطح و مقایسه شفاف را فراهم می‌کنیم و به زبان‌آموز کمک می‌کنیم کلاس مناسب هدف، بودجه و زمان خود را پیدا کند."]}'::jsonb,
    '{"paragraphs":["LingoSpeak makes finding the right language teacher simpler. We verify teachers, provide language-specific assessments and transparent comparisons, and help learners book classes that fit their goals, budget and schedule."]}'::jsonb,
    '{"description":"درباره لینگواسپیک"}'::jsonb,
    true,
    CURRENT_TIMESTAMP
)
ON CONFLICT ("slug") DO UPDATE
SET "published" = true,
    "updatedAt" = CURRENT_TIMESTAMP;
