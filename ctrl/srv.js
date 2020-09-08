//global.app = require('express')();

function httpsWorker(glx) {
    var tlsOptions = null;
    var http2Server = glx.http2Server(tlsOptions, query.serv);

    http2Server.listen(443, "0.0.0.0", function() {
         console.info("Listening on ", http2Server.address());
    });

    socket.run(http2Server);

    var httpServer = glx.httpServer();

    httpServer.listen(80, "0.0.0.0", function() {
        console.info("Listening on ", httpServer.address());
    });
}

sys.on('loaded', () => {
   const db = global.db;
   require("greenlock-express").init({
	packageRoot: process.cwd(),
	configDir: "./greenlock.d",
	cluster: false,
	// used for logging background events and errors
	notify: function(ev, args) {
	     if ('error' === ev || 'warning' === ev) {
	         console.error(ev, args);
	         return;
	     }
	     console.info(ev, args);
	},
//	manager: './ctrl/gl-manager.js',
	store: require('le-store-mongoz').create(
        	db.collection('le-accounts'),
        	db.collection('le-certs')
    	),
	communityMember: true,
	/*
	approveDomains,/*
	set: console.log,//(opts, domain, key, val, done),
	get: console.log,//(defaults, domain, key, done),
	remove: console.log,//(defaults, domain, key, done),
	add: (subject, alt) => {
		console.log(subject, alt);
	},
	*/
        maintainerEmail: "mk@6d.lt"
   }).ready(httpsWorker);
});

function approveDomains(opts, certs, cb) {
  opts.challenges = { 'http-01': http01 }
  opts.email = config.email

  if (certs) {
    opts.domains = [certs.subject].concat(certs.altnames)
  }

    opts.agreeTos = true
    cb(null, { options: opts, certs: certs })
}

const sites = require('./www/sites.js');

const db = require('./db.js');
