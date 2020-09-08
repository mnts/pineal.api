const Site = require('./Site.js');
const Path = require('path');

(Cfg.www.sites || []).map(c => {
	exports[c.domain] = new Site(c);
});

/*
app.use((req, res, next) => {
	console.log(req.hostname + req.url);

	const q = req.q = new Query(req, res);

	const name = 'sid_'+md5(req.hostname),
                  cookie = q.cookies[name];

        q.session = Sessions[cookie];

        if(!req.session){
                var sid = acc.createSession();
                req.session = Sessions[sid];
                res.cookie(name, sid);
        }

	req.site = exports[req.hostname];

	next();
});

//require('require-dir-all')('./auth');
*/
require('./paypal.js');
/*
process.on('loadedModules', ev => {
	app.get('*', (req, res) => {
		const path = (req.q.path || '').replace(/\/\.+/g,'');

		if(!req.site){
			console.error(req.hostname);

			if(Cfg.www.default)
				res.redirect('https://'+Cfg.www.default);
			else
				res.send({ error: 'Domain not found' });

			return;
		}

		if(!path || path == '/')
			res.send(req.site.documents['index.html']);
		else
			query.pump(req.q, Path.join(req.site.path, path));
	});
});
*/
