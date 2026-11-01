import { auth } from 'express-oauth2-jwt-bearer';
import config from '../config/env.js';

const checkJwt = auth({
  audience: config.auth0Audience,
  issuerBaseURL: config.auth0IssuerBaseUrl,
});

export default checkJwt;
