import mongoose from "mongoose";

const documentItemSchema = new mongoose.Schema(
    {
        itemCode: {
            type: String,
            default: null,
        },
        sku: {
            type: String,
            default: null,
        },
        matchCode: {
            type: String,
            default: null,
        },
        description: {
            type: String,
            default: null,
        },
        quantity: {
            type: Number,
            default: null,
        },
        receivedQuantity: {
            type: Number,
            default: null,
        },
        unitPrice: {
          type: Number,
          default: null,
        },
        taxableValue: {
          type: Number,
          default: null,
        },
        totalAmount: {
          type: Number,
          default: null,
        },
        extractionWarning: {
            type: String,
            default: null,
        },
        rawText: {
          type: String,
          default: null,
        },
    },
    {
        _id: false,
    }
);

const documentSchema = new mongoose.Schema(
    {
        documentType: {
        type: String,
        enum: ["po", "grn", "invoice"],
        required: true,
        },
        
        poNumber: {
        type: String,
        required: true,
        index: true,
        trim: true,
        },

        originalFileName: {
        type: String,
        required: true,
        },

        filePath: {
        type: String,
        required: true,
        },

        mimeType: {
        type: String,
        required: true,
        },

        fileSize: {
        type: Number,
        required: true,
        },

        parsedData: {
        poNumber: {
            type: String,
            default: null,
        },
        poDate: {
            type: Date,
            default: null,
        },
        vendorName: {
            type: String,
            default: null,
        },

        grnNumber: {
            type: String,
            default: null,
        },
        grnDate: {
            type: Date,
            default: null,
        },

        invoiceNumber: {
            type: String,
            default: null,
        },
        invoiceDate: {
            type: Date,
            default: null,
        },

        customerOrderNumber: {
            type: String,
            default: null,
        },

        items: {
            type: [documentItemSchema],
            default: [],
        },

        rawGeminiResponse: {
            type: mongoose.Schema.Types.Mixed,
            default: null,
        },
        },

        parsingStatus: {
        type: String,
        enum: ["success", "failed"],
        default: "success",
        },

        parsingError: {
        type: String,
        default: null,
        },
    },
    {
        timestamps: true,
    }
);

const Document = mongoose.model("Document", documentSchema);

export default Document;