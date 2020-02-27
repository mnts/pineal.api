global.tck = {
	path: cfg.files + 'tacks/',
	tmp: cfg.files + '~/',
	thumb: {
		path: cfg.files + 'thumbs/',
		w: 240,
		h: 180
	},
	
	defaultLimit: 25,

	check: function(tr, inf){
		if(!inf.name || inf.name.length < 3) return false;
		
		_.extend(tr, inf);
		
		if(/true/i.test(tr.hide)) tr.hide = true;
		else delete tr.hide;

		return true;
	},
	
	onAdd: {},
	onChange: {},
	onEdit: {},
	onRemove: {},
	onMove: {},

	db: db.collection('tacks'),
	cache: {},
	ecb: function(q){
		q.end({error: 'access denied'});
	}
};

tck.db.aggregate([{ $group: { _id:0, maxId: {$max: "$id"}}}], function(err, re){
	tck.N = re.length?(re[0].maxId):0;
})

GET.tacks = function(q){
	if(q.p[1]) query.pump(q, tck.path+parseInt(q.p[1]));
	else{
		q.res.writeHead(404);
		q.res.end();
		return;
	}
};

POST.tacks = function(q){
	if(q.post.id) q.post.id = parseInt(q.post.id);
	
	if(!q.p[1]){

		var f = _.pick(q.post, 'name');
		_.extend(f, q.post.filter);
		var limit = parseInt(q.post.limit) || tck.defaultLimit,
			 skip = parseInt(q.post.skip) || 0;
		
		if(q.post.uid) q.post.uid = parseInt(q.post.uid);
		
		var sort = [['time', 'desc']];
		if(q.post.voted && q.post.uid)
			f.$nor = [{pros: q.post.uid}, {cons: q.post.uid}, {id: parseInt(q.post.voted)}];
		else
			sort.unshift(['ratio', 'desc']);
		
		tck.db.find(f, {sort: sort}).skip(skip).limit(limit).toArray(function(err, list){
			if(q.post.uid && list) list.forEach(function(el){
				var pro = !!(el.pros && el.pros.indexOf(q.post.uid)+1),
					 con = !!(el.cons && el.cons.indexOf(q.post.uid)+1);
				if(pro || con)
					el._vote = pro?1:-1;
			});
			q.end({tacks: list});
		});
	}
	else{
		acc.auth(q, function(usr){
			switch(q.p[1]){
				case 'add':
					var tack = {};					
					if(!tck.check(tack, q.post)) return q.end({error: 'wrong data'});
					tack.id = ++tck.N;
					tack.pros = (usr)?[usr.id]:[];
					tack.cons = [];
					tack.ratio = 1;
					tack.cn = 0;
					tack.time = (new Date).getTime();
					if(usr) tack.owner = usr.id;
					
					if(typeof q.post.src == 'string')
						tack.src = q.post.src;

					if(typeof q.post.thumb == 'string')
						tack.thumb = q.post.thumb;
					
					if(q.post.file){
						var tmpPath = query.files+tack.file.replace(/\W/g, '');
						if(fs.existsSync(tmpPath))
							tack.src = 'tacks/'+tack.id;
						else
							return q.end({error: 'file expired'});
						
						delete tack.file;
					}
					
					tck.db.insert(tack, {safe: true}, function(e, doc){
						if(tmpPath)
							fs.renameSync(tmpPath, tck.path+tack.id)
						
						if(usr)
							acc.db.update({id: usr.id}, { $inc: {tCount: 1}, $set: {tLast: (new Date).getTime()}}, func);

						q.end(e?{}:{tack: tack});
					});
					break;
				
				case'voted':
					tck.db.find({$or: [{pros: usr.id}, {cons: usr.id}]}, {id: 1}).toArray(function(err, list){
						var r = {good: [], bad: []};
						if(list) list.forEach(function(el){
							r[(el.pros.indexOf(usr.id)+1)?'good':'bad'].push(el.id);
						});
						q.end(r);
					});
					break;
					
				case'increase':
					if(!usr) return tck.ecb(q);
					tck.db.update({id: parseInt(q.post.id), pros: {$ne: usr.id}}, {$push: {pros: usr.id}, $inc: {ratio: 1}}, function(){
						q.end({ok: true});
					});
					break;
					
				case'decrease':
					if(!usr) return tck.ecb(q);
					tck.db.update({id: parseInt(q.post.id), cons: {$ne: usr.id}}, {$push: {cons: usr.id}, $inc: {ratio: -1}}, function(){
						q.end({ok: true});
					});
					break;
					
				case'unvote':
					if(!usr) return tck.ecb(q);
					tck.db.findOne({id: parseInt(q.post.id)}, function(e, r){
						if(!r)q.end({error: 'wrong id'});
						var pro = !!(r.pros.indexOf(usr.id)+1),
							 con = !!(r.cons.indexOf(usr.id)+1);
							 
						if(pro || con){
							var upd = {$pull: {}, $inc: {ratio: pro?(-1):1}};
							upd.$pull[pro?'pros':'cons'] = usr.id;
							tck.db.update({id: parseInt(q.post.id)}, upd, function(er, d){
								q.end({ok: true});
							});
						}
						else
							q.end({error: 'no vote'});
					});
					break;
					
				case'votes':
					if(!usr) return tck.ecb(q);
					tck.db.find(f, {pros: 0, cons: 0}).sort({ratio : 1}).toArray(function(err, list){
						q.end({tacks: list});
					});
					break;
					
				case'comments':
					if(isNaN(q.post.on)) return q.end({error: 'wrong on field'});
					db.collection('comments').find({on: parseInt(q.post.on)}).sort({time : -1}).toArray(function(err, list){
						q.end({comments: list});
					});
					break;
					
				case'comment':
					if(typeof q.post.text != 'string') return q.end({error: 'wrong text field'});
					if(isNaN(q.post.on)) return q.end({error: 'wrong on field'});
			
					if(!usr) return acc.ecb(q);
			
					var msg = {
						uid: usr.id,
						text: q.post.text,
						on: parseInt(q.post.on),
						time: (new Date).getTime()
					};
					
					tck.db.update({id: msg.on}, {$inc: {cn: 1}}, function(e, d){
						db.collection('comments').insert(msg, {safe: true}, function(e, doc){
								q.end(e?{error: 'db fail'}:{comment: doc[0]});
						});
					});
					break;
				
				/*
				case'rename':
					q.end();
					if(typeof q.post.title == 'string')
						tree.access(q, q.post.id, function(tr){
							tree.db.update({id: tr.id}, {$set: {title: q.post.title}});
							tr.title = q.post.title;
							if(tree.onChange[tr.id]) tree.onChange[tr.id](tr);
						});
					break;
					
				case'change':
					tree.db.findOne({id: q.post.id}, function (e, tr){
						tree.access(q, tr, function(){
							if((e || !tr) || !tree.check(tr, q.post)) return ecb();
							
							tree.db.updateById(tr._id, tr, {safe: true}, function(e, n){
								q.end(e?{error: 'duplicate'}:{item: tr});
							});
							
							if(tree.onChange[tr.id]) tree.onChange[tr.id](tr);
						});
					});
					break;
				
				case'remove':
					tree.access(q, q.post.id, function(tr, perm){
						if(perm.indexOf('remove')+1)
							tree.remove(tr, function(){
								q.end({ok: true});
							}, function(){
								tree.ecb(q);
							});
						else tree.ecb(q);
					});
					break;
				*/
			};
		});
	}
}