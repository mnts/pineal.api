const {app, BrowserWindow, ipcMain} = require('electron')
const path = require('path')
const url = require('url')

// Keep a global reference of the window object, if you don't, the window will
// be closed automatically when the JavaScript object is garbage collected.
let win

global.App = {
  indexPath: Cfg.indexPath,
  init: () => {
    win = new BrowserWindow({width: 800, height: 600})

    // and load the index.html of the app.
    win.loadURL(url.format({
      pathname: path.join(__dirname, App.indexPath),
      protocol: 'file:',
      slashes: true
    }));

    win.setMenu(null);
    win.webContents.openDevTools();

    win.on('closed', () => {
      win = null
    })
  },

  connect: function(ws){
		var path = require('url').parse(ws.upgradeReq.url),
			road = ws.road = decodeURI(path.pathname).replace(/^\/+|[^A-Za-z0-9_.:\/~ -]|\/+$/g, ''),
			host = ws.host = ws.upgradeReq.headers.host,
			url = ws.url = ws.host + '/' + road,
			p = ws.p = road.split(/[\/]+/),
			get = ws.get = require('querystring').parse(path.query) || {},
			cookie = ws.cookie = require('cookie').parse(ws.upgradeReq.headers['cookie'] || '');


		if(p[0])
			(SOCK[p[0]] || fake)(ws);
		else
			SOCKET(ws);
	},

  query: function(m, sender){
		if(m.cb){
      var cb = RE[m.cb] = function(msg){
        var r = {cb: m.cb};
        _.extend(r, msg);
        sender.send('query', r);
        delete RE[m.cb];
      };

      setTimeout(function(){
        if(RE[m.cb]) delete RE[m.cb];
      }, 10 * 60 * 1000);
    }

		if(m.cmd){
			var fn = S[m.cmd];
			if(fn){
				var r = fn(m, sender, cb);
			}
		}
  },

  respond: function(m){
  }
};

/*
Coll.afterSave = function(collection, item){
	var as = collection.afterSave || [];

	for(var i = as.length-1; i>=0; i--){
		if(typeof as[i] == 'function')
			as[i](m.item);
		else
		if(typeof as[i] == 'object'){
      console.log('onSAce');
			if(_.isMatch(item, as[i].filter || {}))
				as[i].ws.send('query', {
          cmd: 'onSave',
          item: item,
          collection: collection.name
        });
		}
	};
}
*/

ipcMain.on('query', (event, m) => {
  console.log(m);
  App.query(m, event.sender)
});


app.on('ready', App.init)
app.on('window-all-closed', () => {
  // On macOS it is common for applications and their menu bar
  // to stay active until the user quits explicitly with Cmd + Q
  if(process.platform !== 'darwin')
    app.quit();
})

app.on('activate', () => {
  // On macOS it's common to re-create a window in the app when the
  // dock icon is clicked and there are no other windows open.
  if(win === null)
    App.init();
});
