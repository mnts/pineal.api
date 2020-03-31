global.coll = global.Coll = {
	list: {},
	main: 'tree',

	setId: function(col, id){
		if(id) col.N = id;
		else col.aggregate([{$match:{id: {$type: 16}}}, { $group: { _id:0, maxId: {$max: "$id"}}}], function(err, re){
			col.N = (re && re[0])?(re[0].maxId || 0):0;
			//console.log(col.name+'#'+col.N);
		});

	},

	afterSave: function(collection, item){
		var as = collection.afterSave || [];

		for(var i = as.length-1; i>=0; i--){
			if(typeof as[i] == 'function')
				as[i](m.item);
			else
			if(typeof as[i] == 'object'){
				if(_.isMatch(item, as[i].filter || {})){
					if(as[i].ws.readyState == as[i].ws.OPEN)
						as[i].ws.json({cmd: 'onSave', item: item, collection: collection.name});
					else
						as.splice(i, 1);
				}
			}
		};
	}
};


global.C = Coll.list;

function analyze(c){
	const changeStream = c.collection.watch();
	changeStream.on('change', (change) => {
		if(change.operationType == 'insert'){
			if(c.watch_src && change.fullDocument){
				let item = change.fullDocument;

				console.log(item);

				var u = new URL(item.src);

				var cName = u.pathname.replace(/^\/|\/$/g, ''),
					id = u.hash.substr(1);

				let c2 = Collections[cName];
				c2.collection.findOne({id}).then(itm => {
					/*
					let users = (itm.users || []).filter(v => {
						return v != item.owner;
					});
					*/

					Object.values(Sessions).forEach(ses => {
						if(!ses.user) return;

						if(itm.users.indexOf(ses.user.email) + 1){
							(ses.sockets || []).forEach(soc => {
								soc.json({
									collection: c.name,
									cmd: 'insert',
									item,
									cId: id,
									cName,
									container: itm
								});
							});
						}
					});
				});
			}
		}
	});

	if(c.watch_src){

	}
}

global.Collections = Cfg.collections || {};
if(Cfg.mongodb)
	db.listCollections().toArray().then(collections => {
		collections.forEach(c => {
			let cl = Collections[c.name];

			cl?
				Object.assign(cl, c):
				(cl = Collections[c.name] = c);

			cl.collection = db.collection(cl.name);

			analyze(cl);
		});
	});



if(cfg.mongodb) _.each(cfg.mongodb.collections, function(col){

	var collection = Coll.list[col] = db.collection(col);
	
	/*
	const changeStream = collection.watch();
	changeStream.on('change', (change) => {
		console.log(change);
	});
	*/

	
	collection.afterSave = [];
	collection.name = col;
	Coll.setId(collection);
});

if(cfg.tingo) _.each(cfg.tingo.collections, function(col){
	var collection = Coll.list[col] = DBT.collection(col);
	collection.afterSave = [];
	collection.name = col;
});

