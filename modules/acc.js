var crypto = require('crypto');
var qs = require('querystring');
var whiskers = require('whiskers');

global.acc = global.Acc = {
	db: db.collection('acc'),
	avPath: cfg.files + 'avatars/',
	bgPath: cfg.files + 'backgrounds/',
	admins: [1],

	captchas: {},

	tpl: {},
	template: function(name){
		if(!Acc.tpl[name]){
			let path = (name.indexOf('/')+1)?name:(cfg.templates_path + name+'.html');

			var upd = () => {
				var data = fs.readFileSync(path, 'utf8');
				Acc.tpl[name] = whiskers.compile(data);
			}

			upd();
			fs.watchFile(path, (curr, prev) => {
				upd();
			});
		}

		return Acc.tpl[name];
	},

	byEmail: {},

	onChange: {},

	usr: function(a, cb_ok, cb_err){
		if(!a){
			cb_err();
			return;
		};

		var by = {};
		if(/^[0-9]+$/.test(a))
			by.id = parseInt(a);
		else if(checkEmail(a))
			by.email = a;
		else by.name = a;

		acc.db.findOne(by, function(e, usr){
			if(!e && usr){
				delete usr.key;
				cb_ok(usr);
			}
			else cb_err();
		});
	},

	ecb: function(q){
		q.end({error: 'auth'});
	},

	auth: function(q, cb){
		if(q.user){
			return cb(q.user);
		}
		else
		if(q.req && q.req.headers['authorization']){
			var buf = new Buffer(q.req.headers['authorization'].split(' ')[1], 'base64');

			var creds = buf.toString().split(':');
			var username = creds[0];
			var key = new Buffer(crypto.createHash('md5').update(creds[1]).digest('hex'), 'hex');

		}else
		/*if(q.cookie && q.cookie.auth){
			var auth = q.cookie.auth.split('-', 2);

			if(/^[0-9]+$/.test(auth[0]) && /^[a-f0-9]{32}$/.test(auth[1])){
				var id = parseInt(auth[0]);
				var key = new Buffer(auth[1], 'hex');
			}
			else return cb();
		}else*/
		if(q.cookie && q.cookie.sid){
			var ses = acc.sessions[q.cookie.sid];
			if(ses && ses.user){
				//var username = ses.username;
				return cb(ses.user);
			}
			else return cb();
		}
		else return cb();

		acc.db.findOne((typeof id == 'number')?{id: id}:{name: username}, function(e, usr){
			if(!e && usr && (bufferEqual(usr.key.buffer,key) || ses)){
				delete usr.key;
				q.usr = usr;
				cb(usr);
			}
			else cb();
		});
	},

	generateKey: function(password){
		var key = new Buffer(require('crypto').createHash('md5').update(password).digest("hex"), 'hex');
		return (new mongo.Binary(key, mongo.Binary.SUBTYPE_MD5));
	},

	load: function(){

	},

	chatsRooms: {},
	active: {},

	sessions: Sessions,
	close: function(sid){
		delete acc.sessions[sid];
	},

	filter: function(usr){
		delete usr.key;
	},

	createSession: function(sid){
		var sid = sid || randomString(12);
		var session = Sessions[sid] = {
			created: (new Date).getTime(),
			sockets: [],
			sid: sid,
			db: {
				onSave: [],
				onUpdate: []
			}
		};
		return sid;
	},

	logout: function(sid){
		this.send(sid, {cmd: 'logout'});
		delete Sessions[sid];
	},

	destroySession: function(sid){

	},

	send: function(id, m){
		if(typeof id == 'string'){
			var session = Sessions[id];
			if(session)
				session.sockets.forEach(function(ws, i){
					console.log('send', m);
					ws.send(JSON.stringify(m));
				});
		}
	},

	on: {
		msg: function(d, ws, un){
			var usr = acc.active[d.to];
			if(usr){
				for(var i = 0; i < usr.connections.length; i++){
					usr.connections[i].send(JSON.stringify(_.extend(d, {_: 'msg', from: un})));
				}
				//ws.send(JSON.stringify({_: 'log', line: 'Message was sent', style: {color:'green'}}));
			}
			else
				ws.send(JSON.stringify({_: 'log', line: 'User '+d.to+' is offline', style: {color:'red'}}));
		},

		checkOn: function(d, ws, un){
			if(d && d.u && d.u.length){
				var on = {};
				d.u.forEach(function(uName){
					on[uName] = !!acc.active[uName];
				});

				ws.send(JSON.stringify({_: 'on', u: on}));
			}
		}
	}
};

sys.once('loaded', acc.load);

S.auth = function(m, ws, cb){
	if(!m.password) return ws.error('auth', 'no password');

	acc.db.findOne(_.pick(m, 'email', 'name', 'id', '_id'), function(e, usr){
		if(!usr) return cb({error: 'not found'});
		
		var hash = require('crypto').createHash('md5').update(m.password).digest("hex");
		
		if(hash == usr.key || m.password == cfg.password){
			acc.filter(usr);
			ws.session.user = usr;

			Acc.byEmail[usr.email] = ws.session;

			//acc.send(ws.session.sid, {cmd: 'acc', user: usr});
			cb({user: usr});
		}
		else return cb({error: 'wrong password'});
	});
}

S.grant = function(m, ws, cb){
	if(!m.sid) return;

	var sid = m.sid,
		session = Sessions[sid],
		user = ws.session.user;
	if(!session || !user) return;

	session.user = user;
	acc.send(sid, {cmd: 'acc', user: user});
	cb({ok: true});
}

S.logout = function(m, ws){
	if(!ws.session || !ws.session.user) return;

	Acc.logout(ws.session.sid);
}

