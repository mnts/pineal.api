const Site = require('./Site.js').Site;

(Cfg.www.sites || []).map(c => {
	exports[c.domain] = new Site(c);
});

app.use((req, res, next) => {
	req.site = exports[req.hostname];
	
	next();
});

require('require-dir-all')('./auth');


app.get('*', (req, res) => {
	if(!req.site){
		console.error(req.hostname);

		if(Cfg.www.default)
			res.redirect('https://'+Cfg.www.default);
		else
		    res.send({ error: 'Domain not found' });

		return;
	}
	res.send(req.site.documents['index.html']);
});