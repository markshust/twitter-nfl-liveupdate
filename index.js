require('dotenv').config({silent: true});

if (! process.env.FIREBASE_AUTH_TOKEN) {
  console.log('You must supply FIREBASE_AUTH_TOKEN to run this script.');
  process.exit(1);
}

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

        var status = '';
        var quarterStatus = '';
        var justScoredStatus = '';
        var scoreDiff = 0;
        var scoreStr = val.away_team + ' ' + val.away_score
          + ', ' + val.home_team + ' ' + val.home_score;
        var statusHeader = '#NFL LiveUpdate:\n';

        childData[snap.key()] = val;

        if ('quarter' in oldVal
          && oldVal.quarter != 'F'
          && val.quarter != oldVal.quarter
        ) {
          switch (val.quarter) {
            case '1': quarterStatus = 'The ' + val.away_team + ' vs ' + val.home_team
              + ' game is now underway!'; scoreStr = ''; break;
            case '2': quarterStatus = 'At the end of 1, the score is '; break;
            case 'H': quarterStatus = 'At halftime, the score is '; break;
            case '4': quarterStatus = 'After 3, the score is ' ; break;
            case 'F': quarterStatus = 'The final score is '; break;
            case 'O': quarterStatus = 'At the end of regulation, the score is '; break;
          }

          if (quarterStatus) {
            quarterStatus += scoreStr;
          }
        }

        if ('away_score' in oldVal
          && 'home_score' in oldVal
        ) {
          if (val.away_score > oldVal.away_score) {
            scoreDiff = val.away_score - oldVal.away_score;

            justScoredStatus = val.away_team + ' just scored ' + scoreDiff + '!\n';
          } else if (val.home_score > oldVal.home_score) {
            scoreDiff = val.home_score - oldVal.home_score;

            justScoredStatus = val.home_team + ' just scored ' + scoreDiff  + '!\n';
          }
        }

        if (justScoredStatus || quarterStatus) {
          status = statusHeader;

          if (justScoredStatus && quarterStatus) {
            status += justScoredStatus + quarterStatus;
          } else if (justScoredStatus) {
            status += justScoredStatus + 'The new score is ' + scoreStr;
          } else if (quarterStatus) {
            status += quarterStatus;
          }

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
