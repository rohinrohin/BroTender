'use strict';

// Messenger API integration example
// We assume you have:
// * a Wit.ai bot setup (https://wit.ai/docs/quickstart)
// * a Messenger Platform setup (https://developers.facebook.com/docs/messenger-platform/quickstart)
// You need to `npm install` the following dependencies: body-parser, express, request.
//
// 1. npm install body-parser express request
// 2. Download and install ngrok from https://ngrok.com/download
// 3. ./ngrok http 8445
// 4. WIT_TOKEN=your_access_token FB_APP_SECRET=your_app_secret FB_PAGE_TOKEN=your_page_token node examples/messenger.js
// 5. Subscribe your page to the Webhooks using verify_token and `https://<your_ngrok_io>/webhook` as callback URL.
// 6. Talk to your bot on Messenger!

const bodyParser = require('body-parser');
const crypto = require('crypto');
const express = require('express');
const fetch = require('node-fetch');
const request = require('request');
var fs = require('fs')
var https = require('https')



let Wit = null;
let log = null;
try {
  // if running from repo
  Wit = require('../').Wit;
  log = require('../').log;
} catch (e) {
  Wit = require('node-wit').Wit;
  log = require('node-wit').log;
}

// Webserver parameter
const PORT = 443;

// Wit.ai parameters
const WIT_TOKEN = 'D6DLOBYWJHM2VZRI22AF6UP2TFHQPDY4';

// Messenger API parameters
const FB_PAGE_TOKEN = 'EAABcuqLqpc4BAMjuZCbSxZBjU734ZAlXt9OzLaMOBLrsXr1AFkgW1kzIceqiLpYNdYLW0VdyQjZCymlXh99vDiBvcRmXM5sOGntvWWjk1Dq73PZBsLFqzJaQgZA8Sv5gxEpZCFaEVb9zVVATw3kvPRldj3TY7OezhZBTGaQqjz54CgZDZD';
if (!FB_PAGE_TOKEN) { throw new Error('missing FB_PAGE_TOKEN') }
const FB_APP_SECRET = '24efdeaa3c574a83996053d65c081208';
if (!FB_APP_SECRET) { throw new Error('missing FB_APP_SECRET') }

let FB_VERIFY_TOKEN = 'my_voice_is_my_password_verify_me';
crypto.randomBytes(8, (err, buff) => {
  if (err) throw err;
  FB_VERIFY_TOKEN = buff.toString('hex');
  console.log(`/webhook will accept the Verify Token "${FB_VERIFY_TOKEN}"`);
});

// ----------------------------------------------------------------------------
// Messenger API specific code

// See the Send API reference
// https://developers.facebook.com/docs/messenger-platform/send-api-reference


const token = "EAABcuqLqpc4BAFJvG9EzLvF91uQYdS0nHLUOa9sAlKeBsIn052mjpZAo0GQrM62tUbZB4M6OclUFhMqWA44eVtixw2EsyUkBlPVxvZA2vgrROFOxQ2l4v8Xxg4YsAjZAKB3xhlExPJHfabxI9kjvM7iJgLuIIeh5Fxznpk3uNgZDZD"


function sendGenericMessage(sender, data) {
	request({
		url: 'https://graph.facebook.com/v2.6/me/messages',
		qs: {access_token:token},
		method: 'POST',
		json: {
			recipient: {id:sender},
			message: data,
		}
	}, function(error, response, body) {
		if (error) {
			console.log('Error sending messages: ', error)
		} else if (response.body.error) {
			console.log('Error: ', response.body.error)
		}
	})
}

const fbMessage = (id, text) => {
  const body = JSON.stringify({
    recipient: { id },
    message: { text },
  });
  const qs = 'access_token=' + encodeURIComponent(FB_PAGE_TOKEN);
  return fetch('https://graph.facebook.com/me/messages?' + qs, {
    method: 'POST',
    headers: {'Content-Type': 'application/json'},
    body,
  })
  .then(rsp => rsp.json())
  .then(json => {
    if (json.error && json.error.message) {
      throw new Error(json.error.message);
    }
    return json;
  });
};

// ----------------------------------------------------------------------------
// Wit.ai bot specific code

// This will contain all user sessions.
// Each session has an entry:
// sessionId -> {fbid: facebookUserId, context: sessionState}
const sessions = {};

const findOrCreateSession = (fbid) => {
  let sessionId;
  // Let's see if we already have a session for the user fbid
  Object.keys(sessions).forEach(k => {
    if (sessions[k].fbid === fbid) {
      // Yep, got it!
      sessionId = k;
    }
  });
  if (!sessionId) {
    // No session found for user fbid, let's create a new one
    sessionId = new Date().toISOString();
    sessions[sessionId] = {fbid: fbid, context: {}};
  }
  return sessionId;
};

