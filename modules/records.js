var nr = 0;

global.records = {
	
	onAdd: {},
	onChange: {},
	onEdit: {},
	onRemove: {},
	onMove: {},

	db: db.collection('records'),
	cache: {},
	ecb: function(q){
		q.end({error: 'access denied'});
	},

	access: function(q, t, cb, ecb, trf){
		function check(tr){
			if(!trf){
				trf = tr;

				if(trf.public){
					delete trf.key;
					cb(trf, ['add']);
					return;
				}
			};

			var def = ['add', 'edit', 'remove'];

			if(tr.key && _.contains((q.cookie.keys || "").split(';'), tr.key)){
				cb(trf, def);
			}
			else
			if(tr.owner){
				if(q.usr && q.usr._id == tr.owner){
					delete trf.key;
					cb(trf, def);
				}
				else{
					if(ecb) ecb();
					else tree.ecb(q);
				}
			}
			else
				cb(trf, ['edit', 'remove']);
				//tree.access(q, tr.tid, cb, ecb, trf);
		}

		if(typeof t == 'number')
			tree.db.findOne({id: t}, function (e, tr){
				if(e || !tr) tree.ecb(q);
				else check(tr);
			});
		else if(t && typeof t == 'object')
			check(t);
	},

	getPermissions: function(item, q){
		var def = ['add', 'edit', 'remove'];

		if(item.public)
			return ['add'];
		else
		if(item.owner && q.user && q.user.id == item.owner)
			return def;
		return [];
	}
};

S.saveRecord = function(m, ws){
	if(!ws.session.user || !m.record) return;
	_.extend(m.record, {owner: ws.session.user.id, time: (new Date()).getTime()});
	
	records.db.save(m.record, function(err){
		if(!err && m.cb)
			RE[m.cb]({record: m.record});
	});
}

S.findRecords = function(m, ws){
	if(!ws.session.user || !m.filter) return;
	var filter = _.extend(m.filter, {owner: ws.session.user.id});

	records.db.find(filter).toArray(function(err, records){
		if(err) console.log(err.toString().red);
		if(m.cb)
			RE[m.cb]({records: records});
	});
}