import fs from "fs";

function getGeminiModel() {
    return process.env.GEMINI_MODEL || "gemini-2.5-flash";
}

function getGeminiMaxRetries() {
    const configuredRetries = Number(process.env.GEMINI_MAX_RETRIES);
    
    return Number.isInteger(configuredRetries) && configuredRetries > 0 ? configuredRetries : 3;
}

function getGeminiTimeoutMs() {
    const configuredTimeout = Number(process.env.GEMINI_TIMEOUT_MS);

    return Number.isInteger(configuredTimeout) && configuredTimeout > 0 ? configuredTimeout : 30000;
}

function wait(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

function shouldRetryGeminiRequest(status) {
    return status === 429 || status === 503 || status >= 500;
}

function getGeminiErrorHint(status, model) {
    if (status === 400 || status === 401 || status === 403) {
        return "Check that GEMINI_API_KEY is valid, enabled, unrestricted for this API, and loaded from .env.";
    }

    if (status === 404) {
        return `Check that GEMINI_MODEL is correct and available to your API key. Current model: ${model}.`;
    }

    if (status === 429) {
        return "Rate limit hit. Try again later, reduce request frequency, or check your Gemini quota.";
    }

    if (status === 503) {
        return `Gemini service is temporarily unavailable or overloaded for ${model}. Try again later or switch GEMINI_MODEL to another supported model such as gemini-2.5-flash.`;
    }

    return null;
}

function fileToInlineData(filePath, mimeType) {
    const fileBuffer = fs.readFileSync(filePath);

    return {
        inlineData: {
        data: fileBuffer.toString("base64"),
        mimeType,
        },
    };
}

function getPrompt(documentType) {
    if (documentType === "po") {
        return `
    Extract structured data from this Purchase Order document.

    Return only valid JSON. Do not include markdown.

    Schema:
    {
    "poNumber": "string",
    "poDate": "YYYY-MM-DD",
    "vendorName": "string",
    "items": [
        {
        "itemCode": "string",
        "sku": "string",
        "matchCode": "string",
        "description": "string",
        "hsnCode": "string",
        "quantity": number,
        "unitPrice": number,
        "taxableValue": number,
        "totalAmount": number
        }
    ]
    }

    Rules:
    - Use PO No as poNumber.
    - Use PO Date as poDate.
    - Use Item Code as itemCode.
    - Use Qty as quantity.
    - Extract all table rows.
    - If a field is missing, use null.
    - Return JSON only.
    `;
    }

    if (documentType === "grn") {
        return `
    Extract structured data from this GRN document.

    Return only valid JSON. Do not include markdown.

    Schema:
    {
    "grnNumber": "string",
    "poNumber": "string",
    "grnDate": "YYYY-MM-DD",
    "invoiceNumber": "string",
    "invoiceDate": "YYYY-MM-DD",
    "items": [
        {
        "itemCode": "string",
        "sku": "string",
        "matchCode": "string",
        "description": "string",
        "hsnCode": "string",
        "expectedQuantity": number,
        "receivedQuantity": number,
        "unitPrice": number,
        "taxableValue": number,
        "totalAmount": number
        }
    ]
    }

    Rules:
    - Use PO No as poNumber.
    - Use GRN No as grnNumber.
    - Use GRN Date as grnDate.
    - Use SKU Code as itemCode.
    - Use Exp Qty as expectedQuantity.
    - Use Recv Qty as receivedQuantity.
    - Extract all table rows.
    - If a field is missing, use null.
    - Return JSON only.
    `;
    }

    if (documentType === "invoice") {
        return `
    Extract structured data from this Tax Invoice document.

    Return only valid JSON. Do not include markdown.

    Schema:
    {
    "invoiceNumber": "string",
    "poNumber": "string",
    "invoiceDate": "YYYY-MM-DD",
    "customerOrderNumber": "string",
    "items": [
        {
        "itemCode": "string",
        "sku": "string",
        "matchCode": "string",
        "description": "string",
        "hsnCode": "string",
        "quantity": number,
        "unitPrice": number,
        "taxableValue": number,
        "totalAmount": number
        }
    ]
    }

    Rules:
    - Customer Order No is the poNumber.
    - Invoice No is invoiceNumber.
    - Use Item Code as itemCode.
    - Do not infer matchCode. Set matchCode to null unless a numeric SKU matching PO/GRN is explicitly visible in the invoice.
    - Do not use HSN/SAC code as matchCode.
    - Use Qty as quantity.
    - Extract all table rows.
    - If a field is missing, use null.
    - Return JSON only.
    `;
    }

    throw new Error("Invalid document type");
}

function cleanGeminiJsonResponse(text) {
    return text
        .replace(/```json/g, "")
        .replace(/```/g, "")
        .trim();
}

function extractTextFromGeminiResponse(data) {
    const parts = data?.candidates?.[0]?.content?.parts || [];

    return parts
        .map((part) => part.text || "")
        .join("")
        .trim();
}

function isLikelyHsnCode(value) {
    if (!value) return false;

    const str = String(value).trim();

    return /^\d{8}$/.test(str);
}

function toNumberOrNull(value) {
    if (value === null || value === undefined || value === "") {
        return null;
    }

    const numericValue = Number(String(value).replace(/,/g, ""));

    return Number.isNaN(numericValue) ? null : numericValue;
}

function normalizeParsedData(parsedData) {
    if (!parsedData || !Array.isArray(parsedData.items)) {
        return parsedData;
    }

    parsedData.items = parsedData.items.map((item) => {
        const normalizedItem = { ...item };

        if (isLikelyHsnCode(normalizedItem.matchCode)) {
        normalizedItem.matchCode = null;
        }

        normalizedItem.quantity = toNumberOrNull(normalizedItem.quantity);
        normalizedItem.expectedQuantity = toNumberOrNull(
        normalizedItem.expectedQuantity
        );
        normalizedItem.receivedQuantity = toNumberOrNull(
        normalizedItem.receivedQuantity
        );
        normalizedItem.unitPrice = toNumberOrNull(normalizedItem.unitPrice);
        normalizedItem.taxableValue = toNumberOrNull(normalizedItem.taxableValue);
        normalizedItem.totalAmount = toNumberOrNull(normalizedItem.totalAmount);

        if (
        normalizedItem.quantity !== null &&
        normalizedItem.unitPrice !== null &&
        normalizedItem.taxableValue !== null
        ) {
        const expectedTaxable = Number(
            (normalizedItem.quantity * normalizedItem.unitPrice).toFixed(2)
        );

        const actualTaxable = Number(normalizedItem.taxableValue.toFixed(2));
        const difference = Math.abs(expectedTaxable - actualTaxable);

        if (difference > 10) {
            normalizedItem.extractionWarning = `Possible extraction issue: quantity * unitPrice = ${expectedTaxable}, but taxableValue = ${actualTaxable}`;}
        }

        return normalizedItem;
    });

    return parsedData;
}

export async function parseDocumentWithGemini(file, documentType) {
    if (!process.env.GEMINI_API_KEY) {
        throw new Error("GEMINI_API_KEY is missing");
    }

    const prompt = getPrompt(documentType);
    const filePart = fileToInlineData(file.path, file.mimetype);
    const model = getGeminiModel();
    const maxRetries = getGeminiMaxRetries();
    const timeoutMs = getGeminiTimeoutMs();

    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;

    const requestBody = {
        contents: [
            {
            parts: [
                {
                text: prompt,
                },
                filePart,
            ],
            },
        ],
        generationConfig: {
            responseMimeType: "application/json",
            temperature: 0,
        },
        };

    let lastError;

    for (let attempt = 1; attempt <= maxRetries; attempt += 1) {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), timeoutMs);

        let response;

        try {
            response = await fetch(url, {
                method: "POST",
                headers: {
                "Content-Type": "application/json",
                "x-goog-api-key": process.env.GEMINI_API_KEY,
                },
                body: JSON.stringify(requestBody),
                signal: controller.signal,
            });
        } catch (error) {
            const isTimeout = error.name === "AbortError";
            const message = isTimeout
                ? `Gemini API request timed out after ${timeoutMs}ms. Attempt ${attempt}/${maxRetries}.`
                : `Gemini API request failed: ${error.message}. Attempt ${attempt}/${maxRetries}.`;

            lastError = new Error(message);

            if (isTimeout || attempt === maxRetries) {
                throw lastError;
            }

            await wait(1000 * 2 ** (attempt - 1));
            continue;
        } finally {
            clearTimeout(timeout);
        }

        const data = await response.json().catch(() => ({}));

        if (response.ok) {
            const text = extractTextFromGeminiResponse(data);

            if (!text) {
                throw new Error("Gemini returned an empty response");
            }

            const cleaned = cleanGeminiJsonResponse(text);

            try {
                const parsed = JSON.parse(cleaned);
                return normalizeParsedData(parsed);
            } catch {
                throw new Error(`Gemini returned invalid JSON: ${cleaned.slice(0, 700)}`);
            }
        }

        const apiMessage = data?.error?.message || "Unknown error";
        const hint = getGeminiErrorHint(response.status, model);
        const message = [
        `Gemini API error ${response.status}: ${apiMessage}`,
        hint,
        `Attempt ${attempt}/${maxRetries}.`,
        ]
        .filter(Boolean)
        .join(" ");

        lastError = new Error(message);

        if (!shouldRetryGeminiRequest(response.status) || attempt === maxRetries) {
            throw lastError;
        }

        await wait(1000 * 2 ** (attempt - 1));
    }

    throw lastError || new Error("Gemini API request failed");
}
