var list = {
	check: function(d, inf){
		if(!inf.title || inf.title.length < 3) return false;
		
		_.extend(d, inf);

		return true;
	},

	defaultLimit: 25,
	db: db.collection('list'),
	cache: {},
	ecb: function(q){
		q.end({error: 'access denied'});
	}
};

list.db.aggregate([{ $group: { _id:0, maxId: {$max: "$id"}}}], function(err, re){
	list.N = re.length?(re[0].maxId):0;
})

POST.list = function(q){
	if(q.post.id) q.post.id = parseInt(q.post.id);
	
	if(!q.p[1]){
		var f = q.post.filter || _.pick(q.post, 'name');

		if(q.post.search)
			f.title = { $regex: q.post.search, $options: 'i' };

		var s = [['time', 'desc']];

		var limit = parseInt(q.post.limit) || list.defaultLimit,
			 skip = parseInt(q.post.skip) || 0;

		list.db.find(f, {sort: s}).skip(skip).limit(limit).toArray(function(err, items){
			q.end({items: items});
		});
	}
	else{
		acc.auth(q, function(usr){
			switch(q.p[1]){
				case 'add':
					var item = _.pick(q.post, 'title', 'type', 'info', 'address', 'price');
					item.id = ++list.N;
					item.time = (new Date).getTime();
					if(usr) item.owner = usr.id;
					
					list.db.insert(item, {safe: true}, function(e, doc){
						q.end(e?{}:{item: item});
					});
					break;

				case 'item':
					switch(q.p[2]){
						case 'update':
							list.db.update(
								{id: parseInt(q.post.id), owner: usr.id},
								{$set: q.post.set},
								function(e, n){
									q.end({ok: n});
								}
							);
							break;
					}
					break;
			};
		});
	}
}