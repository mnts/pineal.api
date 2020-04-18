var networks;

sys.on('loaded', () => {
	networks = db.collection('networks');
});

exports.network = function(session, d){
	if(!session) return;

	var findBy = {
		service: d.service,
		nid: d.profile.id
	};



	networks.findOne(findBy, function(e, network){
		if(network){
			networks.update(
				{_id: network._id}, 
				{$set: {
					token: d.token,
					secret: d.secret
				}},
				r => {

				}
			);


			if(!session.user){
				acc.db.findOne({id: network.owner}, (e, user) => {
					acc.filter(user);
					session.user = user;

					//Acc.byEmail[user.email] = session;

					Acc.send(session.sid, {cmd: 'acc', user});
				});
			}

			return;
		}

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
			_.extend(network, {
				title: d.profile.name
			});

		if(d.service == 'reddit'){
			_.extend(network, _.pick(d.profile, 'email', 'gender', 'locale', 'timezone'), {
				intro: d.profile.headline,
				title: d.profile.given_name+' '+d.profile.lastName
			})
		}
		
		networks.insert(network, (err, r) => {
			Acc.send(session.sid, {
				cmd: 'new_network',
				network
			});
		});
	});
}