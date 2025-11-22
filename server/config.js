/* eslint-env node */
import dotenv from 'dotenv';
dotenv.config();

const config = {
    PORT: process.env.PORT || 3000,
    CORS_ORIGIN: process.env.CORS_ORIGIN ? process.env.CORS_ORIGIN.split(',') : ["http://localhost:5173"],
    MAX_HTTP_BUFFER_SIZE: 1e6, // 1MB

    // Rate Limiting
    RATE_LIMIT_WINDOW: 10000, // 10 seconds
    RATE_LIMIT_MAX: 3, // Max 3 actions per window

    // Input Validation
    MAX_NICKNAME_LENGTH: 20,
    MAX_ROOM_NAME_LENGTH: 30,
    MAX_MESSAGE_LENGTH: 500,
    NICKNAME_REGEX: /^[a-zA-Z0-9_-]+$/,

    // Memory Protection
    IDENTITY_TTL: 24 * 60 * 60 * 1000 // 24 hours
};

export default config;
