const paypal = require('@paypal/checkout-server-sdk');

let environment = new paypal.core.SandboxEnvironment(
    Cfg.paypal.configure.client_id, 
    Cfg.paypal.configure.client_secret
);

let client = new paypal.core.PayPalHttpClient(environment);

//paypal.configure(Cfg.paypal.configure);

S['paypal.order'] = (m, ws, cb) => {
	const client = ws.site?.paypal?.client;
	if(!client) return cb({err: 'no client'});

	const user = ws.session.user;
	if(!user) return cb({err: 'no user'});
	if(!m.price) return cb({err: 'no price'});
	//if(!m.src) return cb({err: 'no src'});

	const currency = m.currency || ws.site.currency;

	const pp_req = {
		  "intent": "CAPTURE",
		  "purchase_units": [
			  {
				  "amount": {
					  "currency_code": currency,
					  "value": m.price
				  }
			  }
		   ],
		   application_context: {
		        brand_name: ws.site.title,
				return_url: "http://"+ws.domain+"/api/paypal/return",
				cancel_url: "http://"+ws.domain+"/api/paypal/cancel"
		   }
	}
	
	let request = new paypal.orders.OrdersCreateRequest();
    request.requestBody(pp_req);
    
	client.execute(request).then(res => {
		if(!res || !res.result) return cb({err: 'failed'});

        const result = res.result;

		const links = {};
		result.links.map(link => {
			links[link.rel] = link.href;
		});


        if(result.status = 'CREATED'){
			const item = {
				id: result.id,
				owner: user.email,
				time: (new Date()).getTime(),
				service: 'paypal',
				currency,
				price: m.price,
				domain: ws.domain,
				status: 'created',
				approval_url: links.approve
			};

			if(m.src) item.src = m.src;
			
			db.collection('orders').insertOne(item, (err, res) => {
				if(err || !res.ops || !res.ops.length)
					return cb({error: err || false});

				const ins = res.ops[0];

		        cb({item});
			});
        }
	});
}


const payed = (src) => {
	let u = new URL(src);

	var collection = db.collection(u.pathname.substr(1));
	if(!collection) return;

	collection.updateOne({id: u.hash.substr(1)},
		{$set: {payed: true}}
	);
};

sys.on('loaded', ev => {
    const col = db.collection('orders');
	col.watch().on('change', d => {
		console.log(d)
		if(d.operationType == 'insert'){
		}
		else
		if(d.operationType == 'update'){
			col.findOne(
				{_id: d.documentKey._id},
				{src: 1, status: 1}, 
				(e, item) => {
					if(item.status == 'completed')
					    payed(item.src);
				}
			);
		}
	});
});

app.get('/api/paypal/return', (req, res) => {
	const client = req.site?.paypal?.client;
	if(!client) return cb({err: 'no client'});

	const id = req.query.token;
	if(!id) return res.send('No token');

	let request = new paypal.orders.OrdersCaptureRequest(id);
    request.requestBody({});
	client.execute(request).then(re => {
		if(!re || !re.result) return res.send('failed');
		const result = re.result;

		console.log(result);

		if(result.status != 'COMPLETED') return res.send('Not completed');

		db.collection('orders').findOneAndUpdate({id: result.id}, {$set: {
			status: 'completed',
			payer: result.payer,
		}});
        
		res.send(`
			<body><script>
				const isPC = typeof window.orientation == 'undefined';
				if(isPC)
					window.close();
				else
					location.href = "https://${req.hostname}";
			</script>Completed</body>
		`);
	}).catch(err => console.log(err));
});

app.post('/api/paypal/hooks', (req, res) => {
	//console.log('POST:', req);
});

app.get('/api/paypal/hooks', (req, res) => {
	console.log('GERt:', req);
});

app.get('/pp', (req, res) => {
	console.log('GERt:', req);
		res.send('completed');
});


S['paypal.capture'] = (m, ws, cb) => {
	if(!m.id) return cb({err: 'no id'});
	let request = new paypal.orders.OrdersCaptureRequest(m.id);
    request.requestBody({});
	client.execute(request).then(res => {
		cb({result: res.result});
	});
}



S['paypal.pay'] = function(m, ws){
	//if(!ws.session.user) return;

	/*
	"payment_method": "credit_card",
    "funding_instruments": [{
      "credit_card": {
        "number": "4417119669820331",
        "type": "visa",
        "expire_month": 11,
        "expire_year": 2018,
        "cvv2": "874",
        "first_name": "Betsy",
        "last_name": "Buyer",
        "billing_address": {
          "line1": "111 First Street",
          "city": "Saratoga",
          "state": "CA",
          "postal_code": "95070",
          "country_code": "US"
        }
      }
    }]
	*/

	var pay = {
    "intent": "sale",
    "payer": {
        "payment_method": "paypal"
    },
    "redirect_urls": {
        "return_url": "http://mess.lh/#payed",
        "cancel_url": "http://mess.lh/#canceled"
    },
    "transactions": [{
        "item_list": {
            "items": [{
                "name": "item",
                "sku": "item",
                "price": "1.00",
                "currency": "USD",
                "quantity": 1
            }]
        },
        "amount": {
            "currency": "USD",
            "total": "1.00"
        },
        "description": "Testing how it works."
    }]
	};


	paypal.payment.create(pay, function(error, payment) {
	    if(error)
	        throw error;
			else{
	        console.log("Create Payment Response");
	        console.log(payment);
	    }
	});
}


