var host = window.document.location.host.replace(/:.*/, '');

var client = new Colyseus.Client(location.protocol.replace("http", "ws") + "//" + host + (location.port ? ':' + location.port : ''));
var room;
var players = {};
client.joinOrCreate("multi_player").then(room_instance => {
    room = room_instance;
    game_started = false;
    discardPile = new cards.Deck({faceUp:true});
    deck = new cards.Deck();
    // $("#decide-tricks-form").hide();
    console.log(Object.keys(players).length);
    // $("#decide-tricks-form").show();
    $("#card-table").show();
    $("#player_S").text(name);
    $(".players").text(Object.keys(players).length);
    deck.addCards([new cards.Card('s', 12, "#card-table")]);
    deck.y = 200;
    deck.x = 250;
    discardPile.x = deck.x + 80;
    discardPile.y = deck.y;
    discardPile.addCards([new cards.Card('s', 12, "#card-table")]);
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
        players[sessionId] = player;
        if (!sessionId.startsWith("bot")) {
            $(".players").text(Object.keys(players).length);
        }
    }

    room.state.players.onRemove = function (player, sessionId) {

    }


    room.onMessage("ask_name", (message) => {
        var name = prompt("What is your name?");
        room.send("name", { name: name });
    });

});
