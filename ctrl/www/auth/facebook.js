const OAuth = require('oauth')
const Path = require('path')


const sites = require('../sites.js');
const auth = require('../auth.js');

const script_name = Path.basename(__filename).split('.')[0];

var apps = {};

var setup = (domain, c) => {
	return apps[domain] = new OAuth.OAuth(
		'https://api.twitter.com/oauth/request_token',
		'https://api.twitter.com/oauth/access_token',
		c.key,
		c.secret,
		'1.0A',
		`https://${domain}/auth/twitter/callback`,
		'HMAC-SHA1'
	);
}

async function getAccessTokenFromCode(code) {
  const { data } = await axios({
    url: 'https://graph.facebook.com/v4.0/oauth/access_token',
    method: 'get',
    params: {
      client_id: process.env.APP_ID_GOES_HERE,
      client_secret: process.env.APP_SECRET_GOES_HERE,
      redirect_uri: 'https://www.example.com/authenticate/facebook/',
      code,
    },
  });
  console.log(data); // { access_token, token_type, expires_in }
  return data.access_token;
};

app.get('/auth/'+script_name, (req, res) => {
	let oauth = apps[req.hostname];
	console.log('twitter:'+req.hostname);
	if(!oauth) oauth = setup(req.hostname, req.site.auth.twitter);

	let ses = req.session.twitter;
	if(!ses) ses = req.session.twitter = {};
	
	oauth.getOAuthRequestToken((error, requestToken, requestSecret, results) => {
		if(error)
			res.send("Error getting OAuth request token", 500);
		else {  
			ses.requestToken = requestToken;
			ses.requestSecret = requestSecret;
			res.redirect("https://twitter.com/oauth/authorize?oauth_token="+requestToken);
		}
	});
});

app.get('/auth/'+script_name+'/callback', (req, res) => {
	const oauth = apps[req.hostname];

	let ses = req.session.twitter;

	console.log('callback:'+req.hostname,req.query);

	oauth.getOAuthAccessToken(
		ses.requestToken, 
		ses.requestSecret, 
		req.query.oauth_verifier, 
		(error, token, secret, r) => {
			if(error)
				res.send("Error getting OAuth access token", 500);
			else {
				ses.token = token;
				ses.secret = secret;



				auth.network(req.session, {
					service: 'twitter',
					token, secret,
					profile: {
						name: r.screen_name,
						id: r.user_id
					}
				});

				res.send('<script>window.close();</script>');
			}
	});
});