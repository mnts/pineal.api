var qs = require('querystring');
var crypto = require('crypto');

var orders = Coll.list.orders;
_.extend(Coll.list.orders, {
	//public: true
});

global.pay = {
	defaultUser: 1,
	transfer: function(from,to,amount,cb){
		
	},
	
	addCash: function(to, amount){
		acc.db.update({_id: to}, {$inc : {cash: amount}});
		console.log("To: "+to+':'+amount);
	},
	
	createOrder: function(inf, cb, eb){
		var order = {
			owner: parseInt(inf.owner),
			time: (new Date()).getTime()
		};
		
		function ok(){
			orders.insert(order);
			cb(order);
		}
		
		if(inf.tid)
			tree.db.findOne({_id: parseInt(inf.tid)}, function (e, item){
				if(e || !item) return eb('wrong tid');
				order.tid = item._id;
				order.for = item.owner;
				if(item.price){
					order.n = parseInt(order.n || inf.n || 1);
					order.price = item.price * order.n;
					order.itemPrice = item.price;
				}
				ok();
			});
		else ok();
	}
};

S.rent = function(m, ws){
	if(!ws.session.user || !m.order) return;
	_.extend(m.order, {owner: ws.session.user.id, time: Math.floor(Date.now() / 1000)});

	var collection = coll.list[m.collection || coll.main];
	if(!collection) return;

	if(!m.order.checkIn)
		return RE[m.cb]({error: 'no checkIn'});

	m.order.collection = m.collection;
	collection.find({id: m.order.rentId}).toArray(function(err, data){
		//console.log(data);
		if(err || !data || !data.length)
			return RE[m.cb]({error: 'rent item not found'});

		var item = data[0];

		var oneDay = 24*60*60;
		if(!m.order.checkOut) m.order.checkOut = m.order.checkIn + oneDay;
		var diffDays = Math.round(Math.abs((m.order.checkIn - m.order.checkOut)/oneDay));

		m.order.id = ++orders.N;
		m.order.price = item.price * diffDays;

		console.log(m.order);
		orders.save(m.order, function(err){
			if(!err && m.cb)
				RE[m.cb]({order: m.order});
		});
	});
};

S.order = function(m, ws){
	if(!ws.session.user || !m.order) return;

	if(!m.order || isNaN(m.order.price)) return;

	_.extend(m.order, {owner: ws.session.user.id, time: Math.floor(Date.now() / 1000)});
	
	m.order.id = ++orders.N;
	orders.save(m.order, function(err){
		if(!err && m.cb)
			RE[m.cb]({order: m.order});
	});
};


POST.pay = function(q){
	var ecb = function(e){
		q.end({error: e});
	};
	
	if(!q.p[1]){
		
	}
	else switch(q.p[1]){
		case'order':
			acc.auth(q, function(usr){
				pay.createOrder(q.post, function(o){
					q.end({order: o});
				}, ecb);
			});
			break;
		case'transfer':
			acc.auth(q, function(usr){
				pay.transfer(q.post.from, q.post.to, q.post.amount, function(){
					q.end({acc: usr});
				});
			});
			break;
	}
};

S.WebToPay_URL = function(m, ws){
	var url64 = require("querystring");
	var crypto = require('crypto');

	var obj = _.omit(m, 'cmd', 'cb');

	var data = (new Buffer(url64.stringify(obj)).toString('base64')).replace('/', '_').replace('+', '-');

	var sign = crypto.createHash('md5').update(data + this.sign_password).digest('hex');


    return {'data':data, 'sign':sign};
	if(m.cb) RE[m.cb]({items: data});
}


GET.WebToPay = function(q, tr){
	var g = qs.parse(q.query);
	var d = cfg.WebToPay;
	if(!d) return q.end('Error');
	
	if(g.order){
		orders.find({id: parseInt(g.order)}).toArray(function(err, data){
			//console.log(data);
			if(err || !data || !data.length)
				return q.res.end('order not found');

			var order = data[0];

			var url = 'http://'+q.domain;
			if(d.accepturl && d.accepturl[0] == '/')
				d.accepturl = url + d.accepturl;

			if(d.cancelurl && d.cancelurl[0] == '/')
				d.cancelurl = url + d.cancelurl;

			d.callbackurl = url+'/'+q.uri;

			d.amount = parseInt(order.price * 100);
			d.currency = cfg.currency;
			
			console.log(d.accepturl);
			
			d.orderid = g.order;
			
			var base = new Buffer(qs.stringify(d).replace(/\%20/g,'+')).toString('base64').replace(/\+/g,'-').replace(/\//g,'_');
			var hash = crypto.createHash('md5').update(base + d.sign_password).digest("hex");
			
			q.res.statusCode = 302;
			q.res.setHeader("Location", 'https://www.paysera.com/pay?data='+base+'&sign='+hash);
			q.res.end('');
		});
	}
	else{
		// g.ss1   g.ss2
		/*{ 
			projectid: '37744',
			sign_password: '70c767c26cb3143bad5e660504fd6a76',
			currency: 'LTL',
			country: 'LT',
			test: '1',
			orderid: '8',
			type: 'EMA',
			lang: '',
			payment: 'nordealt',
			amount: '1000',
			paytext: 'Užsakymas nr: 8 http://catalogem.com projekte. (Pardavėjas: Mantas Kazlauskas)',
			p_email: 'mntask@gmail.com',
			p_countryname: '',
			m_pay_restored: '0x4',
			_client_language: 'lit',
			receiverid: '265548',
			status: '1',
			requestid: '43769972',
			name: 'UAB',
			surename: 'Mokėjimai.lt',
			payamount: '1000',
			paycurrency: 'LTL',
			version: '1.6' 
		}*/
		
		if(crypto.createHash('md5').update(g.data + d.sign_password).digest("hex") !== g.ss1)
			return q.res.end("hacking attempt");
			
		var wp = qs.parse(new Buffer(g.data, 'base64').toString('ascii'));
		
		if(!parseInt(wp.status) || (!cfg.devMode && wp.test == 1))
			q.res.end("Error");
		
		var cur = wp.paycurrency;

		if(cur != cfg.currency) return q.res.end('wrong currency');

		console.log(wp);
		orders.find({id: parseInt(wp.orderid)}).toArray(function(err, data){
			if(err || !data || !data.length)
				return q.res.end('order not found');

			var order = data[0];

			var paid = wp.amount / 100;

			if(paid != order.price)
				return q.res.end('wrong price');
			
			orders.find({
				rentId: order.rentId,
				$or: [
					{checkIn: {$gt: order.checkIn, $lt: order.checkOut}},
					{checkOut: {$gt: order.checkIn, $lt: order.checkOut}}
				],
				paid: {$exists: true}
			}).toArray(function(err, data){
				console.log(err);
				console.log(data);
				var res = data[0];
				if(res)
					q.res.end('too late');
				else{
					acc.db.update({id: order.owner}, {
						$inc: {paid: paid},
						$set: {payEmail: wp.p_email}
					}, function(){});

					orders.update({id: parseInt(wp.orderid)}, {$set: {
						paid: paid,
						requestid: parseInt(wp.requestid)
					}}, function(){
						q.res.end("OK");
					});
				}
			});
		});
	}
};
