function check(item){
    if(!item.domain) return;

    const util = require('util');
    const dns = require('dns');
    const lookup = util.promisify(dns.lookup);
    return new Promise((ok, no) => {
        lookup(item.domain, (a, ip, b) => {
            if(ip){
		if(require('ip').address() == ip)
			ok(ip);
		else no('not pointed here');
	    }
            else no('wrong address');
        });
    });
}

module.exports = check;
