var nr = 0;

global.tree = global.Tree = {
	path: cfg.files + 'items/',
	tmp: cfg.files + 'tmp/',
	thumb: {
		path: cfg.files + 'thumbs/',
		w: 240,
		h: 180
	},

	onAdd: {},
	onChange: {},
	onEdit: {},
	onRemove: {},
	onMove: {},

	db: db.collection('tree'),
	cache: {},
	ecb: function(q){
		q.end({error: 'access denied'});
	},

	resolve: function(start, path, cb){
		if(typeof path == 'string')
			path = path.replace(/^\/|\/$/g, '').split(/[\/]+/);

		db.eval(function(start, path){
			var tr = {id: start || 0},
				 road = [];

			for(var i = 0; i<path.length; i++){
				var tr = db.tree.findOne({tid: tr.id, name: path[i]});

				if(!tr) return;
				road.push(tr);
			}

			return road;
		}, [start, path],
		function(err, road){
			if(err || !road) return cb();
			var tr = road.length == path.length?road[path.length-1]:null;
			cb(road, tr);
		});
	},

	road: function(id, cb){
		db.eval(function(id, collection){
			var col = db.getCollection(collection);

			var item = col.findOne({id: id}),
			    path = item.name,
			    road = [item];

			while(item){
			    item = col.findOne({id: item.tid});
			    if(item && item.id != 0){
			        road.unshift(item);
			        path = item.name + '/' + path;
			    }
			    else break;
			}

			if(item && item.id == 0){
			    path = '/' + path;
			}

			return {
				items: road,
				path: path
			}
		}, [id, 'tree'],
		function(e, r){
			if(cb) cb(r.path, r.items);
		});
	},

	get: function(q){
		if(q.p[0] && !isNaN(q.p[0])){
			tree.db.findOne({id: q.p[0]}, function (e, tr){
				if(e || !tr){
					q.res.writeHead(404);
					q.res.end();
					return
				}

				tree.pump(q, tr);
			});
		}
		else{
			var domain = q.domain = (q.req.headers.host || '').toLowerCase();

			if(!q.p[0])
				console.log(
					clc.blue.bold(q.req.connection.remoteAddress + "")+' '+
					(q.date.getHours()+':'+q.date.getMinutes())+' '+
					clc.yellow.italic(domain)
				);

			if(db.eval) db.eval(function(domain){
				var tr = db.tree.findOne({domain: domain});
				if(tr) return tr;

				var d = domain.split('.');
				for(var i = 1; i<=d.length; i++){
					var dm = '*'+((i==d.length)?'':('.'+d.slice(i).join('.')));
					var tr = db.tree.findOne({domain: dm});
					if(tr) return tr;
				}
			}, [domain],
			function(e, site){
				if(typeof site == 'string') return console.log(site);

				if(e || !site){
					console.log(clc.yellow('redirect'));
					q.res.writeHead(301, {
						Location: 'http://'+cfg.main
					});
					q.res.end();
				}
				else{
					var inf = {
						site: site,
						path: q.uri,
						road: [],
						url: domain+(q.uri?('/'+q.uri):''),
						cookie: q.cookie,
						subs: {},
						currency: cfg.currency,
						d: domain.split('.').reverse()
					};

					function loadSite(){
						if(inf.site.render)
							tree.db.find({tid: inf.site.id}).toArray(function(e, list){
								list.forEach(function(tr){
									inf.subs[tr.name] = tr;
								});
								tree.render(q, inf);
							});
						else{
							q.res.writeHead(200, { 'Content-Type': 'text/html' });
							var readStream = fs.createReadStream(query.pathFiles + site.file);
							readStream.pipe(q.res);
						}
					};

					if(!q.p[0]){
						loadSite();
					}
					else if(isNaN(q.p[0])){
						tree.resolve(site.id, q.p, function(road, tr){
							if(!road)
								return q.res.writeHead(404) & q.res.end();

							inf.road = road;
							var asSite = false;
							inf.road.forEach(function(tr){
								if(tr.site !== undefined)
									asSite = tr.site;
							});

							if(asSite) loadSite();
							else if(tr){
								if(typeof GET[tr.mod] == 'function'){
									GET[tr.mod](q, tr);
								}
								else{
									query.pumpFile(q, tr.file);
									//tree.pump(q, tr);
								}
							}
							else{
								q.res.writeHead(404);
								q.res.end();
							}
						});
					}
				}
			});
		}
	},

	cache: function(tr, cache){
		var c = tree.cache[tr.id];
		if(!c || (c && tr.modified && tr.modified > c.time))
			return tree.cache[tr.id] = _.extend(cache(), {time: (new Date()).getTime()});
		return c;
	},

	render: function(q, inf){
		var c = tree.cache(inf.site, function(){
			return {
				tpl: whiskers.compile(
					fs.readFileSync(tree.path + inf.site.id + '/main', 'utf8')
				)
			};
		});

		var renders = inf.site.render;
		if(typeof renders == 'object'){
			var rends = Object.keys(renders);
			for(var key in renders){
				var rend = tree.renders[key];
				if(rend) rend(q, inf, function(opt){
					rends.splice(rends.indexOf(key), 1);
					end(opt);
				});
			}
		}
		else end();

		function end(opt){
			opt = opt || {};
			if(rends && rends.length) return;

			q.res.setHeader("Access-Control-Allow-Origin", '*');
			if(!opt.noHeader)
				q.res.writeHead(200, {'Content-Type': 'text/html' });

			q.res.end(opt.cont || c.tpl(inf), 'utf8');

		}
	},

	renders: {
		auth: function(q, inf, end){
			var mod = inf.site.render.auth;

			var endAuth = function(){
				q.res.writeHead(401, {'WWW-Authenticate': 'Basic'});
				var resp = {noHeader: true};
				if(mod.required) resp.cont = mod.required + '';
				end(resp);
			}

			if(q.req.headers['authorization']){
				acc.auth(q, function(usr){
					inf.user = usr || false;
					if(usr)end();
					else endAuth();
				});
			} else endAuth();
		},

		lang: function(q, inf, end){
			var mod = inf.site.render.lang;
			var lngTr = inf.subs[mod.fldr || 'lang'];
			if(!lngTr) return end();

			inf.language = q.cookie.lang;
			//name: {$regex: '^'+inf.language, $options: 'i'};
			tree.db.find({tid: lngTr.id}).sort({pos : 1}).toArray(function(e, list){
				if(e || !list) return end();
				inf.langs = [];
				var tr;
				list.forEach(function(el){
					inf.langs.push(el);
					if(el.name.split('.')[0] == inf.language)
						tr = el;
				});
				if(!inf.langs.length) return end();

				if(!tr){
					tr = inf.langs[0];
					inf.language = tr.name.split('.')[0];
				}

				inf.langTid = tr.id;
				inf.lang = tree.cache(tr, function(){
					return { lang: Yaml.safeLoad(fs.readFileSync(tree.path + inf.langTid, 'utf8')) };
				}).lang;

				end();
			});

		}
	},

	pump: function(q, tr){
		var id = tr.id;
		var fl = (isNaN(q.p[0])?'':(q.p[1] || '')).replace(/\W/g, '') || 'main';

		var path = tr.file || (tree.path + id + '/'+fl);
		fs.stat(path, function(e, stat){
			if(e){
				//q.res.writeHead(404);
				q.res.end();
			}
			else{
				var lm = stat.mtime.toUTCString();
				var renew = !(q.req.headers['if-modified-since'] && q.req.headers['if-modified-since'] == lm);

				var ext = (/(?:\.([^.]+))?$/.exec(tr.name)[1] || '').toLowerCase();

				var headers = {
					'Content-Length': stat.size,
					'Last-Modified': lm
				};

				if(fl == 'main'){
					headers['Cache-Control'] = 'no-cache, must-revalidate';
					headers['Content-Disposition'] = 'attachment; filename="'+tr.name+'"';
				}

				var expires = new Date(Date.now() + 2628000000);
				headers.expires = expires.toUTCString();

				if(ext == 'css'){
					headers["Content-Type"] = "text/css";
					headers["X-Content-Type-Options"] = "nosniff";
				};

				if(typeof tr.mime == 'string') headers["Content-Type"] = tr.mime;

				q.res.writeHead(renew?200:304,headers);


				if(renew){
					var readStream = fs.createReadStream(path);
					readStream.pipe(q.res);
				}
				else
					q.res.end();
			}
		});
	},

	put: function(q){
		if(!q.p[0] || isNaN(q.p[0])){
			if(isNaN(q.p[0])) return q.end() || console.log(q.uri);

			if(!q.req.headers['x-tid'] || isNaN(q.req.headers['x-tid'])) return 0;
			var tid = q.req.headers['x-tid'];
			var ID = ++C.tree.N;

			var tmpPath = tree.tmp+ID;
			var tmpFile = fs.createWriteStream(tmpPath, { flags: 'w'});
			q.req.pipe(tmpFile, {end: false});

			q.req.on("end", function(){
				tmpFile.end();
				acc.auth(q, function(usr){
					tree.access(q, tid, function(tr){
						var tr = {
							id: ID,
							name: q.req.headers['x-name'],
							title: q.req.headers['x-title'],
							tid: tr.id,
							created: (new Date()).getTime(),
							type: 'file',
							size: tmpFile.bytesWritten
						};

						if(usr) tr.owner = usr._id;
						else if(q.inf.key) tr.key = q.inf.key;

						if(q.inf.public) tr.public = !!q.inf.public;

						tree.db.find({tid: tid}).count(function(e, n){
							tr.pos = n;
							if(!tr.title) delete tr.title;

							tree.db.insert(tr, {safe: true}, function(e, doc){
								tmpFile.destroy();
								if(e){
									fs.unlink(tmpPath, ecb);
									q.end();
								}
								else{
									fs.mkdirSync(tree.path+ID);
									fs.rename(tmpPath, tree.path + ID + '/main', function(err){
										if(err)console.log(err);
										q.end({tr: doc[0]});
									});
								}
							});

						});
					}, function(){
						tmpFile.destroy();
						fs.unlink(tmpPath, ecb);
						return tree.ecb(q);
					});
				});
			});
		}
		else{
			var ID = parseInt(q.p[0]),
				tmpPath = tree.tmp + randomString(10),
				newFile = fs.createWriteStream(tmpPath, {flags: 'w'});
				fl = (isNaN(q.p[0])?'':(q.p[1] || '')).replace(/\W/g, '') || 'main';
			q.req.pipe(newFile, {end: false});

			q.req.on("end", function(){
				//newFile.destroy();
				newFile.end();
				acc.auth(q, function(usr){
					tree.access(q, ID, function(tr){
						var set = {
							modified: (new Date()).getTime(),
							size: newFile.bytesWritten
						};

						_.extend(tr, set);
						tree.db.update({id: ID},{$set: set});

						var path =  tr.file || (tree.path + ID + '/' + fl);
						fs.rename(tmpPath, path, function(err){
							fs.unwatchFile(path);
							if(err) console.log(err);
							q.end({item: tr});

							if(tree.onEdit[ID])
								tree.onEdit[ID](tr);
						});

					}, function(){
						fs.unlink(tmpPath, ecb);
						tree.ecb(q);
					});
				});
			});
		}
	},

	files: function(tid, cb_ok, cb_err){
		tree.db.find({tid: tid}, {id: 1, type: 1}).toArray(function(e, list){
			if(e){
				cb_err();
				return;
			}

			var fids = [];
			list.forEach(function(tr){
				if(tr.type == 'file')
					fids.push(tr.id);
			});

			if(fids.length == list.length)
				cb_ok(fids);
			else cb_err();
		});
	},

	imgs: function(trs, cb){
		tree.db.find({tid: {$in: trs}, pos: 0}, {id: 1, tid: 1}).toArray(function(e, list){
			if(e || !list) return;
			var imgs = {};
			list.forEach(function(tr){
				imgs[tr.tid] = tr.id;
			});

			cb(imgs);
		});
	},

	collect: function(trs, where, list, cb){
		where.tid = (trs.length)? {$in: trs} : parseInt(trs);

		tree.db.find(where, {id: 1}).toArray(function(e, trl){
			if(e) return;
			var arr = [];

			trl.forEach(function(tr){
				arr.push(tr.id);
				list.push(tr.id);
			});

			if(!arr.length) cb();
			else{
				tree.collect(arr, where, list, cb);
			}
		});
	},

	list: function(trs, cb){
		var where = (trs.length)?
			{tid: {$in: trs}}:
			{tid: parseInt(trs)};
		tree.db.find(where, {id: 1, tid: 1}).toArray(function(e, list){
			if(e) return;
			var arr = [];

			list.forEach(function(tr){
				arr.push(tr.id);
			});

			tree.list(arr, cb);

		});
	},

	check: function(tr, inf){
		_.extend(tr, inf);
		return tr;
	},

	properties: [
		'name', 'title', 'price', 'type', 'description', 'thumb', 'thumbs', 'unique',
		'info', 'location', 'file', 'images', 'path', 'src', 'geo',
		'record', 'text'
	],
	pick: function(tr){
		tr = _.pick(tr, tree.properties);

		return tr;
	},

	remove: function(tr, cb, err){
		tree.files(tr.id, function(fids){
			if(0){fids.forEach(function(fid){
				fs.unlink(tree.path+fid, ecb);
				fs.unlink(tree.thumb.path+fid, ecb);
			});
			tree.db.remove({id: {$in: fids}});}

			//fs.cleanDir(tree.path+tr.id);
			tree.db.update({pos:{$gt: tr.pos}, tid: tr.tid}, {$inc : {pos: -1}},{multi:true}, fake);
			tree.db.removeById(tr._id, cb);
			if(tree.onRemove[tr.id]) tree.onRemove[tr.id](tr);
		}, function(){
			err();
		});
	},

	move: function(id, newPos, tid, cb, err){
		function pos(){
			cb();
			var set = {pos: newPos};
			if(tid != undefined) set.tid = tid;
			tree.db.update({id: id}, {$set: set}, function(){
				console.log(arguments);
			});
		};

		tree.db.findOne({id: id}, function (e, tr){
			if(e || !tr) return;
			tree.db.count({tid: (tid == undefined)?tr.tid:tid}, function(e, n){
				if(tid == undefined || tid.toString() == tr.tid){
					if(newPos < n && newPos != tr.pos){
						tree.db.update(
							{pos:(newPos > tr.pos)?{$gt: tr.pos, $lte: newPos}:{$gte: newPos, $lt: tr.pos}, tid: tr.tid},
							{$inc : {pos:(newPos > tr.pos)?-1:1}},
							{multi:true},
							pos
						);
					} else err('wrong position ' + newPos +'<'+ tr.pos);
				}
				else{
					if(newPos <= n){

						tree.db.update({pos:{$gt: tr.pos}, tid: tr.tid}, {$inc : {pos: -1}},{multi:true},function(){
							tree.db.update({pos:{$gte: newPos}, tid: tid}, {$inc : {pos:1}},{multi:true},pos);
						});
					} else
					if(isNaN(newPos)){
						tree.db.update({pos:{$gt: tr.pos}, tid: tr.tid}, {$inc : {pos: -1}},{multi:true},function(){
							newPos = n;
							pos();
						});
					}
				}
			});
		});
	},

	access: function(q, t, cb, ecb, trf){
		function check(tr){
			if(!trf){
				trf = tr;

				if(trf.public){
					delete trf.key;
					cb(trf, ['add']);
					return;
				}
			};

			var def = ['add', 'edit', 'remove'];

			if(tr.key && _.contains((q.cookie.keys || "").split(';'), tr.key)){
				cb(trf, def);
			}
			else
			if(tr.owner){
				if(q.user && q.user.id == tr.owner){
					delete trf.key;
					cb(trf, def);
				}
				else{
					if(ecb) ecb();
					else tree.ecb(q);
				}
			}
			else
				cb(trf, ['edit', 'remove']);
				//tree.access(q, tr.tid, cb, ecb, trf);
		}

		if(typeof t == 'number' || typeof t == 'string')
			tree.db.findOne({id: t}, function (e, tr){
				if(e || !tr) tree.ecb(q);
				else check(tr);
			});
		else if(t && typeof t == 'object')
			check(t);
	},

	getPermissions: function(item, q){
		var def = ['add', 'edit', 'remove'];

		if(item.public)
			return ['add'];
		else
		if(item.owner && q.user && q.user.id == item.owner)
			return def;
		return [];
	}
};

