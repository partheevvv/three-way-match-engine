import Document from "../models/document.model.js";
import { parseDocument } from "../services/parser.service.js";
import { evaluateMatchForPoNumber } from "../services/matching.service.js";

function getPoNumberFromParsedData(documentType, parsedData) {
    if (documentType == "po") {
        return parsedData.poNumber;
    }

    if (documentType == "grn") {
        return parsedData.poNumber;
    }

    if (documentType == "invoice") {
        return parsedData.poNumber || parsedData.customerOrderNumber;
    }

    return null;
}

export async function uploadDocument(req, res) {
    try {
        const { documentType } = req.body;
        const file = req.file;

        if (!documentType) {
            return res.status(400).json({
                message: "documentType is required",
            });
        }

        if (!["po", "grn", "invoice"].includes(documentType)) {
            return res.status(400).json({
                message: "documentType must be one of: po, grn, invoice",
            });
        }

        if (!file) {
            return res.status(400).json({
                message: "file is required",
            });
        }

        const parsedData = await parseDocument(file, documentType);
        const poNumber = getPoNumberFromParsedData(documentType, parsedData);

        if (!poNumber) {
            return res.status(400).json({
                message: "poNumber could not be extracted from document",
                parsedData,
            })
        }

        const document = await Document.create({
            documentType,
            poNumber,
            originalFileName: file.originalname,
            filePath: file.path,
            mimeType: file.mimetype,
            fileSize: file.size,
            parsedData,
            parsingStatus: "success",
        });

        const matchResult = await evaluateMatchForPoNumber(poNumber);

        return res.status(201).json({
            message: "Document uploaded and parsed successfully",
            document,
            matchResult,
        });
    } catch (error) {
        console.error("Upload document error:", error);

        return res.status(500).json({
            message: "Failed to upload document",
            error: error.message,
        });
    }
}

export async function getDocumentById(req, res) {
    try {
        const { id } = req.params;

        const document = await Document.findById(id);

        if (!document) {
            return res.status(404).json({
                message: "Document not found",
            });
        }

        return res.json({
            document,
        });
    } catch (error) {
        console.error("Get document error:", error);

        return res.status(500).json({
            message: "Failed to get document",
            error: error.message,
        });
    }
}
