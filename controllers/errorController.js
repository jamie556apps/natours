const AppError = require('./../utils/appError');

const handleCastErrorDB = err => {
  const message = `Invalid ${err.path} and ${err.value}`;
  return new AppError(message, 400);
};

const handleDuplicateFieldsDB = err => {
  const value = err.errmsg.match(/(["'])(\\?.)*?\1/)[0];
  const message = `Dulicate fields value: ${value}. Please use another value`;
  return new AppError(message, 400);
};

const handleValidationErrorDB = err => {
  const errors = Object.values(err.errors).map(el => el.message);
  const message = `Invalid input data for ${errors.join('. ')}`;
  return new AppError(message, 400);
};

const handleJWTError = () =>
  new AppError('Invalid Token please login again', 401);

const handleExpiredError = () =>
  new AppError('Your token has expired. please login again', 401);

const sendErrDev = (err, req, res) => {
  // A)API
  if (req.originalUrl.startsWith('/api')) {
    return res.status(err.statusCode).json({
      status: err.status,
      err: err,
      message: err.message,
      stack: err.stack
    });
  }
  //Rendered website
  return res.status(err.statusCode).render('error', {
    title: 'Something went wrong!',
    msg: err.message
  });
};

const sendErrProd = (err, req, res) => {
  // B) API
  if (req.originalUrl.startsWith('/api')) {
    //Operational error
    if (err.isOperational) {
      return res.status(err.statusCode).json({
        status: err.status,
        message: err.message
      });
      //Programming or unknown errror
    }
    // Log to the console
    console.error('ERROR', err);
    //
    return res.status(err.statusCode).render('error', {
      title: 'Something went wrong',
      msg: 'Something went wrong'
    });
  }

  // B) RENDERED WEBSITE
  if (err.isOperational) {
    return res.status(err.statusCode).render('error', {
      title: 'error',
      msg: err.message
    });
  }

  //Log the error
  console.error('ERROR', err);

  return res.status(err.statusCode).render('error', {
    title: 'Something went wrong',
    msg: 'Something went wrong'
  });
};

module.exports = (err, req, res, next) => {
  err.statusCode = err.statusCode || 500;
  err.status = err.status || 'error';

  if (process.env.NODE_ENV === 'development') {
    sendErrDev(err, req, res);
  } else if (process.env.NODE_ENV === 'production') {
    let error = { ...err };
    error.message = err.message;
    if (error.name === 'CastError') error = handleCastErrorDB(error);
    if (error.code === 11000) error = handleDuplicateFieldsDB(error);
    if (error.name === 'ValidationError')
      error = handleValidationErrorDB(error);
    if (error.name === 'JsonWebTokenError') error = handleJWTError();
    if (error.name === 'TokenExpiredError') error = handleExpiredError();
    sendErrProd(error, req, res);
  }
};
