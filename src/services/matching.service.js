import Document from "../models/document.model.js";
import MatchResult from "../models/matchResult.model.js";
import { buildFallbackKey, getPrimaryItemKey, normalizeNumber, normalizeText,} from "../utils/itemKey.js";

function createReason(code, message, itemKey = null, details = {}) {
    return {
        code,
        itemKey,
        message,
        details,
    };
}

function getItemQuantity(item, documentType) {
    if (documentType === "grn") {
        return Number(item.receivedQuantity || 0);
    }

    return Number(item.quantity || 0);
}

function buildPoItemMaps(poDocument) {
    const primaryMap = new Map();
    const fallbackMap = new Map();

    const items = poDocument?.parsedData?.items || [];

    for (const item of items) {
        const primaryKey = getPrimaryItemKey(item);
        const fallbackKey = buildFallbackKey(item);

        primaryMap.set(primaryKey, item);

        if(fallbackKey) {
            fallbackMap.set(fallbackKey, item);
        }
    }

    return { 
        primaryMap, 
        fallbackMap 
    };
}

function findPoItem(item, poMaps) {
    const primaryKey = getPrimaryItemKey(item);

    if (poMaps.primaryMap.has(primaryKey)) {
        return {
            items: poMaps.primaryMap.get(primaryKey),
            matchedKey: "primary",
            key: primaryKey,
        };
    }

    const fallbackKey = buildFallbackKey(item);

    if (poMaps.fallbackMap.has(fallbackKey)) {
        const poItem = poMaps.fallbackMap.get(fallbackKey);

        return {
            item: poItem,
            matchedKey: 'fallback',
            key: getPrimaryItemKey(poItem),
        };
    }

    return {
        item: null,
        matchedBy: null,
        key: primaryKey,
    };
}

function aggregateItemsByPoKey(documents, documentType, poMaps) {
    const quantityMap = new Map();

    for (const doc of documents) {
        const items = doc.parsedData?.items || [];

        for (const item of items) {
            const match = findPoItem(item, poMaps);
            const key = match.key;
            const quantity = getItemQuantity(item, documentType);

            if (!quantityMap.has(key)) {
                quantityMap.set(key, {
                    item, 
                    poItem: match.item,
                    quantity: 0,
                    matchedBy: match.matchedBy,
                });
            }

            const existing = quantityMap.get(key);
            existing.quantity += quantity;
        }
    }

    return quantityMap;
}

function hasDateAfter(dateA, dateB) {
    if (!dateA || !dateB) return false;

    const first = new Date(dateA);
    const second = new Date(dateB);

    if (Number.isNaN(first.getTime()) || Number.isNaN(second.getTime())) {
        return false;
    }

    return first.getTime() > second.getTime();
}

function getDocumentRefs(documents) {
    const poDocuments = documents.filter((doc) => doc.documentType === "po");
    const grnDocuments = documents.filter((doc) => doc.documentType === "grn");
    const invoiceDocuments = documents.filter((doc) => doc.documentType === "invoice");

    return {
        poDocuments,
        grnDocuments,
        invoiceDocuments,
    };
}

function buildInsufficientResult(poNumber, documents, reasonList) {
    const { poDocuments, grnDocuments, invoiceDocuments } = getDocumentRefs(documents);

    return {
        poNumber,
        status: "insufficient_documents",
        documents: {
            po: poDocuments[0]?._id || null,
            grns: grnDocuments.map((doc) => doc._id),
            invoices: invoiceDocuments.map((doc) => doc._id),
        },
        summary: {
            poItemCount: poDocuments[0]?.parsedData?.items?.length || 0,
            grnItemCount: grnDocuments.reduce((sum, doc) => sum + (doc.parsedData?.items?.length || 0), 0),
            invoiceItemCount: invoiceDocuments.reduce(
            (sum, doc) => sum + (doc.parsedData?.items?.length || 0), 0),
        },
        reasons: reasonList,
        itemResults: [],
        lastEvaluated: new Date(),
    };
}

function determineStatus(reasons, itemResults) {
    if (reasons.length === 0) {
        return "matched";
    }

    const hasDocumentLevelMismatch = reasons.some((reason) => ["duplicate_po", "invoice_date_after_po_date"].includes(reason.code));

    if (hasDocumentLevelMismatch) {
        return "mismatch";
    }

    const matchedItems = itemResults.filter(
        (itemResult) => itemResult.status === "matched"
    ).length;

    const mismatchedItems = itemResults.filter(
        (itemResult) => itemResult.status === "mismatch"
    ).length;

    if (matchedItems > 0 && mismatchedItems > 0) {
        return "partially_matched";
    }

    return "mismatch";
}

