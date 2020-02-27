const FS = require('fs');
const Path = require('path');
const YAML = require('js-yaml');

global.Data = {
  cfg: Cfg.Data,
  items: {},
  tmp: Path.join(Neuro.path, 'tmp'),
  dir: Path.join(require('os').homedir(), 'Desktop', Cfg.Data.folder || 'myItems'),
  init: function(cfg){
    //this.init_ipfs();
    if(!FS.existsSync(this.dir))
      FS.mkdirSync(this.dir);

    if(!FS.existsSync(this.tmp))
      FS.mkdirSync(this.tmp);

    // this.serve(Cfg.Data.port);

    console.log('Module data was initiated');
  },

  init_ipfs: function(){

  },

  generate_id: () => randomString(8),

  save: function(item){
    return new Promise((resolve, reject) => {
      try{
        var itm = this.saveSync(item);
      }
      catch(err){
        console.error(err);
        return reject(err);
      }

      resolve(itm);
    });
  },

  download: function(url, id){
    if(!id) id = this.generate_id();
    const path = Path.join(this.dir, id);

    var file = FS.createWriteStream(path);

    return new Promise((resolve, reject) => {
      if(url.indexOf('http') === 0)
        require(url.indexOf('https') === 0?'https':'http').get(url, r => {
          r.pipe(file);
          r.on('end', () => {
            resolve(id);
          });
        });
      else reject();
    });
  },

  storeAsType: 'yaml',
  saveSync: function(item){
    if(typeof item == 'object'){
      var path, content;

      if(item.length){
        content = item.join("\n");
        path = Path.join(this.dir, item.id+'.log');
      }
      else{
        if(!item.id) item.id = Data.generate_id();

        if(this.storeAsType == 'yaml'){
          content = YAML.safeDump(item);
          path = Path.join(this.dir, item.id+'.yaml');
        }
        else{
          content = JSON.stringify(item);
          path = Path.join(this.dir, item.id+'.json');
        }

        FS.writeFileSync(path, content);
      }

      Data.items[item.id] = item;
      return item;
    }
  },

  update: function(id, set){
    return new Promise((resolve, reject) => {
      try{
        var itm = this.updateSync(id, set);
      }
      catch(err){
        return reject(err);
      }

      resolve(itm);
    });
  },

  updateSync: function(id, set){
    if(typeof set == 'object'){
      var item = Data.loadSync(id) || {id};
      _.extend(item, set);
      Data.saveSync(item);

      return item;
    }
  },

  saveFile: function(buf, id){
    return new Promise((resolve, reject) => {
    	var file = {
    		id: Data.generate_id(),
    		time: (new Date()).getTime(),
        owner: Me.id
    	};

      /*
    	if(typeof m.name == 'string')
    		file.name = m.name;

    	if(typeof m.mime == 'string')
    		file.mime = m.mime;
      */

      Data.save(file).then(item => {
        var path = Path.join(this.dir, file.id);

        try{
          FS.writeFileSync(path, buf);
        }
        catch(err){
          console.error(err);
          return reject(err);
        }

        resolve(file);
      });
    });
  },

  upd: 4,
  log: function(line, id){
    if(!id) id = Data.generate_id();

    var path = Path.join(this.dir, id+'.log');

    return new Promise((resolve, reject) => {
      if(!FS.existsSync(path))
        FS.writeFileSync(path, line);
      else
        FS.appendFileSync(path, "\r\n"+line);

      if(Data.items[id])
        Data.items[id].push(line);
      else
        Data.items[id] = [line];

      resolve(id);
    });
  },

  listDir: function(dir){
    var items = [];
    FS.readdirSync(dir).forEach(name => {
      var path = Path.join(dir, name);
      try{
        var stats = FS.statSync(path);

        var item = {
          name,
          size: stats.size,
          time: stats.mtimeMs,
          time_created: stats.ctimeMs,
        };

        items.push(item);
      }
      catch(err) {
        console.log('unable to read: ' + path);
      }
    });

    return new Promise((resolve, reject) => {
      resolve(items);
    });
  },

  load: function(id){
    return new Promise((resolve, reject) => {
      try{
        var itm = this.loadSync(id);
      }
      catch(err){
        console.error(err);
        return reject(err);
      }

      resolve(itm);
    });
  },

  share: function(){

  },

  loadSync: function(id){
    var ids = [];
    if(typeof id == 'object'){
      if(id.length)
        ids = id;
      else return;
    }
    else if(typeof id == 'string'){
      ids = [id];
    }
    else return;

    var items = [];
    ids.forEach(ida => {
      if(typeof this.items[ida] == 'object'){
        var item = this.items[ida];
      }
      else
        var item = this.items[ida] = this.read(ida);

      items.push(item);
    });

    return (typeof id == 'string' || typeof id == 'number')?items[0]:items;
  },

  read: function(id){
    var path = Path.join(this.dir, ''+id);

    if(FS.existsSync(path+'.json')){
      var content = FS.readFileSync(path+'.json');
      var item = JSON.parse(content);
    }
    else
    if(FS.existsSync(path+'.yaml')){
      var content = FS.readFileSync(path+'.yaml');
      var item = YAML.safeLoad(content);
    }
    else
    if(FS.existsSync(path+'.log')){
      var content = String(FS.readFileSync(path+'.log'));

      var item = content.split(/\r?\n/);
    }
    else return;

    return item
  },

  open: function(path){
    const fileName = path.split('/').pop(),
          ext = fileName.split('.').pop();

    if(!FS.existsSync(path))
      return false;

    var content = FS.readFileSync(path);
    if(!content)
      return false;

    if(ext == 'json')
      return JSON.parse(content);

    if(ext == 'yaml')
      return YAML.safeLoad(content);

    if(ext == 'log')
      return String(content).split(/\r?\n/);

    return String(content);
  },

  write: function(path, item){
    const fileName = path.split('/').pop(),
          ext = fileName.split('.').pop();

    if(ext == 'json'){
      content = JSON.stringify(item);
    }
    else
    if(ext == 'yaml'){
      content = YAML.safeDump(item);
    }
    else
    if(typeof item == 'string'){
      if(ext == 'log' && FS.existsSync(path))
        return FS.appendFileSync(path, "\r\n"+item);
      else
        content = item;
    }

    FS.writeFileSync(path, content);

    return content;
  },

  getPath: function(id){
    var path = Path.join(Data.dir, ''+id);

    if(FS.existsSync(path))
      return path;

    if(FS.existsSync(path+'.json'))
      return path+'.json';

    if(FS.existsSync(path+'.yaml'))
      return path+'.yaml';

    if(FS.existsSync(path+'.log'))
      return path+'.log';

    return path;
  },

  serve: function(port){
    require('http').createServer((req, res) => {
    	var Url = require('url').parse(req.url),
    	    uri = decodeURI(Url.pathname).replace(/^\/+|[^A-Za-z0-9_.:\/~ @-]|\/+$/g, '');
    	const p = uri.split(/[\/]+/);

      var path = Path.join(this.dir, p[0]);

      try{
        var stat = FS.lstatSync(path);
      } catch(e){
        console.error(e);
        res.writeHead(404);
        res.end();
        return;
      }

      var headers = {
        'Cache-Control': 'no-cache, must-revalidate',
        'Access-Control-Allow-Origin': '*'
      };

      res.writeHead(200, headers);
      var readStream = FS.createReadStream(path);
      readStream.pipe(res);
    }).listen(port || Cfg.Data.port);
  },

	pump: function(res){

	},
};

