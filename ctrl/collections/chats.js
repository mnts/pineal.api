const PubSub = require('pubsub-js');

sys.on('loaded', ev => {
	const chats = db.collection('chats');

	var last;

	const msg = item => {
		const u = new URL(item.src);

        const col = u.pathname.substr(1),
		      id = u.hash.substr(1);

		if(col != 'chats') return;

        last = {
			text: item.text,
			owner: item.owner
		};
        
        chats.updateOne({id}, {$set: {last, time: item.time}});
	};

	PubSub.subscribe('collections.messages.change', (c, change) => {
		console.log('messageeess:', change);
		if(change.operationType == 'insert'){
            msg(change.fullDocument);
		}
	});
});