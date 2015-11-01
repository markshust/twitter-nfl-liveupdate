require('dotenv').config({silent: true});

if (! process.env.FIREBASE_AUTH_TOKEN) {
  console.log("You must supply FIREBASE_AUTH_TOKEN to run this script.");
  process.exit(1);
}

const http = require('http');
const Firebase = require('firebase');
const fbRef = new Firebase('https://nfl-liveupdate.firebaseIO.com/');
const Twitter = require('twitter');
const twitterClient = new Twitter({
  consumer_key: process.env.TWITTER_CONSUMER_KEY,
  consumer_secret: process.env.TWITTER_CONSUMER_SECRET,
  access_token_key: process.env.TWITTER_ACCESS_TOKEN,
  access_token_secret: process.env.TWITTER_ACCESS_TOKEN_SECRET
});
var childData = {};
 
fbRef.authWithCustomToken(process.env.FIREBASE_AUTH_TOKEN, function(err, res) {
  if (err) {
    console.log(err);
    process.exit(1);
  } else {
    console.log('Listening for updates...');

    fbRef.on('child_removed', function(childSnap) {
      delete childData[childSnap.key()];
    });

    fbRef.on('child_added', function(childSnap) {
      childData[childSnap.key()] = {};

      childSnap.ref().on('value', function(snap) {
        var val = snap.val();
        var oldVal = childData[snap.key()];

        if (! val || ! oldVal) return;

        var status = "";
        var scoreStr = val.away_team + ' ' + val.away_score
          + ', ' + val.home_team + ' ' + val.home_score;

        childData[snap.key()] = val;

        if ('quarter' in oldVal
          && oldVal.quarter != "F" 
          && val.quarter != oldVal.quarter
        ) { 
          switch (val.quarter) {
            case '1': status = 'The ' + val.away_team + ' vs ' + val.home_team
              + ' game is now underway!'; scoreStr = ''; break;
            case '2': status = 'At the end of 1, the score is '; break;
            case 'H': status = 'At halftime, the score is '; break;
            case '4': status = 'After 3, the score is ' ; break;
            case 'F': status = 'The final score is '; break;
            case 'O': status = 'At the end of regulation, the score is '; break;
          }   

          if (status) {
            status = '#NFL LiveUpdate:\n' + status + scoreStr;
          }   
        } else if (
          'away_score' in oldVal
          && 'home_score' in oldVal
        ) {
          if (val.away_score > oldVal.away_score) {
            var scoreDiff = val.away_score - oldVal.away_score;

            status = val.away_team + ' just scored ' + scoreDiff + '!\n';
          } else if (val.home_score > oldVal.home_score) {
            var scoreDiff = val.home_score - oldVal.home_score;

            status = val.home_team + ' just scored ' + scoreDiff  + '!\n';
          }

          if (status) {
            status = '#NFL LiveUpdate:\n' + status + 'The new score is ' + scoreStr;
          }
        }

        if (status) {
          twitterClient.post('statuses/update', {status: status}, function(error, tweet){
            if (error) {
              console.log(error);
            } else {
              console.log(tweet);
            }
          });
        }
      });
    });
  }
});

