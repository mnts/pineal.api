const OAuth = require('oauth')

const sites = require('../sites.js');
const auth = require('../auth.js');

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

app.get('/auth/twitter', (req, res) => {
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

app.get('/auth/twitter/callback', (req, res) => {
	const oauth = apps[req.hostname];

	let ses = req.session.twitter;

	console.log('callback:'+req.hostname);

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

				console.log(r);

				oauth.get(
			      'https://api.twitter.com/1.1/account/verify_credentials.json?include_email=true',
			      token, //test user token
			      secret, //test user secret            
			      (e, data, rs) => {

			      	const profile = JSON.parse(data);
			      	console.log('profile', profile);

					auth.network(req.session, {
						service: 'twitter',
						token, secret,
						profile
					});

					res.send('<script>window.close();</script>');
				  }
				);
			}
	});
});