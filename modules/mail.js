var whiskers = require('whiskers');

S.email = function(m, ws, cb){
	var user = ws.session.user;

	var send = message => {
		email.send(message, function(err, msg){
			cb({ok: !err});

			console.log(msg, message);

			if(m.tid && user)
				db.collection('tree').findOneAndUpdate(
					{id: m.tid, owner: user.id},
					{$set: {
						status: 'ready2send'
					}}
				);
		});
	}

	var msg = {
		text: m.text,
		from: m.from || Cfg.email.sender,
		to: m.name+" <"+ m.to +">",
		subject: m.subject
	};

	console.log(msg);

	var context = m.context || {};

	if(m.template && m.context)
		msg.attachment = {
			data: Acc.template(m.template)(context),
			alternative: true
		};

	if(m.template_fid){
		var data = fs.readFileSync(cfg.path.files + makeSafe(m.template_fid));

		msg.attachment = {
			data: whiskers.compile(data)(context),
			alternative: true
		}
	}

	if(m.fid){
		var data = fs.readFileSync(cfg.path.files + makeSafe(m.fid));
		msg.attachment = {data, alternative: true};
	}
	
	if(m.tid){
		db.collection('tree').findOne({id: m.tid}).then(r => {
			console.log(r);
			var item = r;
			if(!item) return cb({error: 'tree item not found'});

			context.node = item;
			context.domain = ws.domain;

			if(!msg.subject)
				msg.subject = item.title || item.name || ('#'+item.id);


			if(!msg.to && item.email)
				msg.to = item.email;

			if(!msg.text && item.description)
				msg.text = item.description;

			if(!msg.attachment && item.id && typeof item.parent == 'string'){
				let domain = item.parent.split('/')[2];
				let path = Cfg.fs.domains[domain] + '/files/'+item.id;
				var data = fs.readFileSync(path || (cfg.path.files + makeSafe(item.file)));
				msg.attachment = {
					data: whiskers.compile(data)(context),
					alternative: true
				};
			}

			send(msg);
		});
		return;
	}
	else
		send(msg);
}

S.whiskers = (m, ws, cb) => {
	if(!m.fid || !m.context) return cb({error: 'no data'});

	var data = fs.readFileSync(cfg.path.files + makeSafe(m.fid));
	var newData = whiskers.compile(data)(m.context);

	var fid = randomString(8);
	fs.writeFileSync(Cfg.path.files + fid, newData, 'utf-8');

	cb({fid});
};

var makeSafe = str => str.replace(/^\/+|[^A-Za-z0-9_.:\/~ -]|\/+$/g, '');

process.on('loadedModules', ev => {
  console.log('Mail loaded');

  let tree = db.collection('tree');
  setInterval(() => {
    var nowTime = (new Date).getTime();
    var filter = {type: 'invitation', start: {$lt: nowTime}, sent: {$exists: false}};
    tree.find(filter).toArray((e, items) => {
			//console.log(e, items);
      items.forEach(item => {
        if(!item.file) return;
        var data = fs.readFileSync(cfg.path.files + makeSafe(item.file));

      	var message = {
      		text: item.description,
      		from: item.from,
      		to: item.user.firstName+" <"+ item.user.email +">",
      		subject: item.subject,
          attachment: {data, alternative: true}
      	};

        email.send(message, function(err, msg){
					db.collection('tree').findOneAndUpdate(
						{id: item.id},
						{$set: {
							status: 'sent',
							sent: (new Date()).getTime()
						}}
					);
      	});
      });
    });
  }, 1000 * 6);
});