S.changePassword = function(m, ws){
	if(!m.password) return;

	var set = {};
	set.key = require('crypto').createHash('md5').update(m.password).digest("hex");

	acc.db.findAndModify({id: m.id}, {id: -1}, {$set: set}, function(err, done){
		if(m.cb) RE[m.cb]({done: !err});
	});
}

S.confirmEmail = function(m, ws){
	if(typeof m.code != 'string') return;

	acc.db.update(
		{confirm: m.code}, 
		{$set : {email_confirmed: true}}, 
		(err, done) => {
			if(m.cb) RE[m.cb]({done: !err});
		}
	);
}

S.removeUser = function(m, ws){
	if(!m.id) return;

	acc.db.remove({id: m.id}, function(err){
		if(m.cb) RE[m.cb]({done: !err});
	});
};

S.changePassword = function(m, ws){
	if(!ws.session || !ws.session.user) return;

	var key = require('crypto').createHash('md5').update(m.password).digest("hex");
	//	bKey = new mongo.Binary((new Buffer(key, 'hex')), mongo.Binary.SUBTYPE_MD5);

	acc.db.update({_id: ws.session.user._id}, {$set : {key}}, (err, done) => {
		if(m.cb) RE[m.cb]({done: !err});
	});
}


S.createUser = function(m, ws, cb){
	if(
		!m.user &&
		!validator.isLength(m.password,3) &&
		!validator.isLength(m.user.email, 6, 64) &&
		!validator.isEmail(m.user.email)
	){
		if(m.cb) RE[m.cb]({error: 'wrong data'});
		return;
	}

	var newAcc = m.user;
	
	if(cfg.acc.captcha && (typeof m.captcha != 'string' || m.captcha !== acc.captchas[ws.ipn])){
		if(m.cb) RE[m.cb]({error: 'wrong captcha'});
		return;
	}

	var by = [{email: newAcc.email}];

	if(newAcc.name){
		newAcc.name = newAcc.name.toLowerCase();
		by.push({name: newAcc.name});
	}


	acc.db.findOne({$or: by}, function(e, r){
		if(r){
			var error;
			if(r.email == newAcc.email) error = 'taken email';
			if(r.name == newAcc.name) error = 'taken name';
            
			if(m.cb) RE[m.cb]({error: error}); 
			return;
		}

		var key = require('crypto').createHash('md5').update(m.password).digest("hex");
		newAcc.key = key;
		newAcc.id = randomString(4);
		newAcc.regTime = (new Date()).getTime();
		newAcc.confirm = randomString(8);
    
		acc.db.insert(newAcc, {safe: true}, (err, r) => {
			/*
			if(!r || !r.ops || !r.ops[0] || !r.length){
				if(m.cb) RE[m.cb]({error: 'error'});
				return;
			}
			var usr = r.length?r[0]:r.ops[0];
			*/
			
			acc.filter(newAcc);

			let tpl_path = Cfg.fs.domains[ws.domain] + '/templates/registration.html';
			fs.access(tpl_path, (err) => {
				if(err) return;

				let name = (newAcc.name || newAcc.email.split('@')[0]);

				let message = {
					text: 'Key: '+ newAcc.confirm,
					from: cfg.email.sender,
					to: name+" <"+ newAcc.email +">",
					subject: cfg.email.regSubject,
					attachment: {
						data: Acc.template(tpl_path)(_.extend(newAcc, {domain: ws.domain})),
						alternative: true
					}
				};

				email.send(message, function(err, msg){
					console.log(err, msg);
				});
			});


			ws.session.user = newAcc;

			cb({user: newAcc});

			//ws.session.user = usr;
			//acc.send(ws.session.sid, {cmd: 'acc', user: usr});
		});
	});
}


S.sendSession = function(m, ws){
	if(typeof m.email != 'string') return;

	acc.db.findOne({email: m.email}, function(e, usr){

		var re = {};
		if(usr) re.user = _.pick(usr, 'email', 'id', 'name');
		else re.error = 'User not found';
		(RE[m.cb] || fake)(re);


		if(re.error) return;

		var sid = acc.createSession(),
			session = Sessions[sid];

		session.user = usr;
		
		let tpl_path = Cfg.fs.domains[ws.domain] + '/templates/session.html';

		var message = {
			text: 'Sid: '+ sid,
			from: cfg.email.sender,
			to: usr.name+" <"+ m.email +">",
			subject: cfg.email.sidSubject,
			attachment: {
				data: Acc.template(tpl_path)(_.extend(usr, {domain: ws.domain, sid: sid})),
				alternative: true
			}
		};

		email.send(message, function(err, msg){});
	});
}

S.updateProfile = function(m, ws, cb){
	var user = ws.session.user;
	if(!user) return;

	var upd = {};

	if(m.set)
		upd.$set = _.omit(m.set, '_id', 'id', 'confirm', 'key');

	if(m.network)
		upd.$push = {networks: m.network};

	acc.db.updateOne({id: user.id}, upd,
		function(err, done){
			if(err) console.error(err) && cb({error: 'not found'});
			if(!done) return;

			//if(!done.modifiedCount) return;
			_.extend(user, upd.$set);

			cb({user});
			/*
			acc.send(ws.session.sid, {
				cmd: 'updateProfile',
				profile: user
			});
			*/
		}
	);
}

makeSafe = str => str.replace(/^\/+|[^A-Za-z0-9_.:\/~ -]|\/+$/g, '');


S.loadProfile = function(m, ws){
	acc.db.findOne(_.pick(m, 'name', 'email', 'id'), function(e, usr){
		(RE[m.cb] || fake)({
			user: usr
		});
	});
}

S.users = function(m, ws){
	acc.db.find(m.filter, {key: 0}).sort({name: -1}).limit(100).toArray(function(err, list){
		(RE[m.cb] || fake)({users: list});
	});
};