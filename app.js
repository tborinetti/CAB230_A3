const createError = require('http-errors');
const express = require('express');
const path = require('path');
const cookieParser = require('cookie-parser');
const logger = require('morgan');
const swaggerUI = require('swagger-ui-express');
const swaggerDocument = require('./docs/openapi.json');

const moviesRouter = require('./routes/movies');
const peopleRouter = require('./routes/people');
const usersRouter = require('./routes/user');

const app = express();

const options = require('./knexfile');
const knex = require('knex')(options);
const cors = require('cors');
require("dotenv").config();

app.use((req, res, next) => {
  req.db = knex;
  next();
});


// view engine setup
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'jade');

logger.token('res', (req, res) => {
  const headers = {}
  res.getHeaderNames().map(h => headers[h] = res.getHeader(h))
  return JSON.stringify(headers)
}) 

app.use(logger('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));

app.use(express.static(path.join(__dirname, 'public')));
app.use(cors());

app.get('/knex', function (req, res, next) {
  req.db.raw("SELECT VERSION()").then(
    (version) => console.log((version[0][0]))
  ).catch((err) => { console.log(err); throw err })
  res.send("Version Logged successfully");
});

app.use('/', swaggerUI.serve);
app.get('/', swaggerUI.setup(swaggerDocument));
app.use('/movies', moviesRouter);
app.use('/people', peopleRouter);
app.use('/user', usersRouter);


// catch 404 and forward to error handler
app.use(function (req, res, next) {
  next(createError(404));
});

// error handler
app.use(function (err, req, res, next) {
  if (res.headersSent) { 
    return next(err); 
  }
  // set locals, only providing error in development
  res.locals.message = err.message;
  res.locals.error = req.app.get('env') === 'development' ? err : {};

  // render the error page
  res.status(err.status || 500);
  res.render('error');
});

module.exports = app;
