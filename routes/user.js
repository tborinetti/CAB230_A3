const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
const JWT_SECRET = process.env.JWT_SECRET;
const express = require('express');
const router = express.Router();

/* GET users listing. */
router.get('/', function (req, res, next) {
  res.send('respond with a resource');
});

router.post('/login', function (req, res, next) {
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
        throw new Error("User does not exist");
      }

      const user = users[0];
      return bcrypt.compare(password, user.hash);
    })
    .then(match => {
      if (!match) {
        throw new Error("Passwords do not match");
      }
      const expires_in = 60 * 60 * 24;
      const exp = Math.floor(Date.now() / 1000) + expires_in;
      const token = jwt.sign({ exp }, process.env.JWT_SECRET);
      res.status(200).json({
        token,
        token_type: "Bearer",
        expires_in
      });
    })
    .catch(e => {
      res.status(500).json({ success: false, message: e.message });
    });


});

router.post('/register', function (req, res, next) {
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
    })
    .catch(e => {
      res.status(500).json({ success: false, message: e.message });
    });
});

module.exports = router;
