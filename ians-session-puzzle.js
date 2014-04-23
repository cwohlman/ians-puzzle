players = new Meteor.Collection('players')
games = new Meteor.Collection('games')

var currentGame = function (collection) {
  collection = collection || games;
  return collection.findOne({
    //active: true
    total: {
      $lt: 50
    }
  });
}

var notMyTurn = function (game, player_id) {
  var lastMove = game.moves && game.moves[game.moves.length - 1];
  return lastMove && lastMove.user_id == player_id;
}

var handleMessage = function (error, success) {
  var message = error || success;
  var alertClass = error ? "alert-error" : "alert-success";
  var text = message && (message.reason || message.message || message);

  Session.set('latest-message', text);
  Session.set('message-class', alertClass);

  if (message) {
    $('.notify').fadeIn().delay(2000).fadeOut();
  }
}


if (Meteor.isClient) {
Deps.autorun(function () {
  var game = currentGame();
  var me = Session.get('user_id');
  if (game && !notMyTurn(game, me) && game.moves) {
    var lastMove = game.moves[game.moves.length - 1];
    var playerName = players.findOne({_id: lastMove.user_id}).userName;
    var move = lastMove.move;
    handleMessage(null, playerName + " played " + move);
  } else if (game && game.total >= 50) {
    var lastMove = game.moves[game.moves.length - 1];
    var playerName = players.findOne({_id: lastMove.user_id}).userName;
    if (notMyTurn(game, me)) handleMessage(null, "You win!");
    else handleMessage(playerName + " wins :(");
  }
})
  Meteor.subscribe('players');
  if (Session.get('user_id')) Meteor.subscribe('games', Session.get('user_id'));
  Template.main.helpers({
    showWelcome: function () {
      return !Session.get('user_id');
    },
    showLobby: function () {
      return Session.get('user_id') && !currentGame();
    },
    showGame: currentGame
  });
  Template.messages.helpers({
    messageText: function () {
      return Session.get('latest-message');
    },
    alertClass: function () {
      return Session.get('message-class');
    }
  });
  Template.welcome.events({
    'submit form': function (e, tmpl) {
      e.preventDefault();
      var userName = tmpl.find('input').value;
      Meteor.call('signUp', userName, function (error, result) {
        handleMessage(error);
        Session.set('user_id', result);
        Meteor.subscribe('games', result);
      });
    }
  });
  Template.lobby.helpers({
    availablePlayers: function () {
      return players.find({
        _id: {
          $not: Session.get('user_id')
        }
      }).fetch();
    }
  });
  Template.lobby.events({
    'click button': function (e, tmpl) {
      Meteor.call('startGame', Session.get('user_id'), this._id, function (error, result) {
        handleMessage(error);
      });
    }
  });
  Template.game.helpers({
    game: currentGame
  });
  Template.game.events({
    'submit form': function (e, tmpl) {
      e.preventDefault();
      var val = Number(tmpl.find('input').value);
      tmpl.find('input').value = "";
      var game_id = currentGame()._id;
      Meteor.call('submitMove', Session.get('user_id'), game_id, val, function (error, result) {
        handleMessage(error);
      });
    }
  });
}

if (Meteor.isServer) {
  Meteor.publish('currentUser')
  Meteor.methods({
    // Returns a game object {
    //  players: [],
    //  moves: [],
    //  total: 0
    // }
    submitMove: function (current_user, game_id, move) {
      var game = games.findOne({
        _id: game_id
      });
      var user_index = game.players.indexOf(current_user);
      if (user_index == -1) {
        throw new Meteor.Error(500, "User is not part of this game!", {});
      }
      if (notMyTurn(game, current_user)) {
        throw new Meteor.Error(500, "Not your turn.", {})
      }
      if (move > 10 || move < 1) {
        throw new Meteor.Error(500, "Invalid move. Please pick a number from 1 to 10", {})
      }
      var newMove = {
        user_id: current_user,
        move: move
      };
      var total = game.total;
      total += move;
      game.moves = game.moves || []
      game.moves.push(newMove);
      games.update({
        _id: game_id
      },{
        $set: {
          moves: game.moves,
          total: total
        }
      });
      return game;
    },
    startGame: function (current_user, user_id) {;
      return games.insert({
        players: [
          current_user,
          user_id
        ],
        total: 0
      })
    },
    signUp: function (userName) {
      var user = players.findOne({
        userName: userName
      })
      if (!user) {
        user = players.insert({
          userName: userName
        });
      }
      user = user._id || user;
      return user;
    }
  });
  Meteor.publish('players', function () {
    return players.find();
  });
  Meteor.publish('games', function (current_user) {
    return games.find({
      players: {
        $in: [current_user]
      }
    })
  });
  // Psmith AI
  Meteor.setInterval(function () {
    var psmith = players.findOne({
      userName: 'Psmith'
    })._id;
    var psmithsGames = games.find({
      players: {
        $in: [psmith]
      },
      total: {
        $lt: 50
      }
    }).fetch();
    psmithsGames.forEach(function (game) {
      if (notMyTurn(game, psmith)) {
        // Don't move, it's not our turn yet.
      } else if (game.moves) {
        // We don't move on the first move, we want to give the player the chance to go first.
        var total = game.total;
        var computerpick = (50 - total) % 11;
        if (computerpick == 0) computerpick = Math.round(Math.random() * 9 + 1);
        Meteor.call('submitMove', psmith, game._id, computerpick, function (error, result) {
          console.log(error)
        });
      }
    });
  }, 500);
  // Freddy AI
  Meteor.setInterval(function () {
    var psmith = players.findOne({
      userName: 'Freddy'
    })._id;
    var psmithsGames = games.find({
      players: {
        $in: [psmith]
      },
      total: {
        $lt: 50
      }
    }).fetch();
    psmithsGames.forEach(function (game) {
      if (notMyTurn(game, psmith)) {
        // Don't move, it's not our turn yet.
      } else {
        // Freddy tries to go first, but won't always win
        var total = game.total;
        var computerpick = (50 - total) % 11;
        if (computerpick == 0) computerpick = Math.round(Math.random() * 9 + 1);
        if (total < 40) computerpick += Math.round(Math.random() * 2 - 1)
        Meteor.call('submitMove', psmith, game._id, computerpick, function (error, result) {
          console.log(error)
        });
      }
    });
  }, 500);
  Meteor.startup(function () {
    // code to run on server at startup
    if (!players.find().count()) {
      // Run on first run
      // Add computer players
      players.insert({
        userName: 'Psmith'
      });
      players.insert({
        userName: 'Freddy'
      });
    }
  });
}
