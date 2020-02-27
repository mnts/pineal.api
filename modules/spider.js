var cheerio = require('cheerio');

S['website'] = function(m, ws, cb){
	if(typeof m.url != 'string') return;

	require((m.url.indexOf('https') === 0)?'https':'http').get(m.url, (res) => {
		res.setEncoding('utf8');
		var content = '';
		res.on('data', (chunk) => {
			content += chunk;
		});

		res.on('end', () => {
			var $ = cheerio.load(content);

			var src;
			src = $("meta[property='og:image']").attr('content');
			if(!src) src = $("link[rel='image_src']").attr('href');

			cb({src: src, title: $('title').text()});
		});
	}).on('error', (e) => {
		cb({error: `Got error: ${e.message}`});
	});
}
