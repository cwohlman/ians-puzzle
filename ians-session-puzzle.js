users = new Meteor.Collection('players')
games = new Meteor.Collection('games')

if (Meteor.isClient) {
  Template.main.helpers({
    showWelcome: function () {
      return !Session.get('user_id');
    },
    showLoby: function () {
      return Session.get('user_id') && !Session.get('game_id');
    },
    showGame: function () {
      return Session.get('game_id');
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
      // TODO!
    },
    startGame: function (user_id) {
      var current_user = this.userId()

    },
    signUp: function (userName) {
      var user = users.findOne({
        userName: userName
      })
      if (!user) {users.insert({
          userName: userName
        });
      }
      user = user._id || user;
      return user;
    },
    getUser: function () {
      return Meteor.userId()
    }
  })
  Meteor.startup(function () {
    // code to run on server at startup
  });
}
