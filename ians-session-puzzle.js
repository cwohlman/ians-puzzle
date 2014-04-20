if (Meteor.isClient) {
  Meteor.startup(function () {
    Session.set('total', Session.get('total') || 0)
  })
  Template.hello.greeting = function () {
    return "Welcome to ians-session-puzzle.";
  };

  Template.hello.events({
    'submit form': function (e, tmpl) {
      e.preventDefault();
      var val = Number($('input').val());
      $('input').val('')
      if (!val || val > 10 || val < 1) {
        alert('Invalid selection');
        return;
      }
      var total = Session.get('total')
      if (total >= 50) {
        total = 0;
      }
      total += val;
      if (total == 50) {
        $('.winner').text('Congratulations you are the winner!')
      } else {
        $('.winner').text('')
        var computerpick = (50 - total) % 11;
        if (computerpick == 0) computerpick = Math.round(Math.random() * 9 + 1);
        total += computerpick
        Session.set('computer', computerpick)
        $('.computerpick').slideDown().delay(500).slideUp(400)
      }

      Session.set('total', total);

    }
  });

  Template.hello.helpers({
    'total': function () {
      return Session.get('total');;
    },
    'goal':function () {
      return 50;
    },
    'computer': function () {
      return Session.get('computer');
    }
  })
}

if (Meteor.isServer) {
  Meteor.startup(function () {
    // code to run on server at startup
  });
}
