import User from '../models/User.js';
import { fetchUserInfo } from '../services/auth0Service.js';
import asyncHandler from '../utils/asyncHandler.js';

const toUserResponse = (user) => ({
  _id: user._id,
  auth0Id: user.auth0Id,
  email: user.email,
  name: user.name,
  picture: user.picture,
  createdAt: user.createdAt,
  lastLoginAt: user.lastLoginAt,
});

// POST /api/users/sync — find-or-create keyed on the Auth0 `sub`.
export const syncUser = asyncHandler(async (req, res) => {
  const { sub } = req.auth.payload;
  const token = req.auth.token;
  const now = new Date();

  let profile;
  try {
    profile = await fetchUserInfo(token);
  } catch (err) {
    console.warn(`[users] /userinfo failed: ${err.message}`);
  }

  if (!profile) {
    // Fall back to touching lastLoginAt for an existing user; a brand-new user needs the profile.
    const existing = await User.findOneAndUpdate(
      { auth0Id: sub },
      { $set: { lastLoginAt: now } },
      { returnDocument: 'after' },
    );
    if (!existing) {
      const error = new Error('Could not load your profile from Auth0. Please try again.');
      error.status = 502;
      throw error;
    }
    return res.json({ user: toUserResponse(existing) });
  }

  const user = await User.findOneAndUpdate(
    { auth0Id: sub },
    {
      $set: {
        email: profile.email,
        name: profile.name,
        picture: profile.picture,
        lastLoginAt: now,
      },
    },
    { upsert: true, returnDocument: 'after', setDefaultsOnInsert: true },
  );

  return res.json({ user: toUserResponse(user) });
});

// GET /api/users/me — the stored user for the token's `sub`.
export const getMe = asyncHandler(async (req, res) => {
  const user = await User.findOne({ auth0Id: req.auth.payload.sub });
  if (!user) {
    const error = new Error('User not found. Please log in again.');
    error.status = 404;
    throw error;
  }
  return res.json({ user: toUserResponse(user) });
});
