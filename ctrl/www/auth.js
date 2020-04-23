const axios = require('axios');

var networks;

const auth = exports.network = function(session, d){
	if(!session) return;

	const connect = network => {
		const upd = (user) => {
			if( !network.email ||
				network.email == user.email || 
				(user.emails && (user.emails.indexOf(network.email) + 1))
			) return;

			if(user.emails.indexOf(network.email));
				user.emails.push(email);

			networks.updateOne({id: user.id}, {
				$addToSet: {emails: network.email}
			}, r => {
				console.log(r);
			});
		};
		
		Acc.send(session.sid, {
			cmd: 'network',
			network
		});

		if(session.user){
			upd(session.user);
		}
		else{
			let findBy = {id: network.owner};

			if(!network.owner)
				findBy = {$or: [
					{email: network.email}, 
					{emails: network.email}
				]};

			acc.db.findOne(findBy, (e, user) => {
				if(user){
					upd(user);
					Acc.byEmail[user.email] = session;

					acc.filter(user);
					session.user = user;
					Acc.send(session.sid, {cmd: 'acc', user});
				}
			});
		}
	};

	var findBy = {
		service: d.service,
		nid: d.profile.id
	};

	networks.findOne(findBy, function(e, net){
		var network = {
			id: randomString(4),
			regTime: (new Date()).getTime(),
			token: d.token,
			secret: d.secret,
			service: d.service,
			nid: d.profile.id
		};

		if(session.user){
			network.owner = session.user.id;
		}

		if(d.service == 'facebook')
			_.extend(network, _.pick(d.profile, 'email', 'gender', 'locale', 'timezone'), {
				title: d.profile.name,
			});

		if(d.service == 'linkedin')
			_.extend(network, _.pick(d.profile, 'email', 'gender', 'locale', 'timezone'), {
				intro: d.profile.headline,
				title: d.profile.firstName+' '+d.profile.lastName
			});

		if(d.service == 'google')
			_.extend(network, _.pick(d.profile, 'gender', 'locale'), {
				title: d.profile.given_name+' '+d.profile.family_name
			});


		if(d.service == 'twitter')
			_.extend(network, _.pick(d.profile, 'email'), {
				title: d.profile.name
			});

		if(d.service == 'reddit'){
			_.extend(network, _.pick(d.profile, 'email', 'gender', 'locale', 'timezone'), {
				intro: d.profile.headline,
				title: d.profile.given_name+' '+d.profile.lastName
			})
		}
		
		if(!net)
			networks.insert(network, (err, r) => {
				connect(network);
			});
		else{
			const $set = _.pick(network, 
				'owner', 'token', 'secret', 'title', 'intro', 'email'
			);

			networks.updateOne(
				{_id: net._id}, 
				{$set},
				r => {
					console.log(r);
					connect(net);
				}
			);

			return;
		}
	});
}


sys.on('loaded', () => {
	networks = db.collection('networks');

	S['auth.facebook'] = async (m, ws, cb) => {
		const r = await axios({
			url: 'https://graph.facebook.com/me',
			method: 'get',
			params: {
				fields: ['id', 'email', 'name'].join(','),
				access_token: m.token,
			},
		});

		console.log(r);

		auth(ws.session, {
			service: 'facebook',
			token: m.token,
			profile: r.data
		});
	};

	S.auth = (m, ws, cb) => {
		auth(ws.session, m);
	};
});