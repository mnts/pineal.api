const tls = require('tls');

global.Security = {
	secureContexts: {},
	path: '',
	createContext: function(domain){
		var context = Security.secureContexts[domain] = tls.createSecureContext({
		    key: fs.readFileSync(Cfg.path.certificates + domain + '.key', 'utf8'),
		    cert: fs.readFileSync(Cfg.path.certificates + domain + '.crt', 'utf8')
		});

		return context;
	},

	getContext: function(domain){
		var context = Security.secureContexts[domain];
		if(!context) context = Security.createContext(domain);
		return context;
	},

	https_options: {
		ca: fs.readFileSync(Cfg.path.certificates+'main.ca'),
		key: fs.readFileSync(Cfg.path.certificates+'main.key'),
		cert: fs.readFileSync(Cfg.path.certificates+'main.crt'),
		SNICallback: function(domain){
			return Security.getContext(domain);
		},
	}
};