import express from "express";

const router = express.Router();

router.get("/:poNumber", (req, res) => {
    res.json({
        message: "Get match result route working",
        poNumber: req.params.poNumber,
    });
});

export default router;