S.save = function(m, ws){
	let c = Collections[m.collection || coll.main];
	if(!c) return;

	if((!ws.session.user && !c.public) || !m.item) return;

	var user = ws.session.user;
	_.extend(m.item, {time: (new Date()).getTime()});

	if(user){
		m.item.owner = user.email;
		//if(user.super) m.item.super = true;
	}
	else
		m.item.ip = ws.ip;

	var save = function(){
		if(!m.item.id)
			m.item.id = randomString(8);

		m.item.domain = ws.domain;
		
		c.collection.save(m.item, function(err){
			if(m.cb) RE[m.cb](err?{error: err}:{item: m.item});

			//Coll.afterSave(collection, m.item);
		});
	};

	if(typeof c.collection.beforeSave == 'functon')
		c.collection.beforeSave(m.item, function(d){
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


S.sync = function(m, ws, cb){
	if(!m.item) return;
	if(typeof m.collection != 'string') return;

	var c = Collections[m.collection];

	m.item.sync = (new Date).getTime();
	delete m.item._id;

	c.collection.findOne(
		{id: m.item.id}, {
			sync: true,
			updated: true,
			time: true,
			id: true,
			owner: true
		}, (err, item) => {
			if(!item)
				c.collection.save(m.item, function(err){
					if(err) console.log(err);
					if(!err && m.cb)
						cb({item: m.item});

					//Coll.afterSave(collection, m.item);

					SET.lastSync.time = (new Date).getTime();
				});
			else
			if(m.item.updated > (item.updated || item.time))
				c.collection.update({id: m.item.id}, m.item, function(err){
					if(err) console.log(err);
						if(!err && m.cb)
							cb({item: m.item});

						//Coll.afterSave(collection, m.item);

						SET.lastSync.time = (new Date).getTime();
				});
			else cb();
		}
	);
};

const cleanItem = item => {
	if(!item) return;
	delete item._id;
	delete item.key;
	delete item.secret;
	return item;
}


S.load = S.find = function(m, ws, cb){
	var user = ws.session.user;

	var filter = _.extend(m.filter, {}),
		limit = parseInt(m.limit || 0),
		skip = parseInt(m.skip || 0),
		sort = m.sort || {pos: 1},
		mod = {};

	var c = Collections[m.collection || coll.main];
	if(!c) return;

	if(m.mod) _.extend(mod, m.mod);

	var cur = c.collection.find(filter, mod);
	cur.sort(sort).limit(limit).skip(skip).toArray(function(err, list){
		if(err) console.log(err.toString().red);

		(list || []).forEach(item => {
			if(!user || !user.super) cleanItem(item);
		});

		cb({items: list});
	});
}


S.averages = function(m, ws){
	if(
		typeof m.collection != 'string' ||
		typeof m.field != 'string' ||
		!m.filter
	) return;

	db.eval(function(collection, filter, field){
		var pr = {};
		pr[field] = 1;
		var items = db.getCollection(collection).find(filter, pr).toArray(),
		    ts = [],
		    n = 0;

		items.some(function(view){
		    if(view[field]){
		        view[field].forEach(function(t, i){
		            if(!ts[i]) ts[i] = 0;
		            ts[i] += t;
		        });
		        n++;
		    }
		});

		ts.forEach(function(t, i){
		    ts[i] = t/n;
		});

		return ts;
	}, [m.collection, m.filter, m.field], function(err, ts){
		if(!err && m.cb)
			RE[m.cb]({list: ts});
	});
}


S.remove = function(m, ws, cb){
	if(!m.id) return;

	var c = Collections[m.collection || coll.main];
	if(!c) return;

	var user = ws.session.user;
	var filter = _.pick(m, 'id');
	filter.owner = user.email;
	if(user && user.super) delete filter.owner;

	c.collection.findOneAndDelete(filter, function(err){
		if(!err && cb) cb({ok: 1});
	});
};


S.update = function(m, ws, cb){
	if(!ws.session || (!m.id && !m.filter)) return;

	var user = ws.session.user;


	//if(!user) return;

	var c = Collections[m.collection || coll.main];
	if(!c) return;

	var user = ws.session.user;
	var filter = m.filter || _.pick(m, 'id');

	//if(user) filter.owner = user.email;
	if(user && user.super) delete filter.owner;


	var todo = {};

	if(m.set){
		todo.$set = _.omit(m.set, '_id', 'id', 'owner', 'time');
		todo.$set.updated = (new Date()).getTime();
	}

	if(m.unset){
		todo.$unset = m.unset;
	}

	c.collection.findOneAndUpdate(filter, todo, {
		new: true, 
		multi: !!m.filter, 
		returnNewDocument: true
	}, function(err, done){
		if(err) return cb({err});

		cb({item: done.value});

		//Coll.afterSave(collection, done.value);
	});
};

S.sort = function(m, ws){
	if(!ws.session || !m.tid) return;

	var collection = coll.list[m.collection || coll.main];
	if(!collection) return;

	collection.find({tid: m.tid}, {id: 1, pos: 1, name: 1}).sort({pos : 1}).toArray(function(e, trl){
		var i = 0;
		trl.forEach(function(tr){
			collection.update({id: tr.id}, {$set: {pos: i++}}, function(){
			});
		});
	});
};

S.pos = function(m, ws){
	if(!ws.session || !m.id || typeof m.pos !== 'number') return;

	var c = Collections[m.collection || coll.main];
	if(!c) return;

	var pos = function(){
		var set = {pos: m.pos};
		c.collection.update({id: m.id}, {$set: set}, function(){
		});
	}

	c.collection.findOne({id: m.id}, function (e, tr){
		c.collection.update(
			{pos:(m.pos > tr.pos)?{$gt: tr.pos, $lte: m.pos}:{$gte: m.pos, $lt: tr.pos}, tid: tr.tid},
			{$inc : {pos:(m.pos > tr.pos)?-1:1}},
			{multi:true},
			pos
		);
	});
};

S.add = function(m, ws, cb){
	tree.db.findOne({id: m.tid}, function (e, item){
		if(e || !item) return;

		if(tree.getPermissions(item, q).indexOf('add')<0)
			return cb({error: 'no permissions'});

		var tr = {tid: item.id};
		if(q.user) tr.owner = q.user.id;
		tr.created = (new Date()).getTime();

		function insert(){
			tr.id = ++tree.N;

			_.extend(tr, tree.pick(q.post));

			tree.db.insert(tr, {safe: true}, function(e, doc){
				cb(e?{}:{item: tr});
			});

			if(tree.onAdd[item.id]) tree.onAdd[item.id](item, tr);
		};

		if(item.order)
			tree.db.find({tid: tr.id}).count(function(e, n){
				if(e) return cb({error: 'db error'});
				tr.pos = n;
				insert();
			});
		else
			insert();
	});
};

S.pushValue = function(m, ws){
	var user = ws.session.user;
	if(!user) return;

	var c = Collections[m.collection || coll.main];
	if(!c) return;

	var value = m.value || user.id;
	if(!m.field || (typeof value == 'undefined')) return;
	c.collection.findOne({id: m.id}, function (e, tr){
		//if(tr.owner && tr.owner !== user.id) return;
		if(Array.isArray(tr[m.field]) && tr[m.field].indexOf(value)+1) return;
		var push = {};
		push[m.field] = value;
		c.collection.updateById(tr._id,
			{$push: push},
			{safe: true},
			function(e, n){}
		);

		if(tr[m.filed]) tr[m.filed].push(value);
		else tr[m.filed] = [value];
		if(tree.onChange[tr.id]) tree.onChange[tr.id](tr);
	});
}


S.pullValue = function(m, ws){
	var user = ws.session.user;
	if(!user) return;

	var c = Collections[m.collection || coll.main];
	if(!c) return;

	var value = m.value || user.id;
	if(!m.field || (typeof value == 'undefined')) return;
	c.collection.findOne({id: m.id}, function (e, tr){
		if(!tr) return;
		//if(tr.owner && tr.owner !== user.id) return;
		var pull = {};
		pull[m.field] = value;
		c.collection.updateById(tr._id,
			{$pull: pull},
			{safe: true},
			function(e, n){}
		);
	});
}

S.updateView = function(m, ws){
	if(typeof m.path != 'string') return;

	db.eval(function(path){
		var views = db.getCollection('pix8').find({path: path, type: 'view'}).toArray(),
		    average = [],
		    scores = {};

		views.some(function(view){
		    if(view.type != 'public' && typeof view.items == 'object')
		        average.push(view.items.length);
		});

		if(average.length){
		    var sum = 0;
		    average.some(function(num){sum+=num});
		    average = Math.round(sum / average.length);
		}

		views.some(function(view){
		    if(view.type == 'public') return;
		    (view.items || []).some(function(id, j){
		        if(!id) return;
		        if(!scores[id]) scores[id] = 0;

		        var score = average-j;
		        if(score>0) scores[id] += score;
		    });
		});

		var ids = [];
		for(var id in scores){
		    ids.push(id);
		};

		ids.sort(function(a, b){
		    var rateA = scores[a];
		        rateB = scores[b];

		    if(rateA == rateB) return 0;
		    return (rateA>rateB)?-1:1;
		});

		var views = db.getCollection('pix8').find({path: path, type: 'public'});
		if(views.length()){

		    var view = views[0];
		        view.items = ids;
		    view.updated = (new Date()).getTime();

		    db.getCollection('pix8').update({id: view.id}, {$set: {
		        items: view.items,
		        updated: view.updated
		    }});
		}
		else{
		    var r = db.getCollection('pix8').findOne({$query:{},$orderby:{id:-1}}, {id: 1});

		    var view = {
		        items : ids,
		        type: 'public',
		        path : path,
		        time : (new Date()).getTime(),
		        id : r.id+1,
		    }

		    db.getCollection('pix8').insert(view);
		}
		return view;
	}, [m.path], function(err, view){

		Coll.setId(Coll.list.pix8);
		if(!err && m.cb)
			RE[m.cb]({view: view});
	});
}
