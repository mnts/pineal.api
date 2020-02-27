var authom = require("authom");

cfg.social.forEach(function(network){
	authom.createServer(network);
});

authom.on("auth", function(req, res, d){
	var end = function(){
		res.writeHead(200, {'Content-Type': 'text/html'});
		res.end('<script>window.close()</script>');
	};

	console.log(d);

	if(!d || !d.data) return end();

	var profile = d.data;

	var sid = require('cookie').parse(req.headers['cookie'] || '').sid, session;
	console.log(sid);
	if(!sid || !(session = Sessions[sid])) return end();



	if(session.user){
		acc.send(sid, {cmd: 'newNetwork', profile: d.data, service: d.service});
		end();

		/*
		acc.db.findAndModify(
			{_id: usr._id}, {},
			{$set : _.omit(m.set, '_id', 'id', 'confirm', 'key')},
			{new: true}, 
		function(err, el){
			delete el.key;
			_.extend(user, el);
			acc.send(ws.session.sid, {
				cmd: 'updateProfile',
				profile: el
			});
		});
		*/

		return;
	}

	var findBy = {};
	if(['google', 'facebook', 'linkedin', 'twitter'].indexOf(d.service)+1)
		findBy['networks.id'] = profile.id;

	acc.db.findOne(findBy, function(e, usr){
		if(usr){
			(usr.networks || []).some(function(network){
				if(network.service == d.service){
					_.extend(network, {
						token: d.token,
						secret: d.secret
					});
					return true;
				}
			});

			console.log("networks.$.token: "+ d.token);
			console.log("networks.$.secret: "+ d.secret);

			acc.db.update(
				{"networks.id": profile.id}, 
				{$set: {
					"networks.$.token": d.token,
					"networks.$.secret": d.secret
				}},
				function(){}
			);


			acc.filter(usr);
			session.user = usr;
			acc.send(sid, {cmd: 'acc', user: usr});

			return end();
		}

		var newAcc = {
			id: ++C.acc.N,
			regTime: (new Date()).getTime(),
			networks: [],
		};

		newAcc.networks.push(_.extend({}, profile, {token: d.token, secret: d.secret, service: d.service}));

		if(d.service == 'facebook')
			_.extend(newAcc, _.pick(profile, 'email', 'gender', 'locale', 'timezone'), {
				fullName: profile.name,
			});

		if(d.service == 'linkedin')
			_.extend(newAcc, _.pick(profile, 'email', 'gender', 'locale', 'timezone'), {
				intro: profile.headline,
				fullName: profile.firstName+' '+profile.lastName
			});

		if(d.service == 'google')
			_.extend(newAcc, _.pick(profile, 'gender', 'locale'), {
				fullName: profile.given_name+' '+profile.family_name
			});


		if(d.service == 'twitter')
			_.extend(newAcc, {
				fullName: profile.name
			});

		if(d.service == 'reddit'){
			_.extend(newAcc, _.pick(profile, 'email', 'gender', 'locale', 'timezone'), {
				intro: profile.headline,
				fullName: profile.given_name+' '+profile.lastName
			})
		}
		
		acc.db.insert(newAcc, function(err, r){
			acc.filter(newAcc);
			session.user = newAcc;
			acc.send(sid, {cmd: 'acc', user: newAcc});
		});
	});

	//if(cb = RE[req.session.state])cb({user: req.user, sid: acc.createSession(req.user)});
	end()
})

authom.on("error", function(req, res, data) {
	console.log(data);
	console.log('Error');
	res.end('<script>window.close()</script>');
});

authom.listen(http);