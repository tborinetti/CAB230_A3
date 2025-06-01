const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
const express = require('express');
const router = express.Router();
const authorization = require("../middleware/profile_auth");
const profile_auth = require('../middleware/profile_auth');
const e = require('express');

/* GET users listing. */
router.get('/', function (req, res) {
	res.send('respond with a resource');
	return;
});

router.post('/login', function (req, res) {
	const email = req.body.email;
	const password = req.body.password;
	const bearerExpire = req.body.bearerExpiresInSeconds;
	const refreshExpire = req.body.refreshExpiresInSeconds;

	// Verify body
	if (!email || !password) {
		res.status(400).json({
			error: true,
			message: "Request body incomplete - email and password needed"
		});
		return;
	}
	
	const queryUsers = req.db.from("users").select("*").where("email", "=", email);
	queryUsers
		.then(users => {
			if (users.length === 0) {
				throw new Error("Incorrect email or password");
			}

			const user = users[0];
			return bcrypt.compare(password, user.hash);
		})
		.then(match => {
			if (!match) {
				throw new Error("Incorrect email or password");
			}
			const bearer_expires_in = bearerExpire ? parseInt(bearerExpire): 60 * 10;
			const bearer_exp = Math.floor(Date.now() / 1000) + bearer_expires_in;
			const bearer_token = jwt.sign({ exp: bearer_exp, email }, process.env.JWT_SECRET);
			
			const refresh_expires_in = refreshExpire ? parseInt(refreshExpire) : 60 * 60 * 24;
			const refresh_exp = Math.floor(Date.now() / 1000) + refresh_expires_in;
			const refresh_token = jwt.sign({ exp: refresh_exp, email }, process.env.JWT_SECRET);
			req.db.from("users")
				.update("refresh", refresh_token)
				.where('email', '=', email)

			.then(()=> {
				res.status(200).json({
					"bearerToken": {
						"token": bearer_token,
						"token_type": "Bearer",
						"expires_in": bearer_expires_in 
					}, 
					"refreshToken": {
						"token": refresh_token,
						"token_type": "Refresh",
						"expires_in": refresh_expires_in 
					}
					
					
				});
			});

		})
		.catch(e => {
			res.status(401).json({ success: false, message: e.message });
			return;
		});


});

router.post('/register', function (req, res) {
	const email = req.body.email;
	const password = req.body.password;

	if (!email || !password) {
		res.status(400).json({
			error: true,
			message: "Request body incomplete - email and password needed"
		});
		return;
	}

	const queryUsers = req.db.from("users").select("*").where("email", "=", email);
	queryUsers.then(users => {
		if (users.length > 0) {
			throw new Error("User already exists");
		}

		const saltRounds = 10;
		const hash = bcrypt.hashSync(password, saltRounds);
		return req.db.from("users").insert({ email, hash });

	})
		.then(() => {
			res.status(201).json({ success: true, message: "User created" });
			return;
		})
		.catch(e => {
			res.status(500).json({ success: false, message: e.message });
			return;
		});
});

router.get('/:email/profile', profile_auth, function (req, res) {
	if (differentUser(req) === true) {
		req.db.from('users').
			select("email", "firstName", "lastName").
			where('email', '=', req.params.email)
		.then((result) => {
			if (result.length !== 1){
				throw new Error("User not found");
			}
			const row = result[0];
			res.json({
				'email': row.email,
				'firstName': row.firstName ? row.firstName : null,
				'lastName': row.lastName? row.lastName : null
			})
			return;
		}).catch((e) => {
			res.status(404).json({
				"error": true,
				"message": e.message
			});
			return;
		})
	} else {
		req.db.from('users').
			select("email", "firstName", "lastName", "dob", "address").
			where('email', '=', req.params.email)
		.then((result) => {
			const row = result[0];
			res.json({
				'email': row.email,
				'firstName': row.firstName ? row.firstName : null,
				'lastName': row.lastName? row.lastName : null,
				'dob': row.dob? row.dob : null,
				'address': row.address? row.address : null
			})
		})
	}
});

