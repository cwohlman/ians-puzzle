players = new Meteor.Collection('players')
games = new Meteor.Collection('games')
rules = new Meteor.Collection('rules');


currentGame = function (collection) {
  collection = collection || games;
  return collection.findOne({
    active: true
  });
}

var currentRule = function (collection) {
  collection = collection || rules;
  var game = currentGame();

  return game && collection.findOne({
    _id: game.rule_id
  }) || collection.findOne({name: "Ian's Puzzle"});;
}

 notMyTurn = function (game, player_id) {
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

var allowedMovesToString = function (moves) {
  // moves is an array
  var result = [];
  var first;
  var last;
  moves.forEach(function (a) {
    // TODO: sort the array, watchout: default sort is alpha numeric
    a = Number(a)
    if ((last + 1) == a) last = a;
    else {
      if (first || first === 0) {
        if (first == last) result.push(last + "");
        else {
          result.push(first + '..' + last);
        }        
      }

      first = a;
      last = a;
    }
  });
  if (first || first === 0) {
    if (first == last) result.push(last + "");
    else {
      result.push(first + '..' + last);
    }        
  }
  return result.join(",");
}

if (Meteor.isClient) {
  Deps.autorun(function () {
    var game = currentGame();
    var rule = currentRule();
    var me = Session.get('user_id');
     if (game && game.total >= rule.goal) {
      var lastMove = game.moves[game.moves.length - 1];
      if (notMyTurn(game, me)) {
        handleMessage(null, "You win!");
      } else {
        var playerName = players.findOne({_id: lastMove.user_id}).userName;
        handleMessage(playerName + " wins :(");
      }
    } else if (game && !notMyTurn(game, me) && game.moves) {
      var lastMove = game.moves[game.moves.length - 1];
      var playerName = players.findOne({_id: lastMove.user_id}).userName;
      var move = lastMove.move;
      handleMessage(null, playerName + " played " + move);
    }
  })
  Meteor.subscribe('players');
  Meteor.subscribe('rules');
  if (Session.get('user_id')) Meteor.subscribe('games', Session.get('user_id'));
  Template.main.helpers({
    showWelcome: function () {
      return !Session.get('user_id');
    },
    showLobbies: function () {
      return !Session.get('rule_id') && !currentGame(); // -1 is the holder for 'any'
    },
    showLobby: function () {
      return Session.get('user_id') && Session.get('rule_id') && !currentGame();
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
  Template.welcome.rendered = function () {
    this.find('input').focus();
  };
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
  Template.heroContent.helpers({
    gameName: function () {
      var rule = currentRule();
      if (rule) return rule.name;
      else return "Ian's Game";
    },
    gameDescription: function () {
      var rule = currentRule();
      if (currentGame()) {
        return rule.description;
      } else {
        return "Where you can play some fun puzzles against men or machines."
      }
    },
    gameRules: function () {
      var rule = currentRule();
      if (currentGame()) {
        return "Pick a number (" + allowedMovesToString(rule.allowedMoves) + "), try to pick the final number adding up to " + rule.goal; 
      }
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
      Meteor.call('startGame', Session.get('user_id'), this._id, Session.get('rule_id'), function (error, result) {
        handleMessage(error);
      });
    }
  });
  Template.lobbies.helpers({
    lobbies: function () {
      return rules.find();
    }
  });
  Template.lobbies.events({
    'click .well': function () {
      Session.set('rule_id', this._id)
    }
  });
  Template.game.rendered = function () {
    this.find('input').focus();
  };
  Template.game.helpers({
    game: currentGame,
    done: function () {
      var game =  currentGame();
      var rule = currentRule();
      return game && game.total >= rule.goal
    }
  });
  Template.game.events({
    'submit form': function (e, tmpl) {
      e.preventDefault();
      var game = currentGame();
      var rule = currentRule();
      if (game.total >= rule.goal) {
        // Game is over, user want's  to go back to lobby
        Meteor.call('gameOver', Session.get('user_id'), game._id, function (error, result) {});
      } else {
        var val = Number(tmpl.find('input').value);
        tmpl.find('input').value = "";
        Meteor.call('submitMove', Session.get('user_id'), game._id, val, function (error, result) {
          handleMessage(error);
        });
      }
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
      var rule = rules.findOne({
        _id: game.rule_id
      }) || rules.findOne({
        name: "Ian's Puzzle"
      });
      if (rule.allowedMoves.indexOf(move) < 0) {
        throw new Meteor.Error(500, "Invalid move. Please pick a valid number: " + allowedMovesToString(rule.allowedMoves), {})
      }
      var newMove = {
        user_id: current_user,
        move: move
      };
      var total = game.total;
      if (total == rule.goal) {
        throw new Meteor.Error(500, 'Game is already over!');
      }
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
    startGame: function (current_user, user_id, rule_id) {
      return games.insert({
        rule_id: rule_id,
        players: [
          current_user,
          user_id
        ],
        total: 0,
        active: true
      })
    },
    gameOver: function (current_user, game_id) {
      var game = games.findOne({_id: game_id});
      if (!game) {
        throw new Meteor.Error(500, 'Game not found!');
      }
      if (game.players.indexOf(current_user) == -1) {
        throw new Meteor.Error(500, 'Not your game');
      }
      games.update({_id: game_id}, {active: {
        $set: false
      }});
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
  Meteor.publish('rules', function () {
    return  rules.find();
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
      }
    }).fetch();
    psmithsGames.forEach(function (game) {
      var rule = rules.findOne({
        _id: game.rule_id
      });
      if (notMyTurn(game, psmith)) {
        // Don't move, it's not our turn yet.
      } else if  (!rule || game.total >= rule.goal) {
        // Don't move, game is over.
      } else if (game.moves) {
        // We don't move on the first move, we want to give the player the chance to go first.
        var total = game.total;
        var first = Number(rule.allowedMoves[0]);
        var last = Number(rule.allowedMoves[rule.allowedMoves.length - 1]);
        var computerpick = (rule.goal - total) % (first + last);
        if (rule.allowedMoves.indexOf(computerpick) == -1) {
          computerpick = rule.allowedMoves[Math.round(Math.random() * (rule.allowedMoves.length - 1))]
        }
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
      }
    }).fetch();
    psmithsGames.forEach(function (game) {
      var rule = rules.findOne({
        _id: game.rule_id
      });
      if (notMyTurn(game, psmith)) {
        // Don't move, it's not our turn yet.
      } else if  (!rule || game.total >= rule.goal) {
        // Don't move, game is over.
      } else if (game.moves) {
        // We don't move on the first move, we want to give the player the chance to go first.
        var total = game.total;
        // Freddie tries to look ahead and pick the path of most likely win
        var moveMap = rule.allowedMoves.map(function (moveA) {
          // Freddies next move
          return {
            move: moveA,
            successRate: rule.allowedMoves.map(function (moveB) {
              return rule.allowedMoves.map(function (moveC) {
                return ((total + moveA + moveB + moveC) >= rule.goal && (total + moveA + moveB) < rule.goal) || total + moveA >= rule.goal
              }).indexOf(true) != -1;
            }).filter(function (a) {return a;}).length
          };
        }).sort(function (a, b) {
          return b.successRate - a.successRate;
        });
        computerpick = moveMap[0].move;
        if (moveMap[0].successRate < rules.length / 2) {
          computerpick = rule.allowedMoves[Math.round(Math.random() * (rule.allowedMoves.length - 1))]
        }
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
    if (!rules.find().count()) {
      rules.insert({
        name: "Ian's Puzzle",
        description: "The brain teaser Ian uses to quiz developers",
        allowedMoves: [1,2,3,4,5,6,7,8,9,10],
        goal: 50,
        playerCount: 2
      });
      rules.insert({
        name: "Pennies",
        description: "A classic version of this game often played with pennies or small stones.",
        allowedMoves: [1,2],
        goal: 21,
        playerCount: 2
      });
      rules.insert({
        name: "Backstab",
        description: "Three players gives this game an interesting twist.",
        allowedMoves: [1,2,3,4,5],
        goal: 43,
        playerCount: 3
      });
      rules.insert({
        name: "Party Time",
        description: "Try this as your next birthday party crowd pleaser?",
        allowedMoves: [1,2,3,4,5],
        goal: 30,
        playerCount: 6
      });
      rules.insert({
        name: "Long stick",
        description: "Just a little different from Ian's puzzle, you can't pick small numbers.",
        allowedMoves: [8,9,10],
        goal: 52,
        playerCount: 2
      });
      rules.insert({
        name: "Marshy",
        description: "Your choices are very limited, and it's a short race too.",
        allowedMoves: [3,8,10],
        goal: 55,
        playerCount: 2
      });
    }
  });
}
