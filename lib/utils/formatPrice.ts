export function formatPrice(cents: number, locale: string = 'en-US', currency: string = 'USD'): string {
    return new Intl.NumberFormat(locale, {
        style: 'currency',
        currency: currency,
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    }).format(!cents ? 0 : cents / 100);
}