/*
C.tree.beforeSave = function(item, cb){
	if(item && item.tid){
		C.tree.findOne({id: item.tid}, function (e, itemTop){
			if(!e && itemTop){
				if(itemTop.public) cb(item);
				else if(item.owner && itemTop.owner == item.owner)
					cb(item);
				else cb('permissions denied');
			}
			else cb('wrong tid');
		});
	}
	else
		cb('no tid');
};
*/

S['tree.resolve'] = function(m, ws){
	//if(typeof m.path != 'string') return;

	Tree.resolve(m.id || 0, m.path, (road, item) => {
		if(m.cb) RE[m.cb]({road: road, item: item});
	});
};

S['tree.road'] = function(m, ws){
	Tree.road(m.id, (path, items) => {
		if(m.cb) RE[m.cb]({path: path, items: items});
	});
};

S['tree.move'] = function(m, ws, cb){
	var newPos = parseInt(m.pos);
	function move(){
		tree.move(m.id, newPos, m.tid,  function(){
			cb({done: true});
		}, function(err){
			cb({error: err});
		});
	};

	/*tree.access(q, m.id, function(tr, perm){
		if(!tr || perm.indexOf('edit') == -1)
			return cb({error: 'permissions denied'});
	*/

		if(m.to)
			tree.db.findOne({id: m.to}, function (e, tr){
				if(e || !tr) return;
				newPos  = tr.pos;
				move();
			});
		else move();
	//});
};

