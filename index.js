global.log = console.log;

global.clc = require('cli-color');
global._ = require('lodash');
global.EventEmitter = require('events').EventEmitter;

process.on('uncaughtException', function(err){
	if(err.stack) console.log(clc.red(err.stack));
	else console.log(err);
});

global.fs = require('fs');
global.util = require('util');
global.YAML = require('yamljs');
global.cookie = require('cookie');

global.RE = {
	void: function(m){}
};
global.S = {};
global.Sessions = {};

global.ecb = function(e){
	console.log(e);
};

global.api = {
	check:{},
};

global.mod = {};
global.sys = new EventEmitter();
sys.setMaxListeners(900);


var stdin = process.openStdin();
stdin.setEncoding('utf8');

stdin.on('data', input => {
	console.log(eval(input));
});

global.cfg = global.Cfg = YAML.load('./config.yaml');

require('./ctrl/server.js');

var initiate = () => {
	cfg.modules.forEach((name) => {
		var file = Cfg.path.modules + name + '.js';

		var module = mod[name] = require(file);
		console.log('load module: '+name);

		if(cfg.devMode)
			fs.watchFile(file, function(curr, prev){
				console.log(clc.yellow(curr.mtime.toString()) +' '+ clc.blue(name));
				delete require.cache[require.resolve(file)];
				require(file);
				if(module._reload) module._reload();
			});
	});

	process.emit('loadedModules');
	sys.emit('loaded');
}

if(Cfg.email)
	global.email = require("emailjs").server.connect(Cfg.email);
	

if(Cfg.mongodb){
	const MongoClient = global.mongo = require('mongodb').MongoClient;
	MongoClient.connect(
		Cfg.mongodb.url, 
		{
			useNewUrlParser: true, 
			useUnifiedTopology: true 
		}
	).then(client => {
		global.db = client.db(Cfg.mongodb.name);

		initiate();
	}).catch(e => console.error('error', e));
}

process.on('unhandledRejection', (reason, promise) => {
  console.log('Unhandled Rejection at:', reason.stack || reason);
});

process.on('uncaughtException', function (err) {
  console.error(err);
  console.log("Node NOT Exiting...");
});
