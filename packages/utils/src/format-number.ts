export const formatNumber = (value: number, locales?: string | string[], options?: Intl.NumberFormatOptions): string =>
    new Intl.NumberFormat(locales, options).format(value);
