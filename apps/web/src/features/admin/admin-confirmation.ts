import { localized, type Locale } from '@/lib/i18n';

export function adminDeleteConfirmation(entityName: string, locale: Locale) {
  return localized(
    {
      fa: `«${entityName}» برای همیشه حذف می‌شود. از حذف آن مطمئن هستید؟`,
      en: `“${entityName}” will be permanently deleted. Are you sure?`,
    },
    locale,
  );
}
