
//Tell the library which element to use for the table
// cards.init({table:'#card-table', type:STANDARD});
$("#card-table").hide();
$("#decide-tricks-form").hide();
console.log(sessionStorage.getItem("player_id"));
window.player_id = Number(sessionStorage.getItem("player_id"));
var websocket_addr = window.location.host.replace(/:.*/, '');
window.websocket = new WebSocket("ws://" + websocket_addr + ":6789/");
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

$(document).ready(function() {
    $(document).on('submit', '#decide-tricks-form', function() {
        console.log("in submit");
        console.log("total tricks: " + window.total_tricks);
        console.log("player id: " + window.player_id);
        console.log("dealer: " + window.dealer);
        window.n_tricks = $("#decide-form-input").val();
        console.log("n_tricks: " + n_tricks);
        console.log("n_cards: " + window.n_cards);
        if (window.player_id == window.dealer && (parseInt(n_tricks < 0) || parseInt(window.total_tricks) + parseInt(window.n_tricks) == parseInt(window.n_cards))) {
            console.log("please enter valid number of cards");
        } else {
            window.total_tricks = parseInt(window.total_tricks) + parseInt(n_tricks);
            $(".total-tricks").text(window.total_tricks);
            $("#decide-tricks-form").hide();
        }
        return false;
    });
});

window.websocket.onmessage = function (event) {
    data = JSON.parse(event.data);
    console.log("___ data info _____");
    console.log(data);
    console.log("_________");
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
                deal_order.push((window.dealer + i + 1) % window.n_players);
        }
        window.deck.deal(window.n_cards, [window.players[deal_order[0]], window.players[deal_order[1]], window.players[deal_order[2]], window.players[deal_order[3]]], 20, function() {
                //callback
        });
        window.player_deciding = (window.dealer + 1) % window.n_players;
        deck.faceUp = true;
        window.deck.render({immediate:true});
    } else if (data.type == "decide_tricks") {
        window.total_tricks = data.total_tricks;
        $(".total-tricks").text(window.total_tricks);
        if (data.player_deciding == window.player_id) {
            $("#decide-tricks-form").show();
        }
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
