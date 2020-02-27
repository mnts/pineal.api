S.save = function(m, ws){
	var collection = coll.list['votes'];
	if(!collection) return;

	//if((!ws.session.user && !collection.public) || !m.item) return;


	var user = ws.session.user;
	_.extend(m.item, {time: (new Date()).getTime()});

	if(user){
		m.item.owner = user.id;
		//if(user.super) m.item.super = true;
	}


	var save = function(){
		if(!m.item.id)
			m.item.id = randomString(8);
		collection.save(m.item, function(err){
			if(!err && m.cb)
				RE[m.cb]({item: m.item});

			Coll.afterSave(collection, m.item);
		});
	};

	if(typeof collection.beforeSave == 'functon')
		collection.beforeSave(m.item, function(d){
			if(typeof d == 'string'){
				if(m.cb) RE[m.cb]({error: d});
			}
			else if(typeof d == 'object')
				save();
		});
	else save();
};

S.onSave = function(m, ws){
	if(typeof m.collection !== 'string') return;
	var collection = coll.list[m.collection];
	if(!collection) return;


	collection.afterSave.push({
		filter: m.filter,
		ws: ws
	});
}
