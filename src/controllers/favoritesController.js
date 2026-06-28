async function getFavorites(
    request,
    response,
    next
) {
    try {
        const user = request.auth.user;

        const favorites = [...user.favorites].sort(
            (first, second) =>
                new Date(second.addedAt) -
                new Date(first.addedAt)
        );

        return response.status(200).json({
            success: true,
            count: favorites.length,
            favorites
        });
    } catch (error) {
        return next(error);
    }
}

async function addFavorite(
    request,
    response,
    next
) {
    try {
        const user = request.auth.user;

        const pokemonId =
            Number(request.body.pokemonId);

        const name =
            String(request.body.name || '').trim();

        const image =
            request.body.image
                ? String(request.body.image).trim()
                : null;

        if (
            !Number.isInteger(pokemonId) ||
            pokemonId < 1
        ) {
            return response.status(400).json({
                success: false,
                error:
                    'El identificador del Pokémon no es válido.'
            });
        }

        if (
            name.length < 1 ||
            name.length > 100
        ) {
            return response.status(400).json({
                success: false,
                error:
                    'El nombre del Pokémon no es válido.'
            });
        }

        const alreadyExists =
            user.favorites.some(
                (favorite) =>
                    favorite.pokemonId === pokemonId
            );

        if (alreadyExists) {
            return response.status(409).json({
                success: false,
                code:
                    'FAVORITE_ALREADY_EXISTS',
                error:
                    `${name} ya está en tus favoritos.`
            });
        }

        user.favorites.push({
            pokemonId,
            name,
            image
        });

        await user.save();

        const newFavorite =
            user.favorites[
                user.favorites.length - 1
            ];

        return response.status(201).json({
            success: true,
            message:
                `${name} fue agregado a tus favoritos.`,
            favorite: newFavorite
        });
    } catch (error) {
        return next(error);
    }
}

async function removeFavorite(
    request,
    response,
    next
) {
    try {
        const user = request.auth.user;

        const pokemonId =
            Number(request.params.pokemonId);

        if (
            !Number.isInteger(pokemonId) ||
            pokemonId < 1
        ) {
            return response.status(400).json({
                success: false,
                error:
                    'El identificador del Pokémon no es válido.'
            });
        }

        const initialLength =
            user.favorites.length;

        user.favorites =
            user.favorites.filter(
                (favorite) =>
                    favorite.pokemonId !== pokemonId
            );

        if (
            user.favorites.length ===
            initialLength
        ) {
            return response.status(404).json({
                success: false,
                code:
                    'FAVORITE_NOT_FOUND',
                error:
                    'Ese Pokémon no estaba en tus favoritos.'
            });
        }

        await user.save();

        return response.status(200).json({
            success: true,
            message:
                'El Pokémon fue eliminado de tus favoritos.'
        });
    } catch (error) {
        return next(error);
    }
}

module.exports = {
    getFavorites,
    addFavorite,
    removeFavorite
};