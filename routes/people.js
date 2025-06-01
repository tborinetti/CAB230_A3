let express = require('express');
const authorization = require("../middleware/authorization");

const router = express.Router();
router.get("/:id", authorization, function (req, res) {
    if (Object.keys(req.query).length !== 0) {
        res.status(400).json({
            error: true,
            message: "Invalid query parameters: " + Object.keys(req.query)[0] + ". Query parameters are not permitted."
        })
        return;
    }

    req.db.from('names').select('*').where('nconst', '=', req.params.id)
        .then((rows) => {
            if (rows.length < 1) {
                throw new Error("User does not exist");
            }
            const row = rows[0];
            const jsonRoles = [];
            req.db.from('names').select(
                'basics.primaryTitle', 
                'principals.tconst', 
                'principals.category', 
                'principals.characters', 
                'basics.imdbRating'
            )
            .join('principals', 'names.nconst', '=', 'principals.nconst')
            .join('basics', 'principals.tconst', '=', 'basics.tconst')
            .where('names.nconst', '=', row.nconst)
            .then((roles) => {
                roles.map((role) => {
                    const result = {
                        'movieName': role['primaryTitle'],
                        'movieID': role['tconst'],
                        'category': role['category'],
                        'characters': [], 
                        'imdbRating': parseFloat(role['imdbRating'])
                    }
                    if (role['characters'] !== ''){
                        try {
                            const parsed = JSON.parse(role['characters']);
                            result['characters'] = parsed;
                        } catch {
                            const char = role['characters'].replaceAll(/[\w \.\-](")/g, '\\"');
                            const parsed = JSON.parse(char);
                            result['characters'] = parsed;
                        }
                    }
                    jsonRoles.push(result);
                })
                
            })
            .then(() => {
                res.json({
                    "name": row.primaryName,
                    "birthYear": row.birthYear,
                    "deathYear": row.deathYear,
                    "roles": jsonRoles
                })})
        })
        .catch((err) => {
            console.log(err);
            res.json({ "Error": true, "Message": "Error executing MySQL query" })
            return;
        })
});

module.exports = router;
