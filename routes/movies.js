const express = require('express');


const router = express.Router();
/* GET home page. */

router.get('/search', function (req, res, next) {
	let searchParams = {
		"title": req.query.title,
		"year": req.query.year,
		"page": req.query.page
	}

	let query = req.db.from('basics');

	if (searchParams['title'] !== undefined) {
		query = query.where('primaryTitle', 'like', `%${searchParams['title']}%`)
	}

	if (searchParams['year'] !== undefined) {
		try {
			const parse = parseInt(searchParams['year']);

			if (!isNaN(parse) && parse > 999 && parse < 10000) {
				query = query.where('year', '=', parse);
			} else {
				throw "Invalid year format. Format must be a 4-digit year.";
			}

		} catch (e) {
			return res.status(400).json({
				error: true,
				message: e
			});
		}
	}

	try {
		const paginationQuery = query.clone();
		const movieData = [];
		const paginationData = {};

		paginationQuery.count('*')
			.then((row) => {
				const total = Object.values(row[0])[0];
				paginationData['total'] = total;
				let lastPage = Math.ceil(total / 100);
				(lastPage === 0) ? lastPage = 1 : lastPage;
				(searchParams['page'] === 0) ? searchParams['page'] = 1 : searchParams['page'];
				paginationData['lastPage'] = lastPage;
				paginationData['perPage'] = 100;
				paginationData['currentPage'] = searchParams['page'];
				paginationData['from'] = (searchParams['page'] - 1) * 100;

				let offset = paginationData['from'];
				if (paginationData['currentPage'] == paginationData['lastPage']) {
					paginationData['to'] = total;
				}
				else if ((total / offset) < 1) {
					paginationData['to'] = offset;
				} else {
					paginationData['to'] = paginationData['from'] + 100;
				}
			})

			.then(() => {
				if (searchParams['page'] !== undefined) {
					const parse = parseInt(searchParams['page']);
					try {
						if (!isNaN(parse)) {
							searchParams['page'] = parse;
							query = query.limit(100).offset((parse * 100) - 100);
						} else {
							throw "Invalid page format. page must be a number."
						}
					} catch (e) {
						return res.status(400).json({
							error: true,
							message: e
						});
						return;
					}
				} else {
					searchParams['page'] = 1;
				}
				query.select('*')
					.then((rows) => {
						res.json({
							'data': rows.map((row) => {
								return {
									'title': row['primaryTitle'],
									'year': row['year'],
									'imdbID': row['tconst'],
									'imdbRating': parseFloat(row['imdbRating']),
									'rottenTomatoesRating': parseFloat(row['rottentomatoesRating']),
									'metacriticRating': parseFloat(row['metacriticRating']),
									'classification': row['rated']
								};
							}),
							'pagination': paginationData
						});
						return;
					})
					.catch((e) => {
						console.log(e);

					})
			});
	} catch (e) {
		console.log(e);
	}
});

router.get("/data/:id", function (req, res) {
	if (Object.keys(req.query).length !== 0) {
		res.status(400).json({
			error: true,
			message: "Invalid query parameters: " + Object.keys(req.query)[0] + ". Query parameters are not permitted."
		})
		return;
	}
	let movieDetail = {};
	const principals = [];
	const ratings = [];
	
	req.db.from('basics').select('*').where('tconst', '=', req.params.id)
		.then((rows) => {
			if (rows.length < 1) {
				res.status(404).json({error: true, message: "No record exists of a movie with this ID"});
				return;
			}
			movieDetail = rows[0];


			req.db.from('basics').select(
				'principals.tconst', 
				'principals.nconst', 
				'names.primaryName',
				'principals.category', 
				'principals.characters' 
			)
			.join('principals', 'basics.tconst', '=', 'principals.tconst')
			.join('names', 'principals.nconst', '=', 'names.nconst')
			.where('basics.tconst', '=', movieDetail.tconst)
			.then((roles) => {
				roles.map((role) => {
					console.log(role);
					const result = {

						'id': role['nconst'],
						'category': role['category'],
						'name': role['primaryName'],
						'characters': []
					}
					if (role['characters'] !== ''){
						try {
							const parsed = JSON.parse(role['characters']);
							result['characters'] = parsed;
						} catch {
							console.log(role['characters']);
							const char = role['characters'].replaceAll(/[\w \.\-](")/g, '\\"');
							const parsed = JSON.parse(char);
							result['characters'] = parsed;
						}
					}
					principals.push(result);
				})
				
			})
			req.db.from('ratings').select('*')
				.where('tconst', '=', req.params.id)
			.then((rating_row) => {
				rating_row.map((rating) => {
					ratings.push({
						"source": rating.source,
						"value": parseFloat(rating.value)
					})
					
				})
			})
			.then(() => {
				res.json({
					  	"title": movieDetail.primaryTitle,
						"year": parseInt(movieDetail.year),
						"runtime": movieDetail.runtimeMinutes,
						"genres": movieDetail.genres.split(','),
						"country": movieDetail.country,
						"principals": principals,
						"ratings": ratings,
						"boxoffice": movieDetail.boxoffice == 0 ? null : movieDetail.boxoffice,
						"poster": movieDetail.poster,
						"plot": movieDetail.plot
				});
				return;
			})
		})
		.catch((err) => {
			console.log(err);
			res.json({ "Error": true, "Message": "Error executing MySQL query" })
			return;
		})
});

module.exports = router;