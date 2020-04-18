const Path = require('path');

const cheerio = require('cheerio');
const fs = require('fs');

exports.Site = class Site{
	constructor(cfg){
		Object.assign(this, {
			documents: {},
			staticExts: [
				'js', 'css', 'png', 'gif', 'ico', 'jpg', 'htm', 'map', 'html', 'xml', 'txt',
				'woff', 'woff2', 'ttf', 'svg', 'mp3'
			],
			loaders: {},
			index: 'index.html',
			domains: [],
			seo: false
		}, cfg);

		if(!this.path)
			this.path = Path.join(Cfg.www.path, this.folder || this.domain);

		this.init();
	}

	init(){
		this.load('index.html');
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
