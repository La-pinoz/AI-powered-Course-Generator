import axios from 'axios';
import config from '../config/env.js';

// Profile fields always come from Auth0, never from the request body.
export async function fetchUserInfo(accessToken) {
  const { data } = await axios.get(`${config.auth0IssuerBaseUrl}userinfo`, {
    headers: { Authorization: `Bearer ${accessToken}` },
    timeout: 8000,
  });
  return { email: data.email, name: data.name, picture: data.picture };
}
