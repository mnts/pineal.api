const PubSub = require('pubsub-js');

const sites = require('../ctrl/www/sites.js');

global.socket = {
	sendOthers: function(room, id, msg){
		var isBuf = (msg instanceof Buffer),
			 ob = isBuf?{}:JSON.parse(msg);
		for(var i = 0; i < room.on.length; i++){
			var client = room.on[i];
			if(client &&  i != id){
				if(!(ob && ob.to > -1 && ob.to != i))
					try{
						client.send(msg, {binary: isBuf});
					}catch (e){
						console.log(e);
					}
			}
		};
	},

	connected: function(ws){
		var req = ws.upgradeReq;
		var path = require('url').parse(req.url),
			road = ws.road = decodeURI(path.pathname).replace(/^\/+|[^A-Za-z0-9_.:\/~ -]|\/+$/g, ''),
			host = ws.host = req.headers.host,
			url = ws.url = ws.host + '/' + road,
			p = ws.p = road.split(/[\/]+/),
			get = ws.get = require('querystring').parse(path.query) || {},
			ip = ws.ip = req.headers['x-forwarded-for'] ||
		     req.connection.remoteAddress ||
		     req.socket.remoteAddress ||
		     req.connection.socket.remoteAddress,
			cookie = ws.cookie = require('cookie').parse(req.headers['cookie'] || '');
		
		let origin = req.headers.origin.replace(/^http(s?):\/\//i, "");
		ws.domain = (origin || req.headers.host || '').toLowerCase().split(':')[0];
        
        ws.subscriptions = {};

		ws.location = {

		};
		
    /*
		if(p[0])
			(SOCK[p[0]] || fake)(ws);
		else
		*/
			SOCKET(ws);
	},

	run: function(h){
		var d = {};
		if(typeof h == 'number')
			d.port = h;
		else d.server = h;

		var WebSocketServer = require('ws').Server,
			wss = new WebSocketServer(d);

		wss.on('connection', (ws, req) => {
			if(req) ws.upgradeReq = req;
			this.connected(ws);
		});
	}
}

global.SOCKET_prototype = {
	json: function(d){
		if(this.readyState !== 1) return;
		this.send(JSON.stringify(d));
	},

	error: function(ofCmd, msg, d){
		this.send(JSON.stringify(_.extend({cmd: 'error', ofCmd: ofCmd, msg: msg}, d)));
	},

	cb: function(cb, m){
		(RE[cb] || fake)(m);
	},

	putCB: function(m){
		var ws = this;
		RE[m.cb] = function(msg){
			var r = {cb: m.cb};
			_.extend(r, msg);
			ws.json(r);

			delete RE[m.cb];
		};

		setTimeout(function(){
			if(RE[m.cb]) delete RE[m.cb];
		}, 10 * 60 * 1000);
	}
};


S.updateLocation = function(m, ws){
	var user = ws.session.user;
	if(!user) return;
	
	if(!ws.location) ws.location = {};
	var loc = ws.location;
	loc.latitude = m.latitude;
	loc.longitude = m.longitude;

	Object.values(Sessions).forEach(ses => {
		if(!ses.user) return;
		(ses.sockets || []).forEach(soc => {
			if(soc == ws) return;
			
			var msg = _.pick(loc, 'latitude', 'longitude');
			msg.user_email = user.email;
			msg.cmd = 'located';
			
			soc.json(msg);
		})
	});
};

S.listLocations = function(m, ws, cb){
	var locations = [];
	Object.values(Sessions).forEach(ses => {
		if(!ses.user) return;
		(ses.sockets || []).forEach(soc => {
			if(soc == ws || !soc.location) return;
			
			var msg = _.pick(soc.location, 'latitude', 'longitude');
			msg.user_email = ses.user.email;
			
			locations.push(msg);
		})
	});

	cb({locations});
}


global.SOCKET = function(ws){
	_.extend(ws, SOCKET_prototype);
	
	if(
		ws.cookie && ws.cookie.sid && Sessions[ws.cookie.sid] ||
		ws.get.sid && Sessions[ws.get.sid]
	)
		ws.session = Sessions[ws.get.sid || ws.cookie.sid];

	if(!ws.session){
		var sid = acc.createSession();
		ws.session = Sessions[sid];
	}

	ws.site = sites[ws.domain];

	ws.sid = sid || ws.cookie.sid;

	ws.session.sockets.push(ws);

	ws.json(_.extend(_.pick(ws.session, 'sid', 'user'), {cmd: 'session'}));


	let u = ws.session.user;
	if(u && u.id)
		PubSub.publish(`user.${u.id}.connected`);

	ws.on('message', function(msg){
		if(typeof msg == 'string'){
			// missing closure bug.
			var ls = msg.substr(-1);
			if(ls != '}' && ls != ']')
				msg += '}';

			/*
			var mg = JSON.parse(msg);
			var m = function(r){
				(RE[mg.cb] || fake)(r);
			};

			_.extend(m, mg);
			*/

			var m = JSON.parse(msg);

			if(m.cb)
				ws.putCB(m);

			if(m.cmd){
				if(m.cmd == 'setSession')
					setSession(m.sid);

				var fn = S[m.cmd];
				if(fn){
					var cb = function(r){
						if(m.cb && RE[m.cb]) RE[m.cb](r);
					};

					try {
						var r = fn(m, ws, cb);
					}
					catch(error){
					  console.error(error);
					}
				}
			}
		}
		else
		if(msg instanceof Buffer){
			if(!ws.stream) return ws.json({error: 'no stream'});
      
			ws.stream.write(msg, function(err){
				if(err) return console.log(clc.red(err.toString()));

				var tmpName = ws.stream.path.split('/').pop();
				ws.json({cmd: 'progress', b: ws.stream.bytesWritten});
			});
		}
	});

	ws.on('close', function(code, msg){
        for(var prop in ws.subscriptions){
        	PubSub.unsubscribe(prop);
        }

		if(ws.session){
			ws.session.sockets.forEach(function(sock, i){
				if(sock == ws)
					ws.session.sockets.splice(i,1);
			});

            let u = ws.session.user;
            if(u && u.id && (!ws.session.sockets || !ws.session.sockets.length))
		        PubSub.publish(`user.${u.id}.disconnected`);
		}
	});
}