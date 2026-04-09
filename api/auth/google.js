// api/auth/google.js
// ─────────────────────────────────────────────────────────────────────────────
// NOTE: This is a Vercel serverless function.
// Route: POST /api/auth/google
//
// Google OAuth sign-in flow:
//   1. Frontend obtains a Google ID token via @react-oauth/google
//   2. Frontend POSTs that token here
//   3. We verify it server-side with google-auth-library
//   4. We create or update the user record and return a JWT
//
// IMPORTANT:
//   After deployment, update Google Cloud Console → OAuth 2.0 Credentials:
//     Authorised JavaScript origins → https://your-app.vercel.app
//     Authorised redirect URIs      → https://your-app.vercel.app/api/auth/google
//   localhost URLs will stop working once the app is on Vercel.
//   Always update redirect URIs when the domain changes.
// ─────────────────────────────────────────────────────────────────────────────

const { OAuth2Client }            = require('google-auth-library');
const { connectDB }               = require('../../lib/db');
const User                        = require('../../lib/models/User');
const { signToken, toPublicUser } = require('../../lib/auth');

// GOOGLE_CLIENT_ID must match the one used on the frontend.
// Set it in Vercel environment variables — never hard-code it.
const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, message: 'Method not allowed' });
  }

  try {
    await connectDB();

    const { token } = req.body || {};

    if (!token) {
      return res.status(400).json({
        success: false,
        code:    'MISSING_FIELDS',
        message: 'Google ID token is required',
      });
    }

    // Verify the Google token with Google's servers.
    // This ensures the token was actually issued by Google for our app.
    const ticket = await googleClient.verifyIdToken({
      idToken:  token,
      audience: process.env.GOOGLE_CLIENT_ID,
    });

    const { sub: googleId, email, name, picture } = ticket.getPayload();

    // Find existing user by googleId OR email (handles the case where a user
    // previously registered with email/password and now signs in with Google).
    let user = await User.findOne({ $or: [{ googleId }, { email }] });

    if (!user) {
      // First-time Google login → create a new verified account.
      user = await User.create({
        name,
        email,
        googleId,
        avatar:     picture || '',
        isVerified: true,
        role:       'user',
      });
    } else {
      if (!user.googleId) {
        // Existing email/password user is linking Google for the first time.
        if (!user.isVerified) {
          return res.status(403).json({
            success: false,
            code:    'VERIFY_EMAIL_FIRST',
            message: 'Please verify your email before linking a Google account',
          });
        }

        user.googleId = googleId;
      }

      // Always refresh avatar from Google's latest profile picture.
      user.avatar     = picture || user.avatar;
      user.isVerified = true;
      await user.save();
    }

    return res.json({
      success: true,
      message: 'Google login successful',
      token:   signToken(user),
      user:    toPublicUser(user),
    });
  } catch (error) {
    console.error('[auth/google]', error);

    // google-auth-library throws a plain Error with message "Token used too late"
    // or "Invalid token signature" — surface those as 401.
    if (error.message?.includes('Token') || error.message?.includes('token')) {
      return res.status(401).json({
        success: false,
        code:    'GOOGLE_TOKEN_INVALID',
        message: 'Google token is invalid or expired. Please sign in again.',
      });
    }

    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
};