S['paypal.plan'] = function(m, ws){
	//if(!ws.session.user) return;

	var billingPlanAttributes = {
	    "description": m.description,
	    "merchant_preferences": {
	        "auto_bill_amount": "yes",
	        "cancel_url": m.cancel_url,
	        "initial_fail_amount_action": "continue",
	        "max_fail_attempts": "1",
	        "return_url": m.return_url,
	        "setup_fee": {
	            "currency": "USD",
	            "value": "25"
	        }
	    },
	    "name": m.name,
	    "payment_definitions": [
	        {
	            "amount": {
	                "currency": "USD",
	                "value": m.amount
	            },
	            "charge_models": [
	                {
	                    "amount": {
	                        "currency": "USD",
	                        "value": "10.60"
	                    },
	                    "type": "SHIPPING"
	                },
	                {
	                    "amount": {
	                        "currency": "USD",
	                        "value": "20"
	                    },
	                    "type": "TAX"
	                }
	            ],
	            "cycles": "0",
	            "frequency": m.frequency || "MONTH",
	            "frequency_interval": "1",
	            "name": "Regular 1",
	            "type": "REGULAR"
	        }
	    ],
	    "type": "INFINITE"
	};

	paypal.billingPlan.create(billingPlanAttributes, (error, billingPlan) => {
	    if (error) {
	        console.log(error);
	    } else {
	        console.log("Create Billing Plan Response");
	        console.log(billingPlan);

					if(m.cb) RE[m.cb]({plan: billingPlan});
	    }
	});

};


S['paypal.credit_card.create'] = function(m, ws){
	if(!m.card) return ws.cb(m.cb, {error: 'no card'});

	paypal.credit_card.create(m.card, function(error, credit_card){
		if(error) return RE[m.cb]({error: 'VALIDATION_ERROR'});

		RE[m.cb]({card: credit_card});
	});
};


S['paypal.credit_card.get'] = function(m, ws){
	if(!m.id) return ws.cb(m.cb, {error: 'no card'});

	paypal.credit_card.get(m.id, function(error, credit_card){
		if(error) return RE[m.cb]({error: 'ERROR'});

		RE[m.cb]({card: credit_card});
	});
};

var url = require('url');


S['paypal.billing.create'] = function(m, ws, cb){
	var isoDate = new Date();
	isoDate.setSeconds(isoDate.getSeconds() + 90);
	isoDate.toISOString().slice(0, 19) + 'Z';

	var agreement = {
	    "name": m.plan.name,
	    "description": m.plan.description,
	    "start_date": isoDate,
	    "plan": {
	        //"id": "P-0NJ10521L3680291SOAQIVTQ"
	    },
	    "payer": m.payer
	};

	// Create the billing plan
	paypal.billingPlan.create(m.plan, (error, billingPlan) => {
	    if(error)
					cb({error: 'failed creating plan', err: error});
	    else{
	        // Activate the plan by changing status to Active
	        paypal.billingPlan.update(
						billingPlan.id, [
					    {
					        "op": "replace",
					        "path": "/",
					        "value": {
					            "state": "ACTIVE"
					        }
					    }
						],
						(error, response) => {
		            if(error){
										cb({error: 'failed activating plan', err: error});
		            } else {
		                console.log("Billing Plan state changed to " + billingPlan.state);
		                agreement.plan.id = billingPlan.id;


		                // Use activated billing plan to create agreement
		                paypal.billingAgreement.create(agreement, function (error, billingAgreement) {
	                    if (error) {
													cb({error: 'failed creating billing agreement', err: error});
	                        //console.log(error);
	                        //throw error;
	                    } else {
	                        for (var index = 0; index < billingAgreement.links.length; index++) {
                            if(billingAgreement.links[index].rel === 'approval_url'){
                              var approval_url = billingAgreement.links[index].href;

															var token = url.parse(approval_url, true).query.token
															cb({
																token: token,
																url: approval_url,
																agreement: billingAgreement,
																plan: billingPlan
															});
                            }
	                        }
	                    }
		                });
		            }
		        });
	    }
	});
};

/*
App.get('/paypal_webhook', function(req, res){
		console.log(req.body);
});
*/

S['paypal.billingAgreement.execute'] = function(m, ws){
	if(!ws.session.user) return;

	if(!m.paymentToken) return ws.cb(m.cb, {error: 'no paymentToken'});
	var paymentToken = '';

	paypal.billingAgreement.execute(m.paymentToken, {}, function (error, item){
	    if (error) {
	        console.log(error);
	    } else {
	        console.log("Billing Agreement Execute Response");
	        //console.log(JSON.stringify(billingAgreement));

					var set = {membership: item.id};
					Acc.db.updateOne({id: ws.session.user.id}, {$set: set});
					_.extend(ws.session.user, set);

					//db.collection('membership').update({token: m.paymentToken}, {$set: {active: true}});

					//acc.db.update({id: ws.session.user.id}, {$set: {}}, function(err, ok){});
					ws.cb(m.cb, {res: item});
	    }
	});
}

S['paypal.billingPlan.get'] = function(m, ws, cb){
	paypal.billingPlan.get(m.id, function(error, item){
	    if(error)
				cb({error: 'failed', err: error});
	    else
	      cb({item: item});
	});
};


S['paypal.billingAgreement.get'] = function(m, ws, cb){
	paypal.billingAgreement.get(m.id, function(error, billingAgreement){
	    if(error)
				cb({error: 'failed', err: error});
	    else
	      cb({item: billingAgreement});
	});
};
