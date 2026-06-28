const express = require('express');

const authenticateToken =
    require('../middleware/authenticateToken');

const {
    getFavorites,
    addFavorite,
    removeFavorite
} = require('../controllers/favoritesController');

const router = express.Router();

/*
 * Todas las rutas de favoritos requieren
 * un access token válido.
 */
router.use(authenticateToken);

router.get(
    '/',
    getFavorites
);

router.post(
    '/',
    addFavorite
);

router.delete(
    '/:pokemonId',
    removeFavorite
);

module.exports = router;