module.exports = Data;

Http.GET['items'] = function(q){
  var cfg = {
    path: Data.getPath(q.p[1])
  };

  query.pump(q, cfg);
};

API.test = (m, q, re) => {
    re({
      re: 'it works'
    });
};

API.log = (m, q, re) => {
  Data.log(m.line, m.id).then(id => {
    if(m.cb) re({id});
  });
};

API.load = (m, q, re) => {
  if(m.path){
    const dir = process.cwd(),
          path = Path.join(dir, m.path);

    var d = Data.open(path);

    var r = {};

    if(!d)
      r.error = true;
    else
    if(typeof d == 'object')
      r.item = d;

    re(r);
  }
  else
    Data.load(m.id).then(item => re({item}));
};

API.update = (m, q, re) => {
  var item = Data.updateSync(m.id, m.set);
  if(m.cb) re({item});
};

API.save = (m, q, re) => {
  if(m.path){
    const dir = process.cwd(),
          path = Path.join(dir, m.path);

    if(m.set || m.update){
      var d = Data.open(path);
      _.extend(d, m.set || m.update);
      Data.write(path, m.item);
      re({ok: 1});
    }
    else
    if(m.item){
      Data.write(path, m.item);
      re({ok: 1});
    }
    else
    if(m.log){
      Data.write(path, m.log);
      re({ok: 1});
    }
  };

  if(m.url){
    var id = Data.generate_id();
    if(m.item) m.item.id = id;
    Data.download(m.url, id).then(id => {
      re({id});
    });
  }

  if(m.log){
    Data.log(m.line, m.id).then(id => {
      if(m.cb) re({id});
    });
  }
  else
  if(m.item){
    Data.save(m.item).then(r => {
      if(!m.url)
        re({
          item: r
        });
    });
  }
};


API.createStream = function(m, ws, re){
  var id = Data.generate_id(),
      path = Path.join(this.dir, id),
  		stream = fs.createWriteStream(path, {flags: 'w'});

	ws.stream = stream;

	re({id});
}

API.createStream = function(m, ws, re){
	var tmpName = randomString(20),
		tmpPath = Data.tmp + '/' + tmpName,
		tmpStream = FS.createWriteStream(tmpPath, {flags: 'w'});

	ws.stream = tmpStream;

	if(m.cb) re({name: tmpName});
}


API.saveStream = function(m, ws, re){
	if(!ws.stream) return ws.json({error: 'no stream'});

	ws.stream.end();
	var tmpName = ws.stream.path.split('/').pop();

	var user = ws.session.user;

	if(m.id){
		var file = Data.loadSync(m.id);
		if(file.owner && (!Me || Me.id != file.owner))
			return ws.json({error: 'access denied'});

		var set = {
			updated: (new Date()).getTime(),
			size: ws.stream.bytesWritten
		};

		_.extend(file, set);

		FS.renameSync(ws.stream.path, file.path || Path.join(Data.dir, file.id));
    Data.save(file).then(item => {
			if(m.cb) re({file: item, name: tmpName});
		});
	}

	var file = {
		id: Data.generate_id(),
		size: ws.stream.bytesWritten,
		time: (new Date()).getTime(),
    owner: '123' || Me.id
	};

	if(typeof m.name == 'string')
		file.name = m.name;

	if(typeof m.mime == 'string')
		file.mime = m.mime;

  Data.save(file).then(item => {
		FS.renameSync(ws.stream.path, file.path || Path.join(Data.dir, file.id));
		delete ws.stream;

		if(m.cb) re({file: item, name: tmpName});
	});
}
