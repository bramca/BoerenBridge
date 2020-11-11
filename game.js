
//Tell the library which element to use for the table
// cards.init({table:'#card-table', type:STANDARD});
$("#card-table").hide();
console.log(sessionStorage.getItem("player_id"));
window.player_id = Number(sessionStorage.getItem("player_id"));
window.websocket = new WebSocket("ws://127.0.0.1:6789/");
var users = document.querySelector('.players');
var start = document.querySelector('.start');
window.playing_cards = [];
window.n_players = 4;
window.players = new Array(window.n_players);
window.deck = {};
window.dealer = 0;
window.n_cards = 0;
window.discardPile = new cards.Deck({faceUp:true});
window.discardPile.x += 50;
window.discardPile.y += 40;

$(".start").click(function() {              
    if (window.websocket) {
        window.websocket.send(JSON.stringify({action: 'start game', id: player_id}));
    }
});

window.websocket.onmessage = function (event) {
    data = JSON.parse(event.data);
    if (data.type == 'users') {
        users.textContent = ("user(s): " + data.count.toString());
    } else if (data.type == 'start') {
        sessionStorage.setItem('game_started', data.value);
        console.log("start game");
        $(".buttons").hide();
        $(".state").hide();
        $("#card-table").show();
	      players[window.player_id] = new cards.Hand({faceUp: true, y: 465, x: 0});
	      players[(window.player_id + 1) % window.n_players] = new cards.Hand({faceUp: false, y: 0, x: -20});
	      players[(window.player_id + 2) % window.n_players] = new cards.Hand({faceUp: false, y: 165, x: 0});
	      players[(window.player_id + 3) % window.n_players] = new cards.Hand({faceUp: false, y: 0, x: 600});
    } else if (data.type == "deck") {
        for (var i = data.value.length - 1; i >= 0; i--) {
	          var c = data.value[i].slice(0, -1);
	          if (c == "K") {
		            c = 13;
	          } else if (c == "D") {
		            c = 12;
	          } else if (c == "J") {
		            c = 11;
	          }
            window.playing_cards.push(new cards.Card(data.value[i].slice(-1), c, "#card-table"));
        }
        window.deck = new cards.Deck();
        window.deck.addCards(window.playing_cards);
        window.deck.x -= 50;
	      window.deck.y += 40;
        window.deck.render({immediate:true});
    } else if (data.type == "deal") {
	      window.dealer = data.dealer;
	      window.n_cards = data.n_cards;
	      deal_order = [];
	      for (var i = 0; i < window.n_players; i++) {
	          deal_order.push((window.dealer + i + 1) % window.window.n_players);
	      }
	      window.deck.deal(window.n_cards, [window.players[deal_order[0]], window.players[deal_order[1]], window.players[deal_order[2]], window.players[deal_order[3]]], 20, function() {
	          //callback
	      });
    } else {
        console.error("unsupported event", data);
    }
};

//When you click on the top card of a deck, a card is added
//to your hand
deck.click(function(card){
	if (card === deck.topCard()) {
		lowerhand.addCard(deck.topCard());
		lowerhand.render();
	}
});

//Finally, when you click a card in your hand, if it's
//the same suit or rank as the top card of the discard pile
//then it's added to it
lowerhand.click(function(card){
	if (card.suit == discardPile.topCard().suit
		|| card.rank == discardPile.topCard().rank) {
		discardPile.addCard(card);
		discardPile.render();
		lowerhand.render();
	}
});


//So, that should give you some idea about how to render a card game.
//Now you just need to write some logic around who can play when etc...
//Good luck :)