// Our bot actions
const actions = {
  send(request, response) {
    // Our bot has something to say!
    // Let's retrieve the Facebook user whose session belongs to
    console.log("REQUEST", JSON.stringify(request));
    const recipientId = sessions[request.sessionId].fbid;
    response = discombobulate(recipientId, request, response); 
    if (recipientId) {
      // Yay, we found our recipient!
      // Let's forward our bot response to her.
      // We return a promise to let our bot know when we're done sending
      
      return sendGenericMessage(recipientId, response.text)
//      .then(() => null)
//      .catch((err) => {
//        console.error(
//          'Oops! An error occurred while forwarding the response to',
//          recipientId,
//          ':',
//          err.stack || err
//        );
//      });
    } else {
      console.error('Oops! Couldn\'t find user for session:', request.sessionId);
      // Giving the wheel back to our bot
      return Promise.resolve()
    }
  },
  // You should implement your custom actions here
  // See https://wit.ai/docs/quickstart
};

// Setting up our bot
const wit = new Wit({
  accessToken: WIT_TOKEN,
  actions,
  logger: new log.Logger(log.INFO)
});

// Starting our webserver and putting it all together
const app = express();
app.use(({method, url}, rsp, next) => {
  rsp.on('finish', () => {
    console.log(`${rsp.statusCode} ${method} ${url}`);
  });
  next();
});
app.use(bodyParser.json({ verify: verifyRequestSignature }));

// Webhook setup
app.get('/webhook', (req, res) => {
  if (req.query['hub.mode'] === 'subscribe' &&
    req.query['hub.verify_token'] === FB_VERIFY_TOKEN) {
    res.send(req.query['hub.challenge']);
  } else {
    res.sendStatus(400);
  }
});

// Message handler
app.post('/webhook', (req, res) => {
  // Parse the Messenger payload
  // See the Webhook reference
  // https://developers.facebook.com/docs/messenger-platform/webhook-reference
  const data = req.body;

  if (data.object === 'page') {
    data.entry.forEach(entry => {
      entry.messaging.forEach(event => {
        // Yay! We got a new message!
        // We retrieve the Facebook user ID of the sender
        const sender = event.sender.id;
        const sessionId = findOrCreateSession(sender);
        if (event.message && !event.message.is_echo) {
          // We retrieve the user's current session, or create one if it doesn't exist
          // This is needed for our bot to figure out the conversation history

          // We retrieve the message content
          const {text, attachments} = event.message;

          if (attachments) {
            // We received an attachment
            // Let's reply with an automatic message
            fbMessage(sender, 'Sorry I can only process text messages for now.')
            .catch(console.error);
          } else if (text) {
            // We received a text message

            // Let's forward the message to the Wit.ai Bot Engine
            // This will run all actions until our bot has nothing left to do
            wit.runActions(
              sessionId, // the user's current session
              text, // the user's message
              sessions[sessionId].context // the user's current session state
            ).then((context) => {
              // Our bot did everything it has to do.
              // Now it's waiting for further messages to proceed.
              console.log('Waiting for next user messages');

              // Based on the session state, you might want to reset the session.
              // This depends heavily on the business logic of your bot.
              // Example:
              // if (context['done']) {
              //   delete sessions[sessionId];
              // }

              // Updating the user's current session state
              sessions[sessionId].context = context;
            })
            .catch((err) => {
              console.error('Oops! Got an error from Wit: ', err.stack || err);
            })
          }
        } else {
          console.log('received event', JSON.stringify(event));
          if (event.postback) {
            if (event.postback.payload) {
              if (event.postback.payload.startsWith("ORDER_ITEM")) {
                event.postback.payload = "Order a " + event.postback.payload.split("^")[1];
              }
              wit.runActions(
                sessionId, // the user's current session
                event.postback.payload, // the user's message
                sessions[sessionId].context // the user's current session state
              ).then((context) => {
                // Our bot did everything it has to do.
                // Now it's waiting for further messages to proceed.
                console.log('Waiting for next user messages');

                // Based on the session state, you might want to reset the session.
                // This depends heavily on the business logic of your bot.
                // Example:
                // if (context['done']) {
                //   delete sessions[sessionId];
                // }

                // Updating the user's current session state
                sessions[sessionId].context = context;
              })
              .catch((err) => {
                console.error('Oops! Got an error from Wit: ', err.stack || err);
              })
            }
          }
        }
      });
    });
  }
  res.sendStatus(200);
});

/*
 * Verify that the callback came from Facebook. Using the App Secret from
 * the App Dashboard, we can verify the signature that is sent with each
 * callback in the x-hub-signature field, located in the header.
 *
 * https://developers.facebook.com/docs/graph-api/webhooks#setup
 *
 */
