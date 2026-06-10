import mongoose from "mongoose";

const mismatchReasonSchema = new mongoose.Schema(
    {
        code: {
        type: String,
        required: true,
        },
        itemKey: {
        type: String,
        default: null,
        },
        message: {
        type: String,
        required: true,
        },
        details: {
        type: mongoose.Schema.Types.Mixed,
        default: {},
        },
    },
    {
        _id: false,
    }
);

const itemResultSchema = new mongoose.Schema(
    {
        itemKey: {
        type: String,
        required: true,
        },
        description: {
        type: String,
        default: null,
        },
        poQuantity: {
        type: Number,
        default: 0,
        },
        grnQuantity: {
        type: Number,
        default: 0,
        },
        invoiceQuantity: {
        type: Number,
        default: 0,
        },
        status: {
        type: String,
        enum: ["matched", "mismatch", "not_invoiced", "not_received"],
        required: true,
        },
        reasons: {
        type: [mismatchReasonSchema],
        default: [],
        },
    },
    {
        _id: false,
    }
);

const matchResultSchema = new mongoose.Schema(
    {
        poNumber: {
        type: String,
        required: true,
        unique: true,
        index: true,
        trim: true,
        },

        status: {
        type: String,
        enum: ["matched", "partially_matched", "mismatch", "insufficient_documents"],
        required: true,
        },

        documents: {
        po: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Document",
            default: null,
        },
        grns: [
            {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Document",
            },
        ],
        invoices: [
            {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Document",
            },
        ],
        },

        summary: {
        poItemCount: {
            type: Number,
            default: 0,
        },
        grnItemCount: {
            type: Number,
            default: 0,
        },
        invoiceItemCount: {
            type: Number,
            default: 0,
        },
        },

        reasons: {
        type: [mismatchReasonSchema],
        default: [],
        },

        itemResults: {
        type: [itemResultSchema],
        default: [],
        },

        lastEvaluatedAt: {
        type: Date,
        default: Date.now,
        },
    },
    {
        timestamps: true,
    }
);

const MatchResult = mongoose.model("MatchResult", matchResultSchema);

export default MatchResult;