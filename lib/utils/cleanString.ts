export const cleanString = (str: string) =>
    str.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^\w\s]/gi, "").toLowerCase();