export async function evaluateMatchForPoNumber(poNumber) {
    const documents = await Document.find({ poNumber }).sort({ createdAt: 1 });

    const { poDocuments, grnDocuments, invoiceDocuments } = getDocumentRefs(documents);

    const reasons = [];

    if (poDocuments.length === 0) {
        reasons.push(createReason("po_missing", `PO document is missing for ${poNumber}`));
    }

    if (grnDocuments.length === 0) {
        reasons.push(createReason("grn_missing", `No GRN document found for ${poNumber}`));
    }

    if (invoiceDocuments.length === 0) {
        reasons.push(createReason("invoice_missing", `No invoice document found for ${poNumber}`));
    }

    if (poDocuments.length == 0 || grnDocuments === 0 || invoiceDocuments.length === 0) {
        const insufficientResult = buildInsufficientResult(poNumber, documents, reasons);

        return MatchResult.findOneAndUpdate({ poNumber }, insufficientResult, {
            new: true,
            upsert: true,
            setDefaultsOnInsert: true,
        });
    }

    if (poDocuments.length > 1) {
        reasons.push(
            createReason(
                "duplicate_po",
                `More than one PO document found for ${poNumber}`,
                null, {
                    count: poDocuments.length,
                }
            )
        );
    }

    const poDocument = poDocuments[0];
    const poItems = poDocument.parsedData?.items || [];
    const poMaps = buildPoItemMaps(poDocument);

    const grnQuantityMap = aggregateItemsByPoKey(grnDocuments, "grn", poMaps);

    const invoiceQuantityMap = aggregateItemsByPoKey(invoiceDocuments, "invoice", poMaps);

    for (const invoiceDocument of invoiceDocuments) {
        const invoiceDate = invoiceDocument.parsedData?.invoiceDate;
        const poDate = poDocument.parsedData?.poDate;

        if (hasDateAfter(invoiceDate, poDate)) { 
            reasons.push(createReason("invoice_date_after_po_date", `Invoice date ${new Date(invoiceDate)
            .toISOString()
            .slice(0, 10)} is after PO date ${new Date(poDate)
            .toISOString()
            .slice(0, 10)}`, null,
            {
                invoiceId: invoiceDocument._id,
                invoiceDate,
                poDate,
            }));
        }
    }

    const itemResults = [];

    for (const poItem of poItems) {
        const itemKey = getPrimaryItemKey(poItem);
        const poQuantity = Number(poItem.quantity || 0);
        const grnQuantity = grnQuantityMap.get(itemKey)?.quantity || 0;
        const invoiceQuantity = invoiceQuantityMap.get(itemKey)?.quantity || 0;

        const itemReasons = [];

        if (grnQuantity > poQuantity) {
            itemReasons.push(createReason("grn_qty_exceeds_po_qty", `GRN quantity ${grnQuantity} exceeds PO quantity ${poQuantity} for item ${itemKey}`, itemKey, {
                    poQuantity,
                    grnQuantity,
                })
            );
        }

        if (invoiceQuantity > poQuantity) {
            itemReasons.push(createReason("invoice_qty_exceeds_po_qty", `Invoice quantity ${invoiceQuantity} exceeds PO quantity ${poQuantity} for item ${itemKey}`, itemKey, {
                    poQuantity,
                    invoiceQuantity,
                })
            );
        }

        if (invoiceQuantity > grnQuantity) {
            itemReasons.push(createReason("invoice_qty_exceeds_grn_qty", `Invoice quantity ${invoiceQuantity} exceeds total GRN received quantity ${grnQuantity} for item ${itemKey}`, itemKey, {
                    grnQuantity,
                    invoiceQuantity,
                })
            );
        }

        const status = itemReasons.length > 0 ? "mismatch" : "matched";

        reasons.push(...itemReasons);

        itemResults.push({
            itemKey,
            description: poItem.description,
            poQuantity: normalizeNumber(poQuantity, 3),
            grnQuantity: normalizeNumber(grnQuantity, 3),
            invoiceQuantity: normalizeNumber(invoiceQuantity, 3),
            status,
            reasons: itemReasons,
        });
    }
    
    for (const [key, value] of grnQuantityMap.entries()) {
        const existsInPo = poMaps.primaryMap.has(key);

        if (!existsInPo) {
            const reason = createReason("item_missing_in_po", `GRN item ${key} is not present in PO`, key,
            {
                source: "grn",
                description: value.item?.description,
            });

            reasons.push(reason);

            itemResults.push({
                itemKey: key,
                description: value.item?.description || null,
                poQuantity: 0,
                grnQuantity: normalizeNumber(value.quantity, 3),
                invoiceQuantity: 0,
                status: "mismatch",
                reasons: [reason],
            });
        }
    }

    for (const [key, value] of invoiceQuantityMap.entries()) {
        const existsInPo = poMaps.primaryMap.has(key);

        if (!existsInPo) {
            const reason = createReason("item_missing_in_po", `Invoice item ${key} is not present in PO`, key,
            {
                source: "invoice",
                description: value.item?.description,
            });

            reasons.push(reason);

            itemResults.push({
                itemKey: key,
                description: value.item?.description || null,
                poQuantity: 0,
                grnQuantity: 0,
                invoiceQuantity: normalizeNumber(value.quantity, 3),
                status: "mismatch",
                reasons: [reason],
            });
        }
    }

    const matchResultPayload = {
        poNumber,
        status: determineStatus(reasons, itemResults),
        documents: {
            po: poDocument._id,
            grns: grnDocuments.map((doc) => doc._id),
            invoices: invoiceDocuments.map((doc) => doc._id),
        },
        summary: {
            poItemCount: poItems.length,
            grnItemCount: grnDocuments.reduce((sum, doc) => sum + (doc.parsedData?.items?.length || 0), 0),
            invoiceItemCount: invoiceDocuments.reduce((sum, doc) => sum + (doc.parsedData?.items?.length || 0), 0),
        },
        reasons,
        itemResults,
        lastEvaluatedAt: new Date(),
    };

    return MatchResult.findOneAndUpdate({ poNumber }, matchResultPayload, {
        new: true,
        upsert: true,
        setDefaultsOnInsert: true,
        }
    );
}

export async function getMatchResultByPoNumber(poNumber) {
    let matchResult = await MatchResult.findOne({ poNumber })
    .populate("documents.po")
    .populate("documents.grns")
    .populate("documents.invoices");

    if (!matchResult) {
        const documents = await Document.find({ poNumber });

        if (documents.length === 0) {
            return null;
        }

        matchResult = await evaluateMatchForPoNumber(poNumber);

        matchResult = await MatchResult.findOne({ poNumber })
        .populate("documents.po")
        .populate("documents.grns")
        .populate("documents.invoices");
    }

    return matchResult;
}