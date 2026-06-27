const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema(
    {
        name: {
            type: String,
            required: true,
            trim: true,
            minlength: 2,
            maxlength: 80
        },

        email: {
            type: String,
            required: true,
            unique: true,
            trim: true,
            lowercase: true,
            maxlength: 160,
            match: [
                /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
                'El correo electrónico no es válido.'
            ]
        },

        passwordHash: {
            type: String,
            required: true,
            select: false
        },

        isActive: {
            type: Boolean,
            default: true
        },

        tokenVersion: {
            type: Number,
            default: 0,
            min: 0
        },

        favorites: [
            {
                pokemonId: {
                    type: Number,
                    required: true,
                    min: 1
                },

                name: {
                    type: String,
                    required: true,
                    trim: true
                },

                image: {
                    type: String,
                    default: null
                },

                addedAt: {
                    type: Date,
                    default: Date.now
                }
            }
        ]
    },
    {
        timestamps: true,
        versionKey: false
    }
);

userSchema.index(
    {
        'favorites.pokemonId': 1
    }
);

userSchema.methods.verifyPassword = async function verifyPassword(
    password
) {
    return bcrypt.compare(
        password,
        this.passwordHash
    );
};

userSchema.statics.hashPassword = async function hashPassword(
    password
) {
    const saltRounds = 12;

    return bcrypt.hash(
        password,
        saltRounds
    );
};

module.exports = mongoose.model(
    'User',
    userSchema
);