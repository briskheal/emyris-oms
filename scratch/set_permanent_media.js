const mongoose = require('mongoose');
require('dotenv').config();

const companySchema = new mongoose.Schema({
    musicUrl: String,
    videoUrl: String
}, { strict: false });

const Company = mongoose.model('Company', companySchema);

async function setPermanentMedia() {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        const settings = await Company.findOne();
        if (settings) {
            settings.musicUrl = '/uploads/media/music.mp3';
            settings.videoUrl = '/uploads/media/landing.mp4';
            await settings.save();
            console.log("✅ Database updated with permanent file paths.");
        }
        process.exit(0);
    } catch (e) {
        console.error("❌ Failed to update DB:", e.message);
        process.exit(1);
    }
}

setPermanentMedia();
