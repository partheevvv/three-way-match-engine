export function normalizeText(value) {
    if (value === null || value === undefined) return "";

    return String(value)
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function normalizeNumber(value, precision = 2) {
    if (value === null || value === undefined || Number.isNaN(Number(value))) {
        return null;
    }

    return Number(Number(value).toFixed(precision));
}

export function getPrimaryItemKey(item) {
    if (!item) return null;

    const keyCandidate = item.matchCode || item.itemCode || item.sku;

    if (keyCandidate !== null && keyCandidate !== undefined && String(keyCandidate).trim()) {
        return String(keyCandidate).trim().toLowerCase();
    }

    const descriptionKey = normalizeText(item.description);

    return descriptionKey || null;
}

export function buildFallbackKey(item) {
    if (!item) return null;

    const description = normalizeText(item.description);
    const hsnCode = item.hsnCode ? String(item.hsnCode).trim() : "";
    const unitPrice = normalizeNumber(item.unitPrice);

    if (!description && !hsnCode && unitPrice === null) {
        return null;
    }

    return `${description}|${hsnCode}|${unitPrice}`;
}

