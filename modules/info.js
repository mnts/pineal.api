POST.info = function(q){
	if(!q.p[1]){
	}
	else switch(q.p[1]){
		case'contact':			
			var message = {
				text: q.post.msg, 
				from: q.post.email, 
				to: cfg.adminEmail,
				subject: 'Contact us'
			};
		
			email.send(message, function(err, msg) {
				q.end(err?{error: true}:{ok: true});
			});
			
			break;
	}
}
