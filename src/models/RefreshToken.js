const mongoose = require('mongoose');

const refreshTokenSchema = new mongoose.Schema(
    {
        tokenHash: {
            type: String,
            required: true,
            unique: true,
            select: false
        },

        userId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            required: true
        },

        clientId: {
            type: String,
            required: true
        },

        expiresAt: {
            type: Date,
            required: true,
            index: {
                expires: 0
            }
        },

        revokedAt: {
            type: Date,
            default: null
        },

        replacedByTokenHash: {
            type: String,
            default: null
        }
    },
    {
        timestamps: true,
        versionKey: false
    }
);

module.exports = mongoose.model(
    'RefreshToken',
    refreshTokenSchema
);