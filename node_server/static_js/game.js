var host = window.document.location.host.replace(/:.*/, '');

var client = new Colyseus.Client(location.protocol.replace("http", "ws") + "//" + host + (location.port ? ':' + location.port : ''));
var room;
var players = {};
var name = "";
var hand = {};
var player_dirs = ["player_S", "player_W", "player_N", "player_E"];
var player_dirs_index = 0;
var client_player_id = 0;
var table_name = "#card-table";
var number_of_cards = 0;
function render_cards(player_id) {
    let place = players[player_id].place;
    console.log("drawing cards for: " + player_id + ", place: " + place);
    if (place == player_dirs[1]) {
        players[player_id].hand = new cards.Hand({faceUp: false, y: 280, x: -10});
        for (let i = 0; i < number_of_cards; i++) {
            let card_to_add = new cards.Card('c', i, table_name);
            players[player_id].hand.addCard(card_to_add);
        }
        players[player_id].hand.render();
    } else if (place == player_dirs[2]) {
        players[player_id].hand = new cards.Hand({faceUp: false, y: 50, x: 270});
        for (let i = 0; i < number_of_cards; i++) {
            let card_to_add = new cards.Card('c', i, table_name);
            players[player_id].hand.addCard(card_to_add);
        }
        players[player_id].hand.render();
    } else if (place == player_dirs[3]) {
        players[player_id].hand = new cards.Hand({faceUp: false, y: 280, x: 550});
        for (let i = 0; i < number_of_cards; i++) {
            let card_to_add = new cards.Card('c', i, table_name);
            players[player_id].hand.addCard(card_to_add);
        }
        players[player_id].hand.render();
    }
}
function getPlayersOnline() {
    let count = 0;
    for (let player_id of Object.keys(players)) {
        if (!player_id.startsWith("bot")) {
            count++;
        }
    }
    return count;
}
client.joinOrCreate("multi_player").then(room_instance => {
    room = room_instance;
    game_started = false;
    discardPile = new cards.Deck({faceUp:true});
    deck = new cards.Deck();
    // $("#decide-tricks-form").hide();
    console.log(Object.keys(players).length);
    // $("#decide-tricks-form").show();
    $(table_name).show();
    $(".players").text(getPlayersOnline());
    // deck.addCards([new cards.Card('s', 12, table_name)]);
    deck.y = 200;
    deck.x = 250;
    discardPile.x = deck.x + 80;
    discardPile.y = deck.y;
    // discardPile.addCards([new cards.Card('s', 12, table_name)]);
    deck.render({immediate:true});
    discardPile.render();
    // deck[0].rotate(90);
    $("#start_button").click(function () {
        console.log("start game pressed");
        $(".buttons").hide();
        if (!game_started) {
            room.send("start_game", {});
            game_started = true;
        }
    });
    room.state.players.onAdd = function (player, sessionId) {
        players[sessionId] = {};
        console.log("player added: " + sessionId + ", place: " + players[sessionId].place + ", name: " + player.name);
        if (!sessionId.startsWith("bot")) {
            $(".players").text(getPlayersOnline());
        } else {
            players[sessionId].place = player_dirs[player_dirs_index];
            players[sessionId].name = sessionId;
            player_dirs_index++;
            $("#" + players[sessionId].place).text(sessionId);
            let player_id = sessionId;
            render_cards(player_id);
        }
    }

    room.state.players.onRemove = function (player, sessionId) {
        console.log("player removed: " + sessionId);
        $("#" + players[sessionId].place).text("");
        delete players[sessionId];
        player_dirs_index--;
        $(".players").text(getPlayersOnline());
    }

    room.onMessage("broadcast_name", (message) => {
        let data_id = message.id;
        let data_name = message.name;
        players[data_id].place = player_dirs[player_dirs_index];
        player_dirs_index++;
        players[data_id].name = data_name;
        $("#" + players[data_id].place).text(data_name);
    });

    room.onMessage("ask_name", (message) => {
        let client_id = message.id;
        client_player_id = message.id;
        let player_names = message.player_names;
        let curr_players_length = Object.keys(player_names).length;
        players[client_id].place = player_dirs[player_dirs_index];
        player_dirs_index++;
        let dirs_index_temp = 0;
        for (let player_key of Object.keys(player_names)) {
            players[player_key].name = player_names[player_key];
            players[player_key].place = player_dirs[player_dirs.length - (curr_players_length - dirs_index_temp)];
            dirs_index_temp++;
            $("#" + players[player_key].place).text(players[player_key].name);
        }
        name = prompt("What is your name?");
        players[client_id].name = name;
        $("#" + players[client_id].place).text(name);
        room.send("name", { name: name });
    });
    room.onMessage("deck_shuffled", (message) => {
        console.log("message");
        console.log(message);
        $(".buttons").hide();
        game_started = true;
        var deck_cards = [];
        for (let card of message) {
            let card_number = card.substring(0, card.length - 1);
            let card_type = card[card.length - 1];
            deck_cards.push(new cards.Card(card_type, card_number, table_name));
        }
        deck.addCards(deck_cards);
        deck.render({immediate: true});
        console.log("deck");
        console.log(deck);
    });
    room.onMessage("draw_cards", (message) => {
        console.log(message);
        players[client_player_id].hand = new cards.Hand({faceUp: true, y: 410, x: 270});
        number_of_cards = message.length;
        for (let card of message) {
            let card_number = card.substring(0, card.length - 1);
            let card_type = card[card.length - 1];
            if (card_number == "K") {
                card_number = 13;
            } else if (card_number == "D") {
                card_number = 12;
            } else if (card_number == "J") {
                card_number = 11;
            }
            players[client_player_id].hand.addCard(new cards.Card(card_type, card_number, table_name));
            players[client_player_id].hand.render({});
        }
        for (let player_id of Object.keys(players)) {
            if (players[player_id].place) {
                render_cards(player_id);
            }
        }
    });

});
