const mongoose = require('mongoose');

const LessonRequestSchema = new mongoose.Schema({
    email: { type: String, required: true },
    day: { type: String, required: true },
    status: { type: String, default: 'pending' } // 'pending' or 'approved'
});

module.exports = mongoose.model('LessonRequest', LessonRequestSchema);
