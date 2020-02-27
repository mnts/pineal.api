var fs = require('fs');

global.Local = {
	path: cfg.local || cfg.files + 'local/',
	collection: 'pix8',
	api: 'ws://2.pix8.co:25286',
	clients: [],

	http: require('http'),
	https: require('https'),

	download: function(url, cb){
		var tmpName = randomString(20),
			tmpPath = query.tmp+tmpName;

		var tmpStream = fs.createWriteStream(tmpPath, {flags: 'w'});
		tmpStream.on('finish', function(){
			cb(tmpName);
		});

		var request = Local[!url.indexOf('https')?'https':'http'].get(url, function(response){
			if(response.statusCode == 200){
				console.log(url+clc.yellow(' was downloaded'));
				response.pipe(tmpStream);
			}
			else{
				console.log(url+clc.red(' error '+response.statusCode));
				tmpStream.emit('close');
			}
		});
	},


	respond: function(m){
		Local.clients.forEach(function(ws, i){
			ws.json(m);
		});
	},

	ext: path => path.split('.').pop().split(/\#|\?/)[0].toLowerCase(),
	allowed: ['png', 'jpg', 'jpeg', 'gif'],

	cache: (item, cb) => {
		if(typeof item.src == 'string'){
			var ext = Local.ext(item.src);
			if(ext == 'php') ext = 'jpg';
			if(Local.allowed.indexOf(ext)<0) return;

			Local.download(item.src, tmpName => {
				var newName = item.id + '.'+ext,
					newPath = Local.path + newName;
				fs.renameSync(query.tmp + tmpName, newPath);
				//Local.files.push(newName);
				item.local = newPath;
				Local.respond({
					_: 'local.saved',
					id: item.id,
					collection: Local.collection
				});
				(cb || fake)();
			});
		}
	},

	cacheAll: items => {
		if(!items) items = _.values(Local.items);

		items.forEach(item => Local.cache(item));
	},
	
	cacheNew: () => {
		var items = _.values(Local.items);

		items.forEach(item => {
			if(!item.local)
				Local.cache(item)
		});
	},

	items: {},

	getItems: ids => {
		if(!ids) return;

		var findId = (typeof ids == 'number')?ids:{"$in":ids};
		Local.ws.json({
			cmd: "load",
			filter: {id: findId},
			collection: Local.collection
		}, function(r){
			(r.items || []).forEach(item => {
				var local = Local.items[item.id];

				var file = Local.checkFile(item.id);
				if(file) item.local = file;

				if(local) _.extend(local, item)
				else Local.items[item.id] = item;
			});

			Local.cacheNew();
		});
	},


	connect: function(){
		var ws = Local.ws = new require('ws')(Local.api);

		_.extend(ws, {
			json: function(m, cb){
				if(!m) return;

				if(cb){
					if(!m.cb) m.cb = randomString(15);
					this.cbs[m.cb] = cb;
				}

				this.send(JSON.stringify(m));
			},

			cbs: {} //callbacks
		});


		ws.on('open', function(){
			//Local.getItems([1302, 1255]);
			//ws.send('something');
		});

		ws.on('close', function(code, message){
			//log(clc.red("Connection was closed #"+code));
			Local.connect();
		});



		ws.on('message', (data, flags) => {
			if(!flags.binary && typeof data == 'string'){
				var m = JSON.parse(data);

				var cb;
				if(m.cb && (cb = ws.cbs[m.cb])) cb(m);

				(L[m._] || func)(m);
			}
		});
	},


	checkFile: function(id){
		var file;
		Local.files.forEach(function(fl){
			if(parseInt(id) == parseInt(fl.split('.')[0])){
				file = fl;
				return true;
			}
		});
		return file;
	},

	checkDir: () => {
		console.log(clc.blue.bold('Checking: ')+Local.path);
		Local.files = [];
		fs.readdirSync(Local.path).forEach(function(el){
			Local.files.push(el);
		});
		return Local.files;
	},

	files: []
}

Local.checkDir();
fs.watch(Local.path, {persistent: true}, (eve, fileName) => {
	console.log("Event: " + eve);
	Local.checkDir();
});

GET_['127.0.0.1'] = function(q){
	var fn;
	if(!q.uri)
		q.end({files: Local.files});
	else
	if(fn = GET[q.uri] || (fn = GET['/'+q.uri]) || (fn = GET[q.p[0]]))
		fn(q);
	else{
		var path = (q.path || '').replace(/\/\.+/g,'');
		query.pump(q, cfg.local+path);
	}
}

GET.local = function(q){
	if(q.p[1]){ 
		var file = Local.checkFile(q.p[1]);
		if(file)
			return query.pump(q, {
				path: Local.path+file,
				filename: file
			});
	}


	q.res.writeHead(404);
	q.res.end();
}


//global.SOCKET = function(ws){
SOCK.local = function(ws){
	_.extend(ws, SOCKET_prototype);
	Local.clients.push(ws);

	ws.on('message', function(msg){
		if(typeof msg == 'string'){
			var m = JSON.parse(msg);

			if(m.cb)
				ws.putCB(m);

			if(m.cmd){
				var fn = S[m.cmd];
				if(fn){
					var r = fn(m, ws);
				}
			}
		}
	});

	ws.on('close', function(code, msg){
		Local.clients.forEach(function(sock, i){
			if(sock == ws)
				Local.clients.splice(i,1);
		});
	});
	ws.json({cmd: 'local.files', files: Local.checkDir()});
}

S['local.list'] = function(m, ws){
	if(m.cb) RE[m.cb]({files: Local.checkDir()});
};

S['local.download'] = function(m, ws){
	console.log(m);
	if(typeof m.url != 'string' && typeof m.url != 'object') return;
	var fileName = m.url.split('/').pop();

	var dl = function(src, cb){
		console.log('Download: '+m.url);
		Local.download(src, tmpName => {
			var newPath = Local.path + (m.path || '') + fileName;
			fs.renameSync(query.tmp + tmpName, newPath);

			Local.respond({
				cmd: 'local.downloaded',
				path: newPath,
				url: src
			});

			console.log('Done: '+newPath);

			if(cb) cb(newPath);
		});
	}

	if(typeof m.url == 'string'){
		dl(m.url);
	}
	else
	if(typeof m.url == 'object' && m.url.length){
		var tasks;
		m.url.forEach(function(url){
			tasks.push(() => {
				dl(url, function(){
					var task = tasks.shift();
					if(task) task();
				})
			});
		});
		tasks.shift()();
	}
};

global.L = {

};

Local.connect();


var chokidar = require('chokidar');
chokidar.watch(Local.path, {
	depth: 0,
	ignoreInitial: true
}).on('add', (path) => {
	Local.respond({
		cmd: 'local.add',
		file: path.split(/(\\|\/)/g).pop()
	});
}).on('unlink', (path) => {
	Local.respond({
		cmd: 'local.remove',
		file: path.split(/(\\|\/)/g).pop()
	});
});