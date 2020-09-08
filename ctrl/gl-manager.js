var MFS = require("greenlock-manager-fs");

var Manage = module.exports;
Manage.create = function(options){
    var mfs = MFS.create(options);

    var manager = {};

    // add some things to... wherever you save things

    manager.set = async function(args){
        // You can see in the tests a sample of common values,
        // but you don't really need to worry about it.
        // var subject = siteConfig.subject;
	console.log('update::', args);
	var set = Object.assign({}, args);
	delete set.subject;
	set.domain = args.subject;
	//set.altnames = [args.subject];

	const res = await db.collection("sites").updateOne({ 
               "domain": args.subject
           }, { $set: set}, { upsert: true });
	console.log('ress::',res);
	return args;
        // Cherry pick what you like for indexing / search, and JSONify the rest
        //return mergeOrCreateSite(subject, siteConfig);
    };

    // find the things you've saved before
	/*
    manager.get = async function(args){
	console.log(args);
	const res = await db.collection("sites").findOne({
		domain: args.subject 

        //return getSiteByAltname(servername);
    };*/

    manager.find = async function(args){
	var q = {};
	if(args.servername) 
		q.domain = args.servername;
	
	var myPromise = () => {
	       return new Promise((resolve, reject) => {
	          db
	          .collection('sites')
	          .find(q)
	          .toArray(function(err, data) {
	             err?reject(err)
	                :resolve(data);
		   });
		});
	 };
	   //await myPromise
	var result = await myPromise();
	var list =  result.map(item => {
		return {
			subject: item.domain,
			altnames: [item.domain/*, 'www.'+item.domain*/]
		};
	});

	return list;
    };

    manager.defaults = async function(opts) {
        return mfs.defaults(opts);
    };

    //
    // Optional (for common deps and/or async initialization)
    //
    manager.init = async function(deps) {
        return mfs.init(deps);
    };

   return manager;
};
