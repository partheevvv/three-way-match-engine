import { parseDocumentWithGemini } from "./gemini.service.js";

function getFakePOParsedData() {
    return {
        poNumber: "CI4PO05788",
        poDate: "2026-03-17",
        vendorName: "M/s AFP",
        items: [
            {
                itemCode: "11423",
                description: "Cheesy Spicy Veg Momos 24.0 Pieces",
                hsnCode: "19022010",
                quantity: 50,
                unitPrice: 220.762,
                taxableValue: 11038.1,
                totalAmount: 11590.0,
            },
            {
                itemCode: "18003",
                description: "Meatigo Chicken Curry Cut Skinless Frozen 450.0 g",
                hsnCode: "02071300",
                quantity: 120,
                unitPrice: 141.143,
                taxableValue: 16937.14,
                totalAmount: 17784.0,
            },
            {
                itemCode: "18004",
                description: "Meatigo Chicken Boneless Breast Frozen 450.0 g",
                hsnCode: "02071300",
                quantity: 540,
                unitPrice: 199.048,
                taxableValue: 107485.71,
                totalAmount: 112860.0,
            },
        ],
    };
}

function getFakeGRNParsedData() {
    return {
        grnNumber: "CI4000020234",
        poNumber: "CI4PO05788",
        grnDate: "2026-03-24",
        invoiceNumber: "IN25MH2504251",
        invoiceDate: "2026-03-24",
        items: [
            {
                itemCode: "11423",
                description: "Spicy Veg Momos 24.0 Pieces",
                expectedQuantity: 50,
                receivedQuantity: 50,
                unitPrice: 220.76,
                taxableValue: 11038.1,
                totalAmount: 11590.01,
            },
            {
                itemCode: "18003",
                description: "Meatigo Chicken Curry Cut Skinless Frozen 450.0 g",
                expectedQuantity: 120,
                receivedQuantity: 30,
                unitPrice: 141.14,
                taxableValue: 4234.29,
                totalAmount: 4446.0,
            },
            {
                itemCode: "18004",
                description: "Meatigo Chicken Boneless Breast Frozen 450.0 g",
                expectedQuantity: 540,
                receivedQuantity: 30,
                unitPrice: 199.05,
                taxableValue: 5971.44,
                totalAmount: 6270.01,
            },
        ],
    };
}

function getFakeInvoiceParsedData() {
    return {
        invoiceNumber: "IN25MH2504251",
        poNumber: "CI4PO05788",
        invoiceDate: "2026-03-24",
        customerOrderNumber: "CI4PO05788",
        items: [
            {
                itemCode: "FG-P-F-0503",
                matchCode: "11423",
                description: "PSM Cheesy Spicy Vegetable Momos 24Pcs",
                hsnCode: "19022010",
                quantity: 50,
                unitPrice: 220.76,
                taxableValue: 11038.0,
                totalAmount: 11589.9,
            },
            {
                itemCode: "FG-M-F-0620",
                matchCode: "18003",
                description: "Meatigo Chicken Curry Cuts 450g (5%)",
                hsnCode: "02071400",
                quantity: 30,
                unitPrice: 141.14,
                taxableValue: 4234.2,
                totalAmount: 4445.91,
            },
            {
                itemCode: "FG-M-F-0619",
                matchCode: "18004",
                description: "Meatigo Chicken Boneless Breast 450g (5%)",
                hsnCode: "02071400",
                quantity: 30,
                unitPrice: 199.05,
                taxableValue: 5971.5,
                totalAmount: 6270.08,
            },
        ],
    };
}

export async function parseDocument(file, documentType) {
    const useMockParser = process.env.USE_MOCK_PARSER === "true";

    if (!useMockParser) {
        return parseDocumentWithGemini(file, documentType);
    }

    if (documentType === "po") {
        return getFakePOParsedData();
    }

    if (documentType === "grn") {
        return getFakeGRNParsedData();
    }

    if (documentType === "invoice") {
        return getFakeInvoiceParsedData();
    }

    throw new Error("Invalid document type");
}