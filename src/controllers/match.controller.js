import { getMatchResultByPoNumber } from "../services/matching.service.js";

export async function getMatchByPoNumber(req, res)  {
    try {
        const { poNumber } = req.params;

        const matchResult = await getMatchResultByPoNumber(poNumber);

        if (!matchResult) {
            return res.status(404).json({
                message: "No documents or match result found for this PO number",
                poNumber,
            });
        }

        return res.json({
            matchResult,
        });
    } catch (error) {
        console.error("Get match result error:", error);

        return res.status(500).json({
            message: "Failed to get match result",
            error: error.message,
        });
    }
}