const bodyParser = require('body-parser')

const md5 = word => {
	return require('crypto').createHash('md5').update(word).digest("hex");
}

const server = require('http').createServer();

global.app = require('express')();


app.use(bodyParser.json()) // for parsing application/json
app.use(bodyParser.urlencoded({ extended: true })) // for parsing application/x-www-form-urlencoded

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

server.on('request', app);

server.listen(Cfg.port, () => {
	console.log('Server listening on :' + server.address().port);
});

sys.on('loaded', ev => {
	socket.run(server);
});