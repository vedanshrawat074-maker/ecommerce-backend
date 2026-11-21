const User = require('../models/User');
const AppError = require('../utils/AppError');
const catchAsync = require('../utils/catchAsync');
const env = require('../config/env');
const { signAccessToken, signRefreshToken, verifyRefreshToken, hashToken } = require('../utils/tokens');

// Issues an access + refresh token pair and stores the refresh token hash (max 5 sessions per user).
async function issueTokens(user) {
  const accessToken = signAccessToken(user);
  const refreshToken = signRefreshToken(user);
  const expiresAt = new Date(Date.now() + env.refreshExpiresDays * 86400000);
  await User.updateOne(
    { _id: user._id },
    { $push: { refreshTokens: { $each: [{ tokenHash: hashToken(refreshToken), expiresAt }], $slice: -5 } } }
  );
  return { accessToken, refreshToken };
}

exports.register = catchAsync(async (req, res) => {
  const user = await User.create(req.body);
  const tokens = await issueTokens(user);
  res.status(201).json({ status: 'success', data: { user, ...tokens } });
});

exports.login = catchAsync(async (req, res) => {
  const { email, password } = req.body;
  const user = await User.findOne({ email }).select('+password');
  if (!user || !(await user.comparePassword(password))) throw new AppError('Invalid email or password', 401);
  if (!user.isActive) throw new AppError('Account is deactivated', 403);
  const tokens = await issueTokens(user);
  res.json({ status: 'success', data: { user, ...tokens } });
});

// Refresh-token rotation: the old token is invalidated and a new pair is issued.
// Re-use of an already-rotated token is treated as theft -> all sessions revoked.
exports.refresh = catchAsync(async (req, res) => {
  const { refreshToken } = req.body;
  let decoded;
  try {
    decoded = verifyRefreshToken(refreshToken);
  } catch {
    throw new AppError('Invalid or expired refresh token', 401);
  }
  const hash = hashToken(refreshToken);
  const user = await User.findOne({ _id: decoded.id, 'refreshTokens.tokenHash': hash });
  if (!user) {
    await User.updateOne({ _id: decoded.id }, { $set: { refreshTokens: [] } });
    throw new AppError('Refresh token reuse detected. Please log in again.', 401);
  }
  if (!user.isActive) throw new AppError('Account is deactivated', 403);
  await User.updateOne({ _id: user._id }, { $pull: { refreshTokens: { tokenHash: hash } } });
  const tokens = await issueTokens(user);
  res.json({ status: 'success', data: tokens });
});

exports.logout = catchAsync(async (req, res) => {
  try {
    const decoded = verifyRefreshToken(req.body.refreshToken);
    await User.updateOne({ _id: decoded.id }, { $pull: { refreshTokens: { tokenHash: hashToken(req.body.refreshToken) } } });
  } catch {
    /* already invalid -> treat as logged out */
  }
  res.json({ status: 'success', message: 'Logged out' });
});
