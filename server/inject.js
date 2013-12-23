//When a HTTP Request comes, we need to figure out is it a proper request
//then get some query data
//then hijack html return by meteor
//code below, does that in abstract way

var http = Npm.require('http');

var injectDataTemplate;
Assets.getText('server/inject_data.html', function(err, text) {
  if(err) {
    console.error('Error reading fast-render inject_data.html: ', err.message);
  } else {
    injectDataTemplate = _.template(text.trim());
  }
});

var injectConfigTemplate;
Assets.getText('server/inject_config.html', function(err, text) {
  if(err) {
    console.error('Error reading fast-render inject_config.html: ', err.message);
  } else {
    injectConfigTemplate = _.template(text.trim());
  }
});

var originalWrite = http.OutgoingMessage.prototype.write;
http.OutgoingMessage.prototype.write = function(a, b) {
  if(this.queryData) {
    //inject config
    if(injectConfigTemplate) {
      var jsonContent = JSON.stringify({
        subscriptions: this.queryData.subscriptions,
        serverRoutePath: this.queryData.serverRoutePath,
        subscriptionIdMap: {}, //map of ids and its subscription name
        loadedSubscriptions: {} //loaded Subscriptions, which have been forcely completed earlier
      });
      var injectHtml = injectConfigTemplate({jsonContent: jsonContent});
      a = a.replace('<head>', '\n' + injectHtml + '\n<head>');
    } else {
      console.warn('injectConfigTemplate is not ready yet!');
    }

    //inject data
    if(injectDataTemplate) {
      var ejsonString = EJSON.stringify({
        collectionData: this.queryData.collectionData
      });
      var injectHtml = injectDataTemplate({ejsonString: ejsonString});
      a = a.replace('</head>', injectHtml + '\n</head>');
    } else {
      console.warn('injectDataTemplate is not ready yet!');
    }
  }
  originalWrite.call(this, a, b);
};

//meteor algorithm to check if this is a meteor serving http request or not
//add routepolicy package to the fast-render
function appUrl(url) {
  if (url === '/favicon.ico' || url === '/robots.txt')
    return false;

  // NOTE: app.manifest is not a web standard like favicon.ico and
  // robots.txt. It is a file name we have chosen to use for HTML5
  // appcache URLs. It is included here to prevent using an appcache
  // then removing it from poisoning an app permanently. Eventually,
  // once we have server side routing, this won't be needed as
  // unknown URLs with return a 404 automatically.
  if (url === '/app.manifest')
    return false;

  // Avoid serving app HTML for declared routes such as /sockjs/.
  if (typeof(RoutePolicy) != 'undefined' && RoutePolicy.classify(url))
    return false;

  // we currently return app HTML on all URLs by default
  return true;
};

//check page and add queries
WebApp.connectHandlers.use(function(req, res, next) {
  if(appUrl(req.url)) {
    FastRender._processRoutes(req.url, function(queryData) {
      res.queryData = queryData;
      res.queryData.serverRoutePath = req.url;
      next();
    });
    //run our route handlers and add proper queryData
  }
});
