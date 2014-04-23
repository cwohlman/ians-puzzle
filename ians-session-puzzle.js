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

if (Meteor.isClient) {
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
  Template.welcome.events({
    'submit form': function (e, tmpl) {
      e.preventDefault();
      var userName = tmpl.find('input').value;
      Meteor.call('signUp', userName, function (error, result) {
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
      Meteor.call('startGame', Session.get('user_id'), this._id, function (error, result) {});
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
        // TODO: validation feedback.
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
        throw new Error("User is not part of this game!")
      }
      var lastMove = game.moves && game.moves[game.moves.length - 1];
      if (lastMove && lastMove.user_id == current_user) {
        throw new Error("Not your turn.")
      }
      if (move > 10 || move < 1) {
        throw new Error("Invalid move. Please pick a number from 1 to 10")
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
      var lastMove = game.moves && game.moves[game.moves.length - 1];
      if (lastMove && lastMove.user_id == psmith) {
        // Don't move, it's not our turn yet.
      } else if (lastMove) {
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
      var lastMove = game.moves && game.moves[game.moves.length - 1];
      if (lastMove && lastMove.user_id == psmith) {
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
