

sys.on('loaded', ev => {
	const reviews = db.collection('reviews');

	let upd = src => {
		if(!src) return;

        reviews.aggregate([
			{$match: {
				src,
				num: {"$gte": 1, "$lte": 5}
			}},
			{"$group": {
				_id: '$src',
				average: {
					"$avg": "$num"
				},
				total: { $sum: 1 }
			}}
		]).toArray((err, r) => {
			if(err) return console.error(err);
			let rating = r[0];
			if(!rating) return;
			delete rating._id;
			
			let u = new URL(src);

            var collection = coll.list[u.pathname.substr(1)];
            if(!collection) return;

            rating.average_int = parseInt(rating.average);
            rating.average_round = Math.round(rating.average);
            
            collection.updateOne({id: u.hash.substr(1)},
                {$set: {rating}}
            );
		});
	};

	reviews.watch().on('change', d => {
		if(d.operationType == 'insert'){
            upd(d.fullDocument.src);
		}
		else
		if(d.operationType == 'update'){
            reviews.findOne(
                {_id: d.documentKey._id},
                {src: 1}, 
                (e, item) => {
                    upd(item.src);
                }
            );
		}
	});
});
