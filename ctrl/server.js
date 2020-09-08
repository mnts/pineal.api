const md5 = word => {
	return require('crypto').createHash('md5').update(word).digest("hex");
}

const server = require('http').createServer();
global.app = require('express')();

app.use(require('cookie-parser')());
app.use((req, res, next) => {
	const name = 'sid_'+md5(req.hostname),
		  cookie = req.cookies[name];
	
	req.session = Sessions[cookie];
	
	if(!req.session){
		var sid = acc.createSession();
		req.session = Sessions[sid];
		res.cookie(name, sid);
	}

	next();
});
const sites = require('./www/sites.js');


server.on('request', app);

server.listen(Cfg.port, () => {
	console.log('Server listening on :' + server.address().port);
});

const db = require('./db.js');

sys.on('loaded', ev => {
	socket.run(server);
});

