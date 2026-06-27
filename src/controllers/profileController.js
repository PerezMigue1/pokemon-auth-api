async function getProfile(
    request,
    response,
    next
) {
    try {
        const user = request.auth.user;

        return response.status(200).json({
            success: true,
            user: {
                id: user._id,
                name: user.name,
                email: user.email,
                isActive: user.isActive,
                favoritesCount:
                    user.favorites.length,
                createdAt: user.createdAt
            }
        });
    } catch (error) {
        return next(error);
    }
}

module.exports = {
    getProfile
};