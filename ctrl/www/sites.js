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
	res.send(req.site.documents['index.html']);
});