const mongoose = require("mongoose");

const CommentSchema = new mongoose.Schema({
    comment_id: { type: Number, required: true, unique: true },
    comment_content: { type: String, required: true },
    is_from_author: { type: Boolean, default: false },
    classifications: [{
        category: { type: String, enum: ["methodological concerns", "figure anomalies", "clarification", "data validity", "ethical issues"] },
        user: { type: String }, 
        timestamp: { type: Date, default: Date.now }
    }]
});

module.exports = mongoose.model("Comment", CommentSchema);
