export function formatPrice(cents: number, locale: string = 'es-MX', currency: string = 'MXN'): string {
    return new Intl.NumberFormat(locale, {
        style: 'currency',
        currency: currency,
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    }).format(!cents ? 0 : cents / 100);
}