function verifyRequestSignature(req, res, buf) {
  var signature = req.headers["x-hub-signature"];

  if (!signature) {
    // For testing, let's log an error. In production, you should throw an
    // error.
    console.error("Couldn't validate the signature.");
  } else {
    var elements = signature.split('=');
    var method = elements[0];
    var signatureHash = elements[1];

    var expectedHash = crypto.createHmac('sha1', FB_APP_SECRET)
                        .update(buf)
                        .digest('hex');

    if (signatureHash != expectedHash) {
      throw new Error("Couldn't validate the request signature.");
    }
  }
}

var server = https.createServer(
  {
    key: fs.readFileSync('/etc/letsencrypt/live/rohin.me/privkey.pem'),
    cert: fs.readFileSync('/etc/letsencrypt/live/rohin.me/fullchain.pem')
  },
  app
)

server.listen('443')



console.log('Listening on :' + PORT + '...');

var discombobulate = function(id, request, response) {
  if (id) {
    var execidentifier = response.text.split("^");
    if (execidentifier[1]) {
      console.log('EXEC', execidentifier);
      response.text = menulist[execidentifier[1]](id, request.entities);
      
    } else if (response.quickreplies && response.quickreplies.length){
      var buttons = {
        name: "",
        list: []
      }
      for (var option in response.quickreplies) {
        buttons.list.push(response.quickreplies[option]);
      }
      var result = generateButton(buttons);
      result.attachment.payload.text = response.text;
      for (var button in result.attachment.payload.buttons) {
        result.attachment.payload.buttons[button].payload = result.attachment.payload.buttons[button].payload.split("^")[1];
      }
      response.text = result;
    }  else {
      response.text = {text: response.text};
    }
    console.log("RESPONSE", JSON.stringify(response));
    return response;
  }
}

var mains = {
  name: "Mains",
  list: ["Heart attack burger", "Sambar and rice"]
}

var starters = {
  name: "Starters",
  list: ["Spring roll", "Paneer manchurian", "Cheesy french fries"]
}

var drinks = {
  name: "Drinks",
  list: ["Bloody Mary", "Mojito"]
}

var deserts = {
  name: "Deserts",
  list: ["Dark forest cake", "Vanilla ice cream"]
}

var specials = {
  name: "Specials",
  list: ["Chambord Jaigermeisters", "Fish Curry"]
}

var menulist = {
  menu: function(id, entities) {
    var menutypes = {
      all: function() {
        return menu();
      },
      mains: function() {
        return generateButton(mains);
      },
      specials: function() {
        return generateButton(specials);
      },
      drinks: function() {
        return generateButton(drinks);
      },
      starters: function() {
        return generateButton(starters);
      }
    };
    if (entities.menu) {
      return menutypes[entities.menu[0].value]();
    } else {
      return {text: "Place an order or ask for the bill when you're done. Let me know if you like your food spicy or sweet, and if there's anything you're alergic to. AlphaDawg is happy to serve."};
    }
  },
  intro: function(id, entities) {
    request({
        url: 'https://graph.facebook.com/v2.6/' + id + '?fields=first_name,last_name,profile_pic,locale,timezone,gender&access_token=' + token,
        json: true
    }, function (error, response, body) {
        if (!error && response.statusCode === 200) {
            var reply = "Hey " + body['first_name'] + ", Welcome to BroBar, my name is AlphaDawg and I will be your server tonight. Would you like to hear about our specials today? "
            sendGenericMessage(id, {text: reply})
            
        }
    })
    return {
        "attachment": {
            "type": "image",
            "payload": {
                "url":"http://i.giphy.com/l2JhKi0Xs9AQ5tqtG.gif"
            }
        }
    };
  },
  mains: function() {
    return generateButton(mains);
  },
  specials: function() {
    return generateButton(specials);
  },
  drinks: function() {
    return generateButton(drinks);
  },
  starters: function() {
    return generateButton(starters);
  }
}

var menu = function() {
  return {text: "Whew, you must be really hungry if you want to see our entire menu. We have a variety of selections from our mains, starters, drinks, deserts and specials. Which one would you like to see?"};
}

var generateButton = function(funcloop) {
    var items = funcloop;
    var attachment={
      attachment: {
        "type":"template",
        "payload":{
          "template_type":"button",
          "text":"Ok, here you go: " + items.name,
          "buttons":[]
        }
      }
    }
    for (var item in items.list) {
      attachment.attachment.payload.buttons.push({
        type: "postback",
        title: items.list[item],
        payload: "ORDER_ITEM_^"+items.list[item]+"^"
      });
    }
    return attachment;
}