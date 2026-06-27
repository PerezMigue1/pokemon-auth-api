const mongoose = require('mongoose');

const authorizationCodeSchema = new mongoose.Schema(
    {
        codeHash: {
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
            required: true,
            trim: true
        },

        redirectUri: {
            type: String,
            required: true,
            trim: true
        },

        scope: {
            type: String,
            default: ''
        },

        codeChallenge: {
            type: String,
            default: null
        },

        codeChallengeMethod: {
            type: String,
            enum: ['S256', null],
            default: null
        },

        expiresAt: {
            type: Date,
            required: true,
            index: {
                expires: 0
            }
        },

        usedAt: {
            type: Date,
            default: null
        }
    },
    {
        timestamps: true,
        versionKey: false
    }
);

module.exports = mongoose.model(
    'AuthorizationCode',
    authorizationCodeSchema
);