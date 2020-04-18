				let item = change.fullDocument;

				console.log(item);

				var u = new URL(item.src);

				var cName = u.pathname.replace(/^\/|\/$/g, ''),
					id = u.hash.substr(1);

				let c2 = Collections[cName];
				c2.collection.findOne({id}).then(itm => {
					/*
					let users = (itm.users || []).filter(v => {
						return v != item.owner;
					});
					*/

					Object.values(Sessions).forEach(ses => {
						if(!ses.user) return;

						if(itm.users.indexOf(ses.user.email) + 1){
							(ses.sockets || []).forEach(soc => {
								soc.json({
									collection: c.name,
									cmd: 'insert',
									item,
									cId: id,
									cName,
									container: itm
								});
							});
						}
					});
				});
			}
