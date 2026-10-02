const express = require("express");
const router = express.Router();
const Comment = require("../models/comment");
const Category = require("../models/category");

const defaultCategories = [
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
        doi_article: doc.doi_articolo,
        title_article: doc.titolo_articolo,
        authors_article: doc.autori_articolo,
        journal_article: doc.rivista_articolo,
        url_article: doc.url_articolo,
        classifications: doc.classifications || []
    };
};

/**
 * @swagger
 * /api/comments/categories:
 *   get:
 *     summary: Restituisce l'elenco completo di tutte le categorie (predefinite + create dagli utenti)
 *     responses:
 *       200:
 *         description: Lista delle categorie e dettagli sui creatori
 */
router.get("/categories", async (req, res) => {
    try {
        // Recupera tutte le categorie personalizzate dal DB
        const customCategories = await Category.find({}, "name createdBy createdAt");

        const customNames = customCategories.map((c) => c.name);

        // Unisce le categorie di default e quelle create dagli utenti (senza duplicati)
        const allCategoryNames = Array.from(
            new Set([...defaultCategories, ...customNames])
        );

        res.json({
            categories: allCategoryNames,
            details: customCategories
        });
    } catch (err) {
        console.error("Errore nel recupero delle categorie:", err);
        res.status(500).json({ error: err.message });
    }
});

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
        const N = parseInt(req.params.N) || 1;
        const sampleSize = 50;

        const rawSample = await Comment.aggregate([
            { $sample: { size: sampleSize } }
        ]);

        rawSample.sort((a, b) => {
            const aCount = a.classifications ? a.classifications.length : 0;
            const bCount = b.classifications ? b.classifications.length : 0;
            return aCount - bCount;
        });

        const selected = rawSample.slice(0, N);

        res.json(selected.map(formatComment));

    } catch (err) {
        console.error("Errore in /random:", err);
        res.status(500).json({ error: err.message });
    }
});

/**
 * @swagger
 * /api/comments/classify/{id}:
 *   post:
 *     summary: Salva una classificazione per un commento e registra l'autore se la categoria è nuova
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

        const cleanCategory = category.trim().toLowerCase();

        if (cleanCategory.length === 0) {
            return res.status(400).json({ error: "La categoria non può essere vuota" });
        }

        // 1. Salva la classificazione sul commento
        const updatedDoc = await Comment.findOneAndUpdate(
            { comment_id: commentId },
            { $push: { classifications: { category: cleanCategory, user } } },
            { new: true }
        );

        if (!updatedDoc) {
            return res.status(404).json({ error: "Commento non trovato" });
        }

        // 2. Se non fa parte di quelle predefinite, salva/registra il creatore originale nel DB
        if (!defaultCategories.includes(cleanCategory)) {
            await Category.updateOne(
                { name: cleanCategory },
                { $setOnInsert: { name: cleanCategory, createdBy: user, createdAt: new Date() } },
                { upsert: true }
            );
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