const express = require("express");
const router = express.Router();
const Comment = require("../models/comment");

const allowedCategories = [
    "methodological concerns",
    "figure anomalies",
    "clarification",
    "data validity",
    "ethical issues",
    "external link"
];

// --- HELPER FUNCTION ---
const formatComment = (doc) => {
    if (!doc) return null;
    return {
        comment_id: doc.comment_id,
        comment_content: doc.comment_content,
        is_from_author: doc.is_from_author,
        doi_articolo: doc.doi_articolo,
        titolo_articolo: doc.titolo_articolo,
        autori_articolo: doc.autori_articolo,
        rivista_articolo: doc.rivista_articolo,
        url_articolo: doc.url_articolo,
        classifications: doc.classifications || []
    };
};

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
 *         description: Lista di commenti completa
 */
router.get("/random/:N", async (req, res) => {
    try {
        const N = parseInt(req.params.N) || 5;

        const pipeline = [
            {
                $addFields: {
                    classCount: { $size: { $ifNull: ["$classifications", []] } }
                }
            },
            { $sort: { classCount: 1 } },
            { $limit: N * 5 },
            { $sample: { size: N } }
        ];

        const rawComments = await Comment.aggregate(pipeline);
        res.json(rawComments.map(formatComment));

    } catch (err) {
        console.error("Errore in /random:", err);
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
 *         description: Commento aggiornato completo
 */
router.post("/classify/:id", async (req, res) => {
    try {
        const commentId = parseInt(req.params.id);
        const { category, user } = req.body;

        if (!category || !user) {
            return res.status(400).json({ error: "I campi 'category' e 'user' sono obbligatori" });
        }

        if (!allowedCategories.includes(category)) {
            return res.status(400).json({
                error: `Categoria non valida. Usa una di: ${allowedCategories.join(", ")}`
            });
        }

        const updatedDoc = await Comment.findOneAndUpdate(
            { comment_id: commentId },
            { $push: { classifications: { category, user } } },
            { new: true }
        );

        if (!updatedDoc) {
            return res.status(404).json({ error: "Commento non trovato" });
        }

        res.json(formatComment(updatedDoc));

    } catch (err) {
        console.error("Errore in /classify:", err);
        res.status(500).json({ error: err.message });
    }
});

/**
 * @swagger
 * /api/comments/article/{id}:
 *   get:
 *     summary: Restituisce l'oggetto completo dato un ID commento
 *     parameters:
 *       - in: path
 *         name: id
 *         schema:
 *           type: integer
 *         required: true
 *         description: ID del commento
 *     responses:
 *       200:
 *         description: Oggetto commento completo
 */
router.get("/article/:id", async (req, res) => {
    try {
        const commentId = parseInt(req.params.id);
        const doc = await Comment.findOne({ comment_id: commentId });

        if (!doc) return res.status(404).json({ error: "Commento non trovato" });

        res.json(formatComment(doc));
    } catch (err) {
        console.error("Errore in /article:", err);
        res.status(500).json({ error: err.message });
    }
});

/**
 * @swagger
 * /api/comments/by-doi/{doi}:
 *   get:
 *     summary: Restituisce tutti i commenti per un articolo dato il DOI
 *     parameters:
 *       - in: path
 *         name: doi
 *         schema:
 *           type: string
 *         required: true
 *         description: DOI dell'articolo
 *     responses:
 *       200:
 *         description: Lista di commenti completa per il DOI
 */
router.get("/by-doi/:doi", async (req, res) => {
    try {
        const doiRaw = decodeURIComponent(req.params.doi);
        const doi = doiRaw.toLowerCase();

        const comments = await Comment.find({ doi_articolo: doi }).sort({ comment_id: 1 });

        if (!comments || comments.length === 0) {
            return res.status(404).json({ error: "Nessun commento trovato per questo DOI" });
        }

        res.json(comments.map(formatComment));

    } catch (err) {
        console.error("Errore in /by-doi:", err);
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