router.put('/:email/profile', authorization, function(req, res){
	if (differentUser(req) === true){
		res.status(403).json({
			"error": true,
			"message": "Forbidden"
		});
		return;
	} 
	const {firstName, lastName, dob, address} = req.body;
	
	if (!firstName || !lastName || !dob || !address){
		res.status(400).json({
			"error": true,
			"message": "Request body incomplete: firstName, lastName, dob and address are required."
		});
		return;
	}

	const invalid = (field) => typeof field !== 'string';
	if ([firstName, lastName, dob, address].some(invalid)) {
		res.status(400).json({
			"error": true, 
			"message": "Request body invalid: firstName, lastName and address must be strings only."
		});
		return;
	}
	try {
		const parsedDate = new Date(dob);
		if (isNaN(parsedDate) || dob !== parsedDate.toISOString().split('T')[0]){
			throw new Error("Invalid input: dob must be a real date in format YYYY-MM-DD.")
		} else if (new Date() < parsedDate) {
			throw new Error("Invalid input: dob must be a date in the past.")
		}
	} catch (e) {
		res.status(400).json({
			"error": true,
			"message": e.message
		});
		return;
	}
	
	req.db.from('users')
	.update({firstName, lastName, dob, address})
	.where('email', '=', req.params.email)
	.then(() => {
		req.db.from('users').
			select("email", "firstName", "lastName", "dob", "address").
			where('email', '=', req.params.email)
		.then((result) => {
			const row = result[0];
			console.log(row);
			res.json({
				'email': row.email,
				'firstName': row.firstName ? row.firstName : null,
				'lastName': row.lastName? row.lastName : null,
				'dob': row.dob? row.dob : null,
				'address': row.address? row.address : null
			})
		})
	})



});

function differentUser(req) {
	let result = true;
	if ("authorization" in req.headers) {
		const token = req.headers.authorization.replace(/^Bearer /, "");
		jwt.verify(token, process.env.JWT_SECRET, (err, decoded) => {
			if (err) {
				console.log('Token is invalid');
				result = true;
			}
			console.log('Decoded Token:', decoded);
			
			if (decoded.email === req.params.email) {
				console.log("User fully authorized");
				result = false;
			}
		});
	}
	return result;
}

router.post('/refresh', function(req, res) {
	const refresh = req.body.refreshToken;
	let email = "";
	if (!refresh) {
		res.status(400).json({
			"error": true,
			"message": "Request body incomplete, refresh token required"
		});
		return;
	}
	
	try {
        jwt.verify(refresh, process.env.JWT_SECRET, (err, decoded) => {
			email = decoded.email;
		});

		req.db.from("users")
			.select("refresh")
			.where("email", '=', email)
		.then((row)=>{
			if (refresh !== row[0].refresh) {
				res.status(401).json({ error: true, message: "JWT token has expired" });
				return;
			}
		})
    } catch (e) {
        if (e.name === "TokenExpiredError") {
            res.status(401).json({ error: true, message: "JWT token has expired" });
        } else {
            res.status(401).json({ error: true, message: "Invalid JWT token" });
        }
        return;
    }

	

	const bearer_expires_in = 60 * 10; // 10 minutes
	const bearer_exp = Math.floor(Date.now() / 1000) + bearer_expires_in;
	const bearer_token = jwt.sign({ exp: bearer_exp, email }, process.env.JWT_SECRET);
	
	const refresh_expires_in = 60 * 60 * 24; // 24 hours
	const refresh_exp = Math.floor(Date.now() / 1000) + refresh_expires_in;
	const refresh_token = jwt.sign({ exp: refresh_exp, email }, process.env.JWT_SECRET);

	res.status(200).json({
		"bearerToken": {
			"token": bearer_token,
			"token_type": "Bearer",
			"expires_in": bearer_expires_in 
		}, 
		"refreshToken": {
			"token": refresh_token,
			"token_type": "Refresh",
			"expires_in": refresh_expires_in 
		}
		
		
	});
});

router.post('/logout', function(req, res) {
	const refresh = req.body.refreshToken;
	let email = "";
	if (!refresh) {
		res.status(400).json({
			"error": true,
			"message": "Request body incomplete, refresh token required"
		});
		return;
	}

	try {
        jwt.verify(refresh, process.env.JWT_SECRET, (err, decoded) => {
			email = decoded.email;
		});

		req.db.from("users")
			.select("refresh")
			.where("email", '=', email)
		.then((row)=>{
			if (refresh !== row[0].refresh) {
				res.status(401).json({ error: true, message: "JWT token has expired" });
				return;
			} 
		}).then(() => {
			req.db.from("users").update("refresh", null).where('email', '=', email)
			.then(() => {
				res.status(200).json({ error: false, message: "Token successfully invalidated" });
				return;
			})
			.catch((e) => {
				throw new Error(e); 
			})
		});	
		
    } catch (e) {
        if (e.name === "TokenExpiredError") {
            res.status(401).json({ error: true, message: "JWT token has expired" });
			return;
        } else {
            res.status(401).json({ error: true, message: "Invalid JWT token" });
			return;
        }
    }
});


module.exports = router;
