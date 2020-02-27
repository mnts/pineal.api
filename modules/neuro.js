const FS = require('fs');
const clc = require('clc');
const Path = require('path');

global.Neuro = {
  path: __dirname,

  apps: {},
  run: function(name){
    var app = this.apps[name] = {
      name: name,
      dir: Path.join(this.path, 'apps', name),
      windows: {}
    };

    app.conf = require_yaml(Path.join(app.dir, 'config.yaml'));

    if(Neuro.express && app.conf.httpAccess)
      Neuro.express.use('/'+name, require('express').static(app.dir));

    var open = app.openWindow = name => Neuro.openWindow(app, name);
    open('index');
  },

  windows: [],
  openWindow(app, name){
    conf = _.extend({}, Cfg.window, app.conf.windows[name]);
    console.log(conf);

    var allignPath = file => Path.join(app.dir, file);
    if(conf.BrowserWindow.icon)
      conf.BrowserWindow.icon = allignPath(conf.BrowserWindow.icon);

    let win = app.windows[name] = new Electron.BrowserWindow(conf.BrowserWindow);
    //const index = this.windows.push(win) - 1;

    var path = allignPath(conf.file || 'index.html');
    if(conf.url){
      if(conf.url.params)
        path += '?' + querysrequire('querystring').stringify(conf.url.params);
    }

    win.loadURL(path);


    win.webContents.App = win.App = app;

    if(conf.maximize)
      win.maximize();

    if(conf.openDevTools)
      win.webContents.openDevTools();

    win.setMenu(null);
    win.on('closed', ev => {
      win = app.windows[name] = null;
    });
  },

  modules: {},
  loadModule: function(name){
    var file = './modules/' + name + '.js';
    var that = this;

    let module = this.modules[name] = require(file);
    console.log('Loaded: '+name);

    if(typeof module.init == 'function')
      module.init();

    if(Cfg.developer_mode)
      FS.watchFile(file, function(curr, prev){
        console.log(curr.mtime.toString() +' '+ name);
        delete require.cache[require.resolve(file)];
        that.modules[name] = require(file);
      });
  }
};
