players = new Meteor.Collection('players')
games = new Meteor.Collection('games')

if (Meteor.isClient) {
  Meteor.subscribe('players');
  Meteor.subscribe('games');
  Template.main.helpers({
    showWelcome: function () {
      return !Session.get('user_id');
    },
    showLobby: function () {
      return Session.get('user_id') && !games.findOne();
    },
    showGame: function () {
      return games.findOne();
    }
  });
  Template.welcome.events({
    'submit form': function (e, tmpl) {
      e.preventDefault();
      var userName = tmpl.find('input').value;
      Meteor.call('signUp', userName, function (error, result) {
        Session.set('user_id', result);
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
    'button click': function (e, tmpl) {
      Meteor.call('startGame', this._id, function (error, result) {});
    }
  });
  Template.game.helpers({
    game: function () {
      return games.findOne();
    }
  });
  Template.game.events({
    'submit form': function (e, tmpl) {
      e.preventDefault();
      var val = Number(tmpl.find('input').value);
      var game_id = games.findOne()._id;
      Meteor.call('submitMove', game_id, val, function (error, result) {
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
    submitMove: function (game_id, move) {
      var current_user = Meteor.userId()
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
    },
    startGame: function (user_id) {
      var current_user = Meteor.userId();
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
      if (!user) {players.insert({
          userName: userName
        });
      }
      user = user._id || user;
      this.setUserId(user);
      return user;
    },
    getUser: function () {
      return Meteor.userId()
    }
  });
  Meteor.publish('players', function () {
    return players.find();
  });
  Meteor.publish('games', function () {
    return games.find({
      players: {
        $in: [this.userId]
      },
      total: {
        $lt: 50
      }
    })
  })
  Meteor.startup(function () {
    // code to run on server at startup
  });
}
