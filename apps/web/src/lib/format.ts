export const faNumber = (value: number) => new Intl.NumberFormat('fa-IR').format(value);
export const toman = (value: number) => `${faNumber(value)} تومان`;
export const jalali = (value?: string, withTime = true) =>
  value
    ? new Intl.DateTimeFormat('fa-IR-u-ca-persian', {
        dateStyle: 'medium',
        ...(withTime ? { timeStyle: 'short' } : {}),
      }).format(new Date(value))
    : '—';
export const digitsOnly = (value: string) =>
  value.replace(/[^0-9۰-۹]/g, '').replace(/[۰-۹]/g, (d) => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d)));
