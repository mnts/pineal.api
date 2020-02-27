POST.node = function(q){
	acc.auth(q, function(usr){
		if(usr && acc.admins.indexOf(usr._id)+1){
			if(!q.p[1]){
				q.end({respond: eval(q.post.cmd)});
			}
			else switch(q.p[1]){
				case 'exit':
					process.exit();
					break;
			}
		}
		else 
			q.end({error: "access denied"});
	});
}

S.sendEmail = function(m, ws){
	if(
		typeof m.to != 'string' ||
		typeof m.subject != 'string' ||
		typeof m.text != 'string' ||
		cfg.trusted_emails.indexOf(m.to)<0
	) return;

		console.log(ws.session.user);
	if(ws.session.user)
		var from = ws.session.user.email;

		console.log(from);

	var message = {
		text: m.text,
		from: from || (typeof m.from == 'string'?m.from:cfg.emailFrom), 
		to: m.to,
		subject: m.subject
	};

	console.log(message);

	email.send(message, function(err, msg){});
};
