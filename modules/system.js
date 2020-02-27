var Sys = {
  onExit: () => {
    console.log('Exit');
    Object.keys(SET).forEach((id) => {
      var item = SET[id];
      item.id = id;
      Sys.save(item);
    });

  },

  collection: db.collection('set'),

  save: (item) => {
    Sys.collection.update({id: item.id}, item, {
      upsert: true
    }, (err, d) => {
      //if(err) console.error(err);
      log(d);
    });
  },

  loadSet: (ids) => {
    Sys.collection.find({
      id: {$in: ids}
    }).toArray(function(err, items){
      log(items);
      (items || []).forEach((item) => {
        SET[item.id] = item;
      });
    });
  }
};

global.SET = {
  lastSync: {
    time: (new Date).getTime() - 1000 * 60 * 60 * 24 * 30
  }
};

Sys.loadSet(Cfg.loadSet);
process.on('loadedModules', (ev) => {
});

process.on('exit', Sys.onExit);
process.on('SIGINT', () => {
  process.exit(2);
});

process.on('uncaughtException', function(e) {
  console.log('Uncaught Exception...');
  console.log(e.stack);
  process.exit(99);
});


S['sys.get'] = function(m, ws, cb){
  log(m);
  cb({item: SET[m.id]});
};
