global.Thumb = {
	path: cfg.files + 'thumbs/',
	downloaded: {
		// url: tmpName
	},

	download: function(url, cb){
		var already = Thumb.downloaded[url];
		if(already) return cb(already);

		var tmpName = randomString(20),
			tmpPath = query.tmp+tmpName;

		var tmpStream = fs.createWriteStream(tmpPath, {flags: 'w'});
		tmpStream.on('finish', function(){
			Thumb.downloaded[url] = tmpName;
			cb(tmpName);
		});


		console.log(url);
		var request = require(!url.indexOf('https')?'https':'http').get(url, function(response){
			response.pipe(tmpStream);
		});
	},

	default:{
			//src:'kitten.jpg', dst:'./output/kitten-thumbnail.jpg',
			height: 300,
			width: null
	},

	make: function(cf, cb){
		var cfg = _.extend(Thumb.default, cf);

		//var heightRatio = cfg.height / image.height();
		require('gm')(cfg.src)
		.resize(cfg.width, cfg.height)
		.autoOrient()
		.quality(90)
		.write(cfg.dst, function (err){
		  if(err) console.log(err);
		  cb(!err);
		});
	},

	pump: function(q, d){
		query.pump(q, {
			path: Thumb.path+d.id+'.jpg',
			download: false
		});
	}
}

GET.thumb = function(q){
	if(!q.p[1].length){
		q.res.writeHead(404);
		q.res.end();
		return;
	}
	else
	if(!isNaN(q.p[1]))
		query.pump(q, Thumb.path+q.p[1]);
	else{
		var aUrl = q.req.url.split('/'),
			url = aUrl.slice(2).join('/');

		C.thumbs.findOne({url: url}, function (e, item){
			if(item) return Thumb.pump(q, item);

			Thumb.download(url, function(tmpName){
				var tmpPath = query.tmp+tmpName;

				var d = {
					url: url,
					id: ++C.thumbs.N
				};

				Thumb.make({
					src: tmpPath,
					dst: Thumb.path+d.id+'.jpg'
				}, function(){
					Thumb.pump(q, d);
					C.thumbs.insert(d);
				});
			});
		});
	};
};

PUT.thumb = function(q){
	var name = (''+q.p[1]).replace(/\W/g, '');
	if(!name.length) return q.res.end();
	var tmpStream = fs.createWriteStream(Thumb.path+name, {flags: 'w'});
	q.req.pipe(tmpStream, {end: false});

	q.req.on("end", function(){
		tmpStream.end();
		//tmpStream.destroy();
		q.end({name: name});
	});
}

var site = new Site({
	path: './static/thumbs',
	domains: ['thumb.pix8.co', 'thumb.lh'],
	staticExts: false
});

site.load('index.html');

site.onRequest = function(q, doc){
	if(!q.p[0].length){
		site.send(q, doc);
		return;
	}

	var aUrl = q.req.url.split('/');

	if(q.p[0] == 'http' || q.p[0] == 'https' || q.p[0] == 'ftp'){
		var url = q.p[0]+'://'+aUrl.slice(2).join('/');
		C.thumbs.findOne({url: url}, function (e, item){
			if(item) return Thumb.pump(q, item);

			Thumb.download(url, function(tmpName){
				var tmpPath = query.tmp+tmpName;

				var d = {
					url: url,
					id: randomString(7)
				};

				Thumb.make({
					src: tmpPath,
					dst: Thumb.path+d.id+'.jpg'
				}, function(){
					Thumb.pump(q, d);
					C.thumbs.insert(d);
				});
			});
		});
	}
	else
	if(q.p[0] == 'fid' || q.p[0] == 'file'){
		C.thumbs.findOne({fid: q.p[1]}, function (e, item){
			if(item) return Thumb.pump(q, item);

			var d = {
				fid: q.p[1],
				id: randomString(7)
			};

			var path = query.pathFiles + d.fid;
			Thumb.make({
				src: path,
				dst: Thumb.path+d.id+'.jpg'
			}, function(){
				Thumb.pump(q, d);
				C.thumbs.insert(d);
			});
		});
	}
};
