const jwt = require('jsonwebtoken');
module.exports = function (req, res, next) {
    if (("authorization" in req.headers)) {
        if (!req.headers.authorization.match(/^Bearer /)) {
            res.status(401).json({ error: true, message: "Authorization header is malformed" });
            return;
        }
        const token = req.headers.authorization.replace(/^Bearer /, "");
        try {
            jwt.verify(token, process.env.JWT_SECRET);
        } catch (e) {
            if (e.name === "TokenExpiredError") {
                res.status(401).json({ error: true, message: "JWT token has expired" });
            } else {
                res.status(401).json({ error: true, message: "Invalid JWT token" });
            }
            return;
        }
    }
    next();
};