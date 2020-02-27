var builder = require('xmlbuilder');

var geobing = require('geobing');
geobing.setKey('As8-tKVhxtQ-zGaZ6yBhCUz4vrhT9qgLIWgxIBxCd4LRmNKOFKBRts8UWrSYTcnR');

S.geo = function(m, ws){
	if(!m.address) return;

	geobing.geocode(m.address, function(err, res){
		if(err) console.log(err);
		if(err || !res || !res.resourceSets || !res.resourceSets[0] || !res.resourceSets[0].resources[0]) return RE[m.cb]({error: 'not found'});;

		var g = res.resourceSets[0].resources[0];

		RE[m.cb]({info: g});
	});
}

S.getItemByName = function(m, ws){
	if(!m.name) return;

	var filter = {
		'$or': [
			{'info.city': m.name},
			{'info.country': m.name},
			{'record.LA_Board': m.name},
			{'info.county': m.name}
		]
	};

	db.collection('catalog').find(filter).limit(1).toArray(function(err, data){
		var r;
		if(!data || !data[0]) r = {};
		else r = {item: data[0]};

		RE[m.cb](r);
	});
}
