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
var max_number_players = 4;
var total_tricks = 0;
var trump_hand = {};
var my_turn = false;
var cards_on_table = {};

function render_cards(player_id, face_up, type, number) {
    let place = players[player_id].place;
    console.log("drawing cards for: " + player_id + ", place: " + place + ", face_up: " + face_up);
    if (place == player_dirs[1]) {
        players[player_id].hand = new cards.Hand({faceUp: face_up, y: 280, x: -10});
        for (let i = 0; i < number_of_cards; i++) {
            let card_to_add = new cards.Card(type, number, table_name);
            players[player_id].hand.addCard(card_to_add);
        }
        players[player_id].hand.render({immediate: true});
    } else if (place == player_dirs[2]) {
        players[player_id].hand = new cards.Hand({faceUp: face_up, y: 50, x: 270});
        for (let i = 0; i < number_of_cards; i++) {
            let card_to_add = new cards.Card(type, number, table_name);
            players[player_id].hand.addCard(card_to_add);
        }
        players[player_id].hand.render({immediate: true});
    } else if (place == player_dirs[3]) {
        players[player_id].hand = new cards.Hand({faceUp: face_up, y: 280, x: 550});
        for (let i = 0; i < number_of_cards; i++) {
            let card_to_add = new cards.Card(type, number, table_name, face_up);
            players[player_id].hand.addCard(card_to_add);
        }
        players[player_id].hand.render({immediate: true});
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

function set_players_text(player_id) {
    let player_text = players[player_id].name;
    if (players[player_id].is_dealer) {
        player_text += " (D)";
    }
    if ('tricks' in players[player_id]) {
        player_text += " (tr: " + players[player_id].tricks + ")";
    }
    if ('wins' in players[player_id]) {
        player_text += " (win: " + players[player_id].wins + ")";
    }
    $("#" + players[player_id].place).text(player_text);
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
        let table = $("#score-table")[0];
        table.innerHTML = '';
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
            players[sessionId].tricks = 0;
            players[sessionId].wins = 0;
            player_dirs_index++;
            set_players_text(sessionId);
            let player_id = sessionId;
            render_cards(player_id, false, 'c', 1);
        }
    }

    room.state.players.onRemove = function (player, sessionId) {
        console.log("player removed: " + sessionId);
        set_players_text(sessionId);
        delete players[sessionId];
        player_dirs_index--;
        $(".players").text(getPlayersOnline());
    }

    room.onMessage("broadcast_name", (message) => {
        let data_id = message.id;
        let data_name = message.name;
        if (!players[data_id].place) {
            players[data_id].place = player_dirs[player_dirs_index];
            player_dirs_index++;
        }
        players[data_id].name = data_name;
        set_players_text(data_id);
    });

    room.onMessage("ask_name", (message) => {
        let client_id = message.id;
        client_player_id = message.id;
        let player_names = message.player_names;
        console.log(player_names);
        let curr_players_length = Object.keys(player_names).length;
        players[client_id].place = player_dirs[player_dirs_index];
        player_dirs_index++;
        let dirs_index_temp = 0;
        for (let player_key of Object.keys(player_names)) {
            players[player_key].name = player_names[player_key];
            players[player_key].place = player_dirs[player_dirs.length - (curr_players_length - dirs_index_temp)];
            dirs_index_temp++;
            set_players_text(player_key);
        }
        let name = prompt("What is your name?");
        players[client_id].name = name;
        set_players_text(client_id);
        room.send("name", { name: name });
    });

    room.onMessage("broadcast_winner", (message) => {
        let id = message.id;
        players[id].wins = message.wins;
        alert(players[id].name + " wins the round!");
        set_players_text(id);
        for (let player_id of Object.keys(players)) {
            if (player_id != id) {
                set_players_text(player_id);
            }
        }
        let cards_to_remove = [];
        for (let c of cards_on_table) {
            c.el.remove();
            cards_to_remove.push(c);
        }
        for (let c of cards_to_remove) {
            cards_on_table.removeCard(c);
        }
        if (message.next_round) {
            room.send("start_next_round", {});
        }
    });

    room.onMessage("broadcast_scores", (message) => {
        console.log(message.scores);
        let scores = message.scores;
        let table = $("#score-table")[0];
        table.innerHTML = '';
        let cols = ["Name", "Score"];
        let row = document.createElement("tr");
        for (let i = 0; i < cols.length; i++) {
            let cell = document.createElement("td");
            cell.innerHTML = cols[i];
            row.appendChild(cell);
        }
        table.appendChild(row);
        // insert data
        for (let [key, value] of Object.entries(scores)) {
            row = document.createElement("tr");
            let cell_name = document.createElement("td");
            let cell_score = document.createElement("td");
            cell_name.innerHTML = players[key].name;
            cell_score.innerHTML = value;
            row.appendChild(cell_name);
            row.appendChild(cell_score);
            table.appendChild(row);
        }
        room.send("start_new_game", {});
    });

    room.onMessage("deck_shuffled", (message) => {
        console.log("message");
        console.log(message);
        $(".card").remove();
        deck = new cards.Deck();
        deck.y = 200;
        deck.x = 250;
        $(".buttons").hide();
        game_started = true;
        var deck_cards = [];
        for (let card of message) {
            let card_number = card.substring(0, card.length - 1);
            let card_type = card[card.length - 1];
            deck_cards.push(new cards.Card(card_type, card_number, table_name));
        }
        for (let player_id of Object.keys(players)) {
            players[player_id].tricks = 0;
            players[player_id].wins = 0;
            players[player_id].is_dealer = false;
            set_players_text(player_id);
        }
        deck.addCards(deck_cards);
        deck.render({immediate: true});
        console.log("deck");
        console.log(deck);
    });

    room.onMessage("draw_one_card", (message) => {
        console.log(message);
        number_of_cards = 1;
        for (let player_key of Object.keys(message)) {
            let card = message[player_key][0];
            let card_number = card.substring(0, card.length - 1);
            let card_type = card[card.length - 1];
            if (card_number == "K") {
                card_number = 13;
            } else if (card_number == "D") {
                card_number = 12;
            } else if (card_number == "J") {
                card_number = 11;
            }
            if (player_key != client_player_id) {
                render_cards(player_key, true, card_type, card_number);
            } else {
                players[client_player_id].hand = new cards.Hand({faceUp: false, y: 410, x: 270});
                players[client_player_id].hand.addCard(new cards.Card(card_type, card_number, table_name));
                players[client_player_id].hand.render({});
            }
        }
        room.send("start_decide_tricks", {});
    });

    room.onMessage("end_game", (message) => {
        $(".buttons").show();
        game_started = false;
    });

    room.onMessage("draw_cards", (message) => {
        console.log(message);
        number_of_cards = message.length;
        players[client_player_id].hand = new cards.Hand({faceUp: true, y: 410, x: 270});
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
            if (players[player_id].place && player_id != client_player_id) {
                render_cards(player_id, false, 'c', 1);
            }
        }
        console.log("players (after draw): ");
        for (let player_id of Object.keys(players)) {
            console.log(players[player_id].hand);
        }
        room.send("start_decide_tricks", {});
    });

    room.onMessage("broadcast_card_played", (message) => {
        let id = message.id;
        let card = message.card;
        let card_number = card.substring(0, card.length - 1);
        let card_type = card[card.length - 1];
        if (card_number == "K") {
            card_number = 13;
        } else if (card_number == "D") {
            card_number = 12;
        } else if (card_number == "J") {
            card_number = 11;
        }
        console.log("received broadcast_card_played from " + id + " with card " + card);
        players[id].hand.topCard().el.remove();
        players[id].hand.removeCard(players[id].hand.topCard());
        let card_obj = new cards.Card(card_type, card_number, table_name);
        players[id].hand.addCard(card_obj);
        players[id].hand.render({immediate: true});
        cards_on_table.addCard(players[id].hand.topCard());
        // players[id].hand.topCard().el.remove();
        // players[id].hand.removeCard(players[id].hand.topCard());
        cards_on_table.render({});
        players[id].hand.render({});
    });

    room.onMessage("play_card", (message) => {
        console.log("received play_card " + message.id);
        my_turn = true;
        $(".card").click(function(ev) {
            let card = $(this).data('card');
            let card_number = card.rank;
            if (card_number == 13) {
                card_number = "K";
            } else if (card_number == 12) {
                card_number = "D";
            } else if (card_number == 11) {
                card_number = "J";
            }
            let has_suit = false;
            if (cards_on_table.length > 0) {
                for (let c of players[message.id].hand) {
                    if (c.suit == cards_on_table[0].suit) {
                        has_suit = true;
                    }
                }
            }
            if (card.container == players[message.id].hand && my_turn) {
                console.log("card clicked");
                console.log(card);
                console.log("first card on table");
                console.log(cards_on_table[0]);
                console.log("trump card");
                console.log(trumphand.topCard());
                if (!has_suit) {
                    cards_on_table.addCard(card);
                    cards_on_table.render({});
                    my_turn = false;
                    room.send("card_played", { 'card': (card_number + card.suit) });
                } else if (card.suit == cards_on_table[0].suit) {
                    cards_on_table.addCard(card);
                    cards_on_table.render({});
                    my_turn = false;
                    room.send("card_played", { 'card': (card_number + card.suit) });
                }
            }
        });
    });

    room.onMessage("trump_card", (message) => {
        console.log("received trump_card: " + message);
        let card_number = message.substring(0, message.length - 1);
        let card_type = message[message.length - 1];
        if (card_number == "K") {
            card_number = 13;
        } else if (card_number == "D") {
            card_number = 12;
        } else if (card_number == "J") {
            card_number = 11;
        }
        trumphand = new cards.Hand({faceUp: true, y: deck.y, x: deck.x});
        trumphand.addCard(new cards.Card(card_type, card_number, table_name));
        trumphand.render({immediate: true});
        cards_on_table = new cards.Hand({faceUp: true, y: deck.y, x: deck.x + 100});
    });

    room.onMessage("dealer", (message) => {
        console.log("received message dealer: " + message);
        players[message].is_dealer = true;
        set_players_text(message);
    });

    room.onMessage("decide_tricks", (message) => {
        let client_id = message.id;
        trumphand.render({immediate: true});
        console.log("received decide_tricks: " + message.id + ", total_tricks: " + message.total_tricks);
        $(".total-tricks").text(message.total_tricks);
        total_tricks = message.total_tricks;
        let n_tricks = prompt("Decide your number of tricks?");
        while (n_tricks == null || isNaN(n_tricks) || n_tricks == '') {
            n_tricks = prompt("Decide your number of tricks?");
        }
        n_tricks = parseInt(n_tricks);
        if (message.is_dealer) {
            while ((total_tricks + n_tricks) == number_of_cards) {
                n_tricks = prompt("Decide your number of tricks?");
            }
        }
        players[client_id].tricks = n_tricks;
        set_players_text(client_id);
        room.send("player_tricks_decided", { "n_tricks": n_tricks });
    });

    room.onMessage("tricks_decided", (message) => {
        console.log("received tricks_decided: id " + message.id + ", n_tricks: " + message.n_tricks);
        players[message.id].tricks = message.n_tricks;
        $(".total-tricks").text(message.total_tricks);
        total_tricks = message.total_tricks;
        set_players_text(message.id);
    });
});
