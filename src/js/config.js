export const DEBUG_MODE = false;

export const API_BASE = 'https://dmtezcygeb.execute-api.us-east-2.amazonaws.com';

const PROD_ORIGIN = 'https://meals.jaetill.com';
const DEV_ORIGIN  = 'http://localhost:5173';

const origin = import.meta.env.DEV ? DEV_ORIGIN : PROD_ORIGIN;

export const COGNITO = {
  region:      'us-east-2',
  userPoolId:  'us-east-2_xneeJzaDJ',
  domain:      'just.jaetill.com',
  clientId:    '2g8kng7thvouq1ami8cm336gbb',
  redirectUri: `${origin}/callback.html`,
  logoutUri:   `${origin}/`,
  scopes:      ['openid', 'email', 'profile', 'aws.cognito.signin.user.admin'],
};
