const PubSub = require('pubsub-js');

sys.on('loaded', ev => {
	const cname = 'subscribers'
	PubSub.subscribe('collections.'+cname+'.change', (c, change) => {
		if(change.operationType == 'insert'){
            Acc.emit(change.fullDocument.owner, {
            	cmd: 'insert',
            	item: change.fullDocument,
            	collection: cname
            });
		}

		if(change.operationType == 'update'){
			db.collection(cname).findOne(
                {_id: change.documentKey._id},
                (e, item) => {
                    Acc.emit(item.owner, {
						cmd: 'update',
						_id: change.documentKey._id,
						item,
						fields: change.updateDescription.updatedFields,
						collection: cname
					});
                }
            );
		}
	});
});