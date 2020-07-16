const paypal = require('@paypal/checkout-server-sdk');
/*
let environment = new paypal.core.SandboxEnvironment(
    Cfg.paypal.configure.client_id, 
    Cfg.paypal.configure.client_secret
);

let client = new paypal.core.PayPalHttpClient(environment);
*/

app.use((req, res, next) => {
    if(req.site && req.site.paypal && !req.site.paypal.client){
        if(
            req.site.paypal.client_id && 
            req.site.paypal.client_secret
        ){
            let environment = new paypal.core.SandboxEnvironment(
                Cfg.paypal.configure.client_id, 
                Cfg.paypal.configure.client_secret
            );

            req.site.paypal.client = new paypal.core.PayPalHttpClient(environment);
        }
    }
	
	next();
});
