const Path = require('path');

const cheerio = require('cheerio');
const fs = require('fs');

module.exports = class Site{
	constructor(cfg){
		Object.assign(this, {
			documents: {},
			staticExts: [
				'js', 'css', 'png', 'gif', 'ico', 'jpg', 
				'htm', 'map', 'html', 'xml', 'txt',
				'woff', 'woff2', 'ttf', 'svg', 'mp3'
			],
			loaders: {},
			index: 'index.html',
			domains: [],
			seo: false
		}, cfg);

		if(!this.currency)
		    this.currency = Cfg.currency || 'USD';

		if(!this.path)
			this.path = Path.join(Cfg.www.path, this.folder || this.domain);

		if(!fs.existsSync(this.path))
			this.path = Path.join(Cfg.www.path, Cfg.www.default_folder);

		this.init();
	}

	init(){
		this.load('index.html');
	}

	manifest(){
		return JSON.stringify(Object.assign(
		_.pick(this, 'name', 'description', 'background_color'), {
			theme_color: this.color,
			display: 'standalone',
                }));
	}

	request(q){
		const path = (q.path || '').replace(/\/\.+/g,'');
		const $ = cheerio.load(this.documents['index.html']);

		if(this._id){
			if(path == 'manifest.json')
				return q.res.end(this.manifest());
		}

		if(this.title) $('title, div[slot=title]').text(this.title);
                if(this.description) $('meta[name=description]').attr('content', this.description);
                if(this.color) $('meta[name="theme-color"]').attr('content', this.color);
                if(this.keywords) $('meta[name=keywords]').attr('content',
			(typeof this.keywords == 'string')?this.keywords:this.keywords.join(',')
		);

		//$('#home').attr('src', 'mongo://'+this.domain+'/sites#'+this.id);

		const filePath = Path.join(this.path, path);
                if(!path || path == '/' || !fs.existsSync(filePath))
                        q.res.end($.html());
                else
                        query.pump(q, filePath);
	}

	load(name){
		const file = Path.join(this.path, name),
			  reload = () => {
			  	this.documents[name] = fs.readFileSync(file, "utf-8");
			  };

		reload();
		fs.watchFile(file, function(){
			reload();
		});;
	}

	checkBot(agent){
		return !(
			agent.search(/spider/i)<0 &&
			agent.search(/bot/i)<0 &&
			agent.search(/yahoo/i)<0 &&
			agent.search(/facebook/i)<0 &&
			agent.search(/snippet/i)<0
		)
	}
};
