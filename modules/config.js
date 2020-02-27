setTimeout(function(){
	var site = {
		staticExts: ['js', 'css', 'png', 'jpg', 'htm', 'map', 'html'],
		/*staticFiles: [
			'jquery.event.drag.js',
			'jquery.js',
			'sort.css',
			'sort.js',
			'tickertape.css',
			'tickertape.js'
		]*/
	};

	var pix =  _.extend({}, site, {path: './static/pix8'});
	//query.staticDomains['pix8.lh'] = query.staticDomains['pix8.0a.lt'] = query.staticDomains['pix8.co'] = pix;

	//query.staticDomains['catalog.lh'] = query.staticDomains['map.0a.lt'] = _.extend({}, site, {path: './static/map'});
	//query.staticDomains['markmap.lh'] = query.staticDomains['markmap.0a.lt'] = _.extend({}, site, {path: './static/markmap'});
	query.staticDomains['mk.0a.lt'] = site;

	query.staticDomains['consciousbit.lh'] = _.extend({}, site, {path: './static/consciousBit'});;



	var site = {
		staticExts: ['js', 'css', 'png', 'jpg', 'htm', 'map'],
	};

	query.staticDomains['twitter.0a.lt'] = _.extend({}, site, {path: './static/fire'});;
}, 1000);