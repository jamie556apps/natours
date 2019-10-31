const crypto = require('crypto');
const { promisify } = require('util');
const jwt = require('jsonwebtoken');
const User = require('./../models/UserModel');
const catchAsync = require('./../utils/catchAsync');
const AppError = require('./../utils/appError');
const Email = require('./../utils/email');

const signToken = id => {
  return jwt.sign({ id }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN
  });
};

const createSendToken = (user, status, res) => {
  const token = signToken(user._id);

  const cookieOptions = {
    expires: new Date(
      Date.now() + process.env.JWT_COOKIE_EXPIRES_IN * 24 * 60 * 60 * 1000
    ),
    secure: false,
    httpOnly: true
  };

  if (process.env.NODE_EV === 'production') cookieOptions.secure = true;

  res.cookie('jwt', token, cookieOptions);

  user.password = undefined;

  res.status(status).json({
    status: 'success',
    token,
    data: {
      user
    }
  });
};

exports.logout = (req, res) => {
  const cookieOptions = {
    expires: new Date(Date.now() + 100000),
    httpOnly: true
  };
  res.cookie('jwt', 'loggedOut', cookieOptions);

  res.status(200).json({
    status: 'success'
  });
};

exports.signUp = catchAsync(async (req, res, next) => {
  const newUser = await User.create({
    name: req.body.name,
    email: req.body.email,
    password: req.body.password,
    passwordConfirm: req.body.passwordConfirm
  });

  const url = `${req.protocol}://${req.get('host')}/me`;
  await new Email(newUser, url).sendWelcome();

  createSendToken(newUser, 201, res);
});

exports.login = catchAsync(async (req, res, next) => {
  const { email, password } = req.body;

  // 1. Check if email and passworf exist

  if (!email || !password) {
    return next(new AppError('Please provide an email and password'), 400);
  }

  // 2. Check if user exists && if password id correct
  const user = await User.findOne({ email }).select('+password');

  if (!user || !(await user.correctPassword(password, user.password))) {
    return next(new AppError('Inccorect email or password', 401));
  }
  // 3.  IF everything okay above send token to client
  createSendToken(user, 200, res);
});

//Create middleware function to check to check if user is logged in

exports.protect = catchAsync(async (req, res, next) => {
  // 1) Getting token and check if its there
  let token;
  if (
    req.headers.authorization &&
    req.headers.authorization.startsWith('Bearer')
  ) {
    token = req.headers.authorization.split(' ')[1];
  } else if (req.cookies.jwt) {
    token = req.cookies.jwt;
  }

  if (!token) {
    return next(new AppError('Please login', 401));
  }
  // 2) Verification token

  const decoded = await promisify(jwt.verify)(token, process.env.JWT_SECRET);

  // 3) Check if user still exists
  const freshUser = await User.findById(decoded.id);

  if (!freshUser) {
    return next(
      new AppError('the user beloning to the token no longer exists', 401)
    );
  }
  // 4) Check if user changed password after the token was issued

  if (freshUser.changedPassword(decoded.iat)) {
    return next(
      new AppError('User recently chagned password, please login again', 401)
    );
  }
  // Grant access to the protected route
  req.user = freshUser;
  res.locals.user = freshUser;

  // 5) if not issued next will be called and then our getAllTours handler will be called
  next();
});

//Only for rendered pages so no ERRORS. But still want to go through all the verifications to see if there is still a user. Not JUST that they have a token
exports.isLoggedIn = async (req, res, next) => {
  try {
    if (req.cookies.jwt) {
      // 2) Verification token

      const decoded = await promisify(jwt.verify)(
        req.cookies.jwt,
        process.env.JWT_SECRET
      );

      // 3) Check if user still exists
      const freshUser = await User.findById(decoded.id);

      // 4) Check if user changed password after the token was issued

      if (freshUser.changedPassword(decoded.iat)) {
        return next();
      }
      // THERE IS A LOGGED IN USER - give pug access to user
      res.locals.user = freshUser;
      return next();
    }
  } catch (err) {
    return next();
  }

  next();
};

exports.restrictedTo = (...roles) => {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      return next(
        new AppError('You do not have permission for perform this action', 403)
      );
    }

    next();
  };
};

exports.forgotPassword = catchAsync(async (req, res, next) => {
  //1. Get user based on the Posted email

  const user = await User.findOne({ email: req.body.email });

  if (!user) {
    return next(new AppError('Please enter in a valid email', 404));
  }
  //2. Generate the random reset token

  const resetToken = user.createPasswordResetToken();

  await user.save({ validateBeforeSave: false });
  //3. Send it to the users email

  try {
    const resetURL = `${req.protocol}://${req.get(
      'host'
    )}/api/v1/users/resetPassword/${resetToken}`;
    await new Email(user, resetURL).sendPasswordReset();

    res.status(200).json({
      status: 'success',
      message: 'A password reset email has been sent to your email address'
    });
  } catch (err) {
    user.createPasswordResetToken = undefined;
    user.PasswordResetExpires = undefined;
    await user.save({ validateBeforeSave: false });

    return next(new AppError(' There was an error sending the email1', 500));
  }
});
exports.resetPassword = catchAsync(async (req, res, next) => {
  // 1) Get user based on the token
  const hashedToken = crypto
    .createHash('sha256')
    .update(req.params.token)
    .digest('hex');

  const user = await User.findOne({
    passwordResetToken: hashedToken,
    passwordResetExpires: { $gt: Date.now() }
  });
  // 2) If token has not expired and there is user, set the new password

  if (!user) {
    return next(new AppError('Token is invalid or expired', 400));
  }
  user.password = req.body.password;
  user.passwordConfirm = req.body.passwordConfirm;
  user.passwordResetToken = undefined;
  user.passwordResetExpires = undefined;

  await user.save();
  // 3) Update the changedPAssword at property of the user
  // 4) Log the user in, send JWT
  createSendToken(user, 201, res);
});

//Update pass for user already logged in
exports.updatePasword = catchAsync(async (req, res, next) => {
  // 1) Get user from collection
  //const { email, password, newPassword, passwordConfirm } = req.body;

  //const user = await User.findOne({ email }).select('+password');
  const user = await User.findById(req.user.id).select('+password');

  // 2) check if posted current password is correct
  if (
    !user ||
    !(await user.correctPassword(req.body.passwordCurrent, user.password))
  ) {
    return next(
      new AppError('Please enter in the correct email and password'),
      400
    );
  }

  // 3) If so, update password

  //user.password = newPassword;
  user.password = req.body.password;
  //'ser.passwordConfirm = passwordConfirm;
  user.passwordConfirm = req.body.passwordConfirm;
  await user.save();
  // 4) Log user in , send new JWT

  createSendToken(user, 201, res);
});
