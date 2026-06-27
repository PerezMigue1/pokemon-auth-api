const express = require('express');

const authenticateToken =
    require('../middleware/authenticateToken');

const {
    getProfile
} = require('../controllers/profileController');

const router = express.Router();

router.get(
    '/',
    authenticateToken,
    getProfile
);

module.exports = router;