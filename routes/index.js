const express = require('express');
const authorization = require("../middleware/authorization");

const router = express.Router();
/* GET home page. */
router.get('/', function (req, res, next) {
  res.render('index', { title: 'The Movies Database API' });
});

router.get('/movies/search', function (req, res, next) {
  res.render('index', { title: 'The Movies Database API' });
});

module.exports = router;