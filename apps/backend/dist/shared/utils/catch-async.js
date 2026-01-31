/**
 * Platinum Standard: Global Async Wrapper for Express Handlers.
 * Eliminates the need for try-catch blocks in controllers/middlewares.
 */
export const catchAsync = (fn) => {
    return (req, res, next) => {
        fn(req, res, next).catch(next);
    };
};
//# sourceMappingURL=catch-async.js.map