const express = require("express");
const router = express.Router();
const Comment = require("../models/comment");
const allowedCategories = [
    "methodological concerns",
    "figure anomalies",
    "clarification",
    "data validity",
    "ethical issues"
];

/**
 * @swagger
 * /api/comments/random/{N}:
 *   get:
 *     summary: Restituisce N commenti randomici con priorità a quelli meno classificati
 *     parameters:
 *       - in: path
 *         name: N
 *         schema:
 *           type: integer
 *         required: true
 *         description: Numero di commenti da restituire
 *     responses:
 *       200:
 *         description: Lista di commenti
 */
router.get("/random/:N", async (req, res) => {
    try {
        const N = parseInt(req.params.N);

        // 1. Raggruppa per numero di classificazioni
        const grouped = await Comment.aggregate([
            {
                $addFields: {
                    classificationsCount: { $size: { $ifNull: ["$classifications", []] } }
                }
            },
            {
                $group: {
                    _id: "$classificationsCount",
                    comments: { $push: "$$ROOT" }
                }
            },
            { $sort: { _id: 1 } } 
        ]);

        // 2. Prendi N commenti rispettando la priorità
        let result = [];
        let remaining = N;

        for (const group of grouped) {
            const commentsArray = group.comments;
            if (commentsArray.length <= remaining) {
                result.push(...commentsArray);
                remaining -= commentsArray.length;
            } else {
                const shuffled = commentsArray.sort(() => 0.5 - Math.random());
                result.push(...shuffled.slice(0, remaining));
                remaining = 0;
            }
            if (remaining <= 0) break;
        }

        res.json(result);

    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

/**
 * @swagger
 * /api/comments/classify/{id}:
 *   post:
 *     summary: Salva una classificazione per un commento
 *     parameters:
 *       - in: path
 *         name: id
 *         schema:
 *           type: integer
 *         required: true
 *         description: ID del commento
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               category:
 *                 type: string
 *               user:
 *                 type: string
 *     responses:
 *       200:
 *         description: Commento aggiornato
 */
router.post("/classify/:id", async (req, res) => {
    try {
        const commentId = parseInt(req.params.id);
        const { category, user } = req.body;

        if (!category || !user) {
            return res.status(400).json({ error: "category e user obbligatori" });
        }

        if (!allowedCategories.includes(category)) {
            return res.status(400).json({ error: `Categoria non valida. Dev'essere una di: ${allowedCategories.join(", ")}` });
        }

        const updated = await Comment.findOneAndUpdate(
            { comment_id: commentId },
            { $push: { classifications: { category, user } } },
            { new: true }
        );

        if (!updated) return res.status(404).json({ error: "Commento non trovato" });

        res.json(updated);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