S['tree'] = function(m, ws){
	var filter = m.filter || {},
		limit = parseInt(m.limit || 0),
		skip = parseInt(m.skip || 0),
		sort = m.sort || {pos: 1},
		collection = coll.list[m.collection || coll.main];
	if(!collection) return RE[m.cb]({error: 'wrong collection name'});

	if(filter._id)
		filter._id = mongo.ObjectID(filter._id);

	var mod = {};
	if(typeof m.mod == 'object')
		_.extend(mod, m.mod);

	if(sort.score) mod.score = sort.score;

	var cur = collection.find(filter, mod);

	cur.count(function(err, count){
		if(m.countOnly) return RE[m.cb]({count: count});
		cur.sort(sort).limit(limit).skip(skip).toArray(function(err, list){
			if(err) console.log(clc.red(err.toString()));
			if(m.cb) RE[m.cb]({items: list, count: count});
		});
	});
};


POST.tree = function(q){
	var filter = q.post.filter || {},
		limit = parseInt(q.post.limit || 0),
		skip = parseInt(q.post.skip || 0),
		sort = q.post.sort || {pos: 1},
		collection = coll.list[q.post.collection || coll.main];
	if(!collection) return q.end({error: 'wrong collection name'});

	if(filter._id)
		filter._id = mongo.ObjectID(filter._id);

	var mod = {};
	if(typeof q.post.mod == 'object')
		_.extend(mod, q.post.mod);

	if(!q.p[1]){
		if(q.post.aggregate instanceof Array){
			var aggregate = [];
			if(q.post.filter)
				aggregate.push({
					$match: filter
				});

			Array.prototype.push.apply(aggregate, q.post.aggregate);

			if(q.post.sort)
				aggregate.push({
					$sort: sort
				});

			if(q.post.mod)
				aggregate.push({
					$project: mod
				});


			if(q.post.skip)
				aggregate.push({
					$skip: skip
				});

			if(q.post.limit)
				aggregate.push({
					$limit: limit
				});

			var cur = collection.find(filter);
			cur.count(function(err, count){
				collection.aggregate(aggregate, {allowDiskUse: true}, function(err, result){
					if(err) console.log(clc.red(err.toString()));
					q.end({items: result, count: count});
				});
			});
			return;
		}

		if(sort.score) mod.score = sort.score;

		var cur = collection.find(filter, mod);

		cur.count(function(err, count){
			if(q.post.countOnly) return q.end({count: count});
			cur.sort(sort).limit(limit).skip(skip).toArray(function(err, list){
				if(err) console.log(clc.red(err.toString()));
				q.end({items: list, count: count});
			});
		});
	}
	else{
		switch(q.p[1]){
			case'item':
				var collection = coll.list[q.post.collection || coll.main];
				delete q.post.collection;
				collection.findOne(q.post, {key: 0}, function (e, tr){
					q.end({item: tr});
				});
				break;
			case 'add':
				tree.db.findOne({id: q.post.tid}, function (e, item){
					if(e || !item) return tree.ecb(q);

					if(tree.getPermissions(item, q).indexOf('add')<0)
						return q.end({error: 'no permissions'});

					var tr = {tid: item.id};
					if(q.user) tr.owner = q.user.id;
					tr.created = (new Date()).getTime();

					function insert(){
						tr.id = ++C.tree.N;

						_.extend(tr, tree.pick(q.post));

						tree.db.insert(tr, {safe: true}, function(e, doc){
							console.log(e);
							q.end(e?{}:{item: tr});
						});

						if(tree.onAdd[item.id]) tree.onAdd[item.id](item, tr);
					};

					if(true || item.order)
						tree.db.find({tid: tr.id}).count(function(e, n){
							if(e) return q.end({error: 'db error'});
							tr.pos = n;
							insert();
						});
					else
						insert();
				});
				break;

			case'unlock':
				tree.db.findOne({id: q.post.id}, function (e, tr){
					if(tr.key == q.post.key)
						q.end({item: tr});
					else tree.ecb(q);
				});
				break;

			case'rename':
				q.end();
				if(typeof q.post.title == 'string')
					tree.access(q, q.post.id, function(tr){
						tree.db.update({id: tr.id}, {$set: {title: q.post.title}}, fake);
						tr.title = q.post.title;
						if(tree.onChange[tr.id]) tree.onChange[tr.id](tr);
					});
				break;

			case'change':
				tree.db.findOne({id: q.post.id}, function(e, tr){
					tree.access(q, tr, function(){
						if((e || !tr) || !tree.check(tr, q.post)) return ecb();

						tree.db.updateById(tr._id, tr, {safe: true}, function(e, n){
							q.end(e?{error: 'duplicate'}:{item: tr});
						});

						if(tree.onChange[tr.id]) tree.onChange[tr.id](tr);
					});
				});
				break;

			case'move':
				var newPos = parseInt(q.post.pos);
				function move(){
					tree.move(q.post.id, newPos, q.post.tid,  function(){
						q.end();
					}, function(err){
						q.end({error: err});
					});
				};

				tree.access(q, q.post.id, function(tr, perm){
					if(!tr || perm.indexOf('edit') == -1)
						return tree.ecb();

					if(q.post.to)
						tree.db.findOne({id: q.post.to}, function (e, tr){
							if(e || !tr) return;
							newPos  = tr.pos;
							move();
						});
					else move();
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

			case'files':
				tree.files(q.post.id, function(r){
					q.end({list: r});
				}, function(){
					q.end();
				});
				break;

			case'reorder':
				tree.db.find({tid: q.post.tid}, {id: 1, pos: 1, name: 1}).sort({pos : 1}).toArray(function(e, trl){
					var i = 0;
					trl.forEach(function(tr){
						console.log(tr.name);
					});

					trl.forEach(function(tr){
						tree.db.update({id: tr.id}, {$set: {pos: i++}}, function(){
							q.end();
						});
					});
				});
				break;

			case'copy':
				db.eval(function(id, tid, N, owner, inf){
						var tr = db.tree.findOne({id : id});
						if(!tr) return false;

						if(db.tree.findOne({id : tid, owner: owner}))
							tr.tid = tid;
						else return false;

						tr.id = N;
						tr.pos = db.tree.find({tid: tid}).count();
						if(owner) tr.owner = owner;

						if(inf){
							if(inf.domain) tr.domain = inf.domain;
							if(inf.name) tr.name = inf.name;
							if(inf.title) tr.title = inf.title;
						}

						db.tree.insert(tr);

						return db.tree.findOne({id : tr.id});
					},
					[q.post.id, q.post.tid, N+1, q.usr?q.usr._id:NULL, q.post.inf],
					function(err, r){
						if(err){
							console.log(clc.cyan(err));
							return q.end({error: 'db'});
						};

						if(r){
							C.tree.N++;
							fs.stat(tree.path + q.post.id, function(e, stat){
								if(!e)
									fs.createReadStream(tree.path + q.post.id)
									.pipe(fs.createWriteStream(tree.path+r.id, {flags: 'w'}));
							});

							fs.stat(tree.thumb.path + q.post.id, function(e, stat){
								if(!e)
									fs.createReadStream(tree.thumb.path + q.post.id)
									.pipe(fs.createWriteStream(tree.thumb.path+r.id, {flags: 'w'}));
							});
							q.end({tr: r});
						}
						else
							q.end({error: 'duplicate'});
					}
				);
				break;

			case'own':
				acc.db.findOne({name: q.post.name}, function(e, owner){
					if(e || !owner) return q.end({error: 'wrong user name'});

					tree.db.findOne({id: q.post.id, owner: usr._id}, function (e, tr){
						if(e || !tr) return q.end({error: 'wrong item'});
						if(q.post.sub == 'true'){
							var trs = new Array();
							trs[0] = tr.id;
							tree.collect(q.post.id, {owner: usr._id}, trs, function(){
								tree.db.update({id: {$in: trs}}, {$set: {owner: owner._id}});
								q.end({done: trs});
							});
						}
						else{
							tree.db.update({id: tr.id}, {$set: {owner: owner._id}});
							q.end({done: trs});
						}
					});
				});
				break;

			case'serialize':
				if(q.isSuper()){
					var col = Coll.list[q.post.collection || 'tree'];
					if(col) col.findOne({id: q.post.id}, function(e, tr){
						tr._id = tr._id.toString();
						q.end({yaml: Yaml.dump(tr)});
					});
				}
				else
					q.end();
				break;

			case'save':
				if(q.isSuper()){
					var col = Coll.list[q.post.collection || 'tree'];
					if(q.post.item){
						col.save(q.post.item);
						q.end({item: q.post.item});
					}
					else
					if(q.post.yaml){
						var tr = Yaml.load(q.post.yaml);
						tr._id = mongo.ObjectID(tr._id);
						col.save(tr, function(e, r){
							if(e) console.error(e);

							q.end({item: tr});
						});
					}
					else
						q.end();
				}
				else
					q.end();

				break;
		};
	}
}

/*
S['tree.add'] = function(m, ws){
	var collection = coll.list.tree;
	if(!collection) return;

	//if((!ws.session.user && !collection.public) || !m.item) return;


	var user = ws.session.user;
	_.extend(m.item, {time: (new Date()).getTime()});
	if(user){
		m.item.owner = user.id;
		if(user.super) m.item.super = true;
	}


	var save = function(){
		if(user){
			m.item.owner = user.id;
			if(user.super) m.item.super = true;
		}

		m.item.id = ++collection.N;
		collection.save(m.item, function(err){
			if(!err && m.cb)
				RE[m.cb]({item: m.item});

			(collection.afterSave || []).forEach(function(func){
				func(m.item);
			});
		});
	};

	save();
	return;

	tree.db.findOne({id: m.tid}, function (e, item){
		if(e || !item) return tree.ecb(q);

		var tr = {tid: item.id};
		if(q.user) tr.owner = q.user.id;
		tr.created = (new Date()).getTime();

		function insert(){
			tr.id = ++collection.N;

			_.extend(tr, tree.pick(m));

			collection.insert(tr, {safe: true}, function(e, doc){
				if(e) console.log(e);
				RE[m.cb](e?{}:{item: tr});
			});

			(collection.afterSave || []).forEach(function(func){
				func(m.item);
			});
		};

		if(true || item.order)
			tree.db.find({tid: tr.id}).count(function(e, n){
				if(e) return q.end({error: 'db error'});
				tr.pos = n;
				insert();
			});
		else
			insert();
	});
};
*/
