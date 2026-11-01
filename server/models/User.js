import mongoose from 'mongoose';

const userSchema = new mongoose.Schema(
  {
    // Auth0 `sub`, e.g. 'auth0|abc' or 'google-oauth2|123'. The only unique key.
    auth0Id: { type: String, required: true, unique: true, index: true },
    // Not unique: the same email via password and via Google yields two different `sub` values.
    email: { type: String, lowercase: true, trim: true },
    name: { type: String, trim: true },
    picture: String,
    lastLoginAt: Date,
  },
  { timestamps: true },
);

export default mongoose.model('User', userSchema);
