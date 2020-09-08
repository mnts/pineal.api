const paypal = require('@paypal/checkout-server-sdk');
/*
let environment = new paypal.core.SandboxEnvironment(
    Cfg.paypal.configure.client_id, 
    Cfg.paypal.configure.client_secret
);

let client = new paypal.core.PayPalHttpClient(environment);
*/
process.on('loadedModules', ev => {

query.constructors.push(q => {
    if(q.site && q.site.paypal && !q.site.paypal.client){
        if(
            q.site.paypal.client_id && 
            q.site.paypal.client_secret
        ){
            let environment = new paypal.core.SandboxEnvironment(
                Cfg.paypal.configure.client_id, 
                Cfg.paypal.configure.client_secret
            );

            q.site.paypal.client = new paypal.core.PayPalHttpClient(environment);
        }
    }
});

});
