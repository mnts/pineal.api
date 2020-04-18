const Path = require('path');
const script_name = Path.basename(__filename).split('.')[0];

const cheerio = require('cheerio')


var collection;
sys.on('loaded', () => {
	collection = db.collection(script_name);
});

app.get('/'+script_name+'/:name', (req, res) => {
	const $ = cheerio.load(req.site.documents['index.html']);

	console.log(req.params.name);
	collection.findOne({
		name: req.params.name
	}, (e, item) => {
		console.log(item);
		if(!item) return res.redirect('/');
		$('title').text(item.title || item.name);
		$('meta[name=description]').attr('content', item.description);

		collection.update(
			{_id: item._id}, 
			{$inc: {
				external_count: 1
			}}
		);
		
		res.send($.html());
	});
	
});